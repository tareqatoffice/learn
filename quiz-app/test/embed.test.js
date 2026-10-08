import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJson, assertSingleScript } from '../src/lib/embed.js';
import { questionsModuleSource } from '../src/lib/questions-plugin.js';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

test('safeJson escapes <, U+2028 and U+2029 and still round-trips', () => {
  const value = [{ q: 'a </script><!-- ' + LS + ' $& $`', p: PS }];
  const out = safeJson(value);
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes(LS));
  assert.ok(!out.includes(PS));
  assert.deepEqual(JSON.parse(out), value);
});

test('assertSingleScript accepts one inline script and rejects any other </script form', () => {
  const ok = '<html><script type="module">var a=1;</script></html>';
  assert.doesNotThrow(() => assertSingleScript(ok));
  assert.throws(() => assertSingleScript('<html></html>'), /<script/);
  assert.throws(() => assertSingleScript(ok.replace('var a=1;', 'x="</script >"')), /<\/script/);
  assert.throws(() => assertSingleScript(ok.replace('var a=1;', 'x="</SCRIPT>"')), /<\/script/);
  assert.throws(() => assertSingleScript(ok + '<script src="a.js"></script>'), /<script/);
});

test('questions module source has no raw < and evaluates to the data', async () => {
  const value = [{ id: 'x-1', q: '</script> <!-- ' + LS }];
  const src = questionsModuleSource(value);
  assert.ok(!src.includes('<'));
  const mod = await import('data:text/javascript,' + encodeURIComponent(src));
  assert.deepEqual(mod.default, value);
});
