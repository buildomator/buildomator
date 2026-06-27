#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/semantic-dup.cjs (Phase 11, plan 11-01).
//
// Native MinHash+LCS structural near-clone detector (DRIFT-05 layer 3).
// Ported constants from @vibedrift/cli@0.14.4 (read locally during research,
// never installed at runtime). Zero-dep, never-throw, deterministic.
//
// Zero-dep harness: node:assert, a bare check(name, fn) runner, a failure
// counter, and a process.exit(1) footer. CI runs directly via
// `node tests/semantic-dup.test.cjs`.
//
// Coverage:
//   - exports: detect + 5 internals (buildShingles, minHashSignature,
//     findLshCandidatePairs, lcsSimilarity, findDuplicatePairs)
//   - DRIFT-05 flagging: cross-file near-clone pair detected (similarity >= 0.7)
//   - DRIFT-05 guards: MIN_BODY_TOKENS skip, same-file skip, token-ratio skip
//   - determinism: two runs on the same corpus yield deepStrictEqual pairs
//   - never-throw: null input, nonexistent file, binary content
//   - DRIFT-03 hand-off: allowlist pair lands in suppressed, not pairs
//   - D-09: result shape carries no line-count/unreachable/unused-export fields
//   - low-level unit: lcsSimilarity, buildShingles, minHashSignature

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dup = require('../bin/lib/semantic-dup.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── Setup: temp dir for corpus fixtures ─────────────────────────────────────

let tmpDir;
let cleanedUp = false;
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-dup-test-'));
} catch (e) {
  console.error('FATAL: could not create temp dir:', e.message);
  process.exit(1);
}

// A deliberate cross-file near-clone: same operation sequence, renamed vars,
// well above MIN_BODY_TOKENS=15. File a uses x/result, file b uses val/output.
// Both files are named a-clone.cjs and b-clone.cjs for the suppression test.
const CLONE_A_SRC = `
'use strict';
function processItems(x) {
  const result = [];
  for (let i = 0; i < x.length; i++) {
    const item = x[i];
    if (item && item.value > 0) {
      result.push(item.value * 2);
    }
  }
  return result;
}
module.exports = { processItems };
`.trim();

const CLONE_B_SRC = `
'use strict';
function handleEntries(val) {
  const output = [];
  for (let i = 0; i < val.length; i++) {
    const entry = val[i];
    if (entry && entry.value > 0) {
      output.push(entry.value * 2);
    }
  }
  return output;
}
module.exports = { handleEntries };
`.trim();

// A tiny 2-token function that should be skipped by MIN_BODY_TOKENS guard.
const TINY_SRC = `
'use strict';
function ping() { return true; }
module.exports = { ping };
`.trim();

// A file with two identical functions — tests same-file skip (should not pair).
const SAME_FILE_SRC = `
'use strict';
function processItems(x) {
  const result = [];
  for (let i = 0; i < x.length; i++) {
    const item = x[i];
    if (item && item.value > 0) {
      result.push(item.value * 2);
    }
  }
  return result;
}
function handleEntries(val) {
  const output = [];
  for (let i = 0; i < val.length; i++) {
    const entry = val[i];
    if (entry && entry.value > 0) {
      output.push(entry.value * 2);
    }
  }
  return output;
}
module.exports = { processItems, handleEntries };
`.trim();

const cloneAPath = path.join(tmpDir, 'a-clone.cjs');
const cloneBPath = path.join(tmpDir, 'b-clone.cjs');
const tinyPath = path.join(tmpDir, 'tiny-helper.cjs');
const sameFilePath = path.join(tmpDir, 'same-file-pair.cjs');

fs.writeFileSync(cloneAPath, CLONE_A_SRC, 'utf8');
fs.writeFileSync(cloneBPath, CLONE_B_SRC, 'utf8');
fs.writeFileSync(tinyPath, TINY_SRC, 'utf8');
fs.writeFileSync(sameFilePath, SAME_FILE_SRC, 'utf8');

// cwd-relative paths for the corpus (relative to tmpDir)
const cloneCorpus = ['a-clone.cjs', 'b-clone.cjs'];
const tinyCorpus = ['tiny-helper.cjs'];
const sameFileCorpus = ['same-file-pair.cjs'];
const fullCorpus = ['a-clone.cjs', 'b-clone.cjs', 'tiny-helper.cjs', 'same-file-pair.cjs'];

// ─── exports ─────────────────────────────────────────────────────────────────

check('exports: detect and the 5 internal functions are present', () => {
  for (const f of ['detect', 'buildShingles', 'minHashSignature', 'findLshCandidatePairs', 'lcsSimilarity', 'findDuplicatePairs']) {
    assert.strictEqual(typeof dup[f], 'function', `missing export: ${f}`);
  }
});

