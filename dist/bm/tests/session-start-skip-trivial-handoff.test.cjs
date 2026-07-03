'use strict';

// Regression test for the trivial-handoff guard added in #12 (cherry-picked
// from @dboeckenhoff). The session-start hook in bin/gsd-tools.cjs must skip
// emitting the "GSD session continuity" resume system message when the
// HANDOFF.json shape is schema-valid-but-trivial (phase: null, task: null),
// which is what bin/lib/checkpoint.cjs writes when PreCompact fires in an
// idle session. Legacy or missing-field shapes (undefined !== null is true)
// must still emit, so the guard is safe-by-default on unknown shapes.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_BIN = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
const CONTINUITY_MARKER = 'GSD session continuity';

function withTempRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-session-start-test-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeHandoff(dir, payload) {
  fs.writeFileSync(
    path.join(dir, '.planning', 'HANDOFF.json'),
    JSON.stringify(payload, null, 2)
  );
}

function runHook(cwd, source) {
  const result = spawnSync('node', [HOOK_BIN, 'hook', 'session-start'], {
    cwd,
    encoding: 'utf-8',
    timeout: 5000,
    input: JSON.stringify({ source: source || 'startup' }),
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Schema-valid handoff skeleton with all required v1.0 fields, parameterized
// so each test case only declares its meaningful overrides.
function skeleton(overrides) {
  const base = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    phase: null,
    phase_name: null,
    phase_dir: null,
    plan: null,
    task: null,
    total_tasks: null,
    status: 'auto-checkpoint',
    completed_tasks: [],
    remaining_tasks: [],
    blockers: [],
    human_actions_pending: [],
    decisions: [],
    uncommitted_files: [],
    next_action: null,
    context_notes: '',
    source: 'auto-compact',
  };
  return Object.assign(base, overrides || {});
}

check('null phase + null task -> resume prompt silenced', () => {
  withTempRepo((dir) => {
    writeHandoff(dir, skeleton({}));
    const r = runHook(dir, 'startup');
    assert(
      !r.stdout.includes(CONTINUITY_MARKER),
      `expected NO continuity marker, got stdout:\n${r.stdout}`
    );
    assert(r.status === 0, `expected exit 0, got ${r.status}`);
  });
});

check('populated phase + null task -> resume prompt emits', () => {
  withTempRepo((dir) => {
    writeHandoff(dir, skeleton({ phase: '5', phase_name: 'Auth Module', plan: '5-01' }));
    const r = runHook(dir, 'startup');
    assert(
      r.stdout.includes(CONTINUITY_MARKER),
      `expected continuity marker, got stdout:\n${r.stdout}`
    );
    assert(
      r.stdout.includes('Phase: Auth Module'),
      `expected Phase to use phase_name, got stdout:\n${r.stdout}`
    );
  });
});

check('null phase + populated task -> resume prompt emits', () => {
  withTempRepo((dir) => {
    writeHandoff(dir, skeleton({ task: '5-02' }));
    const r = runHook(dir, 'startup');
    assert(
      r.stdout.includes(CONTINUITY_MARKER),
      `expected continuity marker, got stdout:\n${r.stdout}`
    );
    assert(
      r.stdout.includes('Task: 5-02'),
      `expected Task: 5-02 in stdout, got:\n${r.stdout}`
    );
  });
});

check('both populated -> resume prompt emits', () => {
  withTempRepo((dir) => {
    writeHandoff(dir, skeleton({
      phase: '5',
      phase_name: 'Auth Module',
      plan: '5-01',
      task: '5-01-task-3',
    }));
    const r = runHook(dir, 'startup');
    assert(
      r.stdout.includes(CONTINUITY_MARKER),
      `expected continuity marker, got stdout:\n${r.stdout}`
    );
  });
});

check('missing phase field (undefined, not null) -> resume prompt emits (safe default)', () => {
  withTempRepo((dir) => {
    // Write a minimal handoff with NO phase / phase_name / task fields at all
    // (undefined, not null). The guard's `!== null` check should pass because
    // undefined !== null is true, so legacy/unknown shapes still get the
    // resume prompt. This is the safe default: over-prompt on unknown shapes.
    fs.writeFileSync(
      path.join(dir, '.planning', 'HANDOFF.json'),
      JSON.stringify({
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'manual-pause',
        status: 'paused',
      }, null, 2)
    );
    const r = runHook(dir, 'startup');
    assert(
      r.stdout.includes(CONTINUITY_MARKER),
      `expected continuity marker for missing-field shape, got stdout:\n${r.stdout}`
    );
  });
});

check('no HANDOFF.json at all -> resume prompt silent', () => {
  withTempRepo((dir) => {
    // Deliberately do NOT create HANDOFF.json.
    const r = runHook(dir, 'startup');
    assert(
      !r.stdout.includes(CONTINUITY_MARKER),
      `expected NO continuity marker when HANDOFF.json absent, got stdout:\n${r.stdout}`
    );
    assert(r.status === 0, `expected exit 0, got ${r.status}`);
  });
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`session-start trivial-handoff guard: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
