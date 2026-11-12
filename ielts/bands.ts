// Pure band maths. No mongoose or server imports: client components import this.

export type Skill = "listening" | "reading" | "writing" | "speaking";
export const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];

export type Criterion = "fluency" | "lexical" | "grammar" | "pronunciation";
export const CRITERIA: Criterion[] = ["fluency", "lexical", "grammar", "pronunciation"];

export const CRITERION_LABEL: Record<Criterion, string> = {
  fluency: "Fluency and Coherence",
  lexical: "Lexical Resource",
  grammar: "Grammatical Range and Accuracy",
  pronunciation: "Pronunciation",
};

// Guards against float noise just under a boundary (e.g. 6.2499999999999).
const EPS = 1e-9;

/** Round to the half band: fraction < 0.25 down, 0.25 to < 0.75 to .5, >= 0.75 up. */
export function roundHalf(mean: number): number {
  const whole = Math.floor(mean + EPS);
  const frac = mean - whole;
  if (frac < 0.25 - EPS) return whole;
  if (frac < 0.75 - EPS) return whole + 0.5;
  return whole + 1;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function overallBand(b: Record<Skill, number>): number {
  return roundHalf(mean(SKILLS.map((s) => b[s])));
}

export function speakingBand(c: Record<Criterion, number>): number {
  return roundHalf(mean(CRITERIA.map((k) => c[k])));
}

type Table = ReadonlyArray<readonly [minRaw: number, band: number]>;

// Approximate; commonly published Academic conversion; not official.
const LISTENING_TABLE: Table = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
  [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];

// Approximate; commonly published Academic conversion; not official.
const READING_TABLE: Table = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5],
  [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];

function convert(table: Table, raw: number): number {
  if (!Number.isInteger(raw) || raw < 0 || raw > 40) {
    throw new RangeError(`Raw score must be a whole number from 0 to 40, got ${raw}.`);
  }
  return table.find(([min]) => raw >= min)![1];
}

export function listeningBand(raw: number): number {
  return convert(LISTENING_TABLE, raw);
}

export function readingBand(raw: number): number {
  return convert(READING_TABLE, raw);
}

export function isHalfBand(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n * 2);
}

export function isWholeBand(n: number): boolean {
  return Number.isInteger(n);
}
