// Parses a question book (markdown) into a ParsedBook. Pure functions, no I/O.
// Legacy books are read with the heuristics ported from quiz-app/src/lib/parse.js; books pulled
// from the app carry `<!-- learn:… -->` markers, and then the markers alone decide the structure.
import type { ParsedBook, ParsedQuestion } from "@/content/types";
import { importKey, slugify } from "@/lib/ids";

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const PART = /^(part|section)\b/i;
const Q_HEAD = /^([QBT])\d+[.:]\s*(.*)$/;
const SKIP_SECTION = /table of contents|cheat sheets?|preparation plan|prep plan|self-scoring|final advice/i;
const EXTRA_SECTION = /cheat sheets?|preparation plan|prep plan|self-scoring|final advice|^appendix\b/i;
const CONTENTS = /^(table of )?contents$/i;
const RAPID_FIRE = /rapid-fire/i;
const ANSWER_LABEL = /^\*\*Answer:\*\*\s*/;
const MARKER = /^<!--\s*learn:(book|part|question|answer|extra)\b(.*?)-->\s*$/;
const PUZZLE_QUESTION = "What does this code output?";

type Heading = { line: number; level: number; text: string };
type Item = { id?: string; question: string; part: string; prompt: string; answer: string };
type Range = [start: number, end: number];
type Structure = Omit<ParsedBook, "questions"> & { items: Item[] };

// outside[i] is true when line i is plain markdown (not a fence marker, not inside a fence).
function fenceMask(lines: string[]): boolean[] {
  const outside: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const f = line.match(FENCE);
    if (f && !fence) {
      fence = f[1];
      outside.push(false);
    } else if (f && fence && f[1][0] === fence[0] && f[1].length >= fence.length && f[2].trim() === "") {
      fence = null;
      outside.push(false);
    } else {
      outside.push(!fence);
    }
  }
  return outside;
}

function scanHeadings(lines: string[], outside: boolean[]): Heading[] {
  const headings: Heading[] = [];
  lines.forEach((line, i) => {
    const m = outside[i] && line.match(HEADING);
    if (m) headings.push({ line: i, level: m[1].length, text: m[2].trim() });
  });
  return headings;
}

function cleanAnswer(text: string): string {
  let t = text.trim();
  let prev;
  do {
    prev = t;
    t = t.replace(/(^|\n)---$/, "").trim();
  } while (t !== prev);
  return t;
}

// Line where the body of heading #idx ends: the next heading of the same or higher level.
function bodyEnd(lines: string[], headings: Heading[], idx: number): number {
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j].level <= headings[idx].level) return headings[j].line;
  }
  return lines.length;
}

function sliceAnswer(lines: string[], headings: Heading[], idx: number): string {
  return cleanAnswer(lines.slice(headings[idx].line + 1, bodyEnd(lines, headings, idx)).join("\n"));
}

const inRanges = (line: number, ranges: Range[]) => ranges.some(([s, e]) => line >= s && line < e);

/** Returns a function that hands out `base`, then `base-2`, `base-3`… for repeated bases. */
function uniqueKeys(): (base: string) => string {
  const used = new Set<string>();
  return (base) => {
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
    used.add(key);
    return key;
  };
}

// "Predict the result" questions: snippet first, then <details><summary>Answer</summary> … </details>.
function splitDetails(body: string): { prompt: string; answer: string } | null {
  const lines = body.split("\n");
  const outside = fenceMask(lines);
  const open = lines.findIndex((l, i) => outside[i] && /^\s*<details>\s*<summary>\s*answer\s*<\/summary>\s*$/i.test(l));
  if (open === -1) return null;
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) {
    if (outside[i] && /^\s*<\/details>\s*$/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) return null;
  return {
    prompt: cleanAnswer(lines.slice(0, open).join("\n")),
    answer: cleanAnswer(lines.slice(open + 1, close).concat(lines.slice(close + 1)).join("\n")),
  };
}

// Untitled puzzles ("### Q61."): leading code block(s) are the question, the rest is the answer.
function splitLeadingCode(body: string): { prompt: string; answer: string } {
  const lines = body.split("\n");
  const outside = fenceMask(lines);
  let i = 0;
  let end = 0;
  while (i < lines.length) {
    if (outside[i] && !lines[i].trim()) {
      i++;
      continue;
    }
    if (outside[i]) break;
    while (i < lines.length && !outside[i]) i++;
    end = i;
  }
  return { prompt: cleanAnswer(lines.slice(0, end).join("\n")), answer: cleanAnswer(lines.slice(end).join("\n")) };
}

