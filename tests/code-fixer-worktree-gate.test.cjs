#!/usr/bin/env node
'use strict';

// Guard for the gsd-code-fixer worktree isolation gate. The agent must read
// workflow.use_worktrees (default true) and, when explicitly false, work
// directly on the current branch in the main tree instead of forcing a
// worktree. Asserts the gate in BOTH the source agent and the regenerated
// dist/bm copy so a missed build cannot hide the drift.
//
// Zero-dep Node harness mirroring tests/mktemp-portable.test.cjs. CI runs it
// via `node tests/code-fixer-worktree-gate.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COPIES = {
  source: path.join(ROOT, 'agents', 'gsd-code-fixer.md'),
  dist: path.join(ROOT, 'dist', 'bm', 'agents', 'gsd-code-fixer.md'),
};

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

for (const [label, file] of Object.entries(COPIES)) {
  const text = fs.readFileSync(file, 'utf-8');

  check(`${label}: reads workflow.use_worktrees via config-get`, () => {
    assert.ok(text.includes('config-get workflow.use_worktrees'),
      'missing config-get workflow.use_worktrees read');
  });

  check(`${label}: false-branch sets wt="." and reviewfix_branch="$branch"`, () => {
    assert.ok(text.includes('wt="."'), 'missing wt="." in the direct-mode branch');
    assert.ok(text.includes('reviewfix_branch="$branch"'),
      'missing reviewfix_branch="$branch" in the direct-mode branch');
  });

  check(`${label}: cleanup tail is guarded on USE_WORKTREES=false`, () => {
    // The cleanup tail must early-skip when isolation is off. Find the tail's
    // fast-forward step and assert a USE_WORKTREES false guard precedes it.
    const guardIdx = text.indexOf('if [ "$USE_WORKTREES" = "false" ]; then\n  echo "use_worktrees=false: fixes committed directly');
    assert.ok(guardIdx !== -1, 'missing cleanup-tail direct-mode skip guard');
    const ffIdx = text.indexOf('merge --ff-only');
    assert.ok(ffIdx !== -1 && guardIdx < ffIdx,
      'cleanup-tail skip guard must precede the fast-forward step');
  });

  check(`${label}: config read appears before the first "git worktree add"`, () => {
    const cfgIdx = text.indexOf('config-get workflow.use_worktrees');
    const addIdx = text.indexOf('git worktree add');
    assert.ok(cfgIdx !== -1 && addIdx !== -1, 'expected both markers present');
    assert.ok(cfgIdx < addIdx, 'config read must precede git worktree add');
  });

  check(`${label}: critical_rules no longer assert an unconditional worktree`, () => {
    assert.ok(!text.includes('**ALWAYS run inside the isolated worktree**'),
      'unconditional ALWAYS-run-inside-worktree rule still present');
    assert.ok(text.includes('When a worktree was created (workflow.use_worktrees not false), ALWAYS run inside the isolated worktree'),
      'softened worktree critical_rule wording missing');
  });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll code-fixer-worktree-gate tests passed');
