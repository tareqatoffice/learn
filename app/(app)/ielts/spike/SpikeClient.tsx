"use client";

import { useEffect, useRef, useState } from "react";
import { confirmTakeAction, deleteTakeAction, startTakeAction, transcribeTakeAction } from "@/app/(app)/speaking/actions";
import { useRecorder } from "@/lib/useRecorder";
import { grabFrames } from "@/lib/media";
import { uploadTake } from "@/lib/uploadTake";
import { spikePlaybackAction, spikeSttShapeAction } from "./actions";

const btn = "rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export function SpikeClient() {
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l, `[${new Date().toISOString().slice(11, 19)}] ${line}`]);
  const [capSec, setCapSec] = useState(300);
  const [kind, setKind] = useState<"audio" | "video">("video");
  const rec = useRecorder({ kind, capSec });
  const [takeId, setTakeId] = useState("");
  const [playUrl, setPlayUrl] = useState("");
  const [localUrl, setLocalUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const handled = useRef<unknown>(null);

  const [env, setEnv] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () =>
        setEnv(
          `[env] ${navigator.userAgent} | secure=${window.isSecureContext} | MediaRecorder=${typeof MediaRecorder} | speechSynthesis=${"speechSynthesis" in window}`,
        ),
      0,
    );
    return () => clearTimeout(t);
  }, []);

  // Report the finished recording once.
  useEffect(() => {
    const r = rec.result;
    if (!r || handled.current === r) return;
    handled.current = r;
    setLog((l) => [
      ...l,
      `recorded: main mime=${r.mime} size=${r.blob.size}B (${(r.blob.size / 1e6).toFixed(2)} MB) dur=${r.durationSec}s; audio mime=${r.audioMime ?? "-"} size=${r.audioBlob?.size ?? "-"}B`,
    ]);
    setLocalUrl(URL.createObjectURL(r.blob));
  }, [rec.result]);

  // (a) speechSynthesis while recording audio from the same tap
  async function speakWhileRecording() {
    if (!("speechSynthesis" in window)) return add("(a) FAIL speechSynthesis missing");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return add(`(a) FAIL getUserMedia: ${(e as Error).name}`);
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const t0 = Date.now();
    let lastChunk = 0;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        lastChunk = Date.now() - t0;
      }
    };
    const ended = new Promise<void>((r) => (mr.onstop = () => r()));
    let trackEnded = false;
    stream.getTracks().forEach((t) => t.addEventListener("ended", () => (trackEnded = true)));
    mr.start(500);
    const u = new SpeechSynthesisUtterance("Good morning. Let's talk about your hometown. Where are you from?");
    const spoke = new Promise<string>((resolve) => {
      u.onend = () => resolve("ended");
      u.onerror = (e) => resolve(`error:${(e as SpeechSynthesisErrorEvent).error}`);
      setTimeout(() => resolve("timeout-15s"), 15000);
    });
    speechSynthesis.speak(u);
    const outcome = await spoke;
    const stateAfter = mr.state;
    await new Promise((r) => setTimeout(r, 1500)); // keep recording briefly after speech
    mr.stop();
    await ended;
    stream.getTracks().forEach((t) => t.stop());
    const total = chunks.reduce((n, c) => n + c.size, 0);
    add(
      `(a) speech=${outcome}; recorder state right after speech=${stateAfter}; trackEnded=${trackEnded}; chunks=${chunks.length}; bytes=${total}; last chunk at ${lastChunk}ms; mime=${mr.mimeType}`,
    );
    add(
      `(a) VERDICT: recording ${stateAfter === "recording" && total > 0 && !trackEnded ? "KEPT WORKING" : "BROKE"} while speaking`,
    );
  }

  // (d) upload via the existing Speaking path
  async function upload() {
    const r = rec.result;
    if (!r) return add("(d) nothing recorded yet");
    const k = r.audioBlob ? "video" : "audio";
    add(`(d) startTakeAction kind=${k} size=${r.blob.size} audioSize=${r.audioBlob?.size ?? "-"}`);
    const started = await startTakeAction({
      task: "recordReview",
      date: new Date().toISOString().slice(0, 10),
      lessonId: null,
      material: { title: "IELTS spike", prompt: "spike", generated: false },
      kind: k,
      mime: r.mime,
      audioMime: r.audioMime,
      size: r.blob.size,
      audioSize: r.audioBlob?.size,
    });
    if (!started.ok) return add(`(d) FAIL startTake: ${JSON.stringify(started.errors)}`);
    const { takeId: id, uploadUrl, audioUploadUrl } = started;
    setTakeId(id);
    try {
      const t = Date.now();
      await uploadTake(uploadUrl, r.blob, r.mime);
      if (audioUploadUrl && r.audioBlob && r.audioMime) await uploadTake(audioUploadUrl, r.audioBlob, r.audioMime);
      add(`(d) upload OK in ${Date.now() - t}ms (R2 CORS fine if no error here)`);
    } catch (e) {
      return add(`(d) FAIL upload (likely R2 CORS or network): ${(e as Error).message}`);
    }
    const c = await confirmTakeAction(id, r.durationSec);
    add(`(d) confirmTake: ${c.ok ? "OK" : JSON.stringify(c.errors)}`);
  }

  // (e) playback from presigned GET
  async function playback() {
    if (!takeId) return add("(e) upload first");
    const p = await spikePlaybackAction(takeId);
    if (!p.ok) return add(`(e) FAIL ${p.error}`);
    setPlayUrl(p.mediaUrl);
    add(`(e) presigned GET ready, mime=${p.mime}. Press play in the player below and report whether it plays.`);
  }

  // (c) grab 4 frames from the local blob
  async function frames() {
    const el = videoRef.current;
    if (!el || !localUrl) return add("(c) record video first");
    try {
      const t = Date.now();
      const f = await grabFrames(el, 4);
      add(`(c) grabFrames: ${f.length} frames in ${Date.now() - t}ms; sizes(chars)=${f.map((x) => x.length).join(",")}; first starts ${f[0]?.slice(0, 22)}`);
    } catch (e) {
      add(`(c) FAIL ${(e as Error).message}`);
    }
  }

  // (f) STT
  async function stt() {
    if (!takeId) return add("(f) upload first");
    const t = Date.now();
    const shape = await spikeSttShapeAction(takeId);
    add(`(f) raw Whisper shape (${Date.now() - t}ms): ${JSON.stringify(shape, null, 1)}`);
    const r = await transcribeTakeAction(takeId);
    add(`(f) transcribeTakeAction: ${r.ok ? `OK text="${r.transcript.slice(0, 120)}"` : JSON.stringify(r.errors)}`);
  }

  async function cleanup() {
    if (!takeId) return;
    const r = await deleteTakeAction(takeId);
    add(`cleanup: delete take ${r.ok ? "OK" : JSON.stringify(r.errors)}`);
    setTakeId("");
  }

  const text = [env, ...log].filter(Boolean).join("\n");
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">IELTS phone spike (temporary)</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label>
          kind{" "}
          <select className="border border-border bg-background p-1" value={kind} onChange={(e) => setKind(e.target.value as "audio" | "video")}>
            <option value="video">video (front camera + audio)</option>
            <option value="audio">audio</option>
          </select>
        </label>
        <label>
          cap s{" "}
          <input className="w-20 border border-border bg-background p-1" type="number" value={capSec} onChange={(e) => setCapSec(Number(e.target.value) || 300)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={speakWhileRecording}>(a) speak while recording</button>
        <button className={btn} onClick={() => rec.start()} disabled={rec.state === "recording" || rec.state === "asking"}>(b) start recording</button>
        <button className={btn} onClick={() => rec.stop()} disabled={rec.state !== "recording"}>stop</button>
        <button className={btn} onClick={frames}>(c) grab 4 frames</button>
        <button className={btn} onClick={upload}>(d) upload</button>
        <button className={btn} onClick={playback}>(e) playback</button>
        <button className={btn} onClick={stt}>(f) transcribe</button>
        <button className={btn} onClick={cleanup}>delete spike take</button>
      </div>
      <p className="text-sm">recorder: {rec.state} {rec.elapsedSec}s {rec.error}</p>
      {rec.stream && (
        <video
          className="w-48"
          muted
          autoPlay
          playsInline
          ref={(el) => {
            if (el && el.srcObject !== rec.stream) el.srcObject = rec.stream;
          }}
        />
      )}
      {localUrl && <video ref={videoRef} src={localUrl} className="hidden" playsInline muted preload="auto" />}
      {playUrl && (
        <video
          src={playUrl}
          controls
          playsInline
          className="w-full"
          onError={() => add("(e) playback element error")}
          onPlaying={() => add("(e) playback playing")}
        />
      )}
      <div>
        <button
          className={btn}
          onClick={() =>
            navigator.clipboard?.writeText(text).then(
              () => add("copied"),
              () => add("copy blocked: select the text manually"),
            )
          }
        >
          Copy results
        </button>
        <textarea
          readOnly
          className="mt-2 h-96 w-full border border-border bg-background p-2 font-mono text-xs"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </main>
  );
}
