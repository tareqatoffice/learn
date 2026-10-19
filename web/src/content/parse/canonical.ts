// Canonical (pulled) question-book format: `<!-- learn:book|part|question|answer|extra … -->` markers,
// each followed by its heading; the markers alone decide what every line belongs to.
import { slugify } from "@/lib/ids";
import { HEADING, PUZZLE_QUESTION, unaccountedLine, type Item, type Structure } from "./shared";

const MARKER = /^<!--\s*learn:(book|part|question|answer|extra)\b(.*?)-->\s*$/;

/** True when the book carries `<!-- learn:… -->` markers outside code fences. */
export function isCanonical(lines: string[], outside: boolean[]): boolean {
  return lines.some((line, i) => outside[i] && MARKER.test(line));
}

export function markerAttrs(raw: string): Record<string, string> {
  return Object.fromEntries([...raw.matchAll(/(\w+)=(\S+)/g)].map((m) => [m[1], m[2]]));
}

export function parseCanonical(lines: string[], outside: boolean[]): Structure {
  const marks = lines.flatMap((line, i) => {
    const m = outside[i] && line.match(MARKER);
    return m ? [{ line: i, kind: m[1], attrs: markerAttrs(m[2]) }] : [];
  });
  const markLines = new Set(marks.map((m) => m.line));
  const unaccounted: Structure["unaccounted"] = [];
  // Marker lines inside a segment are never content: a stray one is reported, a used one is a boundary.
  const used = new Set<number>();
  const text = (from: number, to: number) =>
    lines.slice(from, to).filter((_, k) => !markLines.has(from + k)).join("\n").trim();
  // The heading right after a marker (blank lines allowed in between), if there is one.
  const takeHeading = (from: number, to: number) => {
    let i = from;
    while (i < to && !lines[i].trim()) i++;
    const m = i < to && outside[i] ? lines[i].match(HEADING) : null;
    return m ? { title: m[2].trim(), level: m[1].length, next: i + 1 } : { title: "", level: 0, next: from };
  };

  const bookMark = marks.find((m) => m.kind === "book");
  const structural = marks.filter((m) => m.kind !== "book" && m.kind !== "answer");
  const bookEnd = structural.length ? structural[0].line : lines.length;
  const bookStart = bookMark && bookMark.line < bookEnd ? bookMark.line + 1 : 0;
  if (bookStart > 0) used.add(bookStart - 1);
  // Nothing may precede the book marker.
  for (let i = 0; i < bookStart - 1; i++) if (lines[i].trim()) unaccounted.push(unaccountedLine(lines, i));
  const head = takeHeading(bookStart, bookEnd);
  const titled = head.level === 1;

  const parts: Structure["parts"] = [];
  const extras: Structure["extras"] = [];
  const items: Item[] = [];
  let part = "";
  structural.forEach((mark, k) => {
    used.add(mark.line);
    const end = k + 1 < structural.length ? structural[k + 1].line : lines.length;
    const h = takeHeading(mark.line + 1, end);
    if (mark.kind === "part") {
      part = h.title;
      parts.push({ key: mark.attrs.key ?? slugify(h.title), title: h.title, intro: text(h.next, end) });
    } else if (mark.kind === "extra") {
      extras.push({ key: mark.attrs.key ?? slugify(h.title), title: h.title, body: text(h.next, end) });
    } else {
      const answerMark = marks.find((m) => m.kind === "answer" && m.line > mark.line && m.line < end);
      if (answerMark) used.add(answerMark.line);
      const item: Item = {
        question: h.title.replace(/^[QBT]\d+[.:]\s*/, "") || PUZZLE_QUESTION,
        part,
        prompt: answerMark ? text(h.next, answerMark.line) : "",
        answer: answerMark ? text(answerMark.line + 1, end) : text(h.next, end),
      };
      items.push(mark.attrs.id ? { id: mark.attrs.id, ...item } : item);
    }
  });
  for (const m of marks) if (!used.has(m.line)) unaccounted.push(unaccountedLine(lines, m.line));
  unaccounted.sort((a, b) => a.line - b.line);

  return {
    ...(bookMark?.attrs.id ? { id: bookMark.attrs.id } : {}),
    ...(titled ? { title: head.title } : {}),
    intro: text(titled ? head.next : bookStart, bookEnd),
    parts,
    extras,
    items,
    unaccounted,
  };
}
