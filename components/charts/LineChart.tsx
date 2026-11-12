export type LineSeries<P> = {
  key: string;
  label: string;
  color: string;
  dash?: string;
  pick: (p: P) => number | undefined;
  /** Draw the points without joining them (e.g. official results). */
  dotsOnly?: boolean;
};

const W = 600;
const H = 140;
const PAD = { left: 28, right: 8, top: 8, bottom: 18 };

/** Lines through the points that have a value; gaps stay gaps. */
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

/** Whole numbers inside the domain. */
function wholeTicks([lo, hi]: [number, number]): number[] {
  const ticks: number[] = [];
  for (let v = Math.ceil(lo); v <= hi; v++) ticks.push(v);
  return ticks;
}

/** Inline-SVG line chart with a legend: one line per series, optional horizontal and vertical reference lines. */
export function LineChart<P>({
  points,
  series,
  yDomain,
  yTicks,
  xLabel,
  refLines = [],
  refX,
  ariaLabel = "Line chart",
}: {
  points: P[];
  series: LineSeries<P>[];
  yDomain: [number, number];
  yTicks?: number[];
  xLabel: (p: P) => string;
  refLines?: { y: number; label: string }[];
  refX?: { index: number; label: string };
  ariaLabel?: string;
}) {
  const n = points.length;
  const [lo, hi] = yDomain;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = n > 0 ? innerW / n : innerW;
  const x = (i: number) => PAD.left + step * (i + 0.5);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const shown = series.filter((s) => points.some((p) => typeof s.pick(p) === "number"));
  const ticks = yTicks ?? wholeTicks(yDomain);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={v === lo ? 1 : 0.5} />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {v}
            </text>
          </g>
        ))}
        {refLines.map((r) => (
          <g key={`${r.y}-${r.label}`}>
            <line
              data-ref="y"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(r.y)}
              y2={y(r.y)}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text x={W - PAD.right} y={y(r.y) - 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {r.label}
            </text>
          </g>
        ))}
        {refX && refX.index >= 0 && refX.index < n && (
          <g>
            <line
              data-ref="x"
              x1={x(refX.index)}
              x2={x(refX.index)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text x={x(refX.index)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
              {refX.label}
            </text>
          </g>
        )}
        {shown.map((s) => {
          const pts = points.map((p, i) => {
            const v = s.pick(p);
            return typeof v === "number" ? { x: x(i), y: y(v) } : null;
          });
          return (
            <g key={s.key}>
              {!s.dotsOnly && <path d={paths(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />}
              {pts.map((p, i) =>
                p ? (
                  <circle key={i} cx={p.x} cy={p.y} r={s.dotsOnly ? 3.5 : 2.5} fill={s.color}>
                    <title>{`${s.label}, ${xLabel(points[i])}: ${s.pick(points[i])}`}</title>
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
              {s.dotsOnly ? (
                <circle cx="9" cy="3" r="3" fill={s.color} />
              ) : (
                <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
              )}
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </>
  );
}
