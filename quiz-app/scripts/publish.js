// Copies the single-file build to quiz-app/quiz.html, the committed, double-clickable quiz.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const to = fileURLToPath(new URL('../quiz.html', import.meta.url));
copyFileSync(from, to);
console.log(`Published ${to}`);
