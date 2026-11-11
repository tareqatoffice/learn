type Day = {
  date: string;
  minutes: number;
  self: { fluency?: number; confidence?: number };
  ai: { fluency?: number; vocabulary?: number; grammar?: number; confidence?: number };
};

const SERIES: { key: string; label: string; color: string; dash?: string; pick: (d: Day) => number | undefined }[] = [
  { key: "self-fluency", label: "Fluency (you)", color: "var(--chart-1)", pick: (d) => d.self.fluency },
  { key: "self-confidence", label: "Confidence (you)", color: "var(--chart-2)", pick: (d) => d.self.confidence },
  { key: "ai-fluency", label: "Fluency (AI)", color: "var(--chart-1)", dash: "4 3", pick: (d) => d.ai.fluency },
  { key: "ai-confidence", label: "Confidence (AI)", color: "var(--chart-2)", dash: "4 3", pick: (d) => d.ai.confidence },
  { key: "ai-vocabulary", label: "Vocabulary (AI)", color: "var(--chart-3)", dash: "4 3", pick: (d) => d.ai.vocabulary },
  { key: "ai-grammar", label: "Grammar (AI)", color: "var(--chart-4)", dash: "4 3", pick: (d) => d.ai.grammar },
];

const W = 600;
const H = 140;
const PAD = { left: 28, right: 8, top: 8, bottom: 18 };
const DATE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

const label = (date: string) => DATE.format(new Date(`${date}T00:00:00Z`));

/** Lines through the days that have a value; gaps stay gaps. */
function paths(points: ({ x: number; y: number } | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Minutes per day (bars) and self/AI scores per day (lines, 1–5) over the given days. Inline SVG. */
export function TrendChart({ days }: { days: Day[] }) {
  const n = days.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = n > 0 ? innerW / n : innerW;
  const x = (i: number) => PAD.left + step * (i + 0.5);
  const maxMin = Math.max(5, ...days.map((d) => d.minutes));
  const total = Math.round(days.reduce((s, d) => s + d.minutes, 0) * 10) / 10;
  const scoreY = (v: number) => PAD.top + innerH - ((v - 1) / 4) * innerH;
  const shown = SERIES.filter((s) => days.some((d) => typeof s.pick(d) === "number"));
  const first = days[0]?.date;
  const last = days[n - 1]?.date;

  return (
    <div className="grid gap-5">
      <figure className="grid gap-2">
        <figcaption className="text-sm">
          <span className="font-medium">Minutes practised</span>{" "}
          <span className="text-muted-foreground">· {total} min in the last {n} days</span>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Minutes practised per day, ${total} in total`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--border)" />
          <text x={PAD.left - 4} y={PAD.top + 8} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
            {Math.round(maxMin)}
          </text>
          {days.map((d, i) => {
            const h = (d.minutes / maxMin) * innerH;
            return (
              <rect
                key={d.date}
                x={x(i) - step * 0.35}
                width={step * 0.7}
                y={PAD.top + innerH - h}
                height={h}
                rx={2}
                fill="var(--ok)"
              >
                <title>{`${label(d.date)}: ${d.minutes} min`}</title>
              </rect>
            );
          })}
          {first && (
            <text x={PAD.left} y={H - 4} fontSize="10" fill="var(--muted-foreground)">
              {label(first)}
            </text>
          )}
          {last && (
            <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {label(last)}
            </text>
          )}
        </svg>
      </figure>

      <figure className="grid gap-2">
        <figcaption className="text-sm font-medium">Scores (1–5)</figcaption>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rate a take, or ask the AI coach, and your scores show up here.</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Self and AI scores per day">
              {[1, 2, 3, 4, 5].map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={scoreY(v)} y2={scoreY(v)} stroke="var(--border)" strokeWidth={v === 1 ? 1 : 0.5} />
                  <text x={PAD.left - 6} y={scoreY(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
                    {v}
                  </text>
                </g>
              ))}
              {shown.map((s) => {
                const pts = days.map((d, i) => {
                  const v = s.pick(d);
                  return typeof v === "number" ? { x: x(i), y: scoreY(v) } : null;
                });
                return (
                  <g key={s.key}>
                    <path d={paths(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
                    {pts.map((p, i) =>
                      p ? (
                        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={s.color}>
                          <title>{`${s.label}, ${label(days[i].date)}: ${s.pick(days[i])}`}</title>
                        </circle>
                      ) : null,
                    )}
                  </g>
                );
              })}
            </svg>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {shown.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
                  </svg>
                  {s.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </figure>
    </div>
  );
}
