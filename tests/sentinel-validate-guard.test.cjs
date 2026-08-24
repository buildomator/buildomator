#!/usr/bin/env node
'use strict';

// Regression guard: sentinel phases (leading integer 0 or 999, e.g. a 999.1
// backlog dir or a 0-drafts draft dir, conventions this repo itself uses) must
// not fire the consistency / W006 / W007 / gap warnings. A genuinely unknown
// dir like 7-stray still warns. Naming-format (W005) is a separate check and is
// out of scope here.
//
// Zero-dep Node harness mirroring tests/phase-complete-backlog-sentinel.test.cjs.
// CI runs it via `node tests/sentinel-validate-guard.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function makeProject(roadmap, phaseDirs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-sentinel-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(path.join(planning, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), roadmap, 'utf-8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), '---\ngsd_state_version: 1.0\nmilestone: v1.0\n---\n\n# State\n', 'utf-8');
  fs.writeFileSync(path.join(planning, 'config.json'), '{"phase_naming":"sequential"}', 'utf-8');
  for (const d of phaseDirs) fs.mkdirSync(path.join(planning, 'phases', d), { recursive: true });
  return dir;
}

function consistency(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'validate', 'consistency'], { cwd: dir, encoding: 'utf-8' });
  return JSON.parse(out);
}

function healthW006W007(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'validate', 'health'], { cwd: dir, encoding: 'utf-8' });
  const j = JSON.parse(out);
  return (j.warnings || []).filter(w => w.code === 'W006' || w.code === 'W007').map(w => w.message);
}

const ROADMAP_1_AND_999 = `# Roadmap

## v1.0: Active

### Phase 1: Real

**Goal:** g

### Phase 999.1: Backlog

**Goal:** parked
`;

check('sentinel dirs and a 999.1 roadmap heading fire no consistency/W006/W007/gap warning', () => {
  const dir = makeProject(ROADMAP_1_AND_999, ['01-real', '999-backlog', '999.1-icebox', '0-drafts']);
  try {
    const cw = consistency(dir).warnings;
    for (const w of cw) {
      assert.ok(!w.includes('999'), `consistency warning mentions 999: ${w}`);
      assert.ok(!/Phase 0\b/.test(w), `consistency warning mentions Phase 0: ${w}`);
      assert.ok(!/Gap in phase numbering.*999/.test(w), `gap warning mentions 999: ${w}`);
    }
    const hw = healthW006W007(dir);
    for (const w of hw) {
      assert.ok(!w.includes('999'), `health W006/W007 mentions 999: ${w}`);
      assert.ok(!/Phase 0\b/.test(w), `health W006/W007 mentions Phase 0: ${w}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('a genuinely unknown non-sentinel dir (7-stray) still warns', () => {
  const roadmap = `# Roadmap

## v1.0: Active

### Phase 1: Real

**Goal:** g
`;
  const dir = makeProject(roadmap, ['01-real', '7-stray']);
  try {
    const cw = consistency(dir).warnings;
    assert.ok(cw.some(w => /Phase 0*7 exists on disk but not in ROADMAP/.test(w)),
      `expected a disk-but-not-roadmap warning for phase 7, got ${JSON.stringify(cw)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll sentinel-validate-guard tests passed');
