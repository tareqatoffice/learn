import Link from "next/link";
import { chipClass } from "@/components/Chip";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { Card as TrackCard, ProgressRows } from "@/components/TrackCard";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { PROFILE_TABS, TAB_LABEL, type ProfileData, type ProfileTab } from "@/profile/data";

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

function Card(props: Omit<React.ComponentProps<typeof TrackCard>, "heading">) {
  return <TrackCard heading="h2" {...props} />;
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card title="Notes">
          <Stat label="Chapters read" value={`${d.notes.read}/${d.notes.total}`} />
        </Card>
        <Card title="Interview">
          <Stat label="Questions mastered" value={`${d.interview.mastered}/${d.interview.total}`} hint={`${d.interview.quizzes} quizzes finished`} />
        </Card>
        <Card title="Graphs">
          <Stat label="Topics done" value={`${d.graphs.done}/${d.graphs.total}`} />
        </Card>
        <Card title="Speaking">
          <Stat label="Takes recorded" value={d.speaking.takes} />
        </Card>
        <Card title="IELTS">
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

function NotesTab({ d }: { d: ProfileData["notes"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Series progress">
        <ProgressRows
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
      <Card title="Books mastered">
        <ProgressRows
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
      <Card title="Graph progress">
        <ProgressRows
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
      <Card title="Takes by task">
        {d.byTask.length ? (
          <ul className="grid gap-1 text-sm">
            {d.byTask.map((t) => (
              <li key={t.task} className="flex justify-between">
                <span>{t.task}</span>
                <span className="tabular-nums text-muted-foreground">{t.count}</span>
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
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar host; next/image would need a remote pattern
            <img src={d.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{(d.name.trim()[0] ?? "?").toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className={cn("truncate", pageTitleClass)}>{d.name}</h1>
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
