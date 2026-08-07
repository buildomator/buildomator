#!/usr/bin/env node
'use strict';

// Regression guard for the stage-2 roadmap next-phase scan in
// bin/lib/phase.cjs cmdPhaseComplete. Completing the last real phase while a
// trailing backlog heading (### Phase 999.x) exists in ROADMAP.md must yield
// next_phase null / is_last_phase true, never advance into the backlog. The
// stage-1 filesystem scan already skips 999.x; this covers the stage-2 twin.
//
// Zero-dep Node harness mirroring tests/mktemp-portable.test.cjs. The
// cmdPhaseComplete output is written to fd 1, so the call runs in a child
// process and its stdout JSON is parsed here. CI runs it via
// `node tests/phase-complete-backlog-sentinel.test.cjs`.

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

const ROADMAP = `# Roadmap

## Current Milestone: Test

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 9.    | 1/1   | Complete | 2026-04-01 |
| 10.   | 0/1   | In Progress |  |

- [x] Phase 9: Foundation
- [ ] Phase 10: Final

### Phase 9: Foundation

**Goal:** Build foundation
**Plans:** 1/1 plans complete

Plans:
- [x] 09-01 (setup)

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
  completed_plans: 1
  percent: 50
---

# Project State

## Current Position

Phase: 10 of 2 (Final)
Status: Executing Phase 10
`;

function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-backlog-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), ROADMAP, 'utf-8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), STATE, 'utf-8');
  const phases = path.join(planning, 'phases');
  for (const [d, n] of [['09-foundation', '09'], ['10-final', '10']]) {
    const pd = path.join(phases, d);
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, `${n}-01-PLAN.md`), 'plan', 'utf-8');
    fs.writeFileSync(path.join(pd, `${n}-01-SUMMARY.md`), 'summary', 'utf-8');
  }
  return dir;
}

function runPhaseComplete(fixtureDir) {
  const script =
    `const {cmdPhaseComplete}=require(${JSON.stringify(PHASE_CJS)});` +
    `cmdPhaseComplete(process.argv[1],'10',false);`;
  const out = execFileSync(process.execPath, ['-e', script, fixtureDir], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

check('completing the last real phase with a trailing 999.x backlog heading yields next_phase null', () => {
  const dir = buildFixture();
  try {
    const data = runPhaseComplete(dir);
    assert.strictEqual(data.next_phase, null,
      `expected next_phase null, got ${JSON.stringify(data.next_phase)}`);
    assert.strictEqual(data.is_last_phase, true,
      `expected is_last_phase true, got ${JSON.stringify(data.is_last_phase)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll phase-complete-backlog-sentinel tests passed');
