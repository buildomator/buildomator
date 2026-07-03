#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/drift-allowlist.cjs.
//
// Covers DRIFT-03: committed pre-seeded allowlist + never-throw loader +
// pair/ignore suppression auditability (D-07).
//
// Zero-dep harness mirroring tests/conventions.test.cjs: node:assert,
// a bare check(name, fn) runner, a failure counter, and a process.exit(1)
// footer. CI runs this directly via `node tests/drift-allowlist.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const allowlist = require('../bin/lib/drift-allowlist.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── exports ─────────────────────────────────────────────────────────────────

check('exports the public functions', () => {
  for (const f of ['load', 'isSuppressed']) {
    assert.strictEqual(typeof allowlist[f], 'function', `missing ${f}`);
  }
});

// ─── load: never-throw on missing file ──────────────────────────────────────

check('load returns {pairs:[], ignore:[]} on missing .gsd/drift-allowlist.json', () => {
  const result = allowlist.load('/nonexistent-xyz-directory-12345');
  assert.ok(Array.isArray(result.pairs), 'pairs should be an array');
  assert.ok(Array.isArray(result.ignore), 'ignore should be an array');
  assert.strictEqual(result.pairs.length, 0, 'pairs should be empty on missing file');
  assert.strictEqual(result.ignore.length, 0, 'ignore should be empty on missing file');
});

// ─── load: never-throw on malformed JSON ────────────────────────────────────

check('load returns empty-but-valid on malformed JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-test-'));
  const gsdDir = path.join(tmpDir, '.gsd');
  fs.mkdirSync(gsdDir, { recursive: true });
  fs.writeFileSync(path.join(gsdDir, 'drift-allowlist.json'), 'THIS IS NOT JSON }{garbage');
  try {
    const result = allowlist.load(tmpDir);
    assert.ok(Array.isArray(result.pairs), 'pairs should be an array');
    assert.ok(Array.isArray(result.ignore), 'ignore should be an array');
    assert.strictEqual(result.pairs.length, 0, 'pairs should be empty on malformed JSON');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── isSuppressed: matching intentional pair ─────────────────────────────────

check('isSuppressed returns {suppressed:true, reason} when pair matches (a->b direction)', () => {
  const allow = {
    pairs: [{ a: 'bin/lib/**', b: 'sdk/src/**', reason: 'Dual CJS/SDK runtime resolver' }],
    ignore: [],
  };
  const result = allowlist.isSuppressed('bin/lib/x.cjs', 'sdk/src/x.ts', allow);
  assert.strictEqual(result.suppressed, true, 'should be suppressed');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'reason should be non-empty');
});

check('isSuppressed returns {suppressed:true, reason} when pair matches (b->a symmetric direction)', () => {
  const allow = {
    pairs: [{ a: 'bin/lib/**', b: 'sdk/src/**', reason: 'Dual CJS/SDK runtime resolver' }],
    ignore: [],
  };
  // Symmetric: swap fileA and fileB — should still suppress
  const result = allowlist.isSuppressed('sdk/src/x.ts', 'bin/lib/x.cjs', allow);
  assert.strictEqual(result.suppressed, true, 'should be suppressed (symmetric)');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'reason should be non-empty (symmetric)');
});

// ─── isSuppressed: non-matching pair ────────────────────────────────────────

check('isSuppressed returns {suppressed:false} when no pair matches', () => {
  const allow = {
    pairs: [{ a: 'bin/lib/**', b: 'sdk/src/**', reason: 'Dual CJS/SDK runtime resolver' }],
    ignore: [],
  };
  const result = allowlist.isSuppressed('bin/lib/x.cjs', 'bin/lib/y.cjs', allow);
  assert.strictEqual(result.suppressed, false, 'should not be suppressed');
  assert.strictEqual(result.reason, undefined, 'reason should be absent');
});

// ─── isSuppressed: empty allow ───────────────────────────────────────────────

check('isSuppressed with empty allow returns {suppressed:false}', () => {
  const result = allowlist.isSuppressed('bin/lib/x.cjs', 'sdk/src/x.ts', { pairs: [], ignore: [] });
  assert.strictEqual(result.suppressed, false, 'should not be suppressed with empty allow');
});

// ─── committed .gsd/drift-allowlist.json pre-seeded rule ────────────────────

check('committed .gsd/drift-allowlist.json parses and contains the bin/lib<->sdk/src pair with reason', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const raw = fs.readFileSync(path.join(repoRoot, '.gsd', 'drift-allowlist.json'), 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.intentional), 'intentional should be an array');
  const hasPair = parsed.intentional.some(
    (p) => /bin\/lib/.test(p.a + p.b) && /sdk\/src/.test(p.a + p.b) && typeof p.reason === 'string' && p.reason.length > 0
  );
  assert.ok(hasPair, 'should contain a bin/lib<->sdk/src pair with a non-empty reason');
});

// ─── isIgnored: .vibedriftignore corpus exclusion ────────────────────────────

check('exports isIgnored', () => {
  assert.strictEqual(typeof allowlist.isIgnored, 'function');
});

check('isIgnored: glob entry excludes a matching file only', () => {
  const allow = { pairs: [], ignore: ['*.generated.cjs'] };
  assert.strictEqual(allowlist.isIgnored('command-aliases.generated.cjs', allow), true);
  assert.strictEqual(allowlist.isIgnored('verify.cjs', allow), false);
});

check('isIgnored: bare directory name excludes everything beneath it', () => {
  const allow = { pairs: [], ignore: ['vendor'] };
  assert.strictEqual(allowlist.isIgnored('vendor/lib/x.cjs', allow), true);
  assert.strictEqual(allowlist.isIgnored('vendor', allow), true);
  assert.strictEqual(allowlist.isIgnored('src/vendor-helper.cjs', allow), false);
});

check('isIgnored: trailing-slash and ** entries both match nested paths', () => {
  assert.strictEqual(allowlist.isIgnored('dist/a/b.cjs', { ignore: ['dist/'] }), true);
  assert.strictEqual(allowlist.isIgnored('sdk/src/query/x.ts', { ignore: ['sdk/src/**'] }), true);
});

check('isIgnored: empty/missing ignore list returns false (never throws)', () => {
  assert.strictEqual(allowlist.isIgnored('any/file.cjs', { ignore: [] }), false);
  assert.strictEqual(allowlist.isIgnored('any/file.cjs', {}), false);
  assert.strictEqual(allowlist.isIgnored('any/file.cjs', null), false);
});

// footer
if (failures) {
  console.error(`\ndrift-allowlist: ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\ndrift-allowlist: all checks passed');
}
