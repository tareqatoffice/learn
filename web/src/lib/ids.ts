/** Lowercase, hyphen-separated slug. Runs of non-alphanumerics (including dashes like "—") collapse into one hyphen. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** FNV-1a hash in base 36. Byte-for-byte port of `fnv1a` in quiz-app/src/lib/collect.js. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Stable identity of a legacy question, equal to the id the quiz-app derives for it. */
export function importKey(bookSlug: string, question: string, prompt: string): string {
  return `${bookSlug}-${fnv1a(question + "\n" + prompt)}`;
}
