// Pure deck/progress helpers used by the Svelte app. No DOM, no storage.

function shuffle(arr, rand) {
  const r = rand || Math.random;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function filterQuestions(all, books, part) {
  return all.filter((q) => (books.size === 0 || books.has(q.book)) && (!part || q.part === part));
}

function buildDeck(all, opts, rand) {
  const ids = filterQuestions(all, opts.books, opts.part).map((q) => q.id);
  return opts.mode === 'shuffle' ? shuffle(ids, rand) : ids;
}

function requeue(deck, pos, id, rand) {
  const r = rand || Math.random;
  const at = Math.min(deck.length, pos + 1 + 4 + Math.floor(r() * 5));
  const out = deck.slice();
  out.splice(at, 0, id);
  return out;
}

function emptyProgress() {
  return { got: [], review: [], seen: [] };
}

function addUnique(arr, id) {
  return arr.includes(id) ? arr : arr.concat(id);
}

function markProgress(p, id, kind) {
  const other = kind === 'got' ? 'review' : 'got';
  const next = { got: p.got, review: p.review, seen: p.seen };
  next[kind] = addUnique(p[kind], id);
  next[other] = p[other].filter((x) => x !== id);
  return next;
}

function markSeen(p, id) {
  return { got: p.got, review: p.review, seen: addUnique(p.seen, id) };
}

export { shuffle, filterQuestions, buildDeck, requeue, emptyProgress, markProgress, markSeen };
