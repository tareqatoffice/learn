// Speaking part timing (R14). Client-safe (no mongoose), so the mock runner and the server share one source.
import type { Kind } from "./questions";

export type Part = "p1" | "p2" | "p3";

/** The parts each kind records, in order. */
export const KIND_PARTS: Record<Kind, Part[]> = { mock: ["p1", "p2", "p3"], part1: ["p1"], part2: ["p2"], part3: ["p3"] };
/** Hard recording caps (R14): Part 1 and 3 run to 420 s, Part 2 to 150 s. */
export const PART_CAP_SEC: Record<Part, number> = { p1: 420, p2: 150, p3: 420 };
/** Part 1 and 3: past this the runner shows "time to move on", without cutting off. */
export const PART_SOFT_SEC = 300;
/** Part 2: preparation time before the talk starts recording. */
export const P2_PREP_SEC = 60;
/** Part 2: the "keep going" marker on the talk. */
export const P2_MARK_SEC = 60;
/** Part 2: the talk stops here. */
export const P2_TALK_SEC = 120;
