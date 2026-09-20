#!/usr/bin/env node
'use strict';

// Regression guard: STATE.md field read/write must be line-anchored and confined
// to same-line horizontal whitespace. An empty bold field must never consume the
// following data line, and a mid-line prose lookalike (`... **Status:** ...`)
// must never be read as the field row or overwritten by a field write. Covers
// both the pure helpers (state-document.cjs) and the `state get` CLI reader.
//
// Zero-dep harness mirroring tests/frontmatter-bom.test.cjs. CI runs it via
// `node tests/state-field-line-anchor.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { stateExtractField, stateReplaceField } = require('../bin/lib/state-document.cjs');
const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

check('empty bold field write does not eat the next data line', () => {
  const c = '**Status:**\n**Progress:** 3/10 total_phases\n';
  const r = stateReplaceField(c, 'Status', 'Ready');
  assert.ok(r.includes('**Progress:** 3/10 total_phases'), 'next line survives');
  assert.ok(/^\*\*Status:\*\* Ready$/m.test(r), 'field row rewritten with a space');
});

check('prose lookalike above the real row is not read and not overwritten', () => {
  const c = 'Note that **Status:** in prose is not a row.\n**Status:** real\n';
  assert.strictEqual(stateExtractField(c, 'Status'), 'real');
  const r = stateReplaceField(c, 'Status', 'X');
  assert.ok(r.includes('Note that **Status:** in prose is not a row.'), 'prose untouched');
  assert.ok(/^\*\*Status:\*\* X$/m.test(r), 'only the real row rewritten');
});

check('only a prose lookalike, no real row, extracts null', () => {
  assert.strictEqual(stateExtractField('Note that **Status:** in prose.\n', 'Status'), null);
});

check('indented real row is honored and indentation preserved', () => {
  assert.strictEqual(stateExtractField('  **Status:** indented\n', 'Status'), 'indented');
  const r = stateReplaceField('  **Status:** indented\n', 'Status', 'new');
  assert.ok(/^  \*\*Status:\*\* new$/m.test(r), 'indentation preserved: ' + JSON.stringify(r));
});

check('plain empty field write does not eat the next line', () => {
  const r = stateReplaceField('Status:\nnext: keep\n', 'Status', 'v');
  assert.ok(r.includes('next: keep'), 'next line survives: ' + JSON.stringify(r));
});

check('existing bold value replace stays byte-exact', () => {
  assert.strictEqual(
    stateReplaceField('**Status:** old value\n', 'Status', 'new value'),
    '**Status:** new value\n',
  );
});

check('state get reads the real indented row past a prose lookalike', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-anchor-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  fs.writeFileSync(
    path.join(planning, 'STATE.md'),
    'Note that **Status:** in prose.\n  **Status:** Ready to execute\n',
    'utf-8',
  );
  try {
    const out = execFileSync(process.execPath, [GSD_TOOLS, 'state', 'get', 'Status'], {
      cwd: dir, encoding: 'utf-8',
    });
    const data = JSON.parse(out);
    assert.strictEqual(data.Status, 'Ready to execute', 'state get value: ' + out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll state-field-line-anchor tests passed');
