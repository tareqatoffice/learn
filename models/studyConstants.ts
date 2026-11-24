export const RECITE_MAX = 300;
export const RECITE_VERDICTS = ["got", "review"] as const;
export type ReciteVerdict = (typeof RECITE_VERDICTS)[number];
export const ANCHOR_MAX = 200;
export const PREQ_MAX_QUESTIONS = 3;
export const PREQ_MAX_LEN = 200;
