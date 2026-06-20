#!/usr/bin/env node
'use strict';

// Guard for Stream B of "Less GSD housekeeping prompts": context-aware
// auto-advance + `--no-auto` opt-out
// (`.planning/todos/pending/auto-advance-default-and-gap-escalation.md`).
//
// auto_advance is moving to default-on, so the routing must be SAFE:
//  - plan->execute: cheap phases (<=2 plans) advance silently; big phases fall
//    through to the /clear hand-off (clean context + live wave checkpoints).
//  - discuss->plan: explicit --chain/--auto stays silent; config-default uses the
//    /clear hand-off so plan-phase's scope prompts stay interactive (#1009).
//  - --no-auto opts out everywhere.
//
// (The resolver default flip itself is covered by the SDK test suite.)

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
let failures = 0;
const ok = m => console.log(`  ok - ${m}`);
const fail = m => { console.error(`  FAIL - ${m}`); failures++; };
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (src, n, m) => src.includes(n) ? ok(m) : fail(`${m} (missing: ${n})`);

// --- plan-phase step 15: context-aware plan->execute + --no-auto ---
{
  const f = 'workflows/plan-phase.md';
  const src = read(f);
  has(src, '--no-auto', `${f}: --no-auto opt-out present`);
  has(src, 'If `PLAN_COUNT` <= 2 (cheap phase):', `${f}: cheap-phase silent-advance branch`);
  has(src, 'If `PLAN_COUNT` > 2 (big phase):', `${f}: big-phase /clear hand-off branch`);
  has(src, 'Auto-advance paused for context hygiene', `${f}: big-phase hygiene notice`);
  has(src, 'Skill(skill="gsd-execute-phase"', `${f}: silent dispatch retained for cheap phases`);
  // UI-SPEC gate (§5.6) honors auto_advance, not just the chain flag — no needless gate.
  has(src, 'AUTO_ACTIVE=$(gsd-sdk query check auto-mode --pick active', `${f}: UI-SPEC gate reads auto_advance (active), not just auto_chain_active`);
  has(src, 'this is not a decision the user needs to\nmake; auto-generate the UI-SPEC', `${f}: UI-SPEC auto-generates under auto-advance`);
}

// --- discuss-phase chain: interactive-by-default discuss->plan ---
{
  const f = 'workflows/discuss-phase/modes/chain.md';
  const src = read(f);
  has(src, '--no-auto', `${f}: --no-auto opt-out present`);
  has(src, 'Explicit `--auto` or `--chain` flag', `${f}: explicit-flag silent path`);
  has(src, 'Config default only', `${f}: config-default /clear hand-off path`);
  has(src, 'keeps planning interactive', `${f}: default keeps plan-phase prompts live`);
}

if (failures) {
  console.error(`\nauto-advance-context-aware: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nauto-advance-context-aware: all checks passed');
