#!/usr/bin/env node
'use strict';

// Regression guard for letter-named phase ids in two places:
//  (1) milestone membership (core.cjs getMilestonePhaseFilter): a letter-named
//      phase dir (`A-tool-output-contract`) must count toward the milestone
//      whose roadmap declares `### Phase A:`. The old greedy custom-ID capture
//      swallowed the whole slug so the dir never matched the declared id and
//      letter-named phases silently dropped out of the count.
//  (2) roadmap analyze (roadmap.cjs cmdRoadmapAnalyze): a letter-prefixed
//      heading id like `### Phase B7:` must produce a nonzero phase_count.
//
// Zero-dep Node harness mirroring tests/mktemp-portable.test.cjs. CI runs it
// via `node tests/letter-phase-ids.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { getMilestonePhaseFilter } = require('../bin/lib/core.cjs');
const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function makeProject(roadmap) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-letter-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), roadmap, 'utf-8');
  return dir;
}

// ─── Part A: milestone membership ────────────────────────────────────────────

check('letter-named dir + numeric dir both count in a mixed milestone', () => {
  const dir = makeProject(`# Roadmap

## Current Milestone

### Phase A: Tool Output Contract
### Phase 01: Inventory
`);
  try {
    const filter = getMilestonePhaseFilter(dir);
    assert.strictEqual(filter.phaseCount, 2, `phaseCount ${filter.phaseCount}`);
    assert.strictEqual(filter('A-tool-output-contract'), true, 'A- dir in milestone');
    assert.strictEqual(filter('01-inventory'), true, '01- dir in milestone');
    assert.strictEqual(filter('B-evidence-artifact-contract'), false, 'undeclared B- excluded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('13 letter-named phases A..L all count, undeclared M excluded', () => {
  const letters = 'ABCDEFGHIJKL'.split('');
  const roadmap = '# Roadmap\n\n## Current Milestone\n\n' +
    letters.map((l, i) => `### Phase ${l}: Work ${i + 1}`).join('\n') + '\n';
  const dir = makeProject(roadmap);
  try {
    const filter = getMilestonePhaseFilter(dir);
    assert.strictEqual(filter.phaseCount, 12, `phaseCount ${filter.phaseCount}`);
    for (const l of letters) {
      assert.strictEqual(filter(`${l}-work-item`), true, `${l}- dir in milestone`);
    }
    assert.strictEqual(filter('M-extra'), false, 'undeclared M- excluded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('hyphenated declared id PROJ-42 matches dir via the segment rule', () => {
  const dir = makeProject(`# Roadmap

## Current Milestone

### Phase PROJ-42: Widget
`);
  try {
    const filter = getMilestonePhaseFilter(dir);
    assert.strictEqual(filter('PROJ-42-description'), true, 'PROJ-42 dir in milestone');
    assert.strictEqual(filter('PROJ-99-other'), false, 'undeclared PROJ-99 excluded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Part B: roadmap analyze id widening ─────────────────────────────────────

function analyze(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'roadmap', 'analyze'], {
    cwd: dir, encoding: 'utf-8',
  });
  return JSON.parse(out);
}

check('letter-prefixed heading id B7 produces a nonzero phase_count', () => {
  const dir = makeProject(`# Roadmap

## Current Milestone

### Phase B7: Widget

**Goal:** Build the widget
`);
  try {
    const data = analyze(dir);
    assert.ok(data.phase_count >= 1, `phase_count ${data.phase_count}`);
    const ids = data.phases.map(p => String(p.number));
    assert.ok(ids.includes('B7'), `phases ${JSON.stringify(ids)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('numeric-only roadmap analyze is unchanged (phases 1 and 2)', () => {
  const dir = makeProject(`# Roadmap

## Current Milestone

### Phase 1: First

**Goal:** Do first

### Phase 2: Second

**Goal:** Do second
`);
  try {
    const data = analyze(dir);
    const ids = data.phases.map(p => String(p.number)).sort();
    assert.deepStrictEqual(ids, ['1', '2'], `phases ${JSON.stringify(ids)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll letter-phase-ids tests passed');
