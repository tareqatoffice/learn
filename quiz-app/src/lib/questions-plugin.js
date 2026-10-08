// Vite plugin: `import questions from 'virtual:questions'` gives the parsed books, embedded as escaped JSON.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { collect } from './collect.js';
import { safeJson } from './embed.js';

const VIRTUAL_ID = 'virtual:questions';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// The JSON text travels as a JS string literal, so even a minifier that rewrites string escapes
// never sees a "<" character it could turn back into "</script".
export function questionsModuleSource(questions) {
  return `export default JSON.parse(${JSON.stringify(safeJson(questions))});`;
}

export function questionsPlugin(booksDir) {
  return {
    name: 'interview-questions',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { questions, counts } = collect(booksDir);
      for (const file of readdirSync(booksDir)) {
        if (file.toLowerCase().endsWith('.md')) this.addWatchFile(join(booksDir, file));
      }
      Object.entries(counts).forEach(([book, n]) => console.log(`${book.padEnd(24)} ${n}`));
      console.log(`${'TOTAL'.padEnd(24)} ${questions.length}`);
      return questionsModuleSource(questions);
    },
  };
}
