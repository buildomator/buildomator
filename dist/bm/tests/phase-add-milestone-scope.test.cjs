#!/usr/bin/env node
'use strict';

// Regression guard: `phase add` / `phase add-batch` must insert a new
// `### Phase N:` entry inside the ACTIVE milestone section, before that
// milestone's trailing separator, not before the file's last `---` (which on a
// long roadmap sits inside a shipped-archive block, dropping the new phase
// under the archive). When no milestone resolves, the legacy whole-file
// insertion (before the file's last separator) is preserved.
//
// Zero-dep Node harness mirroring tests/phase-complete-backlog-sentinel.test.cjs.
// CI runs it via `node tests/phase-add-milestone-scope.test.cjs`.

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

const ACTIVE_ROADMAP = `# Roadmap

## v1.0: Active Milestone

### Phase 1: First

**Goal:** a

### Phase 2: Second

**Goal:** b

---

## v0.9: Shipped Archive

### Phase 0: Old

done

---
`;

const ACTIVE_STATE = `---
gsd_state_version: 1.0
milestone: v1.0
---

# Project State
`;

function makeProject(roadmap, state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-addscope-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(path.join(planning, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), roadmap, 'utf-8');
  if (state) fs.writeFileSync(path.join(planning, 'STATE.md'), state, 'utf-8');
  return dir;
}

function run(dir, args) {
  execFileSync(process.execPath, [GSD_TOOLS, 'phase', ...args], { cwd: dir, encoding: 'utf-8' });
  return fs.readFileSync(path.join(dir, '.planning', 'ROADMAP.md'), 'utf-8');
}

check('phase add inserts inside the active milestone, before the archive heading', () => {
  const dir = makeProject(ACTIVE_ROADMAP, ACTIVE_STATE);
  try {
    const out = run(dir, ['add', 'New Feature']);
    const idxNew = out.indexOf('### Phase 3: New Feature');
    const idxPhase2 = out.indexOf('### Phase 2: Second');
    const idxArchive = out.indexOf('## v0.9: Shipped Archive');
    assert.ok(idxNew !== -1, 'new phase entry present');
    assert.ok(idxNew > idxPhase2, 'new phase after Phase 2');
    assert.ok(idxNew < idxArchive, 'new phase before the v0.9 archive heading');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('phase add-batch inserts both entries inside the active milestone', () => {
  const dir = makeProject(ACTIVE_ROADMAP, ACTIVE_STATE);
  try {
    const out = run(dir, ['add-batch', '--descriptions', JSON.stringify(['Alpha', 'Beta'])]);
    const idxArchive = out.indexOf('## v0.9: Shipped Archive');
    const idxAlpha = out.indexOf('### Phase 3: Alpha');
    const idxBeta = out.indexOf('### Phase 4: Beta');
    assert.ok(idxAlpha !== -1 && idxBeta !== -1, 'both entries present');
    assert.ok(idxAlpha < idxArchive, 'Alpha before the archive');
    assert.ok(idxBeta < idxArchive, 'Beta before the archive');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('no-milestone fallback keeps legacy insertion before the trailing separator', () => {
  const roadmap = `# Roadmap

### Phase 1: Only

**Goal:** a

---
`;
  const dir = makeProject(roadmap, null);
  try {
    const out = run(dir, ['add', 'Second Thing']);
    const idxNew = out.indexOf('### Phase 2: Second Thing');
    const idxLastSep = out.lastIndexOf('\n---');
    assert.ok(idxNew !== -1, 'new phase entry present');
    assert.ok(idxNew < idxLastSep, 'new phase before the trailing separator');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll phase-add-milestone-scope tests passed');
