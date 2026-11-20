/** Track identity: each area of the app keeps one hue (a `--t-*` token) on every page. */
export const TRACK = {
  graphs: 0,
  speaking: 1,
  notes: 2,
  interview: 3,
  ielts: 4,
  coding: 5,
} as const;
export type TrackName = keyof typeof TRACK;

export const trackVar = (track: TrackName) => `var(--t-${TRACK[track]})`;

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
