export const STATUSES = ["draft", "published", "archived"] as const;

export type Status = (typeof STATUSES)[number];
