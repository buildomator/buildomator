#!/usr/bin/env node
'use strict';

// Guard for the 3.7.0 "Improved resilience when sessions are broken" sweep:
// the literal coverage gates auto-heal a tagging gap instead of confronting the
// user with GSD internals (D-NN / must_haves / truths) where the safe fix wasn't
// even recommended. Only GENUINELY-uncovered items surface, in plain language
// with the fix recommended. See the example in the conversation that prompted it.

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'workflows/plan-phase.md'), 'utf8');

let failures = 0;
const ok = m => console.log(`  ok - ${m}`);
const fail = m => { console.error(`  FAIL - ${m}`); failures++; };
const has = (n, m) => src.includes(n) ? ok(m) : fail(`${m} (missing: ${n})`);

// §13a decision-coverage gate auto-heals the (D-NN) tagging gap.
has('AUTO-HEAL first — do NOT immediately prompt', '§13a: auto-heals before prompting');
has('Backfill tags', '§13a: backfills (D-NN) tags');
has('auto-tagged {K} decision(s) for traceability', '§13a: announces the auto-tag, no prompt');
has('Only if decisions remain uncovered after backfill', '§13a: surfaces only genuine gaps');
has('NO GSD internals', '§13a: genuine-gap message is plain-language');

// §13 requirements-coverage gate applies the same auto-heal (conservatively).
has('AUTO-HEAL first** (same principle as §13a)', '§13: requirements gate auto-heals too');
has('auto-tagged {K} REQ-ID(s)', '§13: announces requirement auto-tag');
has('only tag when the plan really covers it', '§13: conservative (only tag when really covered)');
has('Requirements not covered by any plan', '§13: surfaces genuine req gaps plainly');

// The genuine-judgment gates still recommend the fix (not auto-healed, by design).
has('Add a plan to cover this item (recommended)', '§9c source-audit recommends the fix');

if (failures) {
  console.error(`\ncoverage-gate-autoheal: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ncoverage-gate-autoheal: all checks passed');
