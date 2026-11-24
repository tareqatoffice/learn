import Image from "next/image";
import Link from "next/link";
import { chipClass } from "@/components/Chip";
import { areaLabel, formatDuration } from "@/features/focus/context";
import { ActivityHeatmap } from "@/features/profile/components/ActivityHeatmap";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { Panel as Card } from "@/components/Panel";
import { ProgressBar } from "@/components/ProgressBar";
import { trackVar, type TrackName } from "@/components/track";
import { ProgressRows } from "@/features/profile/components/TrackCard";
import { pageTitleBase } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { PROFILE_TABS, TAB_LABEL, type ProfileData, type ProfileTab } from "@/features/profile/data";
import type { FocusArea } from "@/models/focusConstants";

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

function Stat({
  label,
  value,
  hint,
  bar,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  bar?: { value: number; max: number; track: TrackName };
}) {
  return (
    <div className="grid gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {bar && <ProgressBar value={bar.value} max={bar.max} color={trackVar(bar.track)} />}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function History({ rows, empty }: { rows: { key: string; main: React.ReactNode; meta: string }[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate">{r.main}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.meta}</span>
        </li>
      ))}
    </ul>
  );
}

const focusColor = (area: FocusArea) => (area === "general" ? "var(--primary)" : trackVar(area));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const KIND: Record<string, string> = { mock: "Full mock", part1: "Part 1 drill", part2: "Part 2 drill", part3: "Part 3 drill" };
const AREA: Record<string, string> = { speaking: "Speaking", listening: "Listening", reading: "Reading", writing: "Writing" };
const BAND_KEYS = [
  ["listening", "L"],
  ["reading", "R"],
  ["writing", "W"],
  ["speaking", "S"],
] as const;
const SOURCE: Record<string, string> = { official: "Official", practice: "Practice test (entered)", practiceTest: "Practice test", mockSelf: "Mock (self)", mockAi: "Mock (AI)", writingSelf: "Writing (self)", writingAi: "Writing (AI)", other: "Other" };

function Overview({ d }: { d: ProfileData }) {
  return (
    <div className="grid gap-4">
      <Card title="Activity">
        <ActivityHeatmap days={d.activity} />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Focus">
          <Stat
            label="Time focused"
            value={d.focus.sessions ? formatDuration(d.focus.totalSeconds) : "0m"}
            hint={`${plural(d.focus.sessions, "session")} · ${formatDuration(d.focus.weekSeconds)} this week`}
          />
        </Card>
        <Card title="Notes" track="notes">
          <Stat label="Chapters read" value={`${d.notes.read}/${d.notes.total}`} bar={{ value: d.notes.read, max: d.notes.total, track: "notes" }} />
        </Card>
        <Card title="Interview" track="interview">
          <Stat
            label="Questions mastered"
            value={`${d.interview.mastered}/${d.interview.total}`}
            bar={{ value: d.interview.mastered, max: d.interview.total, track: "interview" }}
            hint={`${d.interview.quizzes} quizzes finished`}
          />
        </Card>
        <Card title="Graphs" track="graphs">
          <Stat label="Topics done" value={`${d.graphs.done}/${d.graphs.total}`} bar={{ value: d.graphs.done, max: d.graphs.total, track: "graphs" }} />
        </Card>
        <Card title="Speaking" track="speaking">
          <Stat label="Takes recorded" value={d.speaking.takes} />
        </Card>
        <Card title="IELTS" track="ielts">
          <Stat
            label="Practice done"
            value={d.ielts.speaking.completed + d.ielts.tests + d.ielts.writing}
            hint={`${d.ielts.speaking.completed} speaking · ${d.ielts.tests} listening/reading · ${d.ielts.writing} writing`}
          />
        </Card>
      </div>
    </div>
  );
}

