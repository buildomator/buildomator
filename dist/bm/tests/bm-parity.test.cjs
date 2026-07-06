#!/usr/bin/env node
'use strict';

// Command-inventory parity gate for the generated bm package.
//
// Proves three things about the committed dist/bm tree relative to the tracked
// source:
//   1. Every skills/<name>/SKILL.md in source has an identically-pathed file in
//      dist/bm (the command surface is complete).
//   2. Every tracked, non-excluded source file has a counterpart at the same
//      relative path in dist/bm (full-inventory superset).
//   3. No file in dist/bm still carries a /bm: sibling's /bm: command token, so
//      a bm-only user never gets bounced into the other plugin.
//   4. `node bin/build-bm.cjs --check` exits 0, i.e. the committed dist/bm is the
//      byte-exact deterministic transform of source.
//
// Zero-dep harness mirroring tests/build-bm-drift.test.cjs: node:assert, a bare
// check(name, fn) runner, a failure counter, and a process.exit(1) footer.
// Enumeration always goes through git ls-files + the build's own shouldExclude
// predicate, never a raw fs walk, so it stays deterministic and matches exactly
// what the build ships.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { execFileSync } = require('node:child_process');

const { shouldExclude } = require('../bin/build-bm.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'bm');
const SCRIPT = path.join(ROOT, 'bin', 'build-bm.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Tracked source files (git index), filtered through the build's shouldExclude,
// so the inventory checks compare exactly the set the build copies.
function includedSourceFiles() {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
  assert.strictEqual(listed.status, 0, 'git ls-files failed');
  return listed.stdout.toString('utf8').split('\0').filter(Boolean).filter((f) => !shouldExclude(f));
}

// ─── skill-inventory parity ────────────────────────────────────────────────

check('every source skill has an identically-pathed SKILL.md in dist/bm', () => {
  const skills = includedSourceFiles().filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
  assert.ok(skills.length > 0, 'expected at least one skills/<name>/SKILL.md in source');
  const missing = skills.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  assert.deepStrictEqual(missing, [], `skills absent from dist/bm: ${missing.slice(0, 5).join(', ')}`);
});

// ─── full-inventory parity ─────────────────────────────────────────────────

check('every tracked non-excluded source file exists at the same path in dist/bm', () => {
  const included = includedSourceFiles();
  const missing = included.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  assert.deepStrictEqual(missing, [], `files absent from dist/bm: ${missing.slice(0, 5).join(', ')}`);
});

// ─── zero-leak scan ────────────────────────────────────────────────────────

check('no /bm: command token leaks into dist/bm', () => {
  // A leaking /bm: token would send a bm-only user into the sibling plugin.
  // grep exits 1 (and prints nothing) when there is no match, which is the pass
  // case; a non-empty list is the failure. If a genuine cross-plugin reference
  // is ever intentional, it would need an explicit allowlist carved out here.
  let leaks = '';
  try {
    leaks = execFileSync('grep', ['-rIl', '/bm:', OUT], { encoding: 'utf8' }).trim();
  } catch (e) {
    if (e.status === 1) leaks = ''; // no match: clean
    else throw e;
  }
  assert.strictEqual(leaks, '', `un-rewritten /bm: refs leaked into dist/bm:\n${leaks}`);
});

// ─── byte-parity gate ──────────────────────────────────────────────────────

check('build-bm --check exits 0 (dist/bm is the byte-exact transform of source)', () => {
  const r = spawnSync('node', [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `--check reported drift:\n${r.stdout}${r.stderr}`);
});

// ─── footer ────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll bm-parity tests passed');
