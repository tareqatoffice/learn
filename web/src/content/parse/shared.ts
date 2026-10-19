// Line-level helpers shared by the legacy and canonical question-book parsers.
import type { ParsedBook } from "@/content/types";

export const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
export const PUZZLE_QUESTION = "What does this code output?";

/** A question before its importKey is assigned. */
export type Item = { id?: string; question: string; part: string; prompt: string; answer: string };
/** A parsed book whose questions still need importKeys. */
export type Structure = Omit<ParsedBook, "questions"> & { items: Item[] };

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

// outside[i] is true when line i is plain markdown (not a fence marker, not inside a fence).
export function fenceMask(lines: string[]): boolean[] {
  const outside: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const f = line.match(FENCE);
    if (f && !fence) {
      fence = f[1];
      outside.push(false);
    } else if (f && fence && f[1][0] === fence[0] && f[1].length >= fence.length && f[2].trim() === "") {
      fence = null;
      outside.push(false);
    } else {
      outside.push(!fence);
    }
  }
  return outside;
}

/** An `unaccounted` entry for 0-based line `i`. */
export const unaccountedLine = (lines: string[], i: number) => ({ line: i + 1, heading: lines[i].trim() });
