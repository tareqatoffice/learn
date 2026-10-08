// JSON that is safe to place inside an inline <script>: no raw "<" (so no "</script" or "<!--"),
// and no U+2028/U+2029. The characters are built from char codes on purpose (see plan constraints).
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}
