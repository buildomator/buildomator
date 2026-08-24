#!/usr/bin/env node
'use strict';

// Regression guard: the frontmatter parser must tolerate a single leading
// UTF-8 BOM (U+FEFF) before the byte-0 `---` fence. Windows tooling such as
// PowerShell Out-File writes a BOM by default; without the strip the fence
// match fails, the parse collapses to an empty object, and every frontmatter
// field silently vanishes. Scope is BOM only: one codepoint, no broader
// tolerance of pre-fence whitespace or comments.
//
// Zero-dep harness mirroring tests/mktemp-portable.test.cjs. CI runs it via
// `node tests/frontmatter-bom.test.cjs`.

const assert = require('node:assert');
const { extractFrontmatter } = require('../bin/lib/frontmatter.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

const BODY = '---\nphase: 01-x\nplan: 2\n---\nbody';

check('BOM-prefixed doc parses to the same object as its BOM-less twin', () => {
  const withBom = extractFrontmatter('﻿' + BODY);
  const withoutBom = extractFrontmatter(BODY);
  assert.deepStrictEqual(withBom, withoutBom);
  assert.strictEqual(withBom.phase, '01-x');
  assert.strictEqual(withBom.plan, '2');
});

check('BOM-less docs parse unchanged', () => {
  const fm = extractFrontmatter(BODY);
  assert.strictEqual(fm.phase, '01-x');
  assert.strictEqual(fm.plan, '2');
});

check('doc with no frontmatter but a leading BOM returns an empty object', () => {
  const fm = extractFrontmatter('﻿just body text, no fence');
  assert.deepStrictEqual(fm, {});
});

check('a BOM appearing later in the body does not affect parsing', () => {
  const withMidBom = extractFrontmatter(BODY.replace('body', 'bo﻿dy'));
  const plain = extractFrontmatter(BODY);
  assert.deepStrictEqual(withMidBom, plain);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll frontmatter-bom tests passed');
