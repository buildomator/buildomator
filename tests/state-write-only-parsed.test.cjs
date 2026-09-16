#!/usr/bin/env node
'use strict';

// Regression guard for the "write only what you parsed" invariant in STATE.md
// mutation commands:
//  - a parse error in advance-plan never writes STATE.md (bytes and mtime stay put);
//  - update-progress only rewrites the body Progress line and never the
//    frontmatter progress block (total_phases / completed_plans survive);
//  - a frontmatter-only Progress key is a byte-identical updated:false no-op;
//  - the happy path still advances the plan counter.
//
// Zero-dep Node harness mirroring tests/progress-and-frontier.test.cjs.
// CI runs it via `node tests/state-write-only-parsed.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
const PINNED = new Date('2000-01-01T00:00:00Z');

const FM = '---\n'
  + 'gsd_state_version: 1.0\n'
  + 'milestone: v1.0\n'
  + 'progress:\n'
  + '  total_phases: 30\n'
  + '  completed_plans: 5\n'
  + '---\n\n'
  + '# Project State\n\n'
  + '## Current Position\n\n';

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function mkproj() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i5z-write-only-'));
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  return dir;
}

function statePath(dir) {
  return path.join(dir, '.planning', 'STATE.md');
}

function writeState(dir, text) {
  fs.writeFileSync(statePath(dir), text, 'utf-8');
}

function stateText(dir) {
  return fs.readFileSync(statePath(dir), 'utf-8');
}

function pinMtime(dir) {
  fs.utimesSync(statePath(dir), PINNED, PINNED);
  return fs.statSync(statePath(dir)).mtimeMs;
}

function mtime(dir) {
  return fs.statSync(statePath(dir)).mtimeMs;
}

function run(dir, ...args) {
  try {
    return execFileSync(process.execPath, [GSD_TOOLS, ...args], { cwd: dir, encoding: 'utf-8' });
  } catch (e) {
    // A non-zero exit still carries the JSON error payload on stdout.
    return e.stdout || '';
  }
}

function seedPlans(dir) {
  const pd = path.join(dir, '.planning', 'phases', '01-x');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(pd, '01-01-PLAN.md'), 'plan', 'utf-8');
  fs.writeFileSync(path.join(pd, '01-02-PLAN.md'), 'plan', 'utf-8');
  fs.writeFileSync(path.join(pd, '01-01-SUMMARY.md'), 'summary', 'utf-8');
}

check('advance-plan on an unparseable STATE.md reports the error and never writes', () => {
  const dir = mkproj();
  try {
    writeState(dir, `${FM}Phase: 3\nStatus: Executing\n\nProgress: [░░░░░░░░░░] 0%\n`);
    const before = stateText(dir);
    const m = pinMtime(dir);
    const out = run(dir, 'state', 'advance-plan');
    assert.ok(out.includes('Cannot parse'), `expected Cannot parse, got ${out}`);
    assert.strictEqual(stateText(dir), before, 'STATE.md must be byte-identical');
    assert.strictEqual(mtime(dir), m, 'mtime must be unchanged');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('update-progress rewrites the body line to 50% while frontmatter progress survives', () => {
  const dir = mkproj();
  try {
    writeState(dir, `${FM}Phase: 3\nStatus: Executing\n\nProgress: [░░░░░░░░░░] 0%\n`);
    seedPlans(dir);
    run(dir, 'state', 'update-progress');
    const after = stateText(dir);
    assert.ok(/^Progress:.*50%/m.test(after), `expected body 50%, got:\n${after}`);
    assert.ok(/^  total_phases: \d+$/m.test(after), 'total_phases line must survive');
    assert.ok(/^  completed_plans: \d+$/m.test(after), 'completed_plans line must survive');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('update-progress with a frontmatter-only Progress key is a byte-identical no-op', () => {
  const dir = mkproj();
  try {
    writeState(dir, `${FM}Phase: 3\nStatus: Executing\n`);
    seedPlans(dir);
    const before = stateText(dir);
    const m = pinMtime(dir);
    const out = run(dir, 'state', 'update-progress');
    assert.ok(out.includes('Progress field not found'), `expected not-found reason, got ${out}`);
    assert.strictEqual(stateText(dir), before, 'STATE.md must be byte-identical');
    assert.strictEqual(mtime(dir), m, 'mtime must be unchanged');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('advance-plan on a parseable STATE.md still advances the plan counter', () => {
  const dir = mkproj();
  try {
    writeState(dir, `${FM}Phase: 3\nPlan: 2 of 3\nStatus: Executing\n`);
    const out = run(dir, 'state', 'advance-plan');
    assert.ok(out.includes('"advanced":true'), `expected advanced, got ${out}`);
    assert.ok(out.includes('"current_plan":3'), `expected current_plan 3, got ${out}`);
    assert.ok(/^Plan: 3 of 3/m.test(stateText(dir)), `expected Plan: 3 of 3, got:\n${stateText(dir)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll state-write-only-parsed tests passed');
