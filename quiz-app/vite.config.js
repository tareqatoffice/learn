import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { questionsPlugin } from './src/lib/questions-plugin.js';

const BOOKS_DIR = fileURLToPath(new URL('../interview-topics', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [questionsPlugin(BOOKS_DIR), svelte(), viteSingleFile()],
});
