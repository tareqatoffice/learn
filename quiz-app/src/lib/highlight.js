// Tiny offline code highlighter. Output is always HTML-escaped.
const SLASH_LANGS = new Set(['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'java', 'c#', 'csharp', 'cs', 'go', 'rust', 'json']);
const HASH_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'python', 'py', 'dockerfile', 'docker', 'toml', 'ini']);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|from|export|default|class|extends|new|async|await|try|catch|finally|throw|typeof|instanceof|type|interface|enum|public|private|protected|static|void|true|false|null|undefined|this|def|self|None|True|False)\b|(\b\d+(?:\.\d+)?\b)/g;

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(code, lang) {
  const l = (lang || '').toLowerCase();
  const slash = SLASH_LANGS.has(l);
  const hash = HASH_LANGS.has(l);
  if (!slash && !hash) return escapeHtml(code);
  let out = '';
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    last = m.index + m[0].length;
    let cls;
    if (m[1] !== undefined) cls = (m[1][0] === '#' ? hash : slash) ? 'c' : null;
    else if (m[2] !== undefined) cls = 's';
    else if (m[3] !== undefined) cls = 'k';
    else cls = 'n';
    out += cls ? '<span class="hl-' + cls + '">' + escapeHtml(m[0]) + '</span>' : escapeHtml(m[0]);
  }
  return out + escapeHtml(code.slice(last));
}
