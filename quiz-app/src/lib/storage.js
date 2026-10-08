// Progress persistence. Never throws: blocked or corrupt storage falls back to empty progress.
import { emptyProgress } from './deck.js';

export const STORE_KEY = 'interviewQuiz.progress.v1';

const defaultStorage = () => globalThis.localStorage;

function ids(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function loadProgress(getStorage = defaultStorage) {
  try {
    const raw = getStorage().getItem(STORE_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw);
    return { got: ids(p && p.got), review: ids(p && p.review), seen: ids(p && p.seen) };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress, getStorage = defaultStorage) {
  try {
    getStorage().setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    // storage blocked: keep going without persistence
  }
}