// B/T questions: everything before the first "**Answer:** …" line is the prompt.
function splitAnswerLabel(body: string): { prompt: string; answer: string } | null {
  const lines = body.split("\n");
  const outside = fenceMask(lines);
  const at = lines.findIndex((l, i) => outside[i] && ANSWER_LABEL.test(l));
  if (at === -1) return null;
  return {
    prompt: cleanAnswer(lines.slice(0, at).join("\n")),
    answer: cleanAnswer([lines[at].replace(ANSWER_LABEL, ""), ...lines.slice(at + 1)].join("\n")),
  };
}

function questionRecord(kind: string, title: string, part: string, body: string): Item {
  const labeled = kind === "Q" ? null : splitAnswerLabel(body);
  if (labeled) return { question: title || PUZZLE_QUESTION, part, ...labeled };
  const details = splitDetails(body);
  if (title) return { question: title, part, prompt: details ? details.prompt : "", answer: details ? details.answer : body };
  const split = details || splitLeadingCode(body);
  return { question: PUZZLE_QUESTION, part, prompt: split.prompt, answer: split.answer };
}

// Question-like items in sections that are not Q headings: bold numbered prompts
// ("**1. Design a URL shortener.**" + answer lines), quoted bold bullets
// ("- **"Tell me about…"** answer"), and "| Question | Answer |" tables.
function sectionExtras(text: string, part: string): Item[] {
  const lines = text.split("\n");
  const outside = fenceMask(lines);
  const out: Item[] = [];
  let open: { question: string; lines: string[] } | null = null;
  const flush = () => {
    if (open) out.push({ question: open.question, part, prompt: "", answer: cleanAnswer(open.lines.join("\n")) });
    open = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (outside[i]) {
      let m = line.match(/^\*\*\d+\.\s+(.+?)\.?\*\*\s*$/);
      if (m) {
        flush();
        open = { question: m[1].trim(), lines: [] };
        continue;
      }
      m = line.match(/^[-*]\s+\*\*"(.+?)"\*\*\s*(.*)$/);
      if (m) {
        flush();
        out.push({ question: m[1].trim(), part, prompt: "", answer: m[2].trim() });
        continue;
      }
    }
    if (
      outside[i] && outside[i + 1] &&
      /^\|\s*(question|q)\s*\|\s*(answer|a)\s*\|\s*$/i.test(line) &&
      /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")
    ) {
      flush();
      let j = i + 2;
      for (; j < lines.length && outside[j] && /^\|.*\|\s*$/.test(lines[j]); j++) {
        const cells = lines[j].trim().slice(1, -1).split("|").map((c) => c.trim());
        out.push({ question: cells[0], part, prompt: "", answer: cells.slice(1).join(" | ") });
      }
      i = j - 1;
      continue;
    }
    if (open) open.lines.push(line);
  }
  flush();
  return out;
}

function splitRapidFire(text: string): { question: string; answer: string }[] {
  const lines = text.split("\n");
  const outside = fenceMask(lines);
  const items: { question: string; answer: string }[] = [];
  lines.forEach((line, i) => {
    const m = outside[i] && line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m) items.push({ question: m[1].trim(), answer: m[2].trim() });
    else if (items.length) items[items.length - 1].answer += "\n" + line;
  });
  return items.map((it) => ({ question: it.question, answer: cleanAnswer(it.answer) }));
}

/** What a legacy mode found: the questions plus which headings/lines they account for. */
type ModeResult = { items: Item[]; questionRanges: Range[]; partHeads: Set<number>; sources: Set<number> };

// Q mode: Q/B/T headings, plus question-like items in the direct content of other sections.
function parseQuestionHeadings(lines: string[], headings: Heading[], excluded: Range[]): ModeResult {
  const items: Item[] = [];
  const questionRanges: Range[] = [];
  const partHeads = new Set<number>();
  const sources = new Set<number>();
  let part: string | null = null;
  let section: string | null = null;
  let sectionIdx = -1;
  let insideQ = -1; // line where the current Q's body ends
  const partOf = () => {
    if (!part && section) partHeads.add(sectionIdx);
    return part || section || "";
  };
  headings.forEach((h, i) => {
    const q = (h.level === 2 || h.level === 3) && h.text.match(Q_HEAD);
    if (q) {
      items.push(questionRecord(q[1], q[2].trim(), partOf(), sliceAnswer(lines, headings, i)));
      insideQ = bodyEnd(lines, headings, i);
      questionRanges.push([h.line, insideQ]);
      return;
    }
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      section = null;
      partHeads.add(i);
    } else if (h.level === 2) {
      section = h.text;
      sectionIdx = i;
    }
    if (h.level >= 2 && h.line >= insideQ && !SKIP_SECTION.test(h.text) && !inRanges(h.line, excluded)) {
      const next = i + 1 < headings.length ? headings[i + 1].line : lines.length;
      const found = sectionExtras(lines.slice(h.line + 1, next).join("\n"), "");
      if (found.length) {
        const p = partOf();
        items.push(...found.map((it) => ({ ...it, part: p })));
        sources.add(i);
      }
    }
  });
  return { items, questionRanges, partHeads, sources };
}