// ─── low-level unit: lcsSimilarity ───────────────────────────────────────────

check('lcsSimilarity: identical non-trivial arrays yield 1', () => {
  const tokens = ['if', 'VAR', '>', 'NUM', 'CALL', 'VAR', 'return', 'VAR'];
  assert.strictEqual(dup.lcsSimilarity(tokens, tokens), 1);
});

check('lcsSimilarity: returns 0 when min/max length ratio < 0.5', () => {
  const a = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
  const b = ['a', 'b', 'c', 'd', 'e'];  // 5/11 < 0.5
  assert.strictEqual(dup.lcsSimilarity(a, b), 0);
});

check('lcsSimilarity: returns 0 for empty arrays', () => {
  assert.strictEqual(dup.lcsSimilarity([], ['a', 'b']), 0);
  assert.strictEqual(dup.lcsSimilarity(['a', 'b'], []), 0);
});

check('lcsSimilarity: similar (but not identical) sequences produce value in (0,1)', () => {
  const a = ['if', 'VAR', '>', 'NUM', 'CALL', 'VAR', 'return', 'VAR', 'else', 'return'];
  const b = ['if', 'VAR', '>', 'NUM', 'CALL', 'VAR', 'return', 'VAR', 'else', 'NUM'];
  const sim = dup.lcsSimilarity(a, b);
  assert.ok(sim > 0 && sim < 1, `expected (0,1) similarity, got ${sim}`);
});

// ─── low-level unit: buildShingles ───────────────────────────────────────────

check('buildShingles: produces tokens.length - size + 1 shingles for size=5', () => {
  const tokens = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const shingles = dup.buildShingles(tokens, 5);
  assert.strictEqual(shingles.length, tokens.length - 5 + 1); // 3
});

check('buildShingles: returns a single shingle when tokens.length < size', () => {
  const tokens = ['a', 'b', 'c'];
  const shingles = dup.buildShingles(tokens, 5);
  assert.strictEqual(shingles.length, 1);
  assert.ok(typeof shingles[0] === 'string', 'shingle must be a string');
});

// ─── low-level unit: minHashSignature ────────────────────────────────────────

check('minHashSignature: same shingles yield identical signature on two calls (determinism)', () => {
  const shingles = dup.buildShingles(['for', 'VAR', 'in', 'VAR', 'push', 'VAR', 'return', 'VAR'], 5);
  const sig1 = dup.minHashSignature(shingles);
  const sig2 = dup.minHashSignature(shingles);
  assert.deepStrictEqual(Array.from(sig1), Array.from(sig2));
});

check('minHashSignature: returns a Uint32Array of length 128', () => {
  const shingles = dup.buildShingles(['a', 'b', 'c', 'd', 'e', 'f'], 5);
  const sig = dup.minHashSignature(shingles);
  assert.ok(sig instanceof Uint32Array, 'should return Uint32Array');
  assert.strictEqual(sig.length, 128);
});

// ─── DRIFT-05: cross-file near-clone flagging ────────────────────────────────

check('DRIFT-05: detect() flags a cross-file near-clone pair (similarity >= 0.7)', () => {
  const result = dup.detect(cloneCorpus, { cwd: tmpDir });
  assert.strictEqual(result.skipped, false, 'should not skip on valid corpus');
  assert.ok(Array.isArray(result.pairs), 'pairs must be array');
  assert.ok(Array.isArray(result.suppressed), 'suppressed must be array');
  assert.ok(result.pairs.length >= 1, `expected at least 1 pair, got ${result.pairs.length}`);
  const pair = result.pairs[0];
  assert.ok(pair.similarity >= 0.7, `expected similarity >= 0.7, got ${pair.similarity}`);
  assert.ok(pair.a && pair.a.file, 'pair.a must have file');
  assert.ok(pair.b && pair.b.file, 'pair.b must have file');
  assert.notStrictEqual(pair.a.file, pair.b.file, 'cross-file pair must have different files');
});

// ─── DRIFT-05 guards ─────────────────────────────────────────────────────────

check('DRIFT-05 guard: tiny function (< MIN_BODY_TOKENS) is never paired', () => {
  // tiny-helper.cjs only has `ping()` which is tiny; cloneA is the counter
  const corpus = ['a-clone.cjs', 'tiny-helper.cjs'];
  const result = dup.detect(corpus, { cwd: tmpDir });
  assert.strictEqual(result.skipped, false);
  // If any pair is found, none should involve tiny-helper.cjs
  for (const pair of result.pairs) {
    assert.ok(
      pair.a.file !== 'tiny-helper.cjs' && pair.b.file !== 'tiny-helper.cjs',
      'tiny function should not appear in any pair'
    );
  }
});

