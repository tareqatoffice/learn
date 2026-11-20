import type { ParsedBook } from "@/features/content/types";

export const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
export const PUZZLE_QUESTION = "What does this code output?";

export type Item = { id?: string; question: string; part: string; partKey?: string; prompt: string; answer: string };
export type Structure = Omit<ParsedBook, "questions"> & { items: Item[] };

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

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

export const splitLines = (md: string): string[] => md.replace(/^﻿/, "").split(/\r?\n/);

export const unaccountedLine = (lines: string[], i: number) => ({ line: i + 1, heading: lines[i].trim() });
