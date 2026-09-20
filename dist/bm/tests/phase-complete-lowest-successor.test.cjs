#!/usr/bin/env node
'use strict';

// Regression guard for the ROADMAP-only fallback in bin/lib/phase.cjs
// cmdPhaseComplete. When the completed phase has no scaffolded successor on
// disk, the fallback must advance to the numerically lowest successor in the
// ROADMAP, not the first heading in document order. An out-of-order ROADMAP
// (headings 1, 3, 2) must yield next_phase 2, and a trailing 999.x backlog
// heading must never win.
//
// Zero-dep harness mirroring tests/phase-complete-backlog-sentinel.test.cjs.
// CI runs it via `node tests/phase-complete-lowest-successor.test.cjs`.

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

const STATE = `---
gsd_state_version: 1.0
milestone: test
status: executing
---

# Project State

## Current Position

Phase: 1 (First)
Status: Executing Phase 1
`;

function buildFixture(roadmap) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-lowest-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), roadmap, 'utf-8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), STATE, 'utf-8');
  const pd = path.join(planning, 'phases', '01-a');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(pd, '01-01-PLAN.md'), 'plan', 'utf-8');
  fs.writeFileSync(path.join(pd, '01-01-SUMMARY.md'), 'summary', 'utf-8');
  return dir;
}

function runPhaseComplete(fixtureDir) {
  const script =
    `const {cmdPhaseComplete}=require(${JSON.stringify(PHASE_CJS)});` +
    `cmdPhaseComplete(process.argv[1],'1',false);`;
  const out = execFileSync(process.execPath, ['-e', script, fixtureDir], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

const ROADMAP_1_3_2 = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 3: Third
### Phase 2: Second

### Phase 999.1: Backlog (BACKLOG)
`;

const ROADMAP_1_3_21_2 = `# Roadmap

## Current Milestone

### Phase 1: First
### Phase 3: Third
### Phase 2.1: Second-point-one
### Phase 2: Second
`;

check('out-of-order headings 1, 3, 2 advance to the lowest successor 2', () => {
  const dir = buildFixture(ROADMAP_1_3_2);
  try {
    const data = runPhaseComplete(dir);
    assert.strictEqual(String(data.next_phase), '2',
      `expected next_phase 2, got ${JSON.stringify(data.next_phase)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('a trailing 999.x backlog heading never wins the successor race', () => {
  const dir = buildFixture(ROADMAP_1_3_2);
  try {
    const data = runPhaseComplete(dir);
    assert.notStrictEqual(String(data.next_phase), '999.1',
      `backlog phase won: ${JSON.stringify(data.next_phase)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('headings 1, 3, 2.1, 2 advance to 2 (2 < 2.1 < 3)', () => {
  const dir = buildFixture(ROADMAP_1_3_21_2);
  try {
    const data = runPhaseComplete(dir);
    assert.strictEqual(String(data.next_phase), '2',
      `expected next_phase 2, got ${JSON.stringify(data.next_phase)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll phase-complete-lowest-successor tests passed');