check('DRIFT-05 guard: same-file pair is never emitted', () => {
  // same-file-pair.cjs has two near-identical functions in the same file
  const result = dup.detect(sameFileCorpus, { cwd: tmpDir });
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.pairs.length, 0, 'same-file pairs must never be emitted');
});

// ─── determinism ─────────────────────────────────────────────────────────────

check('determinism: two detect() calls on the same corpus yield deepStrictEqual pairs', () => {
  const r1 = dup.detect(cloneCorpus, { cwd: tmpDir });
  const r2 = dup.detect(cloneCorpus, { cwd: tmpDir });
  assert.strictEqual(r1.skipped, false);
  assert.strictEqual(r2.skipped, false);
  // Compare sorted pair list
  const normalize = (pairs) => JSON.stringify(pairs.map(p => ({
    aFile: p.a.file, aName: p.a.name, bFile: p.b.file, bName: p.b.name, sim: p.similarity,
  })));
  assert.strictEqual(normalize(r1.pairs), normalize(r2.pairs), 'pairs must be identical across two runs');
});

// ─── never-throw ─────────────────────────────────────────────────────────────

check('never-throw: detect(null) returns { skipped:true, pairs:[], suppressed:[] }', () => {
  const r = dup.detect(null);
  assert.strictEqual(r.skipped, true, 'should be skipped');
  assert.ok(typeof r.reason === 'string', 'reason must be a string');
  assert.deepStrictEqual(r.pairs, [], 'pairs must be empty array');
  assert.deepStrictEqual(r.suppressed, [], 'suppressed must be empty array');
});

check('never-throw: detect([]) with nonexistent file does not throw', () => {
  let threw = false;
  let result;
  try {
    result = dup.detect(['nonexistent-file-zzz99.cjs'], { cwd: tmpDir });
  } catch (e) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'detect must never throw');
  assert.ok(result && (result.skipped === true || Array.isArray(result.pairs)),
    'result must have valid shape');
});

check('never-throw: detect() with a binary/garbage file in corpus does not throw', () => {
  const binaryPath = path.join(tmpDir, 'binary.cjs');
  // Write binary-ish content
  fs.writeFileSync(binaryPath, Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x7f, 0x80, 0xd0, 0xc0, 0x00, 0x01]));
  let threw = false;
  try {
    dup.detect(['binary.cjs'], { cwd: tmpDir });
  } catch (e) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'detect must never throw on binary content');
});

// ─── DRIFT-03 hand-off: allowlist suppression ────────────────────────────────

check('DRIFT-03: a pair matching opts.allow lands in suppressed, not pairs', () => {
  const allow = {
    pairs: [{ a: 'a-*.cjs', b: 'b-*.cjs', reason: 'test intentional' }],
    ignore: [],
  };
  const result = dup.detect(cloneCorpus, { cwd: tmpDir, allow });
  assert.strictEqual(result.skipped, false);
  // The near-clone pair must be suppressed
  assert.ok(result.suppressed.length >= 1, `expected at least 1 suppressed pair, got ${result.suppressed.length}`);
  // The pairs[] must not contain the suppressed pair
  const suppFiles = result.suppressed.map(s => [s.a.file, s.b.file].sort().join(':'));
  for (const pair of result.pairs) {
    const pairKey = [pair.a.file, pair.b.file].sort().join(':');
    assert.ok(!suppFiles.includes(pairKey), 'suppressed pair must not appear in pairs[]');
  }
  // Suppressed entries must carry the reason
  for (const s of result.suppressed) {
    assert.ok(typeof s.reason === 'string' && s.reason.length > 0, 'suppressed entry must have reason');
  }
});

// ─── D-09: no noise fields ───────────────────────────────────────────────────

check('D-09: result shape carries no line-count, unreachable-after-return, unused-export, or comment-density field', () => {
  const result = dup.detect(cloneCorpus, { cwd: tmpDir });
  const noiseFields = ['lineCount', 'unreachable', 'unusedExport', 'commentDensity',
    'line_count', 'unreachable_after_return', 'unused_export', 'comment_density'];
  for (const field of noiseFields) {
    assert.ok(!(field in result), `result must not have field: ${field}`);
  }
  // Check pairs too
  for (const pair of result.pairs) {
    for (const field of noiseFields) {
      assert.ok(!(field in pair), `pair must not have field: ${field}`);
    }
  }
});

// ─── Footer ──────────────────────────────────────────────────────────────────

// Cleanup temp dir
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  cleanedUp = true;
} catch (e) {
  console.error('  warn: could not clean up temp dir:', e.message);
}

if (failures) { console.error(`\nsemantic-dup: ${failures} failure(s)`); process.exit(1); }
console.log('\nsemantic-dup: all checks passed');
