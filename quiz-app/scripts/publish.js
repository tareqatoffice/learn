// Copies the single-file build to quiz-app/quiz.html, the committed, double-clickable quiz.
import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertSingleScript } from '../src/lib/embed.js';

const from = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const to = fileURLToPath(new URL('../quiz.html', import.meta.url));
// Refuse to publish a page whose inline script could be cut short.
assertSingleScript(readFileSync(from, 'utf8'));
copyFileSync(from, to);
console.log(`Published ${to}`);
