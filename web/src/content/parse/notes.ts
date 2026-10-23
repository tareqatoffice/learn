import type { ParsedChapter } from "@/content/types";
import { markerAttrs } from "./canonical";
import { fenceMask, splitLines } from "./shared";

const NOTE_MARKER = /^<!--\s*learn:note\b(.*?)-->\s*$/;
const H1 = /^#\s+(.+?)\s*$/;

/** `03-networking.md` -> `networking`. */
function slugFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.md$/i, "").replace(/^\d+-/, "");
}

/** Parses one note file: title is the first H1 outside code fences, body is everything after it. */
export function parseChapter(md: string, fileName: string): ParsedChapter {
  const lines = splitLines(md);
  let slug = slugFromFileName(fileName);
  let id: string | undefined;

  const first = lines.findIndex((l) => l.trim());
  const marker = first >= 0 ? lines[first].match(NOTE_MARKER) : null;
  if (marker) {
    const attrs = markerAttrs(marker[1]);
    id = attrs.id;
    if (attrs.slug) slug = attrs.slug;
  }

  const outside = fenceMask(lines);
  const h1 = lines.findIndex((l, i) => outside[i] && H1.test(l));
  const title = h1 >= 0 ? lines[h1].match(H1)![1] : "";
  const bodyLines = h1 >= 0 ? lines.slice(h1 + 1) : lines.filter((_, i) => !(marker && i === first));
  return { ...(id ? { id } : {}), slug, title, body: bodyLines.join("\n").trim() };
}
