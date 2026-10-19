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

// ─── #5358: next-phase Status derived from disk state ───────────────────────

const STATE_WITH_POSITION = `---
gsd_state_version: 1.0
milestone: test
status: executing
---

# Project State

## Current Position

Phase: 1 (First)
Status: Executing Phase 1
Plan: 01-01-PLAN.md
`;

const ROADMAP_1_2 = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 2: Second
`;

const ROADMAP_1_ONLY = `# Roadmap

## Current Milestone

### Phase 1: First
`;

const ROADMAP_1_3 = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 3: Third
`;

function positionField(stateText, field) {
  const m = stateText.match(/(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i);
  if (!m) return null;
  const line = m[2].match(new RegExp(`^${field}:.*$`, 'm'));
  return line ? line[0] : null;
}

function nextStateCase(name, phases, roadmap, expectStatus, expectPlan) {
  check(name, () => {
    const dir = buildFixture({ state: STATE_WITH_POSITION, roadmap, phases });
    try {
      runPhaseComplete(dir, '1');
      const state = readState(dir);
      assert.strictEqual(positionField(state, 'Status'), `Status: ${expectStatus}`,
        `Status mismatch: ${positionField(state, 'Status')}`);
      assert.strictEqual(positionField(state, 'Plan'), `Plan: ${expectPlan}`,
        `Plan mismatch: ${positionField(state, 'Plan')}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

nextStateCase('#5358 next phase with 0 plans -> Ready to plan / Not started',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 0, summaries: 0 } },
  ROADMAP_1_2, 'Ready to plan', 'Not started');

nextStateCase('#5358 next phase with 2 plans, 0 summaries -> Ready to execute / Not started',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 2, summaries: 0 } },
  ROADMAP_1_2, 'Ready to execute', 'Not started');

nextStateCase('#5358 next phase with 2 plans, 1 summary -> Ready to execute / 2',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 2, summaries: 1 } },
  ROADMAP_1_2, 'Ready to execute', '2');

nextStateCase('#5358 next phase with 2 plans, 2 summaries, no verification -> Ready for verification / 2',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 2, summaries: 2 } },
  ROADMAP_1_2, 'Ready for verification', '2');

nextStateCase('#5358 last phase -> Milestone complete / Not started',
  { '01-a': { plans: 1, summaries: 1 } },
  ROADMAP_1_ONLY, 'Milestone complete', 'Not started');

nextStateCase('#5358 next phase found only in ROADMAP (no directory) -> Ready to plan / Not started',
  { '01-a': { plans: 1, summaries: 1 } },
  ROADMAP_1_3, 'Ready to plan', 'Not started');

// ─── #4820: skip roadmap-complete phases in the next_phase cascade ──────────

const ROADMAP_2_COMPLETE = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 2: Done
### Phase 3: Next

- [x] **Phase 2: Done**
- [ ] **Phase 3: Next**
`;

const ROADMAP_2_COMPLETE_PADDED = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 2: Done
### Phase 3: Next

- [x] **Phase 02: Done**
- [ ] **Phase 3: Next**
`;

const ROADMAP_999_COMPLETE = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 2: Second
### Phase 3: Third

- [x] **Phase 999.1: Parked**
`;

function nextPhaseCase(name, phases, roadmap, expectNext) {
  check(name, () => {
    const opts = { state: STATE_WITH_POSITION, phases };
    if (roadmap) opts.roadmap = roadmap;
    const dir = buildFixture(opts);
    try {
      const data = runPhaseComplete(dir, '1');
      // next_phase is zero-padded when sourced from the disk dir name (e.g. 03)
      // and unpadded from the ROADMAP heading; compare on the stripped integer.
      const got = String(data.next_phase).replace(/^0+(?=\d)/, '');
      assert.strictEqual(got, String(expectNext),
        `expected next_phase ${expectNext}, got ${JSON.stringify(data.next_phase)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

nextPhaseCase('#4820 disk scan skips a roadmap-complete phase 2, selecting phase 3',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 1, summaries: 1 }, '03-c': { plans: 0, summaries: 0 } },
  ROADMAP_2_COMPLETE, 3);

nextPhaseCase('#4820 ROADMAP fallback skips a complete phase 2, selecting phase 3',
  { '01-a': { plans: 1, summaries: 1 } },
  ROADMAP_2_COMPLETE, 3);

nextPhaseCase('#4820 a complete 999.x row never changes selection (still phase 2)',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 0, summaries: 0 }, '03-c': { plans: 0, summaries: 0 } },
  ROADMAP_999_COMPLETE, 2);

nextPhaseCase('#4820 with ROADMAP.md absent, selection is unchanged (phase 2)',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 0, summaries: 0 }, '03-c': { plans: 0, summaries: 0 } },
  null, 2);

nextPhaseCase('#4820 a zero-padded [x] Phase 02 row still skips the dir 2-... (comparePhaseNum dedupe)',
  { '01-a': { plans: 1, summaries: 1 }, '02-b': { plans: 1, summaries: 1 }, '03-c': { plans: 0, summaries: 0 } },
  ROADMAP_2_COMPLETE_PADDED, 3);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll phase-complete-next-phase-state tests passed');