// Fallback for books without Q headings: each "## N. Topic" is a question.
function parseNumberedSections(lines: string[], headings: Heading[]): ModeResult {
  const items: Item[] = [];
  const questionRanges: Range[] = [];
  const partHeads = new Set<number>();
  let part = "";
  headings.forEach((h, i) => {
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      partHeads.add(i);
      return;
    }
    if (h.level !== 2) return;
    const m = h.text.match(/^(\d+)\.\s+(.+)$/);
    if (!m || SKIP_SECTION.test(m[2])) return;
    questionRanges.push([h.line, bodyEnd(lines, headings, i)]);
    const title = m[2].trim();
    const answer = sliceAnswer(lines, headings, i);
    if (RAPID_FIRE.test(title)) {
      splitRapidFire(answer).forEach((r) => items.push({ question: r.question, part, prompt: "", answer: r.answer }));
      return;
    }
    items.push({ question: /^Design\b/i.test(title) ? title : `Explain: ${title}`, part, prompt: "", answer });
  });
  return { items, questionRanges, partHeads, sources: new Set() };
}

const sectionTitle = (text: string) => text.replace(/^\d+\.\s+/, "");
const isQHeading = (h: Heading) => (h.level === 2 || h.level === 3) && Q_HEAD.test(h.text);
const isPartHeading = (h: Heading) => h.level === 1 && PART.test(h.text);

/**
 * Contents sections (dropped) and extra sections (kept as raw markdown), outside question bodies.
 * An extra runs to the next heading of the same or higher level, or the next question heading.
 */
function findSections(lines: string[], headings: Heading[], questionRanges: Range[]) {
  const contents: Range[] = [];
  const extras: { idx: number; range: Range }[] = [];
  headings.forEach((h, i) => {
    const taken = [...contents, ...extras.map((e) => e.range)];
    if (isQHeading(h) || isPartHeading(h) || inRanges(h.line, questionRanges) || inRanges(h.line, taken)) return;
    const title = sectionTitle(h.text);
    if (CONTENTS.test(title)) contents.push([h.line, bodyEnd(lines, headings, i)]);
    else if (EXTRA_SECTION.test(title)) {
      let end = lines.length;
      for (let j = i + 1; j < headings.length; j++) {
        if (headings[j].level <= h.level || isQHeading(headings[j])) {
          end = headings[j].line;
          break;
        }
      }
      extras.push({ idx: i, range: [h.line, end] });
    }
  });
  return { contents, extras };
}

function parseLegacy(lines: string[], outside: boolean[], bookSlug: string): Structure {
  const headings = scanHeadings(lines, outside);
  // Q/B/T heading ranges never depend on extras, so extras can be found first and kept out of Q mode.
  const qRanges = headings.flatMap((h, i): Range[] => (isQHeading(h) ? [[h.line, bodyEnd(lines, headings, i)]] : []));
  let { contents, extras } = findSections(lines, headings, qRanges);
  let mode = parseQuestionHeadings(lines, headings, [...contents, ...extras.map((e) => e.range)]);
  if (mode.items.length === 0) {
    mode = parseNumberedSections(lines, headings);
    ({ contents, extras } = findSections(lines, headings, mode.questionRanges));
  }
  if (mode.items.length === 0) throw new Error(`No questions found in ${bookSlug}`);

  const first = headings[0];
  const titled = !!first && first.level === 1 && !PART.test(first.text) && !EXTRA_SECTION.test(first.text);
  const extraRanges = extras.map((e) => e.range);
  const introEnd = Math.min(
    lines.length,
    ...[...mode.partHeads, ...mode.sources].map((i) => headings[i].line),
    ...mode.questionRanges.map(([s]) => s),
    ...extraRanges.map(([s]) => s),
  );
  const introStart = titled ? first.line + 1 : 0;
  const intro = cleanAnswer(
    lines.slice(introStart, introEnd).filter((_, k) => !inRanges(introStart + k, contents)).join("\n"),
  );

  const partKey = uniqueKeys();
  const partTitles = new Set([...mode.partHeads].sort((a, b) => a - b).map((i) => headings[i].text));
  const parts = [...partTitles].map((title) => ({ key: partKey(slugify(title)), title }));

  const extraKey = uniqueKeys();
  const extraList = extras.map(({ idx, range: [start, end] }) => ({
    key: extraKey(slugify(headings[idx].text)),
    title: headings[idx].text,
    body: cleanAnswer(lines.slice(start + 1, end).join("\n")),
  }));

  const covered = [...mode.questionRanges, ...extraRanges, ...contents, [0, introEnd] as Range];
  const unaccounted = headings
    .filter((h, i) => !(titled && i === 0) && !mode.partHeads.has(i) && !mode.sources.has(i) && !inRanges(h.line, covered))
    .map((h) => ({ line: h.line + 1, heading: lines[h.line].trim() }));

  return {
    ...(titled ? { title: first.text } : {}),
    intro,
    parts,
    extras: extraList,
    items: mode.items,
    unaccounted,
  };
}

