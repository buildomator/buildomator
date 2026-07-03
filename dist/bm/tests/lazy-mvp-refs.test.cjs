#!/usr/bin/env node
'use strict';

// Regression guard for the lazy-MVP-reference progressive-disclosure change
// (adapted from upstream gsd-core #746 / #720).
//
// The MVP-only reference bodies — planner-mvp-mode.md, user-story-template.md,
// skeleton-template.md, execute-mvp-tdd.md — must NOT be eagerly `@`-imported by
// plan-phase / execute-phase or the gsd-planner / gsd-executor agents. An `@`
// sigil inlines the whole body into context on EVERY run, even non-MVP ones.
// They must instead be referenced as lazy paths the agent only Reads when
// MVP_MODE / WALKING_SKELETON / MVP+TDD is active.
//
// This guard fails if an eager `@...<mvp-body>` import is reintroduced in those
// four files, and also fails if a reference is deleted entirely (the path must
// still be present so agents know where to find it).
//
// NOTE: workflows/mvp-phase.md is intentionally EXCLUDED — invoking that
// workflow *is* MVP mode, so eagerly loading the MVP bodies there is correct.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

let failures = 0;
function fail(msg) { console.error(`  FAIL - ${msg}`); failures++; }
function ok(msg) { console.log(`  ok - ${msg}`); }

// Matches an eager @-import of the given reference body in any path form
// (@${CLAUDE_PLUGIN_ROOT}/..., @~/.claude/..., @./...). `[^\s)]*` cannot cross
// whitespace/newlines, so it only matches a contiguous @<path><file> run.
function hasEagerImport(content, fname) {
  return new RegExp('@[^\\s)]*' + fname.replace(/[.]/g, '\\.')).test(content);
}

// The four operational files in scope (NOT mvp-phase.md).
const CASES = [
  { file: 'workflows/plan-phase.md', banned: ['planner-mvp-mode.md', 'skeleton-template.md'] },
  { file: 'workflows/execute-phase.md', banned: ['execute-mvp-tdd.md'] },
  { file: 'agents/gsd-planner.md', banned: ['planner-mvp-mode.md', 'user-story-template.md', 'skeleton-template.md'] },
  { file: 'agents/gsd-executor.md', banned: ['execute-mvp-tdd.md'] },
];

for (const { file, banned } of CASES) {
  const full = path.join(ROOT, file);
  const content = fs.readFileSync(full, 'utf8');
  for (const fname of banned) {
    if (hasEagerImport(content, fname)) {
      fail(`${file} eagerly @-imports ${fname} — strip the leading @ and make it a lazy Read (loads on every run otherwise). See #746/#720.`);
    } else {
      ok(`${file}: no eager @-import of ${fname}`);
    }
    // The lazy reference must still be present.
    if (!content.includes(fname)) {
      fail(`${file} no longer references ${fname} at all — keep the lazy path so agents can find it. See #746/#720.`);
    } else {
      ok(`${file}: still references ${fname} (lazy)`);
    }
  }
}

if (failures) {
  console.error(`\nlazy-mvp-refs: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nlazy-mvp-refs: all checks passed');
