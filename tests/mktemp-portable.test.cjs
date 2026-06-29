#!/usr/bin/env node
'use strict';

// Regression guard for BSD/macOS mktemp portability (gsd-core 1.6 #1520).
//
// `mktemp` only expands the trailing run of X's when they are the LAST
// characters of the template. BSD/macOS mktemp (`/usr/bin/mktemp`) does NOT
// expand `foo-XXXXXX.json` — it returns the path with `XXXXXX` literal, so
// concurrent callers collide on one filename. GNU mktemp tolerates a suffix,
// which is why this slips through on Linux. The portable fix is to keep the
// X's at the end (drop the cosmetic extension); temp files here are referenced
// by variable, never by extension.
//
// This test scans workflow + bin sources for `mktemp` templates with a suffix
// after the trailing X's and fails if any reappear. Zero-dep harness mirroring
// tests/version-alignment.test.cjs. CI runs it via `node tests/mktemp-portable.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// A broken template: `mktemp ... XXX...X` immediately followed by a non-X,
// non-terminator char (a suffix like `.json` / `.md`). Terminators that END the
// template token are fine: quote, whitespace, `)`, `;`, `&`, end-of-line.
const BROKEN = /mktemp\b[^\n]*?X{3,}[^\sX"'`)\;&|]/;

function walk(dir, exts, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
}

function offenders() {
  const root = path.join(__dirname, '..');
  const files = [];
  for (const [dir, exts] of [['workflows', ['.md']], ['bin', ['.sh', '.cjs']]]) {
    const d = path.join(root, dir);
    if (fs.existsSync(d)) walk(d, exts, files);
  }
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('mktemp') && BROKEN.test(line)) {
        hits.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return hits;
}

// ─── the detector must catch the known-bad shape ─────────────────────────────

check('BROKEN matches a suffixed template (self-test)', () => {
  assert.ok(BROKEN.test('X=$(mktemp /tmp/foo-XXXXXX.json)'), 'should flag XXXXXX.json');
  assert.ok(BROKEN.test('mktemp "${TMPDIR:-/tmp}/a.XXXXXX.md"'), 'should flag XXXXXX.md');
});

check('BROKEN does NOT match a portable template (X{3,} at end)', () => {
  assert.ok(!BROKEN.test('X=$(mktemp /tmp/foo-XXXXXX)'), 'plain trailing X is fine');
  assert.ok(!BROKEN.test('mktemp "${TMPDIR:-/tmp}/a.XXXXXX")'), 'trailing X before quote is fine');
  assert.ok(!BROKEN.test('mktemp -d /tmp/foo-XXXXXX'), '-d dir form is fine');
});

// ─── the repo must be clean ──────────────────────────────────────────────────

check('no suffixed mktemp templates remain in workflows/ or bin/', () => {
  const hits = offenders();
  assert.strictEqual(hits.length, 0,
    `found non-portable mktemp template(s) — move the X's to the end:\n  ${hits.join('\n  ')}`);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll mktemp-portable tests passed');