function FocusTab({ d }: { d: ProfileData["focus"] }) {
  const most = Math.max(0, ...d.byArea.map((a) => a.seconds));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Time by area">
        {d.byArea.length ? (
          <div className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              {formatDuration(d.totalSeconds)} in {plural(d.sessions, "session")} · {formatDuration(d.weekSeconds)} in the last 7 days
            </p>
            <ul className="grid gap-2 text-sm">
              {d.byArea.map((a) => (
                <li key={a.area} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span>{areaLabel(a.area)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatDuration(a.seconds)} · {plural(a.sessions, "session")}
                  </span>
                  <ProgressBar value={a.seconds} max={most} color={focusColor(a.area)} className="col-span-2" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty>No focus sessions yet. Start one with the focus timer on any page.</Empty>
        )}
        <Link href="/focus/review" className={`mt-4 inline-block text-sm font-medium underline ${linkClass}`}>
          Weekly review and plan
        </Link>
      </Card>
      <Card title="Recent sessions">
        <History
          empty="No focus sessions yet."
          rows={d.history.map((f) => ({
            key: f.id,
            main: (
              <Link href={f.path} className={linkClass}>
                {f.label} <span className="text-muted-foreground">· {areaLabel(f.area)}</span>
              </Link>
            ),
            meta: [
              formatDuration(f.seconds),
              ...(f.targetMinutes ? [f.completed ? `${f.targetMinutes}m goal met` : `of ${f.targetMinutes}m`] : []),
              fmt(f.date),
            ].join(" · "),
          }))}
        />
      </Card>
    </div>
  );
}

function NotesTab({ d }: { d: ProfileData["notes"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Series progress" track="notes">
        <ProgressRows
          track="notes"
          empty="No note series yet."
          rows={d.series.map((s) => ({ key: s.slug, href: `/notes/${s.slug}`, label: s.title, value: s.read, max: s.total }))}
        />
      </Card>
      <Card title="Recently read">
        <History
          empty="No chapters marked read yet."
          rows={d.history.map((h) => ({
            key: `${h.seriesSlug}/${h.chapterSlug}`,
            main: (
              <Link href={`/notes/${h.seriesSlug}/${h.chapterSlug}`} className={linkClass}>
                {h.chapter} <span className="text-muted-foreground">· {h.series}</span>
              </Link>
            ),
            meta: fmt(h.date),
          }))}
        />
      </Card>
    </div>
  );
}

function InterviewTab({ d }: { d: ProfileData["interview"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Books mastered" track="interview">
        <ProgressRows
          track="interview"
          empty="No question books yet."
          rows={d.books.map((b) => ({ key: b.slug, href: `/interview/${b.slug}`, label: b.title, value: b.mastered, max: b.total }))}
        />
      </Card>
      <Card title="Recent quizzes">
        <History
          empty="No quizzes yet."
          rows={d.history.map((q) => ({
            key: q.id,
            main: (
              <Link href={`/interview/history/${q.id}`} className={linkClass}>
                {q.label}
                {!q.finished && <span className="text-muted-foreground"> · in progress</span>}
              </Link>
            ),
            meta: `${q.got} got · ${q.review} review · ${fmt(q.date)}`,
          }))}
        />
      </Card>
    </div>
  );
}

function GraphsTab({ d }: { d: ProfileData["graphs"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Graph progress" track="graphs">
        <ProgressRows
          track="graphs"
          empty="No graphs yet."
          rows={d.graphs.map((g) => ({ key: g.slug, href: `/graphs/${g.slug}`, label: g.title, value: g.done, max: g.total }))}
        />
      </Card>
      <Card title="Recently finished topics">
        <History
          empty="No topics marked done yet."
          rows={d.history.map((h) => ({
            key: `${h.graphSlug}/${h.topicSlug}`,
            main: (
              <Link href={`/graphs/${h.graphSlug}?topic=${encodeURIComponent(h.topicSlug)}`} className={linkClass}>
                {h.topic} <span className="text-muted-foreground">· {h.graph}</span>
              </Link>
            ),
            meta: fmt(h.date),
          }))}
        />
      </Card>
    </div>
  );
}

function SpeakingTab({ d }: { d: ProfileData["speaking"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Takes by task" track="speaking">
        {d.byTask.length ? (
          <ul className="grid gap-2 text-sm">
            {d.byTask.map((t, _i, all) => (
              <li key={t.task} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span>{t.task}</span>
                <span className="tabular-nums text-muted-foreground">{t.count}</span>
                <ProgressBar
                  value={t.count}
                  max={Math.max(...all.map((x) => x.count))}
                  color={trackVar("speaking")}
                  className="col-span-2"
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No takes recorded yet.</Empty>
        )}
      </Card>
      <Card title="Recent takes">
        <History empty="No takes recorded yet." rows={d.history.map((t) => ({ key: t.id, main: t.task, meta: fmt(t.date) }))} />
      </Card>
    </div>
  );
}

function IeltsTab({ d }: { d: ProfileData["ielts"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Band history">
        <History
          empty="No band results logged yet."
          rows={d.bands.map((b, i) => {
            const skills = BAND_KEYS.flatMap(([k, short]) => (b.bands[k] !== undefined ? [`${short} ${b.bands[k]}`] : []));
            return {
              key: `${b.date}-${i}`,
              main: SOURCE[b.source] ?? b.source,
              meta: [...skills, ...(b.overall !== undefined ? [`Overall ${b.overall}`] : []), fmt(b.date)].join(" · "),
            };
          })}
        />
      </Card>
      <Card title="Recent practice">
        <p className="text-xs text-muted-foreground">
          {d.speaking.attempts} speaking · {d.tests} listening/reading · {d.writing} writing · {d.studyMinutes} min logged study
        </p>
        <History
          empty="No IELTS practice yet."
          rows={d.history.map((a) => ({
            key: `${a.area}-${a.id}`,
            main: (
              <Link href={a.href} className={linkClass}>
                {AREA[a.area]} · {KIND[a.kind] ?? a.kind}
                {!a.done && <span className="text-muted-foreground"> · not finished</span>}
              </Link>
            ),
            meta: `${a.band !== undefined ? `Band ${a.band} · ` : ""}${fmt(a.date)}`,
          }))}
        />
      </Card>
    </div>
  );
}

function Panel({ tab, d }: { tab: ProfileTab; d: ProfileData }) {
  switch (tab) {
    case "focus":
      return <FocusTab d={d.focus} />;
    case "notes":
      return <NotesTab d={d.notes} />;
    case "interview":
      return <InterviewTab d={d.interview} />;
    case "graphs":
      return <GraphsTab d={d.graphs} />;
    case "speaking":
      return <SpeakingTab d={d.speaking} />;
    case "ielts":
      return <IeltsTab d={d.ielts} />;
    default:
      return <Overview d={d} />;
  }
}

export function Profile({
  d,
  tab,
  timeZone,
}: {
  d: ProfileData;
  tab: ProfileTab;
  timeZone: string;
}) {
  return (
    <div className="grid gap-6">
      <TimeZoneCookie current={timeZone} />
      <header className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xl font-semibold">
          {d.image ? (
            <Image src={d.image} alt="" width={56} height={56} referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{(d.name.trim()[0] ?? "?").toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className={cn("truncate", pageTitleBase)}>{d.name}</h1>
          <p className="text-sm text-muted-foreground">
            {d.joined ? `Joined ${fmt(d.joined)}` : "Member"}
            {d.streak > 0 && ` · ${d.streak}-day activity streak`}
          </p>
        </div>
      </header>

      <nav aria-label="Profile sections" className="flex flex-wrap gap-2">
        {PROFILE_TABS.map((t) => (
          <Link
            key={t}
            href={t === "overview" ? "/profile" : `/profile?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={chipClass(t === tab, "shrink-0")}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      <Panel tab={tab} d={d} />
    </div>
  );
}
