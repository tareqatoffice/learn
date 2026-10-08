<script>
  import questions from 'virtual:questions';
  import SetupBar from './components/SetupBar.svelte';
  import QuestionCard from './components/QuestionCard.svelte';
  import { buildDeck, filterQuestions, requeue, emptyProgress, markProgress, markSeen } from './lib/deck.js';
  import { loadProgress, saveProgress } from './lib/storage.js';

  const books = [...new Set(questions.map((q) => q.book))];
  const bookCounts = Object.fromEntries(books.map((b) => [b, questions.filter((q) => q.book === b).length]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  let selected = $state([]); // book names; empty = all books
  let part = $state('');
  let mode = $state('shuffle');
  let deck = $state([]);
  let pos = $state(0);
  let revealed = $state(false);
  let progress = $state(loadProgress());
  let cardEl = $state(null);

  const parts = $derived(
    selected.length === 1
      ? [...new Set(questions.filter((q) => q.book === selected[0] && q.part).map((q) => q.part))]
      : []
  );
  const current = $derived(pos < deck.length ? byId.get(deck[pos]) : null);
  const stats = $derived.by(() => {
    const scope = filterQuestions(questions, new Set(selected), part);
    const count = (list) => {
      const set = new Set(list);
      return scope.filter((q) => set.has(q.id)).length;
    };
    return { total: scope.length, seen: count(progress.seen), got: count(progress.got), review: count(progress.review) };
  });

  function save(next) {
    progress = next;
    saveProgress(next);
  }

  function markCurrentSeen() {
    if (current) save(markSeen(progress, current.id));
  }

  function newDeck() {
    deck = buildDeck(questions, { books: new Set(selected), part, mode });
    pos = 0;
    revealed = false;
    markCurrentSeen();
  }

  function toggleBook(book) {
    selected = selected.includes(book) ? selected.filter((b) => b !== book) : [...selected, book];
    part = '';
    newDeck();
  }

  function allBooks() {
    selected = [];
    part = '';
    newDeck();
  }

  function setPart(p) {
    part = p;
    newDeck();
  }

  function setMode(m) {
    mode = m;
    newDeck();
  }

  function resetProgress() {
    if (!window.confirm('Reset all saved progress?')) return;
    save(emptyProgress());
    newDeck();
  }

  function reveal() {
    if (current && !revealed) revealed = true;
  }

  function advance() {
    if (!current) return;
    pos += 1;
    revealed = false;
    markCurrentSeen();
    if (cardEl) cardEl.scrollIntoView({ block: 'start' });
  }

  function mark(kind) {
    const q = current;
    if (!q || !revealed) return;
    save(markProgress(progress, q.id, kind));
    if (kind === 'review') deck = requeue(deck, pos, q.id);
    advance();
  }

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      if (tag === 'BUTTON') return; // the focused button handles Space itself
      e.preventDefault();
      reveal();
    } else if (e.key === 'ArrowRight') {
      advance();
    } else if (e.key === 'g' || e.key === 'G') {
      mark('got');
    } else if (e.key === 'r' || e.key === 'R') {
      mark('review');
    }
  }

  newDeck();
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <header class="top">
    <h1>Interview Quiz</h1>
    <div class="stats" aria-live="polite">
      {stats.seen} / {stats.total} seen · {stats.got} got it · {stats.review} to review
    </div>
  </header>

  <SetupBar
    {books}
    counts={bookCounts}
    total={questions.length}
    {selected}
    {parts}
    {part}
    {mode}
    onToggleBook={toggleBook}
    onAllBooks={allBooks}
    onPart={setPart}
    onMode={setMode}
    onReset={resetProgress}
  />

  <section class="card" bind:this={cardEl} aria-live="polite">
    {#if deck.length === 0}
      <div class="empty"><p>No questions match this filter.</p></div>
    {:else if !current}
      <div class="empty">
        <p>Deck finished. Nice work.</p>
        <button type="button" class="btn primary" onclick={newDeck}>Start again</button>
      </div>
    {:else}
      <QuestionCard
        q={current}
        position={pos + 1}
        total={deck.length}
        {revealed}
        gotBefore={progress.got.includes(current.id)}
        reviewMarked={progress.review.includes(current.id)}
        onReveal={reveal}
        onMark={mark}
        onNext={advance}
      />
    {/if}
  </section>
</main>
