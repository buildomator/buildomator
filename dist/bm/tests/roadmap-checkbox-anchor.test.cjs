#!/usr/bin/env node
'use strict';

// Regression guard for ROADMAP checkbox-to-phase projection anchoring:
//   #5063 roadmap analyze must bind roadmap_complete for phase N only to a
//         checkbox line that itself names Phase N at line start, not an earlier
//         [x] line that merely mentions Phase N mid-line.
//   #5064 init progress and init manager project checkbox states from line-start
//         rows, keep the first match per phase, and (progress only) tolerate an
//         optional leading [tag] before the word Phase.
//
// Zero-dep harness spawning bin/gsd-tools.cjs.

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

// Current-milestone checklist where phase 1's [x] row mentions Phase 2 mid-line,
// phase 3 is a [legacy] bracket-tagged row, a duplicate [ ] Phase 2 row appears
// later, and a Note: line mentions "- [x] Phase 2" mid-line (must not bind).
const ROADMAP = `# Roadmap

## Current Milestone: v1.0 Anchor

- [x] **Phase 1: Auth** (see Phase 2 for follow-ups)
- [ ] **Phase 2: Billing**
- [x] [legacy] Phase 3: Imports
- [ ] Phase 2: duplicate later row
Note: the old row read - [x] Phase 2: Billing before the rename

### Phase 1: Auth
**Goal:** a
### Phase 2: Billing
**Goal:** b
### Phase 3: Imports
**Goal:** c
`;

const STATE = `---
gsd_state_version: 1.0
milestone: v1.0 Anchor
status: executing
---

# Project State

## Current Position

Phase: 1
`;

function buildProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-cbanchor-'));
  const planning = path.join(dir, '.planning');
  fs.mkdirSync(path.join(planning, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), ROADMAP, 'utf-8');
  fs.writeFileSync(path.join(planning, 'STATE.md'), STATE, 'utf-8');
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

function phase(data, n) {
  const arr = data.phases || [];
  return arr.find((p) => String(p.number).replace(/^0+(?=\d)/, '') === String(n));
}

// ─── #5063: roadmap analyze ─────────────────────────────────────────────────

check('#5063 phase 1 roadmap_complete is true (its own [x] row)', () => {
  withProject((dir) => {
    assert.strictEqual(phase(tool(dir, ['roadmap', 'analyze']), 1).roadmap_complete, true);
  });
});

check('#5063 phase 2 roadmap_complete is false (the phase 1 [x] row mentioning Phase 2 does not bind)', () => {
  withProject((dir) => {
    assert.strictEqual(phase(tool(dir, ['roadmap', 'analyze']), 2).roadmap_complete, false);
  });
});

// ─── #5064: init progress + init manager ───────────────────────────────────

function progressStatus(dir, n) {
  const d = tool(dir, ['init', 'progress']);
  return (phase(d, n) || {}).status;
}
function managerComplete(dir, n) {
  const d = tool(dir, ['init', 'manager']);
  return (phase(d, n) || {}).roadmap_complete;
}

check('#5064 init progress keeps phase 2 not complete (first-match [ ] wins over a mid-line mention)', () => {
  withProject((dir) => {
    assert.strictEqual(progressStatus(dir, 2), 'not_started');
  });
});

check('#5064 init progress reports phase 3 complete via the [legacy] bracket-tagged row', () => {
  withProject((dir) => {
    assert.strictEqual(progressStatus(dir, 3), 'complete');
  });
});

check('#5064 init manager keeps phase 2 roadmap_complete false', () => {
  withProject((dir) => {
    assert.strictEqual(managerComplete(dir, 2), false);
  });
});

check('#5064 init manager does NOT treat the bracket-tagged row as a checkbox for phase 3', () => {
  withProject((dir) => {
    assert.strictEqual(managerComplete(dir, 3), false);
  });
});

// A checkbox indented two spaces still binds (leading whitespace allowed).
const ROADMAP_INDENTED = `# Roadmap

## Current Milestone: v1.0 Indented

  - [x] **Phase 5: Indented complete**

### Phase 5: Indented complete
**Goal:** g
`;

check('#5064 init progress matches a checkbox indented two spaces', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofz-cbindent-'));
  try {
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), ROADMAP_INDENTED, 'utf-8');
    fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), STATE, 'utf-8');
    assert.strictEqual(progressStatus(dir, 5), 'complete');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll roadmap-checkbox-anchor tests passed');
