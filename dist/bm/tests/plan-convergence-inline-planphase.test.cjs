'use strict';

// Regression test for the #936 cherry-pick (run gsd-plan-phase inline in
// plan-review-convergence).
//
// gsd-plan-phase is a SPAWNER skill: it spawns gsd-planner and gsd-plan-checker
// as sub-agents. plan-review-convergence.md previously wrapped gsd-plan-phase in
// Agent() at both the initial-planning and replan sites. On Claude Code a depth-1
// Agent has no Agent tool, so the wrapped plan-phase could never spawn its
// sub-agents and the replan loop silently produced no revised plan when reviewers
// flagged HIGH concerns. The fix runs plan-phase inline (bare Skill at depth 0).
//
// allow-test-rule: source-text-is-the-product
// Workflow .md files ARE the installed prompts; asserting their text IS asserting
// the deployed behavior contract.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WF_DIR = path.join(ROOT, 'workflows');

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

// ─── 1. plan-review-convergence runs gsd-plan-phase inline at both sites ──────
const conv = fs.readFileSync(path.join(WF_DIR, 'plan-review-convergence.md'), 'utf-8');
ok('initial planning is a bare inline Skill (depth 0)',
  conv.includes('Skill(skill="gsd-plan-phase", args="{PHASE} {GSD_WS}")'));
ok('replan is a bare inline Skill (depth 0)',
  conv.includes('Skill(skill="gsd-plan-phase", args="{PHASE} --reviews --skip-research {GSD_WS}")'));
ok('the old Agent-wrapped gsd-plan-phase form is gone',
  !/Execute:\s*Skill\(skill=['"]gsd-plan-phase/.test(conv));
ok('success_criteria document the inline requirement + bug #936',
  conv.includes('inline Skill("gsd-plan-phase")') && conv.includes('#936'));

// ─── 2. Structural guard: NO workflow wraps gsd-plan-phase in Agent() ────────
// The anti-pattern in this codebase's format is an Agent() prompt that contains
// `Execute: Skill(skill='gsd-plan-phase' ...)` — i.e. a spawner skill pushed to
// depth 1. Scan every workflow for it.
const offenders = [];
for (const f of fs.readdirSync(WF_DIR).filter((n) => n.endsWith('.md'))) {
  const txt = fs.readFileSync(path.join(WF_DIR, f), 'utf-8');
  if (/Execute:\s*Skill\(skill=['"]gsd-plan-phase/.test(txt)) offenders.push(f);
}
ok(`no workflow wraps gsd-plan-phase in Agent() (offenders: ${offenders.join(', ') || 'none'})`,
  offenders.length === 0);

for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
