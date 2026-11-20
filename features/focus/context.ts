import { NAV_ITEMS } from "@/components/nav";
import { SITE_NAME } from "@/lib/seo";
import { FOCUS_AREAS, FOCUS_LABEL_MAX, FOCUS_PATH_MAX, type FocusArea } from "@/models/focusConstants";

/** What a focus session is about: the page the user started it on. */
export type FocusContext = {
  area: FocusArea;
  /** Human label for the content, e.g. the note chapter or question title. */
  label: string;
  path: string;
};

const AREA_LABELS: Record<FocusArea, string> = {
  graphs: "Graphs",
  speaking: "Speaking",
  notes: "Notes",
  interview: "Interview",
  ielts: "IELTS",
  coding: "Coding",
  general: "General",
};

export const areaLabel = (area: FocusArea) => AREA_LABELS[area];

export function areaFor(pathname: string): FocusArea {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return (FOCUS_AREAS as readonly string[]).includes(first) && first !== "general"
    ? (first as FocusArea)
    : "general";
}

/** Whether the idle focus button belongs on this page: only inside a study track, not profile/admin/dashboard. */
export const offersFocus = (pathname: string) => areaFor(pathname) !== "general";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TITLE_SUFFIX = new RegExp(`\\s*·\\s*${escapeRegExp(SITE_NAME)}$`);

/** An in-app path: one leading slash, never `//host` or `/\host` (protocol-relative). */
export const isAppPath = (path: string) => /^\/(?![/\\])/.test(path);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Builds the focus context for a page. Prefers the document title (set per page by
 * `buildMetadata`), then the page's main heading, then the area name.
 */
export function focusContextFor(
  pathname: string,
  { title, heading }: { title?: string | null; heading?: string | null } = {},
): FocusContext {
  const area = areaFor(pathname);
  const fromTitle = clean(title).replace(TITLE_SUFFIX, "");
  const navLabel = NAV_ITEMS.find((i) => i.href === pathname)?.label;
  const label =
    (fromTitle && fromTitle !== SITE_NAME ? fromTitle : "") ||
    clean(heading) ||
    navLabel ||
    areaLabel(area);
  return {
    area,
    label: label.slice(0, FOCUS_LABEL_MAX),
    path: (pathname || "/").slice(0, FOCUS_PATH_MAX),
  };
}

/** `m:ss`, or `h:mm:ss` from one hour up. */
export { clockWithHours as formatClock } from "@/lib/format";

/** Short duration like `1h 5m` or `12m`; under a minute shows `<1m`. */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 1) return "<1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
