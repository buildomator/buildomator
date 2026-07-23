#!/usr/bin/env node
'use strict';

// Round-trip regression for the CJS frontmatter serializer/parser.
//
// reconstructFrontmatter must emit VALID YAML for unsafe scalars (embedded
// quotes/backslashes, leading structural indicators, surrounding whitespace,
// the empty string), and extractFrontmatter must read them back unchanged so
// that extractFrontmatter(reconstructFrontmatter(x)) === x.
//
// The parser does NOT type-coerce, so numeric-looking strings and reserved
// words already round-trip bare and MUST STAY BARE — quoting them would be
// over-reach. The stay-bare guards below lock that in. The exact-output
// assertions mirror the SDK unit test so the two twins stay byte-identical.

const assert = require('node:assert');
const fm = require('../bin/lib/frontmatter.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function roundtrip(value) {
  const doc = `---\n${fm.reconstructFrontmatter({ k: value })}\n---\n`;
  return fm.extractFrontmatter(doc).k;
}

// ─── Exact output: unsafe scalars are quoted and escaped ───────────────────────

check('embedded quotes are escaped', () => {
  assert.strictEqual(fm.reconstructFrontmatter({ k: 'a "b": c' }), 'k: "a \\"b\\": c"');
});

check('backslashes are escaped when a value is quoted', () => {
  // C:\temp needs quoting (colon); its backslash must be doubled -> k: "C:\\temp"
  assert.strictEqual(fm.reconstructFrontmatter({ k: 'C:\\temp' }), 'k: "C:\\\\temp"');
});

check('leading YAML indicator is quoted', () => {
  assert.strictEqual(fm.reconstructFrontmatter({ k: '- leading' }), 'k: "- leading"');
});

check('leading/trailing whitespace is quoted', () => {
  assert.strictEqual(fm.reconstructFrontmatter({ k: ' spaced ' }), 'k: " spaced "');
});

check('empty string is quoted', () => {
  assert.strictEqual(fm.reconstructFrontmatter({ k: '' }), 'k: ""');
});

// ─── Round-trip invariant for unsafe scalars ──────────────────────────────────

check('round-trips embedded quotes', () => {
  assert.strictEqual(roundtrip('a "b": c'), 'a "b": c');
});

check('round-trips backslash + quote', () => {
  assert.strictEqual(roundtrip('a\\"b'), 'a\\"b');
});

check('round-trips a Windows-style path (colon + backslash)', () => {
  assert.strictEqual(roundtrip('C:\\temp'), 'C:\\temp');
});

check('round-trips leading indicator', () => {
  assert.strictEqual(roundtrip('- leading'), '- leading');
});

check('round-trips surrounding whitespace', () => {
  assert.strictEqual(roundtrip(' spaced '), ' spaced ');
});

check('round-trips the empty string', () => {
  assert.strictEqual(roundtrip(''), '');
});

// ─── Stay-bare guards (over-reach protection) ──────────────────────────────────

check('numeric-looking strings stay bare', () => {
  assert.strictEqual(fm.reconstructFrontmatter({ k: '10' }), 'k: 10');
  assert.strictEqual(fm.reconstructFrontmatter({ k: '01' }), 'k: 01');
  assert.strictEqual(fm.reconstructFrontmatter({ k: '1.5' }), 'k: 1.5');
});

check('reserved words stay bare', () => {
  for (const w of ['yes', 'no', 'true', 'false', 'null', 'on', 'off', '~']) {
    assert.strictEqual(fm.reconstructFrontmatter({ k: w }), `k: ${w}`);
  }
});

check('stay-bare scalars round-trip as strings', () => {
  for (const v of ['10', '01', '1.5', 'yes', 'no', 'true', 'false', 'null', 'on', 'off', '~']) {
    assert.strictEqual(roundtrip(v), v);
  }
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll frontmatter round-trip checks passed');
