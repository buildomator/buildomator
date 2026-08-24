#!/usr/bin/env node
'use strict';

// Regression guard for two frontier/progress fixes:
//  (A) state update-progress must be a no-op (updated:false, STATE.md
//      byte-unchanged) when the current-milestone scan finds zero plans, so a
//      shipped 100% Progress line survives a milestone archive. The legitimate
//      0% case (plans exist, none summarized) still writes 0%.
//  (B) init progress next_phase must follow roadmap order: a stray higher-
//      numbered artifact dir must not claim next_phase ahead of a pending
//      lower-numbered roadmap phase.
//
// Zero-dep Node harness mirroring tests/phase-complete-backlog-sentinel.test.cjs.
// CI runs it via `node tests/progress-and-frontier.test.cjs`.

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

function mkproj() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-frontier-'));
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  return dir;
}

function writeState(dir, progressLine) {
  fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'),
    `---\ngsd_state_version: 1.0\nmilestone: v1.0\n---\n\n# Project State\n\n## Current Position\n\nProgress: ${progressLine}\n`, 'utf-8');
}

function runUpdateProgress(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'state', 'update-progress'], { cwd: dir, encoding: 'utf-8' });
  return out;
}

function stateText(dir) {
  return fs.readFileSync(path.join(dir, '.planning', 'STATE.md'), 'utf-8');
}

// ─── Part A: zero-plan no-op ─────────────────────────────────────────────────

check('A-1: shipped 100% survives a zero-plan scan (updated:false, byte-identical)', () => {
  const dir = mkproj();
  try {
    writeState(dir, '[██████████] 100%');
    const before = stateText(dir);
    const out = runUpdateProgress(dir);
    assert.ok(/"updated":\s*false|^false/.test(out.trim()) || out.includes('false'), `expected updated:false, got ${out}`);
    const after = stateText(dir);
    assert.strictEqual(after, before, 'STATE.md must be byte-identical');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('A-2: 2 plans + 1 paired summary rewrites Progress to 50%', () => {
  const dir = mkproj();
  try {
    writeState(dir, '[░░░░░░░░░░] 0%');
    const pd = path.join(dir, '.planning', 'phases', '01-x');
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, '01-01-PLAN.md'), 'plan', 'utf-8');
    fs.writeFileSync(path.join(pd, '01-02-PLAN.md'), 'plan', 'utf-8');
    fs.writeFileSync(path.join(pd, '01-01-SUMMARY.md'), 'summary', 'utf-8');
    runUpdateProgress(dir);
    assert.ok(/Progress:.*\b50%/.test(stateText(dir)), `expected 50%, got:\n${stateText(dir)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('A-3: plans exist with zero summaries rewrites Progress to 0% (legitimate zero)', () => {
  const dir = mkproj();
  try {
    writeState(dir, '[██████████] 100%');
    const pd = path.join(dir, '.planning', 'phases', '01-x');
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, '01-01-PLAN.md'), 'plan', 'utf-8');
    fs.writeFileSync(path.join(pd, '01-02-PLAN.md'), 'plan', 'utf-8');
    runUpdateProgress(dir);
    assert.ok(/Progress:.*\b0%/.test(stateText(dir)), `expected 0%, got:\n${stateText(dir)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Part B: roadmap-order frontier ──────────────────────────────────────────

const ROADMAP_89 = `# Roadmap

## v1.0: Active Milestone

### Phase 8: Eighth

**Goal:** eighth work

### Phase 9: Ninth

**Goal:** ninth work
`;

function initProgress(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'init', 'progress'], { cwd: dir, encoding: 'utf-8' });
  return JSON.parse(out);
}

check('B-1: a stray phase-9 artifact dir does not skip pending roadmap phase 8', () => {
  const dir = mkproj();
  try {
    fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), ROADMAP_89, 'utf-8');
    writeState(dir, '[░░░░░░░░░░] 0%');
    // Phase 9 has a dir but only an evidence file (no PLAN); phase 8 has no dir.
    const p9 = path.join(dir, '.planning', 'phases', '09-thing');
    fs.mkdirSync(p9, { recursive: true });
    fs.writeFileSync(path.join(p9, '09-01-UAT.md'), 'evidence', 'utf-8');
    const data = initProgress(dir);
    assert.ok(data.next_phase, 'next_phase present');
    assert.strictEqual(parseInt(data.next_phase.number, 10), 8, `expected next_phase 8, got ${JSON.stringify(data.next_phase.number)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('B-2: aligned tree returns the pending phase as next_phase', () => {
  const dir = mkproj();
  try {
    fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), ROADMAP_89, 'utf-8');
    writeState(dir, '[░░░░░░░░░░] 0%');
    // Phase 8 has a dir (pending, no plans); phase 9 also has a dir.
    for (const d of ['08-eighth', '09-ninth']) {
      const pd = path.join(dir, '.planning', 'phases', d);
      fs.mkdirSync(pd, { recursive: true });
      fs.writeFileSync(path.join(pd, '.gitkeep'), '', 'utf-8');
    }
    const data = initProgress(dir);
    assert.ok(data.next_phase, 'next_phase present');
    assert.strictEqual(parseInt(data.next_phase.number, 10), 8, `expected next_phase 8, got ${JSON.stringify(data.next_phase.number)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll progress-and-frontier tests passed');