function markerAttrs(raw: string): Record<string, string> {
  return Object.fromEntries([...raw.matchAll(/(\w+)=(\S+)/g)].map((m) => [m[1], m[2]]));
}

// Canonical (pulled) format: `<!-- learn:book|part|question|answer|extra … -->` markers, each
// followed by its heading; the markers alone decide what every line belongs to.
function parseCanonical(lines: string[], outside: boolean[]): Structure {
  const marks = lines.flatMap((line, i) => {
    const m = outside[i] && line.match(MARKER);
    return m ? [{ line: i, kind: m[1], attrs: markerAttrs(m[2]) }] : [];
  });
  const unaccounted: ParsedBook["unaccounted"] = [];
  const text = (from: number, to: number) => lines.slice(from, to).join("\n").trim();
  // The heading right after a marker (blank lines allowed in between), if there is one.
  const takeHeading = (from: number, to: number) => {
    let i = from;
    while (i < to && !lines[i].trim()) i++;
    const m = i < to && outside[i] ? lines[i].match(HEADING) : null;
    return m ? { title: m[2].trim(), level: m[1].length, next: i + 1 } : { title: "", level: 0, next: from };
  };
  const strayHeadings = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      if (outside[i] && HEADING.test(lines[i])) unaccounted.push({ line: i + 1, heading: lines[i].trim() });
    }
  };

  const bookMark = marks.find((m) => m.kind === "book");
  const structural = marks.filter((m) => m.kind !== "book" && m.kind !== "answer");
  const bookEnd = structural.length ? structural[0].line : lines.length;
  const bookStart = bookMark && bookMark.line < bookEnd ? bookMark.line + 1 : 0;
  const head = takeHeading(bookStart, bookEnd);
  const titled = head.level === 1;

  const parts: ParsedBook["parts"] = [];
  const extras: ParsedBook["extras"] = [];
  const items: Item[] = [];
  let part = "";
  structural.forEach((mark, k) => {
    const end = k + 1 < structural.length ? structural[k + 1].line : lines.length;
    const h = takeHeading(mark.line + 1, end);
    if (mark.kind === "part") {
      part = h.title;
      parts.push({ key: mark.attrs.key ?? slugify(h.title), title: h.title });
      strayHeadings(h.next, end);
    } else if (mark.kind === "extra") {
      extras.push({ key: mark.attrs.key ?? slugify(h.title), title: h.title, body: text(h.next, end) });
    } else {
      const answerMark = marks.find((m) => m.kind === "answer" && m.line > mark.line && m.line < end);
      const item: Item = {
        question: h.title.replace(/^[QBT]\d+[.:]\s*/, ""),
        part,
        prompt: answerMark ? text(h.next, answerMark.line) : "",
        answer: answerMark ? text(answerMark.line + 1, end) : text(h.next, end),
      };
      items.push(mark.attrs.id ? { id: mark.attrs.id, ...item } : item);
    }
  });

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

/** Parses one question book. `bookSlug` prefixes every importKey (repeats get `-2`, `-3`… per book). */
export function parseBook(md: string, bookSlug: string): ParsedBook {
  const lines = md.split(/\r?\n/);
  const outside = fenceMask(lines);
  const canonical = lines.some((line, i) => outside[i] && MARKER.test(line));
  const { items, ...book } = canonical ? parseCanonical(lines, outside) : parseLegacy(lines, outside, bookSlug);
  const key = uniqueKeys();
  const questions: ParsedQuestion[] = items.map((it) => ({
    ...it,
    importKey: key(importKey(bookSlug, it.question, it.prompt)),
  }));
  return { ...book, questions };
}
