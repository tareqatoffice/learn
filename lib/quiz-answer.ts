// The learner's own answer to a quiz card, as the card sends it with a mark. Kept apart from the
// server code so client components can import it without pulling in Mongoose.

export const ANSWER_MODES = ["typed", "voice", "mixed"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

/** What the learner answered before marking a card; empty when they only revealed it. */
export type QuizAttempt = { answer: string; mode: AnswerMode };

/** How an answer was given, from whether any of it was typed and any of it spoken. */
export function answerModeOf(typed: boolean, spoken: boolean): AnswerMode {
  if (spoken) return typed ? "mixed" : "voice";
  return "typed";
}

export const ANSWER_MODE_LABEL: Record<AnswerMode, string> = {
  typed: "Written",
  voice: "Voice",
  mixed: "Written and voice",
};
