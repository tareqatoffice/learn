
export const ANSWER_MODES = ["typed", "voice", "mixed"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

export type QuizAttempt = { answer: string; mode: AnswerMode };

export function answerModeOf(typed: boolean, spoken: boolean): AnswerMode {
  if (spoken) return typed ? "mixed" : "voice";
  return "typed";
}

export const ANSWER_MODE_LABEL: Record<AnswerMode, string> = {
  typed: "Written",
  voice: "Voice",
  mixed: "Written and voice",
};
