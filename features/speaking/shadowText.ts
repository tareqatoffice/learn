export const CLIP_RATES = [0.5, 0.75, 0.9, 1] as const;
export type ClipRate = (typeof CLIP_RATES)[number];

export const isClipRate = (n: unknown): n is ClipRate => CLIP_RATES.includes(n as ClipRate);

export type Sentence = { text: string; start: number; end: number };

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const parts = line.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) ?? [];
    for (const part of parts) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

export function validMarks(marks: readonly number[] | undefined, count: number, durationSec: number): boolean {
  if (!marks || count === 0 || marks.length !== count) return false;
  if (marks[0] < 0) return false;
  for (let i = 1; i < marks.length; i++) if (!(marks[i] > marks[i - 1])) return false;
  return !(durationSec > 0) || marks[marks.length - 1] < durationSec;
}

export function timeline(text: string, durationSec: number, marks?: readonly number[]): Sentence[] {
  const parts = splitSentences(text);
  if (!parts.length) return [];
  const total = durationSec > 0 ? durationSec : 0;
  if (marks && validMarks(marks, parts.length, total)) {
    return parts.map((t, i) => ({
      text: t,
      start: marks[i],
      end: i + 1 < parts.length ? marks[i + 1] : total || marks[i] + 5,
    }));
  }
  const weights = parts.map((p) => Math.max(p.length, 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  return parts.map((t, i) => {
    const start = at;
    at += total ? (weights[i] / sum) * total : 0;
    return { text: t, start, end: at };
  });
}

export function sentenceAt(sentences: readonly Sentence[], t: number): number {
  if (!sentences.length) return -1;
  for (let i = sentences.length - 1; i >= 0; i--) if (t >= sentences[i].start) return i;
  return 0;
}

export const MAX_MARKS = 500;

export const needsMarks = (text: string, durationSec: number, hasAudioLink = false): boolean =>
  (durationSec > 0 || hasAudioLink) && splitSentences(text).length > 0;

export function words(text: string): string[] {
  return text.toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
}

export type WordMatch = { score: number; total: number; matched: number; missed: string[] };

const MAX_MISSED = 20;

export function wordMatch(reference: string, spoken: string): WordMatch {
  const ref = words(reference);
  const said = words(spoken);
  const n = ref.length;
  const m = said.length;
  if (!n) return { score: 0, total: 0, matched: 0, missed: [] };

  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i][j] = ref[i - 1] === said[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const hit = new Array<boolean>(n).fill(false);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (ref[i - 1] === said[j - 1]) {
      hit[i - 1] = true;
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) i--;
    else j--;
  }

  const missed: string[] = [];
  for (let i = 0; i < n && missed.length < MAX_MISSED; i++) if (!hit[i] && !missed.includes(ref[i])) missed.push(ref[i]);
  const matched = table[n][m];
  return { score: Math.round((matched / n) * 100), total: n, matched, missed };
}
