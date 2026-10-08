<script>
  import { renderBlock, renderInline } from '../lib/markdown.js';

  let { source, inline = false, class: cls = '' } = $props();
  const html = $derived(inline ? renderInline(source) : renderBlock(source));
</script>

{#if inline}
  <span class={cls}>{@html html}</span>
{:else}
  <div class={cls}>{@html html}</div>
{/if}
