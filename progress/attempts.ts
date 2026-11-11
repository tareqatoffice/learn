import { isValidObjectId, type Types } from "mongoose";
import { visibleQuestionFilter } from "@/content/visibility";
import { ANSWER_MODE_LABEL, type AnswerMode } from "@/lib/quiz-answer";
import { Question, QuestionBook, QuizSession } from "@/models";
import type { MarkResult } from "./questions";
import { labelSessions, sessionCounts } from "./quiz";

type Id = Types.ObjectId;

type CoachRecord = {
  verdict?: "correct" | "partial" | "incorrect";
  score?: number;
  summary?: string;
  strengths?: string[];
  missing?: string[];
  model?: string;
  chat?: { role: "user" | "assistant"; content: string }[];
};

type ResultRow = {
  questionId: Id;
  result: MarkResult;
  at: Date;
  answer?: string;
  answerMode?: AnswerMode;
  coach?: CoachRecord;
};

type SessionRow = {
  _id: Id;
  filter: { bookIds: Id[]; partKeys: string[]; mode: "unseen" | "review" | "all"; questionIds?: Id[] };
  questionIds: Id[];
  results: ResultRow[];
  startedAt: Date;
  finishedAt?: Date | null;
};

export type AttemptSessionSummary = {
  id: string;
  label: string;
  startedAt: Date;
  finishedAt: Date | null;
  attempts: number;
  answered: number;
  counts: Record<MarkResult, number>;
};

export type Attempt = {
  at: Date;
  result: MarkResult;
  /** Empty when the learner revealed the answer without answering. */
  answer: string;
  answerMode: AnswerMode | null;
  coach: CoachRecord | null;
  /** Null when the question has been deleted or unpublished since. */
  question: null | {
    question: string;
    prompt: string;
    reference: string;
    bookTitle: string;
    partTitle: string;
  };
};

export type AttemptLog = AttemptSessionSummary & { items: Attempt[] };

/** How many sessions the history page and the full export include, newest first. */
export const HISTORY_LIMIT = 200;

const summarize = (s: SessionRow, label: string): AttemptSessionSummary => ({
  id: String(s._id),
  label: label || "Quiz",
  startedAt: s.startedAt,
  finishedAt: s.finishedAt ?? null,
  attempts: s.results.length,
  // answerMode is stored only alongside an answer, so it counts answers without loading them.
  answered: s.results.filter((r) => r.answerMode).length,
  counts: sessionCounts(s),
});

/** Leaves out the answers and coach chats, which only the full log needs. */
const SUMMARY_PROJECTION = { "results.answer": 0, "results.coach": 0 };

async function ownedSessions(userId: string, sessionId?: string, projection?: object): Promise<SessionRow[]> {
  if (!isValidObjectId(userId) || (sessionId !== undefined && !isValidObjectId(sessionId))) return [];
  const query = sessionId ? { _id: sessionId, userId } : { userId, "results.0": { $exists: true } };
  return QuizSession.find(query, projection).sort({ startedAt: -1, _id: -1 }).limit(HISTORY_LIMIT).lean<SessionRow[]>();
}

/** Sessions with at least one marked card, newest first. */
export async function listAttemptSessions(userId: string): Promise<AttemptSessionSummary[]> {
  const sessions = await ownedSessions(userId, undefined, SUMMARY_PROJECTION);
  const labels = await labelSessions(sessions);
  return sessions.map((s, i) => summarize(s, labels[i]));
}

/** Every attempt of one session, or of all recent sessions, with the questions as they now read. */
export async function getAttemptLogs(userId: string, sessionId?: string): Promise<AttemptLog[]> {
  const sessions = await ownedSessions(userId, sessionId);
  if (!sessions.length) return [];

  const ids = [...new Set(sessions.flatMap((s) => s.results.map((r) => String(r.questionId))))];
  const [labels, questions] = await Promise.all([
    labelSessions(sessions),
    visibleQuestionFilter().then((visible) =>
      Question.find({ ...visible, _id: { $in: ids } }).lean<
        { _id: Id; bookId: Id; partKey: string; question: string; prompt?: string; answer: string }[]
      >(),
    ),
  ]);
  const books = await QuestionBook.find({ _id: { $in: questions.map((q) => q.bookId) } }, { title: 1, parts: 1 }).lean<
    { _id: Id; title: string; parts: { key: string; title: string }[] }[]
  >();
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const questionById = new Map(
    questions.map((q) => {
      const book = bookById.get(String(q.bookId));
      return [
        String(q._id),
        {
          question: q.question,
          prompt: q.prompt ?? "",
          reference: q.answer,
          bookTitle: book?.title ?? "",
          partTitle: book?.parts.find((p) => p.key === q.partKey)?.title ?? "",
        },
      ];
    }),
  );

  return sessions.map((s, i) => ({
    ...summarize(s, labels[i]),
    items: s.results.map((r) => ({
      at: r.at,
      result: r.result,
      answer: r.answer ?? "",
      answerMode: r.answer?.trim() ? (r.answerMode ?? "typed") : null,
      coach: r.coach ?? null,
      question: questionById.get(String(r.questionId)) ?? null,
    })),
  }));
}

