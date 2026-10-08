<script>
  import Markdown from './Markdown.svelte';

  let { q, position, total, revealed, gotBefore, reviewMarked, onReveal, onMark, onNext } = $props();
</script>

<div class="meta">
  <span class="tag">{q.book}</span>
  {#if q.part}<span>{q.part}</span>{/if}
  <span>Question {position} of {total}</span>
  {#if gotBefore}<span class="badge-got">✓ got it before</span>{/if}
  {#if reviewMarked}<span class="badge-review">↻ marked for review</span>{/if}
</div>

<h2 class="question"><Markdown source={q.question} inline /></h2>

{#if q.prompt}
  <Markdown source={q.prompt} class="md prompt" />
{/if}

{#if revealed}
  <Markdown source={q.answer || '_No answer text._'} class="md answer" />
{/if}

<div class="actions">
  {#if !revealed}
    <button type="button" class="btn primary" onclick={onReveal}>Show answer<kbd>Space</kbd></button>
  {:else}
    <button type="button" class="btn review" onclick={() => onMark('review')}>Review again<kbd>R</kbd></button>
    <button type="button" class="btn got" onclick={() => onMark('got')}>Got it<kbd>G</kbd></button>
  {/if}
  <button type="button" class="btn" onclick={onNext}>Next<kbd>→</kbd></button>
</div>
