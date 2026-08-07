#!/usr/bin/env node
'use strict';

// Accept/reject guard for the worktree branch namespace check in
// bin/lib/worktree-safety.cjs normalizeCleanupManifest. The guard must accept
// the per-agent branch shapes (agent-*, worktree-agent-*, worktree-wf_*) and
// reject protected refs (main/master/develop/trunk/release/*), HEAD, and empty.
// It also sweeps the repo (including dist/bm) so the old narrow literal cannot
// linger at any of the widened guard sites.
//
// Zero-dep Node harness mirroring tests/mktemp-portable.test.cjs. CI runs it
// via `node tests/worktree-safety.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeCleanupManifest } = require(path.join(__dirname, '..', 'bin', 'lib', 'worktree-safety.cjs'));

const ROOT = path.join(__dirname, '..');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function entriesFor(branch) {
  const result = normalizeCleanupManifest({
    worktrees: [{ worktree_path: '/tmp/x', branch, expected_base: 'abc123' }],
  });
  return result.entries.length;
}

const ACCEPT = ['worktree-agent-abc', 'agent-abc', 'worktree-wf_run123-1', 'worktree-wf_execute-phase-x'];
const REJECT = ['main', 'master', 'develop', 'trunk', 'release/1.0', 'HEAD', ''];

check('accepts per-agent branch namespaces', () => {
  for (const b of ACCEPT) {
    assert.strictEqual(entriesFor(b), 1, `should accept branch ${JSON.stringify(b)}`);
  }
});

check('rejects protected refs, HEAD, and empty', () => {
  for (const b of REJECT) {
    assert.strictEqual(entriesFor(b), 0, `should reject branch ${JSON.stringify(b)}`);
  }
});

// ─── repo-wide sweep: no old narrow literal remains ──────────────────────────

// The retired narrow guard: `^worktree-agent-[A-Za-z0-9._/-]+$` NOT preceded by
// the widened `(worktree-)?` alternation. A widened site reads
// `^((worktree-)?agent-|worktree-wf_)[A-Za-z0-9._/-]+$`; matching on the literal
// `^worktree-agent-[A-Za-z0-9._/-]+$` catches only the old form.
const NARROW = '^worktree-agent-[A-Za-z0-9._/-]+$';

const SKIP_DIRS = new Set(['node_modules', '.git', '.planning']);
const SKIP_REL = new Set([path.join('sdk', 'dist')]);
const EXTS = ['.md', '.cjs', '.ts'];
const THIS_FILE = path.resolve(__filename);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      const rel = path.relative(ROOT, path.join(dir, e.name));
      if (SKIP_REL.has(rel)) continue;
      walk(path.join(dir, e.name), out);
    } else if (EXTS.some((x) => e.name.endsWith(x))) {
      out.push(path.join(dir, e.name));
    }
  }
}

check('no old narrow worktree-agent-only literal remains (dist/bm included)', () => {
  const files = [];
  walk(ROOT, files);
  const hits = [];
  for (const f of files) {
    if (path.resolve(f) === THIS_FILE) continue;
    if (fs.readFileSync(f, 'utf-8').includes(NARROW)) {
      hits.push(path.relative(ROOT, f));
    }
  }
  assert.strictEqual(hits.length, 0,
    `found retired narrow branch-namespace literal in:\n  ${hits.join('\n  ')}`);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll worktree-safety tests passed');
