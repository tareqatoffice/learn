import type { Kind } from "./questions";

export type Part = "p1" | "p2" | "p3";

export const KIND_PARTS: Record<Kind, Part[]> = { mock: ["p1", "p2", "p3"], part1: ["p1"], part2: ["p2"], part3: ["p3"] };
export const PART_CAP_SEC: Record<Part, number> = { p1: 420, p2: 150, p3: 420 };
export const PART_SOFT_SEC = 300;
export const P2_PREP_SEC = 60;
export const P2_MARK_SEC = 60;
export const P2_TALK_SEC = 120;