export const MARK_LABEL: Record<MarkResult, string> = { got: "Got it", review: "Needs review", skip: "Skipped" };
export const VERDICT_LABEL = { correct: "Correct", partial: "Partly right", incorrect: "Not quite" } as const;

/** "1 attempt", "3 attempts". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const day = (d: Date) => d.toISOString().slice(0, 10);
const time = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
/** One line of Markdown: the question title must not break the heading. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const quote = (s: string) =>
  s
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

const REVIEW_PROMPT = [
  "## How to use this file",
  "",
  "Paste this file into an AI assistant with a prompt like:",
  "",
  "> You are a senior technical interviewer. Below is a log of my interview-practice answers. Each",
  "> entry has the question, my own answer (written or transcribed from voice), the reference",
  "> answer, and any AI coach feedback. For every entry, tell me (1) what I got right, (2) what I",
  "> missed or got wrong compared with the reference, and (3) how to phrase a stronger answer.",
  "> Then summarise my recurring gaps across all entries and give me a short, prioritised list of",
  "> topics to study next. Voice answers are speech-to-text transcripts, so ignore transcription",
  "> slips and judge the substance.",
].join("\n");

function attemptMarkdown(item: Attempt, n: number): string {
  const q = item.question;
  const lines: string[] = [];
  lines.push(`### ${n}. ${q ? oneLine(q.question) : "(This question is no longer available)"}`, "");
  const source = q ? [q.bookTitle, q.partTitle].filter(Boolean).join(" › ") : "";
  const meta = [
    source && `Book: ${source}`,
    `Marked: ${MARK_LABEL[item.result]}`,
    item.answerMode && `Answered by: ${ANSWER_MODE_LABEL[item.answerMode]}`,
    `At: ${time(item.at)}`,
  ].filter(Boolean);
  lines.push(meta.map((m) => `- ${m}`).join("\n"), "");
  if (q?.prompt.trim()) lines.push("**Context**", "", q.prompt.trim(), "");
  lines.push("**My answer**", "", item.answer.trim() ? quote(item.answer) : "_No answer given; I only revealed the reference._", "");
  if (q) lines.push("**Reference answer**", "", q.reference.trim(), "");

  const c = item.coach;
  if (c?.verdict) {
    const head = [VERDICT_LABEL[c.verdict], c.score !== undefined && `${c.score}/100`, c.model && `(${c.model})`]
      .filter(Boolean)
      .join(" · ");
    lines.push(`**AI coach feedback:** ${head}`, "");
    if (c.summary) lines.push(c.summary.trim(), "");
    if (c.strengths?.length) lines.push("What I got right:", "", ...c.strengths.map((s) => `- ${oneLine(s)}`), "");
    if (c.missing?.length) lines.push("What to add or fix:", "", ...c.missing.map((s) => `- ${oneLine(s)}`), "");
  }
  if (c?.chat?.length) {
    lines.push("**Follow-up with the coach**", "");
    for (const m of c.chat) lines.push(`${m.role === "user" ? "**Me:**" : "**Coach:**"} ${m.content.trim()}`, "");
  }
  return lines.join("\n");
}

/** The attempt logs as one Markdown file, written for a learner to hand to another AI for review. */
export function attemptsMarkdown(logs: AttemptLog[], exportedAt = new Date()): string {
  const total = logs.reduce((sum, l) => sum + l.items.length, 0);
  const answered = logs.reduce((sum, l) => sum + l.answered, 0);
  const title = logs.length === 1 ? `Interview practice: ${logs[0].label}` : "Interview practice log";
  const out: string[] = [
    `# ${title}`,
    "",
    `Exported ${day(exportedAt)} · ${logs.length} ${logs.length === 1 ? "quiz" : "quizzes"} · ${plural(total, "attempt")} · ${answered} with my own answer`,
    "",
    REVIEW_PROMPT,
    "",
  ];
  for (const log of logs) {
    const { got, review, skip } = log.counts;
    out.push(
      `## ${log.label} (${day(log.startedAt)})`,
      "",
      `Got it ${got} · Needs review ${review} · Skipped ${skip}${log.finishedAt ? "" : " · unfinished"}`,
      "",
    );
    log.items.forEach((item, i) => out.push(attemptMarkdown(item, i + 1), "---", ""));
  }
  if (!total) out.push("_No attempts yet._", "");
  return out.join("\n");
}

/** A filesystem-safe file name for an export. */
export function exportFileName(label: string | null, at = new Date()): string {
  const slug = (label ?? "all")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `interview-answers-${slug || "quiz"}-${day(at)}.md`;
}
