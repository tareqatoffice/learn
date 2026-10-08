// Reads every *.md book in a folder and turns it into question records with stable ids.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile } from './parse.js';

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

export function collect(dir) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  if (files.length === 0) throw new Error(`No .md files in ${dir}`);
  const used = new Set();
  const questions = [];
  const counts = {};
  for (const file of files) {
    const md = readFileSync(join(dir, file), 'utf8');
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
