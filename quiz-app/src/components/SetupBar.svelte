<script>
  import { releasePointerFocus as release } from '../lib/focus.js';

  let { books, counts, total, selected, parts, part, mode, onToggleBook, onAllBooks, onPart, onMode, onReset } = $props();

  // A mouse-used control gives up focus so the card shortcuts (Space, arrows, G, R) keep working;
  // keyboard users keep their place. A select has no click detail, so remember how it was opened.
  let selectViaPointer = false;
</script>

<section class="setup" aria-label="Choose questions">
  <div class="chips" role="group" aria-label="Books">
    <button type="button" class="chip" aria-pressed={String(selected.length === 0)}
      onclick={(e) => { release(e); onAllBooks(); }}>
      All books <span class="count">{total}</span>
    </button>
    {#each books as book (book)}
      <button type="button" class="chip" aria-pressed={String(selected.includes(book))}
        onclick={(e) => { release(e); onToggleBook(book); }}>
        {book} <span class="count">{counts[book]}</span>
      </button>
    {/each}
  </div>
  <div class="row">
    {#if parts.length > 1}
      <label>Part
        <select value={part}
          onpointerdown={() => { selectViaPointer = true; }}
          onblur={() => { selectViaPointer = false; }}
          onchange={(e) => { const v = e.currentTarget.value; if (selectViaPointer) e.currentTarget.blur(); onPart(v); }}>
          <option value="">All parts</option>
          {#each parts as p (p)}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
    {/if}
    <div class="seg" role="group" aria-label="Order">
      <button type="button" aria-pressed={String(mode === 'shuffle')} onclick={(e) => { release(e); onMode('shuffle'); }}>Shuffle</button>
      <button type="button" aria-pressed={String(mode === 'browse')} onclick={(e) => { release(e); onMode('browse'); }}>Browse</button>
    </div>
    <button type="button" class="ghost" onclick={(e) => { release(e); onReset(); }}>Reset progress</button>
  </div>
</section>
