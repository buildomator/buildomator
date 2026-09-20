#!/usr/bin/env node
'use strict';

// Regression guard: bin/lib/state-document.generated.cjs must be a fresh
// projection of sdk/src/query/state-document.ts produced by the committed
// generator. Regenerate to a temp path and byte-compare to the committed file,
// and confirm the generator's --check mode exits clean.
//
// Zero-dep harness mirroring tests/frontmatter-bom.test.cjs. CI runs it via
// `node tests/state-document-generated-fresh.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GEN = path.join(__dirname, '..', 'sdk', 'scripts', 'gen-state-document.mjs');
const COMMITTED = path.join(__dirname, '..', 'bin', 'lib', 'state-document.generated.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

check('regenerating to a temp path yields bytes identical to the committed file', () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gen-state-')), 'out.cjs');
  try {
    execFileSync(process.execPath, [GEN, '--out', tmp], { encoding: 'utf-8' });
    const fresh = fs.readFileSync(tmp);
    const committed = fs.readFileSync(COMMITTED);
    assert.ok(fresh.equals(committed), 'committed generated cjs is stale; run: cd sdk && npm run gen:state-document');
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
});

check('generator --check exits 0 against the committed file', () => {
  execFileSync(process.execPath, [GEN, '--check'], { encoding: 'utf-8' });
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll state-document-generated-fresh tests passed');
