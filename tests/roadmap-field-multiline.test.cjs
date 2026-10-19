#!/usr/bin/env node
'use strict';

// Regression guard for gsd-core #4826: hard-wrapped **Goal:** / **Requirements:**
// phase fields must be read in full, past the soft wrap. A single-line read
// truncated them and dropped continuation REQ IDs, which then escaped the
// Requirements Coverage Gate.
//
// Unit cases call bin/lib/roadmap.cjs extractPhaseFieldMultiline directly.
// Integration cases spawn bin/gsd-tools.cjs for roadmap get-phase, roadmap
// analyze, init plan-phase / execute-phase / phase-op, init manager, and phase
// complete, asserting the wrapped values round-trip. Zero-dep harness.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROADMAP_CJS = path.join(__dirname, '..', 'bin', 'lib', 'roadmap.cjs');
const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
const { extractPhaseFieldMultiline } = require(ROADMAP_CJS);

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

const GOAL_JOINED = 'Ship the parser that reads a very long goal sentence which the roadmapper soft-wrapped onto a second line and a third line';
const REQ_JOINED = 'AUTH-01, AUTH-02, AUTH-03, AUTH-04';

const SECTION = `### Phase 2: Wrapped Fields

**Goal:** Ship the parser that reads a very long goal sentence which the roadmapper
soft-wrapped onto a second line and a third line
**Requirements:** AUTH-01, AUTH-02,
AUTH-03, AUTH-04
**Depends on:** Phase 1
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md
`;

// ─── Unit cases ─────────────────────────────────────────────────────────────

check('Goal reads across the soft wrap and joins with single spaces', () => {
  assert.strictEqual(extractPhaseFieldMultiline(SECTION, 'Goal'), GOAL_JOINED);
});

check('Requirements reads continuation REQ IDs', () => {
  assert.strictEqual(extractPhaseFieldMultiline(SECTION, 'Requirements'), REQ_JOINED);
});

check('returns null for a missing label', () => {
  assert.strictEqual(extractPhaseFieldMultiline(SECTION, 'Nonexistent'), null);
});

check('returns null for an empty value followed by a blank line', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:**\n\nmore', 'Goal'), null);
});

check('accepts the colon-outside label form **Requirements**:', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Requirements**: REQ-1', 'Requirements'), 'REQ-1');
});

check('accepts the spaced label form **Requirements** :', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Requirements** : REQ-1', 'Requirements'), 'REQ-1');
});

check('accepts the no-colon label form **Requirements**', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Requirements** REQ-1', 'Requirements'), 'REQ-1');
});

check('stops at another bold label', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n**Depends on:** x', 'Goal'), 'g1');
});

check('stops at a blank line', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n\ng2', 'Goal'), 'g1');
});

check('stops at a heading', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n### Phase 3: Next', 'Goal'), 'g1');
});

check('stops at a table row', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n| a | b |', 'Goal'), 'g1');
});

check('stops at a list item', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n- item', 'Goal'), 'g1');
});

check('stops at an HTML tag line (details)', () => {
  assert.strictEqual(extractPhaseFieldMultiline('**Goal:** g1\n<details>', 'Goal'), 'g1');
});

check('a continuation followed directly by a bare Plans: line does not absorb it', () => {
  assert.strictEqual(
    extractPhaseFieldMultiline('**Requirements:** AUTH-01,\nAUTH-02\nPlans:', 'Requirements'),
    'AUTH-01, AUTH-02');
});

// ─── Integration cases ──────────────────────────────────────────────────────

const ROADMAP = `# Roadmap

## Current Milestone: v1.0 Test

${SECTION}`;

const REQUIREMENTS = `# Requirements

- [ ] **AUTH-01** first
- [ ] **AUTH-02** second
- [ ] **AUTH-03** third
- [ ] **AUTH-04** fourth

## Traceability

| ID | Phase | Status |
|----|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
`;

const STATE = `---
gsd_state_version: 1.0
milestone: v1.0 Test
status: executing
---

# Project State

## Current Position

Phase: 2
`;

function buildProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-multiline-'));
  const planning = path.join(dir, '.planning');
  const pd = path.join(planning, 'phases', '02-wrapped-fields');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), ROADMAP, 'utf-8');
  fs.writeFileSync(path.join(planning, 'REQUIREMENTS.md'), REQUIREMENTS, 'utf-8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), STATE, 'utf-8');
  for (const f of ['02-01-PLAN', '02-02-PLAN', '02-01-SUMMARY', '02-02-SUMMARY']) {
    fs.writeFileSync(path.join(pd, `${f}.md`), 'x', 'utf-8');
  }
  return dir;
}

function tool(dir, args) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, ...args], { cwd: dir, encoding: 'utf-8' });
  return JSON.parse(out);
}

function withProject(fn) {
  const dir = buildProject();
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function phase2(data) {
  const arr = data.phases || [];
  return arr.find((p) => String(p.number).replace(/^0+(?=\d)/, '') === '2');
}

check('roadmap get-phase 2 returns the full wrapped goal', () => {
  withProject((dir) => {
    assert.strictEqual(tool(dir, ['roadmap', 'get-phase', '2']).goal, GOAL_JOINED);
  });
});

check('roadmap analyze returns the full wrapped goal for phase 2', () => {
  withProject((dir) => {
    assert.strictEqual(phase2(tool(dir, ['roadmap', 'analyze'])).goal, GOAL_JOINED);
  });
});

check('init plan-phase 2 returns all continuation REQ IDs', () => {
  withProject((dir) => {
    assert.strictEqual(tool(dir, ['init', 'plan-phase', '2']).phase_req_ids, REQ_JOINED);
  });
});

check('init execute-phase 2 returns all continuation REQ IDs', () => {
  withProject((dir) => {
    assert.strictEqual(tool(dir, ['init', 'execute-phase', '2']).phase_req_ids, REQ_JOINED);
  });
});

check('init manager returns the full wrapped goal for phase 2', () => {
  withProject((dir) => {
    assert.strictEqual(phase2(tool(dir, ['init', 'manager'])).goal, GOAL_JOINED);
  });
});

check('phase complete 2 ticks the continuation REQ IDs AUTH-03 and AUTH-04', () => {
  withProject((dir) => {
    tool(dir, ['phase', 'complete', '2']);
    const req = fs.readFileSync(path.join(dir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(/- \[x\] \*\*AUTH-03\*\*/.test(req), 'AUTH-03 checkbox not ticked');
    assert.ok(/- \[x\] \*\*AUTH-04\*\*/.test(req), 'AUTH-04 checkbox not ticked');
    assert.ok(/\|\s*AUTH-03\s*\|[^|]+\|\s*Complete\s*\|/.test(req), 'AUTH-03 traceability not Complete');
  });
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll roadmap-field-multiline tests passed');
