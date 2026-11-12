import { LineChart, type LineSeries } from "@/components/charts/LineChart";
import { shortDate } from "@/components/ielts/format";
import { CRITERION_LABEL, type Criterion } from "@/ielts/bands";
import type { BandPoint, CriteriaPoint, WeekMinutes } from "@/ielts/history";

const Empty = ({ children }: { children: string }) => <p className="text-sm text-muted-foreground">{children}</p>;

const Figure = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <figure className="grid gap-2 rounded-xl border border-border bg-card p-4">
    <figcaption className="text-sm font-medium">{title}</figcaption>
    {children}
  </figure>
);

type BandRow = Partial<BandPoint> & { date: string };

const own = (sources: BandPoint["source"][], pick: (p: BandPoint) => number | undefined) => (p: BandRow) =>
  p.source && sources.includes(p.source) ? pick(p as BandPoint) : undefined;
const SELF_SOURCES: BandPoint["source"][] = ["practice", "other"];

const BAND_SERIES: LineSeries<BandRow>[] = [
  { key: "overall", label: "Overall (practice)", color: "var(--chart-1)", pick: own(SELF_SOURCES, (p) => p.overall) },
  { key: "official", label: "Overall (official)", color: "var(--chart-1)", dotsOnly: true, pick: own(["official"], (p) => p.overall) },
  { key: "listening", label: "Listening", color: "var(--chart-2)", pick: own(SELF_SOURCES, (p) => p.listening) },
  { key: "reading", label: "Reading", color: "var(--chart-3)", pick: own(SELF_SOURCES, (p) => p.reading) },
  { key: "writing", label: "Writing", color: "var(--chart-4)", pick: own(SELF_SOURCES, (p) => p.writing) },
  { key: "speaking", label: "Speaking (practice)", color: "var(--chart-5)", pick: own(SELF_SOURCES, (p) => p.speaking) },
  { key: "mockSelf", label: "Speaking (mock, you)", color: "var(--chart-5)", pick: own(["mockSelf"], (p) => p.speaking) },
  { key: "mockAi", label: "Speaking (mock, AI estimate)", color: "var(--chart-5)", dash: "4 3", pick: own(["mockAi"], (p) => p.speaking) },
];

const CRITERION_COLOR: Record<Criterion, string> = {
  fluency: "var(--chart-1)",
  lexical: "var(--chart-2)",
  grammar: "var(--chart-3)",
  pronunciation: "var(--chart-4)",
};
const CRITERION_SERIES: LineSeries<CriteriaPoint>[] = (Object.keys(CRITERION_LABEL) as Criterion[]).flatMap((c) => [
  { key: `self-${c}`, label: `${CRITERION_LABEL[c]} (you)`, color: CRITERION_COLOR[c], pick: (p: CriteriaPoint) => p.self[c] },
  {
    key: `ai-${c}`,
    // The AI hears no audio, so its pronunciation band comes from the transcript alone.
    label: c === "pronunciation" ? `${CRITERION_LABEL[c]} (AI estimate, transcript only)` : `${CRITERION_LABEL[c]} (AI estimate)`,
    color: CRITERION_COLOR[c], dash: "4 3", pick: (p: CriteriaPoint) => p.ai?.[c] },
]);

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** Bands over time, mock criteria and weekly minutes against the plan. */
export function BandCharts({
  bands,
  criteria,
  weeks,
  target,
  testDate,
}: {
  bands: BandPoint[];
  criteria: CriteriaPoint[];
  weeks: WeekMinutes[];
  target?: number;
  testDate?: string;
}) {
  // The test date is a point on the axis of its own when it is still ahead of the last entry.
  const last = bands[bands.length - 1]?.date;
  const withTest: BandRow[] = testDate && last && testDate > last ? [...bands, { date: testDate }] : bands;
  const values = bands.flatMap((b) => [b.overall, b.listening, b.reading, b.writing, b.speaking]).filter((v): v is number => typeof v === "number");
  const lo = Math.min(4, Math.floor(Math.min(...values, 4)));
  const hi = 9;

  const weekPoints = weeks.map((w) => ({ date: w.weekStart, target: sum(w.target), done: sum(w.done) }));
  const maxMin = Math.max(60, ...weekPoints.flatMap((w) => [w.target, w.done]));
  const top = Math.ceil(maxMin / 60) * 60;

  return (
    <div className="grid gap-4">
      <Figure title="Bands over time">
        {bands.length === 0 ? (
          <Empty>Save a calculator result or finish a mock and your bands show up here.</Empty>
        ) : (
          <LineChart
            points={withTest}
            series={BAND_SERIES}
            yDomain={[lo, hi]}
            xLabel={(p) => shortDate(p.date)}
            refLines={target ? [{ y: target, label: `Target ${target.toFixed(1)}` }] : []}
            refX={testDate && withTest.length > bands.length ? { index: withTest.length - 1, label: "Test" } : undefined}
            ariaLabel="Bands over time with the target and the test date"
          />
        )}
      </Figure>
      <Figure title="Speaking mocks by criterion">
        {criteria.length === 0 ? (
          <Empty>Finish a full Speaking mock and rate yourself to see criteria here. Drills are not included.</Empty>
        ) : (
          <LineChart
            points={criteria}
            series={CRITERION_SERIES}
            yDomain={[1, 9]}
            xLabel={(p) => shortDate(p.date)}
            ariaLabel="Speaking mock bands per criterion, you and AI estimate"
          />
        )}
      </Figure>
      <Figure title="Minutes against plan, per week">
        {weekPoints.length === 0 ? (
          <Empty>Your weekly minutes show up here once your plan has started.</Empty>
        ) : (
          <LineChart
            points={weekPoints}
            series={[
              { key: "done", label: "Done", color: "var(--chart-2)", pick: (p) => p.done },
              { key: "target", label: "Plan target", color: "var(--chart-1)", dash: "4 3", pick: (p) => p.target },
            ]}
            yDomain={[0, top]}
            yTicks={[0, top / 2, top]}
            xLabel={(p) => `Week of ${shortDate(p.date)}`}
            ariaLabel="Minutes done against the plan target per week"
          />
        )}
      </Figure>
    </div>
  );
}
