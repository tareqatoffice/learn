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
