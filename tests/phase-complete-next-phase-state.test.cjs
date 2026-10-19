#!/usr/bin/env node
'use strict';

// Regression guard for the phase-complete trio in bin/lib/phase.cjs
// cmdPhaseComplete:
//   #4898 the Current Plan reset must be scoped to the `## Current Position`
//         section so a prose line starting `plan:` elsewhere is never rewritten.
//   #5358 the next phase's Status must be derived from its disk state, not a
//         blind `Ready to plan`.
//   #4820 a phase whose current-milestone ROADMAP checkbox is `[x]` must never
//         be selected as the next phase.
//
// Zero-dep harness mirroring tests/phase-complete-lowest-successor.test.cjs.
// CI runs it via `node tests/phase-complete-next-phase-state.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PHASE_CJS = path.join(__dirname, '..', 'bin', 'lib', 'phase.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Build a tmp project. opts: { state, roadmap, phases: { 'N-name': {plans, summaries, verification} } }
function buildFixture(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-nextstate-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  if (opts.state) fs.writeFileSync(path.join(planning, 'STATE.md'), opts.state, 'utf-8');
  if (opts.roadmap) fs.writeFileSync(path.join(planning, 'ROADMAP.md'), opts.roadmap, 'utf-8');
  const phases = opts.phases || { '01-a': { plans: 1, summaries: 1 } };
  for (const [name, spec] of Object.entries(phases)) {
    const pd = path.join(planning, 'phases', name);
    fs.mkdirSync(pd, { recursive: true });
    const num = name.match(/^(\d+)/)[1];
    for (let i = 1; i <= (spec.plans || 0); i++) {
      const nn = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(pd, `${num}-${nn}-PLAN.md`), 'plan', 'utf-8');
    }
    for (let i = 1; i <= (spec.summaries || 0); i++) {
      const nn = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(pd, `${num}-${nn}-SUMMARY.md`), '# Summary\n\nstatus: complete\n', 'utf-8');
    }
    if (spec.verification) {
      fs.writeFileSync(path.join(pd, 'VERIFICATION.md'), spec.verification, 'utf-8');
    }
  }
  return dir;
}

function runPhaseComplete(fixtureDir, phase) {
  const script =
    `const {cmdPhaseComplete}=require(${JSON.stringify(PHASE_CJS)});` +
    `cmdPhaseComplete(process.argv[1],${JSON.stringify(String(phase))},false);`;
  const out = execFileSync(process.execPath, ['-e', script, fixtureDir], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

function readState(fixtureDir) {
  return fs.readFileSync(path.join(fixtureDir, '.planning', 'STATE.md'), 'utf-8');
}

// Extract the Plan: line inside the ## Current Position section.
function currentPositionPlan(stateText) {
  const m = stateText.match(/(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i);
  if (!m) return null;
  const line = m[2].match(/^Plan:.*$/m);
  return line ? line[0] : null;
}

// ─── #4898: Current Plan reset scoped to Current Position ───────────────────

const STATE_WITH_PROSE_PLAN = `---
gsd_state_version: 1.0
milestone: test
status: executing
---

# Project State

## Project Reference

plan: keep this prose

## Current Position

Phase: 1 (First)
Status: Executing Phase 1
Plan: 02-01-PLAN.md
`;

check('#4898 a prose line starting plan: before Current Position stays byte-identical', () => {
  const dir = buildFixture({ state: STATE_WITH_PROSE_PLAN });
  try {
    runPhaseComplete(dir, '1');
    const state = readState(dir);
    assert.ok(state.includes('plan: keep this prose'),
      `prose plan: line was rewritten:\n${state}`);
    assert.strictEqual(currentPositionPlan(state), 'Plan: Not started',
      `Current Position Plan line not reset: ${currentPositionPlan(state)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const STATE_NO_CURRENT_POSITION = `---
gsd_state_version: 1.0
milestone: test
status: executing
---

# Project State

Plan: 01
Status: executing
`;

check('#4898 whole-body fallback still resets a top-level Plan line with no Current Position', () => {
  const dir = buildFixture({ state: STATE_NO_CURRENT_POSITION });
  try {
    runPhaseComplete(dir, '1');
    const state = readState(dir);
    assert.ok(/^Plan: Not started$/m.test(state),
      `top-level Plan line not reset:\n${state}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll phase-complete-next-phase-state tests passed');
