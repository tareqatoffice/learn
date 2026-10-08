'use strict';

// Parses the interview md books into question records. Pure functions, no I/O.
// Record: { question, part, prompt, answer } — prompt is markdown shown with the
// question before the answer is revealed ('' when there is none).

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const PART = /^(part|section)\b/i;
const Q_HEAD = /^Q\d+[.:]\s*(.*)$/;
const SKIP_SECTION = /table of contents|cheat sheets?|preparation plan|prep plan|self-scoring|final advice/i;
const RAPID_FIRE = /rapid-fire/i;
const PUZZLE_QUESTION = 'What does this code output?';

// outside[i] is true when line i is plain markdown (not a fence marker, not inside a fence).
function fenceMask(lines) {
  const outside = [];
  let fence = null;
  for (const line of lines) {
    const f = line.match(FENCE);
    if (f && !fence) {
      fence = f[1];
      outside.push(false);
    } else if (f && f[1][0] === fence[0] && f[1].length >= fence.length && f[2].trim() === '') {
      fence = null;
      outside.push(false);
    } else {
      outside.push(!fence);
    }
  }
  return outside;
}

function scanHeadings(lines) {
  const outside = fenceMask(lines);
  const headings = [];
  lines.forEach((line, i) => {
    if (!outside[i]) return;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) headings.push({ line: i, level: m[1].length, text: m[2].trim() });
  });
  return headings;
}

function cleanAnswer(text) {
  let t = text.trim();
  let prev;
  do {
    prev = t;
    t = t.replace(/(^|\n)---$/, '').trim();
  } while (t !== prev);
  return t;
}

// Line where the body of heading #idx ends: the next heading of the same or higher level.
function bodyEnd(lines, headings, idx) {
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j].level <= headings[idx].level) return headings[j].line;
  }
  return lines.length;
}

function sliceAnswer(lines, headings, idx) {
  return cleanAnswer(lines.slice(headings[idx].line + 1, bodyEnd(lines, headings, idx)).join('\n'));
}

// "Predict the result" questions: snippet first, then <details><summary>Answer</summary> … </details>.
function splitDetails(body) {
  const lines = body.split('\n');
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
    prompt: cleanAnswer(lines.slice(0, open).join('\n')),
    answer: cleanAnswer(lines.slice(open + 1, close).concat(lines.slice(close + 1)).join('\n')),
  };
}

// Untitled puzzles ("### Q61."): leading code block(s) are the question, the rest is the answer.
function splitLeadingCode(body) {
  const lines = body.split('\n');
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
  return { prompt: cleanAnswer(lines.slice(0, end).join('\n')), answer: cleanAnswer(lines.slice(end).join('\n')) };
}

function questionRecord(title, part, body) {
  const details = splitDetails(body);
  if (title) return { question: title, part, prompt: details ? details.prompt : '', answer: details ? details.answer : body };
  const split = details || splitLeadingCode(body);
  return { question: PUZZLE_QUESTION, part, prompt: split.prompt, answer: split.answer };
}

// Question-like items in sections that are not Q headings: bold numbered prompts
// ("**1. Design a URL shortener.**" + answer lines), quoted bold bullets
// ("- **"Tell me about…"** answer"), and "| Question | Answer |" tables.
function sectionExtras(text, part) {
  const lines = text.split('\n');
  const outside = fenceMask(lines);
  const out = [];
  let open = null;
  const flush = () => {
    if (open) out.push({ question: open.question, part, prompt: '', answer: cleanAnswer(open.lines.join('\n')) });
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
        out.push({ question: m[1].trim(), part, prompt: '', answer: m[2].trim() });
        continue;
      }
    }
    if (
      outside[i] && outside[i + 1] &&
      /^\|\s*(question|q)\s*\|\s*(answer|a)\s*\|\s*$/i.test(line) &&
      /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')
    ) {
      flush();
      let j = i + 2;
      for (; j < lines.length && outside[j] && /^\|.*\|\s*$/.test(lines[j]); j++) {
        const cells = lines[j].trim().slice(1, -1).split('|').map((c) => c.trim());
        out.push({ question: cells[0], part, prompt: '', answer: cells.slice(1).join(' | ') });
      }
      i = j - 1;
      continue;
    }
    if (open) open.lines.push(line);
  }
  flush();
  return out;
}

function parseQuestionHeadings(md) {
  const lines = md.split(/\r?\n/);
  const headings = scanHeadings(lines);
  const out = [];
  let part = null;
  let section = null;
  let insideQ = -1; // line where the current Q's body ends
  headings.forEach((h, i) => {
    const q = (h.level === 2 || h.level === 3) && h.text.match(Q_HEAD);
    if (q) {
      out.push(questionRecord(q[1].trim(), part || section || '', sliceAnswer(lines, headings, i)));
      insideQ = bodyEnd(lines, headings, i);
      return;
    }
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      section = null;
    } else if (h.level === 2) {
      section = h.text;
    }
    if (h.level >= 2 && h.line >= insideQ && !SKIP_SECTION.test(h.text)) {
      const next = i + 1 < headings.length ? headings[i + 1].line : lines.length;
      out.push(...sectionExtras(lines.slice(h.line + 1, next).join('\n'), part || section || ''));
    }
  });
  return out;
}

function splitRapidFire(text) {
  const lines = text.split('\n');
  const outside = fenceMask(lines);
  const items = [];
  lines.forEach((line, i) => {
    const m = outside[i] && line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m) items.push({ question: m[1].trim(), answer: m[2].trim() });
    else if (items.length) items[items.length - 1].answer += '\n' + line;
  });
  return items.map((it) => ({ question: it.question, answer: cleanAnswer(it.answer) }));
}

function parseNumberedSections(md) {
  const lines = md.split(/\r?\n/);
  const headings = scanHeadings(lines);
  const out = [];
  let part = '';
  headings.forEach((h, i) => {
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      return;
    }
    if (h.level !== 2) return;
    const m = h.text.match(/^(\d+)\.\s+(.+)$/);
    if (!m || SKIP_SECTION.test(m[2])) return;
    const title = m[2].trim();
    const answer = sliceAnswer(lines, headings, i);
    if (RAPID_FIRE.test(title)) {
      splitRapidFire(answer).forEach((r) => out.push({ question: r.question, part, prompt: '', answer: r.answer }));
      return;
    }
    out.push({ question: /^Design\b/i.test(title) ? title : `Explain: ${title}`, part, prompt: '', answer });
  });
  return out;
}

function parseFile(md, fileName) {
  const found = parseQuestionHeadings(md);
  const items = found.length ? found : parseNumberedSections(md);
  if (items.length === 0) throw new Error(`No questions found in ${fileName}`);
  return items;
}

module.exports = { parseFile, parseQuestionHeadings, parseNumberedSections };
