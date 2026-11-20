
import { listeningBand, readingBand } from "@/features/ielts/bands";

export type QuestionKind = "mcq" | "tfng" | "ynng" | "completion" | "matching";
export const QUESTION_KINDS: QuestionKind[] = ["mcq", "tfng", "ynng", "completion", "matching"];

export type Question = {
  n: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  answers: string[];
  explanation: string;
};

export type Group = {
  kind: QuestionKind;
  instruction: string;
  options: string[];
  questions: Question[];
};

export type Section = {
  title: string;
  passage: string;
  script: string;
  audioKey: string;
  durationSec: number;
  groups: Group[];
};

export type PublicQuestion = Pick<Question, "n" | "kind" | "prompt" | "options">;
export type PublicGroup = { kind: QuestionKind; instruction: string; options: string[]; questions: PublicQuestion[] };
export type PublicSection = { title: string; passage: string; hasAudio: boolean; groups: PublicGroup[] };

export const letter = (i: number) => String.fromCharCode(65 + i);

export const TFNG = ["TRUE", "FALSE", "NOT GIVEN"] as const;
export const YNNG = ["YES", "NO", "NOT GIVEN"] as const;

export function choicesFor(kind: QuestionKind, q: Pick<PublicQuestion, "options">, group: Pick<PublicGroup, "options">): string[] {
  switch (kind) {
    case "mcq":
      return q.options.map((_, i) => letter(i));
    case "matching":
      return group.options.map((_, i) => letter(i));
    case "tfng":
      return [...TFNG];
    case "ynng":
      return [...YNNG];
    default:
      return [];
  }
}

export function numberSections(sections: { groups: Group[] }[]): number {
  let n = 0;
  for (const s of sections) for (const g of s.groups) for (const q of g.questions) q.n = ++n;
  return n;
}

const TFNG_ALIASES: Record<string, string> = {
  t: "true", true: "true", y: "yes", yes: "yes", f: "false", false: "false", n: "no", no: "no",
  ng: "not given", "not given": "not given", notgiven: "not given",
};

function clean(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.]+$/, "").trim();
}

function normalise(kind: QuestionKind, s: string): string {
  const c = clean(s);
  if (kind === "tfng" || kind === "ynng") return TFNG_ALIASES[c] ?? c;
  if (kind === "mcq" || kind === "matching") return c.replace(/[^a-z0-9]/g, "");
  return c;
}

const ARTICLE = /^(a|an|the) /;

export function isCorrect(q: Pick<Question, "kind" | "answers">, given: string | undefined): boolean {
  if (typeof given !== "string" || !clean(given)) return false;
  const g = normalise(q.kind, given);
  return q.answers.some((a) => {
    const want = normalise(q.kind, a);
    if (g === want) return true;
    return q.kind === "completion" && g.replace(ARTICLE, "") === want.replace(ARTICLE, "");
  });
}

export type QuestionResult = { n: number; given: string; correct: boolean };
export type Score = { raw: number; total: number; band?: number; results: QuestionResult[] };

export function scoreSections(skill: "listening" | "reading", sections: { groups: Group[] }[], answers: Record<string, string>): Score {
  const results: QuestionResult[] = [];
  for (const s of sections) {
    for (const g of s.groups) {
      for (const q of g.questions) {
        const given = typeof answers[String(q.n)] === "string" ? answers[String(q.n)].trim() : "";
        results.push({ n: q.n, given, correct: isCorrect(q, given) });
      }
    }
  }
  const raw = results.filter((r) => r.correct).length;
  const total = results.length;
  const band = total === 40 ? (skill === "listening" ? listeningBand(raw) : readingBand(raw)) : undefined;
  return { raw, total, ...(band !== undefined ? { band } : {}), results };
}

export function toPublic(sections: Section[]): PublicSection[] {
  return sections.map((s) => ({
    title: s.title,
    passage: s.passage,
    hasAudio: Boolean(s.audioKey) || Boolean(s.script),
    groups: s.groups.map((g) => ({
      kind: g.kind,
      instruction: g.instruction,
      options: g.options,
      questions: g.questions.map((q) => ({ n: q.n, kind: q.kind, prompt: q.prompt, options: q.options })),
    })),
  }));
}
