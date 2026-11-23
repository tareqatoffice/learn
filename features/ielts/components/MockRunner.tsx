"use client";

import { Circle, Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { type ActionResult, firstError } from "@/features/admin/result";
import { confirm } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { Kind } from "@/features/ielts/speaking/questions";
import type { StartPartInput } from "@/features/ielts/speaking/attempts";
import { KIND_PARTS, P2_MARK_SEC, P2_PREP_SEC, P2_TALK_SEC, PART_CAP_SEC, PART_SOFT_SEC, type Part } from "@/features/ielts/speaking/timing";
import { useExaminer } from "@/features/ielts/lib/useExaminer";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { UploadError, uploadTake } from "@/features/recording/lib/uploadTake";
import { type RecorderResult, useRecorder } from "@/features/recording/lib/useRecorder";
import { PartTimer } from "./PartTimer";
import { Card } from "@/components/Card";

type Marker = { atSec: number; label: string };

export type MockQuestions = {
  part1?: { frames: { title: string; questions: string[] }[] };
  part2?: { cue: { topic: string; bullets: string[]; explain: string; roundOff: string[] } };
  part3?: { questions: string[] };
};

export type MockActions = {
  startPart(
    attemptId: string,
    input: StartPartInput,
  ): Promise<ActionResult<{ uploadUrl: string; audioUploadUrl?: string; maxBytes: number }>>;
  confirmPart(attemptId: string, part: Part, input: { durationSec: number; markers: Marker[] }): Promise<ActionResult>;
  transcribePart(attemptId: string, part: Part): Promise<ActionResult<{ transcript: string }>>;
  finishAttempt(
    attemptId: string,
    input: { notes?: string; paused: boolean },
  ): Promise<ActionResult<{ status: "inProgress" | "complete" | "incomplete" }>>;
};

type Prompt = { label: string; heading?: string; text: string; say: string };
type Started = { uploadUrl: string; audioUploadUrl?: string; maxBytes: number; at: number; main: boolean; audio: boolean };
type Take = { result: RecorderResult; markers: Marker[]; started?: Started };
type Upload = { status: "sending" | "failed" | "saved"; error?: string };
type Stage = "ready" | "prep" | "live" | "between" | "finishing";

const REUSE_MS = 8 * 60 * 1000;
const MB = 1024 * 1024;
const NAME: Record<Part, string> = { p1: "Part 1", p2: "Part 2", p3: "Part 3" };
const LEAVE_PROMPT = "You have recordings that haven't saved. Leave anyway?";
const GUARD_KEY = "ieltsLeaveGuard";

const PREP_INTRO =
  "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.";
const TALK_START = "All right? Remember you have one to two minutes for this. Start speaking now.";
const P3_INTRO = "Now I'd like to ask you some more general questions related to this topic.";
const THE_END = "Thank you. That is the end of the speaking test.";

function promptsFor(part: Part, q: MockQuestions, mock: boolean): Prompt[] {
  if (part === "p1") {
    const list = (q.part1?.frames ?? []).flatMap((f) =>
      f.questions.map((text, i) => ({ heading: f.title, text, say: i === 0 ? `Let's talk about ${f.title}. ${text}` : text })),
    );
    return list.map((p, i) => ({ ...p, label: `Q${i + 1}` }));
  }
  if (part === "p3") {
    return (q.part3?.questions ?? []).map((text, i) => ({
      label: `Q${i + 1}`,
      text,
      say: i === 0 && mock ? `${P3_INTRO} ${text}` : text,
    }));
  }
  return [];
}

const hasContent = (part: Part, q: MockQuestions) =>
  part === "p2" ? !!q.part2 : promptsFor(part, q, false).length > 0;

export function MockRunner({
  attemptId,
  kind,
  questions,
  video,
  examinerVoice,
  actions,
}: {
  attemptId: string;
  kind: Kind;
  questions: MockQuestions;
  video: boolean;
  examinerVoice: boolean;
  actions: MockActions;
}) {
  const router = useRouter();
  const [voice, setVoice] = useState(examinerVoice);
  const [headphones, setHeadphones] = useState(false);
  const examiner = useExaminer({ enabled: voice });
  const mock = kind === "mock";
  const parts = KIND_PARTS[kind].filter((p) => hasContent(p, questions));
  const prompts: Record<Part, Prompt[]> = {
    p1: promptsFor("p1", questions, mock),
    p2: [],
    p3: promptsFor("p3", questions, mock),
  };
  const cue = questions.part2?.cue;
  const roundOff = cue?.roundOff.find((r) => r.trim());

  const recKind = video ? "video" : "audio";
  const recs: Record<Part, ReturnType<typeof useRecorder>> = {
    p1: useRecorder({ kind: recKind, capSec: PART_CAP_SEC.p1 }),
    p2: useRecorder({ kind: recKind, capSec: PART_CAP_SEC.p2 }),
    p3: useRecorder({ kind: recKind, capSec: PART_CAP_SEC.p3 }),
  };

  const [stage, setStage] = useState<Stage>("ready");
  const [part, setPart] = useState<Part>(parts[0] ?? "p1");
  const [promptIdx, setPromptIdx] = useState(0);
  const [stopped, setStopped] = useState<{ part: Part; reason: "paused" | "stopped" } | null>(null);
  const [paused, setPaused] = useState(false);
  const [notes, setNotes] = useState("");
  const [uploads, setUploads] = useState<Partial<Record<Part, Upload>>>({});
  const [finishError, setFinishError] = useState("");
  const [prep, setPrep] = useState({ endsAt: 0, now: 0, pausedLeftMs: null as number | null });

  const takes = useRef(new Map<Part, Take>());
  const sending = useRef(new Set<Part>());
  const handled = useRef(new Map<Part, RecorderResult>());
  const markers = useRef<Marker[]>([]);
  const ending = useRef(false);
  const pausing = useRef(false);
  const roundOffAsked = useRef(false);
  const finishing = useRef(false);
  const prepTimers = useRef<{ end?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});
  const previewRef = useRef<HTMLVideoElement>(null);

  const rec = recs[part];
  const nextOf = (p: Part): Part | null => parts[parts.indexOf(p) + 1] ?? null;

  const clearPrepTimers = () => {
    clearTimeout(prepTimers.current.end);
    clearInterval(prepTimers.current.tick);
    prepTimers.current = {};
  };
  useEffect(() => clearPrepTimers, []);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = rec.stream;
  }, [rec.stream]);


  async function send(p: Part) {
    const take = takes.current.get(p);
    if (!take || sending.current.has(p)) return;
    sending.current.add(p);
    const set = (u: Upload) => setUploads((all) => ({ ...all, [p]: u }));
    const fail = (error: string) => set({ status: "failed", error });
    const { result } = take;
    set({ status: "sending" });
    try {
      if (result.mime.startsWith("video/") && !result.audioBlob) {
        return fail(`${NAME[p]}'s audio track didn't record, so it can't be saved.`);
      }
      let s = take.started;
      if (s && Date.now() - s.at > REUSE_MS) s = take.started = undefined;
      if (!s) {
        const res = await actions.startPart(attemptId, {
          part: p,
          kind: result.mime.startsWith("video/") ? "video" : "audio",
          mime: result.mime,
          audioMime: result.audioMime,
          size: result.blob.size,
          audioSize: result.audioBlob?.size,
        });
        if (!res.ok) return fail(firstError(res.errors) ?? `Couldn't save ${NAME[p]}. Try again.`);
        s = take.started = {
          uploadUrl: res.uploadUrl,
          audioUploadUrl: res.audioUploadUrl,
          maxBytes: res.maxBytes,
          at: Date.now(),
          main: false,
          audio: false,
        };
      }
      if (result.blob.size > s.maxBytes) {
        return fail(`${NAME[p]} is larger than the ${Math.floor(s.maxBytes / MB)} MB limit, so it can't be saved.`);
      }
      if (!s.main) {
        await uploadTake(s.uploadUrl, result.blob, result.mime);
        s.main = true;
      }
      if (s.audioUploadUrl && result.audioBlob && !s.audio) {
        await uploadTake(s.audioUploadUrl, result.audioBlob, result.audioMime!);
        s.audio = true;
      }
      const confirmed = await actions.confirmPart(attemptId, p, { durationSec: result.durationSec, markers: take.markers });
      if (!confirmed.ok) {
        take.started = undefined;
        return fail(firstError(confirmed.errors) ?? `Couldn't save ${NAME[p]}. Try again.`);
      }
      takes.current.delete(p);
      set({ status: "saved" });
      void actions.transcribePart(attemptId, p).catch(() => undefined);
    } catch (e) {
      fail(e instanceof UploadError ? e.message : `Couldn't save ${NAME[p]}. Check your connection and try again.`);
    } finally {
      sending.current.delete(p);
    }
  }


  function record(p: Part) {
    const first = prompts[p][0];
    markers.current = first ? [{ atSec: 0, label: first.label }] : [];
    ending.current = false;
    pausing.current = false;
    roundOffAsked.current = false;
    setPart(p);
    setPromptIdx(0);
    setStopped(null);
    setStage("live");
    void recs[p].start();
    void examiner.speak(p === "p2" ? TALK_START : (first?.say ?? ""));
  }

  function runPrep(leftMs: number) {
    clearPrepTimers();
    const now = Date.now();
    setPrep({ endsAt: now + leftMs, now, pausedLeftMs: null });
    prepTimers.current.tick = setInterval(() => setPrep((s) => ({ ...s, now: Date.now() })), 250);
    prepTimers.current.end = setTimeout(talk, leftMs);
  }

  function talk() {
    clearPrepTimers();
    record("p2");
  }

  function enter(p: Part) {
    if (p !== "p2") return record(p);
    setPart("p2");
    setStopped(null);
    setStage("prep");
    runPrep(P2_PREP_SEC * 1000);
    if (cue) void examiner.speak(`${PREP_INTRO} ${cue.topic}`);
  }

  function finish() {
    setStopped(null);
    setStage("finishing");
    if (mock) void examiner.speak(THE_END);
  }

  function endPart() {
    ending.current = true;
    rec.stop();
  }

  function pause() {
    setPaused(true);
    if (stage === "prep") {
      const left = Math.max(0, prep.endsAt - Date.now());
      clearPrepTimers();
      setPrep((s) => ({ ...s, pausedLeftMs: left }));
      return;
    }
    pausing.current = true;
    rec.stop();
  }

  function nextQuestion() {
    const i = promptIdx + 1;
    const q = prompts[part][i];
    if (!q) return;
    markers.current.push({ atSec: rec.elapsedSec, label: q.label });
    setPromptIdx(i);
    void examiner.speak(q.say);
  }

  const onPartEnded = useEffectEvent((p: Part, result: RecorderResult) => {
    takes.current.set(p, { result, markers: [...markers.current] });
    void send(p);
    const next = nextOf(p);
    if (ending.current) {
      ending.current = false;
      if (next) enter(next);
      else finish();
      return;
    }
    setStopped({ part: p, reason: pausing.current ? "paused" : "stopped" });
    pausing.current = false;
    setStage("between");
  });
  const r1 = recs.p1.result;
  const r2 = recs.p2.result;
  const r3 = recs.p3.result;
  useEffect(() => {
    for (const [p, r] of [["p1", r1], ["p2", r2], ["p3", r3]] as const) {
      if (r && handled.current.get(p) !== r) {
        handled.current.set(p, r);
        onPartEnded(p, r);
      }
    }
  }, [r1, r2, r3]);

  const p2 = recs.p2;
  const talkOver = stage === "live" && part === "p2" && p2.state === "recording" && p2.elapsedSec >= P2_TALK_SEC;
  const onTalkOver = useEffectEvent(() => {
    if (roundOffAsked.current) return;
    if (!roundOff) return endPart();
    roundOffAsked.current = true;
    markers.current.push({ atSec: p2.elapsedSec, label: "Round-off" });
    void examiner.speak(`Thank you. ${roundOff}`);
  });
  useEffect(() => {
    if (talkOver) onTalkOver();
  }, [talkOver]);

  const onHidden = useEffectEvent(() => {
    if (document.visibilityState !== "hidden") return;
    if (stage === "prep" && prep.pausedLeftMs === null) pause();
    else if (stage === "live") {
      setPaused(true);
      pausing.current = true;
    }
  });
  useEffect(() => {
    const listener = () => onHidden();
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);


  async function complete() {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const res = await actions.finishAttempt(attemptId, { ...(notes.trim() ? { notes: notes.trim() } : {}), paused });
      if (!res.ok) {
        finishing.current = false;
        return setFinishError(firstError(res.errors) ?? "Couldn't finish the test. Try again.");
      }
      router.push(`/ielts/speaking/${attemptId}/review`);
    } catch {
      finishing.current = false;
      setFinishError("Couldn't finish the test. Check your connection and try again.");
    }
  }

  const allSaved = Object.values(uploads).every((u) => u?.status === "saved");
  const onReadyToFinish = useEffectEvent(() => void complete());
  useEffect(() => {
    if (stage !== "finishing" || !allSaved) return;
    const t = setTimeout(onReadyToFinish, 0);
    return () => clearTimeout(t);
  }, [stage, allSaved]);

  async function finishWithout() {
    const failed = (Object.keys(uploads) as Part[]).filter((p) => uploads[p]?.status === "failed");
    const names = failed.map((p) => NAME[p]).join(" and ");
    const many = failed.length > 1;
    if (
      !(await confirm({
        description: `${names} ${many ? "haven't" : "hasn't"} saved. Finish without ${many ? "them" : "it"}?`,
        destructive: true,
      }))
    ) {
      return;
    }
    for (const p of failed) takes.current.delete(p);
    setUploads((all) => Object.fromEntries(Object.entries(all).filter(([p]) => !failed.includes(p as Part))));
  }

  const unsent = stage === "live" || Object.values(uploads).some((u) => u && u.status !== "saved");
  useEffect(() => {
    if (!unsent) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  useLeaveGuard(unsent, LEAVE_PROMPT, GUARD_KEY);


  if (parts.length === 0) return <Notice>This practice has no questions. Start a new one.</Notice>;

  const voiceOff = voice && (!examiner.supported || examiner.failed);
  const needHeadphones = voice && examiner.supported && !examiner.failed;
  const notStarted = rec.state === "error" || rec.state === "idle";
  const prompt = prompts[part][promptIdx];
  const recording = rec.state === "recording";
  const prepLeftSec = Math.ceil((prep.pausedLeftMs ?? Math.max(0, prep.endsAt - prep.now)) / 1000);
  const savedList = parts.filter((p) => uploads[p]);
  const hasFailed = savedList.some((p) => uploads[p]?.status === "failed");

  return (
    <div className="grid gap-4">
      {voiceOff && (
        <Notice tone="info">
          The examiner&apos;s voice isn&apos;t available on this device, so read each question on screen.
        </Notice>
      )}

      {stage === "ready" && (
        <Card as="section" className="grid gap-4">
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {parts.includes("p1") && <li>Part 1: short questions about you, for 4 to 5 minutes.</li>}
            {parts.includes("p2") && <li>Part 2: one minute to prepare a topic, then talk for up to 2 minutes.</li>}
            {parts.includes("p3") && <li>Part 3: a discussion of broader questions, for 4 to 5 minutes.</li>}
          </ul>
          <p className="text-sm">
            {needHeadphones ? "The examiner reads each question aloud. " : "Read each question on screen. "}
            {parts[0] === "p2" ? "Preparation starts when you tap Start." : "Recording starts when you tap Start."}
          </p>
          {needHeadphones && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} className="size-4" />
                I&apos;m wearing headphones
              </label>
              <p className="text-xs text-muted-foreground">
                The examiner&apos;s voice plays while you record, so wear headphones or the microphone picks it up.
              </p>
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setVoice(false)}>
                Read questions on screen instead
              </Button>
            </div>
          )}
          <Button size="lg" className="w-full sm:w-auto" disabled={needHeadphones && !headphones} onClick={() => enter(parts[0])}>
            <Circle className="fill-current text-destructive" /> {mock ? "Start the test" : "Start"}
          </Button>
        </Card>
      )}

      {stage === "prep" && cue && (
        <Card as="section" aria-label="Part 2 preparation" className="grid gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">Part 2: prepare</h2>
          <CueCard cue={cue} />
          <PartTimer label="Preparation" elapsedSec={P2_PREP_SEC - prepLeftSec} totalSec={P2_PREP_SEC} countdown />
          <label className="grid gap-1.5 text-sm">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={5}
              className="rounded-lg border border-input bg-background p-3 text-base"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {prep.pausedLeftMs === null ? (
              <>
                <Button size="lg" className="flex-1 sm:flex-none" onClick={talk}>
                  Start talking now
                </Button>
                <Button variant="outline" size="lg" onClick={pause}>
                  <Pause /> Pause
                </Button>
              </>
            ) : (
              <Button size="lg" className="flex-1 sm:flex-none" onClick={() => runPrep(prep.pausedLeftMs ?? 0)}>
                <Play /> Resume
              </Button>
            )}
          </div>
        </Card>
      )}

      {stage === "live" && (
        <Card as="section" aria-label={NAME[part]} className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{NAME[part]}</h2>
            {recording && (
              <span className="flex items-center gap-2 text-sm text-destructive">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                <span>Recording</span>
              </span>
            )}
            {rec.state === "asking" && <span className="text-sm text-muted-foreground">Allow the microphone to start…</span>}
          </div>

          {part === "p2" && cue ? (
            <>
              <CueCard cue={cue} />
              {notes.trim() && (
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Your notes</p>
                  <p className="whitespace-pre-line text-sm">{notes}</p>
                </div>
              )}
              {roundOff && p2.elapsedSec >= P2_TALK_SEC && <p className="text-lg leading-snug">{roundOff}</p>}
            </>
          ) : (
            prompt && (
              <div className="grid gap-1">
                {prompt.heading && <p className="text-xs text-muted-foreground">{prompt.heading}</p>}
                <p className="text-lg leading-snug">{prompt.text}</p>
              </div>
            )
          )}

          {video && recording && (
            <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full max-w-md -scale-x-100 rounded-lg bg-black" />
          )}

          {part === "p2" ? (
            <PartTimer label="Talk" elapsedSec={rec.elapsedSec} totalSec={P2_TALK_SEC} markSec={P2_MARK_SEC} />
          ) : (
            <PartTimer label={NAME[part]} elapsedSec={rec.elapsedSec} totalSec={PART_SOFT_SEC} />
          )}
          {part === "p2" && rec.elapsedSec >= P2_MARK_SEC && rec.elapsedSec < P2_TALK_SEC && (
            <Notice tone="info">One minute. Keep going until the examiner stops you.</Notice>
          )}
          {part !== "p2" && rec.elapsedSec >= PART_SOFT_SEC && (
            <Notice tone="info">Time to move on. Finish your answer and end this part when you&apos;re ready.</Notice>
          )}

          {notStarted ? (
            <div className="grid gap-3">
              <Notice>{rec.error || `Recording didn't start. Tap below to start ${NAME[part]} again.`}</Notice>
              <Button size="lg" onClick={() => record(part)}>
                <Circle className="fill-current text-destructive" /> Start {NAME[part]} again
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {part !== "p2" && prompts[part][promptIdx + 1] && (
                <Button size="lg" className="flex-1 sm:flex-none" onClick={nextQuestion} disabled={!recording}>
                  Next question
                </Button>
              )}
              <Button variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={endPart} disabled={!recording}>
                <Square /> End {NAME[part]}
              </Button>
              <Button variant="ghost" size="lg" onClick={pause} disabled={!recording}>
                <Pause /> Pause
              </Button>
            </div>
          )}
        </Card>
      )}

      {stage === "between" && stopped && (
        <Card as="section" className="grid gap-3">
          <p className="text-sm">
            {stopped.reason === "paused" ? `Paused. ${NAME[stopped.part]} is kept up to here.` : `${NAME[stopped.part]} stopped. What was recorded is kept.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {nextOf(stopped.part) && (
              <Button size="lg" className="flex-1 sm:flex-none" onClick={() => enter(nextOf(stopped.part)!)}>
                <Play /> Continue to {NAME[nextOf(stopped.part)!]}
              </Button>
            )}
            <Button variant={nextOf(stopped.part) ? "outline" : "default"} size="lg" onClick={finish}>
              {nextOf(stopped.part) ? "Finish now" : "Finish"}
            </Button>
          </div>
        </Card>
      )}

      {stage === "finishing" && (
        <Card as="section" className="grid gap-3" role="status">
          <p className="text-sm">
            {hasFailed ? "Some parts haven't saved yet." : finishError ? "" : "Saving your recordings…"}
          </p>
          {finishError && (
            <div className="grid gap-3">
              <Notice>{finishError}</Notice>
              <Button
                onClick={() => {
                  setFinishError("");
                  void complete();
                }}
              >
                Finish again
              </Button>
            </div>
          )}
          {hasFailed && (
            <Button variant="outline" onClick={finishWithout}>
              Finish without them
            </Button>
          )}
        </Card>
      )}

      {savedList.length > 0 && (
        <section aria-label="Uploads" className="grid gap-2">
          {savedList.map((p) => {
            const u = uploads[p]!;
            return (
              <div key={p} className="grid gap-2 rounded-lg border border-border p-3 text-sm">
                {u.status === "saved" && <span className="text-muted-foreground">{NAME[p]} saved</span>}
                {u.status === "sending" && <span className="text-muted-foreground">{NAME[p]} uploading…</span>}
                {u.status === "failed" && (
                  <>
                    <Notice>{u.error}</Notice>
                    <p className="text-xs text-muted-foreground">{NAME[p]} is kept on this page until it saves.</p>
                    <Button size="sm" className="justify-self-start" onClick={() => void send(p)}>
                      Try again
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function CueCard({ cue }: { cue: NonNullable<MockQuestions["part2"]>["cue"] }) {
  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 p-4">
      <p className="text-lg font-semibold leading-snug">{cue.topic}</p>
      {cue.bullets.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">You should say:</p>
          <ul className="list-disc pl-5 text-base">
            {cue.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </>
      )}
      {cue.explain && <p className="text-base">{cue.explain}</p>}
    </div>
  );
}
