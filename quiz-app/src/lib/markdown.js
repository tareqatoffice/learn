// marked 12 configured with the highlighter. marked 12.x renderer signature: code(code, infostring, escaped).
import { marked } from 'marked';
import { escapeHtml, highlight } from './highlight.js';

marked.use({
  gfm: true,
  renderer: {
    code(code, infostring) {
      const lang = ((infostring || '').match(/^\S*/) || [''])[0];
      return '<pre><code class="lang-' + escapeHtml(lang) + '">' + highlight(code, lang) + '\n</code></pre>\n';
    },
  },
});

export const renderBlock = (md) => marked.parse(md);
export const renderInline = (md) => marked.parseInline(md);
