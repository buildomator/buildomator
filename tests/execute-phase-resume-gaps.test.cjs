#!/usr/bin/env node
'use strict';

// Guard for the status-aware all-filtered decision in
// workflows/execute-phase.md discover_and_group_plans. When every plan in a
// phase is already complete (or retired) and no --gaps-only / --wave filter is
// active, the step must resume the phase tail instead of dead-ending:
//   - verification missing  -> continue at aggregate_results
//   - verified but unticked -> continue at update_roadmap
//   - verified and ticked   -> exit (genuinely done)
//   - a filter is active    -> exit (unchanged)
// Zero-dep Node harness; child processes drive the real CLI twins so the
// routing inputs are proven against on-disk fixtures.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GSD_TOOLS = path.join(ROOT, 'bin', 'gsd-tools.cjs');
const SDK_CLI = path.join(ROOT, 'sdk', 'dist', 'cli.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function runJson(bin, argv, cwd) {
  const out = execFileSync(process.execPath, [bin, ...argv], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'cfg') },
  });
  const o = JSON.parse(out);
  return o.data ?? o;
}

const ROADMAP = `# Roadmap

## Current Milestone: Test

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 9.    | 2/2   | Complete | 2026-04-01 |
| 10.   | 0/1   | In Progress |  |

- [ ] Phase 9: Foundation
- [ ] Phase 10: Final

### Phase 9: Foundation

**Goal:** Build foundation
**Plans:** 2/2 plans complete

Plans:
- [x] 09-01 (setup)
- [x] 09-02 (more)

### Phase 10: Final

**Goal:** Final work
**Plans:** 1 plans

Plans:
- [ ] 10-01 (final)

### Phase 999.1: Backlog (BACKLOG)

**Goal:** Parked ideas, not sequential work
`;

const STATE = `---
gsd_state_version: 1.0
milestone: test
status: executing
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Current Position

Phase: 9 of 2 (Foundation)
Status: Executing Phase 9
`;

function planFm(n) {
  return `---
phase: 09-foundation
plan: ${n}
wave: 1
autonomous: true
---
<objective>do thing ${n}</objective>
`;
}

function summaryFm(n, status) {
  return `---
phase: 09-foundation
plan: ${n}
status: ${status}
---
# Summary
one-liner for plan ${n}.
`;
}

function buildFixtureA() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nwr-resume-'));
  const planning = path.join(dir, '.planning');
  const pd = path.join(planning, 'phases', '09-foundation');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), ROADMAP, 'utf8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), STATE, 'utf8');
  fs.writeFileSync(path.join(pd, '09-01-PLAN.md'), planFm('01'), 'utf8');
  fs.writeFileSync(path.join(pd, '09-02-PLAN.md'), planFm('02'), 'utf8');
  fs.writeFileSync(path.join(pd, '09-01-SUMMARY.md'), summaryFm('01', 'complete'), 'utf8');
  fs.writeFileSync(path.join(pd, '09-02-SUMMARY.md'), summaryFm('02', 'retired'), 'utf8');
  return dir;
}

function addVerification(dir) {
  const pd = path.join(dir, '.planning', 'phases', '09-foundation');
  fs.writeFileSync(path.join(pd, '09-VERIFICATION.md'),
    '---\nphase: 9\nstatus: passed\n---\nVerification passed.\n', 'utf8');
}

// --- Workflow text pins ---
check('discover_and_group_plans is status-aware and the old exit line is gone', () => {
  const src = fs.readFileSync(path.join(ROOT, 'workflows', 'execute-phase.md'), 'utf8');
  assert.ok(!src.includes('If all filtered: "No matching incomplete plans"'),
    'old unconditional all-filtered exit line must be removed');
  const start = src.indexOf('<step name="discover_and_group_plans">');
  assert.ok(start !== -1, 'discover_and_group_plans step must exist');
  const rest = src.slice(start + 1);
  const nextStep = rest.indexOf('<step name=');
  const slice = nextStep === -1 ? rest : rest.slice(0, nextStep);
  for (const marker of ['check.verification-status', 'roadmap_complete',
    'aggregate_results', 'update_roadmap', 'WAVE_FILTER', '--gaps-only',
    '#2868', '#3684']) {
    assert.ok(slice.includes(marker), `step slice must mention ${marker}`);
  }
});

// --- Fixture A: all plans complete + verification missing -> aggregate_results ---
check('Fixture A: every plan complete and verification missing', () => {
  const dir = buildFixtureA();
  try {
    const idx = runJson(GSD_TOOLS, ['phase-plan-index', '9'], dir);
    assert.ok(Array.isArray(idx.plans) && idx.plans.length === 2, 'two plans indexed');
    assert.ok(idx.plans.every(p => p.complete === true), 'all plans read complete');
    assert.strictEqual(idx.incomplete.length, 0, 'no incomplete plans');
    const vs = runJson(SDK_CLI, ['query', 'check.verification-status', '9'], dir);
    assert.strictEqual(vs.status, 'missing', 'verification status is missing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- Fixture B: verified but unticked -> update_roadmap, then idempotent tick ---
check('Fixture B: verified, unticked, then phase complete is idempotent', () => {
  const dir = buildFixtureA();
  addVerification(dir);
  try {
    const analyze = runJson(GSD_TOOLS, ['roadmap', 'analyze'], dir);
    const before = (analyze.phases || []).find(p => String(p.number) === '9');
    assert.ok(before, 'phase 9 present in analyze output');
    assert.strictEqual(before.roadmap_complete, false, 'phase 9 not yet ticked');
    const vs = runJson(SDK_CLI, ['query', 'check.verification-status', '9'], dir);
    assert.strictEqual(vs.status, 'passed', 'verification status is passed');
    assert.notStrictEqual(vs.status, 'missing', 'verification status is not missing');

    execFileSync(process.execPath, [GSD_TOOLS, 'phase', 'complete', '9'],
      { cwd: dir, stdio: 'ignore' });
    const roadmapPath = path.join(dir, '.planning', 'ROADMAP.md');
    const after1 = fs.readFileSync(roadmapPath);
    const analyze2 = runJson(GSD_TOOLS, ['roadmap', 'analyze'], dir);
    const ticked = (analyze2.phases || []).find(p => String(p.number) === '9');
    assert.strictEqual(ticked.roadmap_complete, true, 'phase 9 ticked after complete');

    execFileSync(process.execPath, [GSD_TOOLS, 'phase', 'complete', '9'],
      { cwd: dir, stdio: 'ignore' });
    const after2 = fs.readFileSync(roadmapPath);
    assert.ok(after1.equals(after2), 'ROADMAP.md byte-identical after second phase complete');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\nexecute-phase-resume-gaps: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nexecute-phase-resume-gaps: all checks passed');
