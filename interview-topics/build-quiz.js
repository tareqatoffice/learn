#!/usr/bin/env node
'use strict';

// Builds quiz.html from every *.md in this folder.
// Usage: node interview-topics/build-quiz.js   (re-run after editing any md file)

const fs = require('node:fs');
const path = require('node:path');
const { parseFile } = require('./quiz-src/parse');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'quiz-src');
const OUT = path.join(ROOT, 'quiz.html');
const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js';

const BOOK_NAMES = {
  'css-questions-ebook.md': 'CSS',
  'frontend-interview-bl.md': 'Frontend Interview',
  'frontend-system-design-ebook.md': 'Frontend System Design',
  'html-questions-ebook.md': 'HTML',
  'javascript-explained-ebook.md': 'JavaScript',
  'nestjs-interview-guide.md': 'NestJS',
  'nextjs-questions-ebook.md': 'Next.js',
  'nodejs-questions-ebook.md': 'Node.js',
  'react-questions-ebook.md': 'React',
};

function bookName(file) {
  return (
    BOOK_NAMES[file] ||
    file.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function slug(file) {
  return file.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function collect(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  if (files.length === 0) throw new Error(`No .md files in ${dir}`);
  const used = new Set();
  const questions = [];
  const counts = {};
  for (const file of files) {
    const md = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!md.trim()) throw new Error(`Empty file: ${file}`);
    const book = bookName(file);
    const items = parseFile(md, file);
    counts[book] = items.length;
    for (const item of items) {
      const base = `${slug(file)}-${fnv1a(item.question + '\n' + item.prompt)}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      questions.push({ id, book, part: item.part, question: item.question, prompt: item.prompt, answer: item.answer });
    }
  }
  return { questions, counts };
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// "</script" would end the inline <script> early; "<\/script" means the same inside JS strings,
// regexes and comments.
function inlineScript(src) {
  return src.replace(/<\/(script)/gi, (m, word) => '<\\/' + word);
}

// split/join (not String.replace) so "$&" and friends in the data are never interpreted.
function renderHtml({ questions, template, markedSrc, deckSrc }) {
  const slots = [
    ['/*__MARKED__*/', inlineScript(markedSrc)],
    ['/*__DECK__*/', inlineScript(deckSrc)],
    ['/*__DATA__*/[]', safeJson(questions)], // last, so injected text is never re-scanned
  ];
  let html = template;
  for (const [slot, value] of slots) {
    if (!html.includes(slot)) throw new Error(`template missing slot ${slot}`);
    html = html.split(slot).join(value);
  }
  return html;
}

function main() {
  const markedPath = path.join(SRC, 'vendor', 'marked.min.js');
  if (!fs.existsSync(markedPath)) {
    throw new Error(`Missing ${markedPath}\nDownload it once:\n  curl -L -o "${markedPath}" ${MARKED_URL}`);
  }
  const { questions, counts } = collect(ROOT);
  const html = renderHtml({
    questions,
    template: fs.readFileSync(path.join(SRC, 'template.html'), 'utf8'),
    markedSrc: fs.readFileSync(markedPath, 'utf8'),
    deckSrc: fs.readFileSync(path.join(SRC, 'deck.js'), 'utf8'),
  });
  fs.writeFileSync(OUT, html);
  Object.entries(counts).forEach(([book, n]) => console.log(`${book.padEnd(24)} ${n}`));
  console.log(`${'TOTAL'.padEnd(24)} ${questions.length}`);
  console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
}

module.exports = { collect, renderHtml };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
