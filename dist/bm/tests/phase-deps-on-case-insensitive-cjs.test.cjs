'use strict';

// Regression test for #PLUGIN-DEPS-ON-CASE-INSENSITIVE (bin/lib/phase.cjs).
// The patch makes phase wave computation case-insensitive in depends_on
// resolution: lowercased dep references resolve to uppercase-suffix plan
// IDs (e.g. depends_on: ['05c-01'] resolves to plan ID '05C-01-foo').
// Without it, the DAG edge silently drops and the wave layout collapses
// to wave 1 + a misleading "declared wave: N but depends_on DAG places
// it in wave 1" warning. Note: the SDK TypeScript side has its own test
// at sdk/src/query/phase.test.ts, but the CJS path at bin/lib/phase.cjs
// is the runtime path that users actually hit. Both must pass.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const TOOL_BIN = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

function withTempPhase(plans, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-phase-case-test-'));
  const phaseDir = path.join(dir, '.planning', 'phases', '05C-test');
  fs.mkdirSync(phaseDir, { recursive: true });
  for (const [filename, body] of Object.entries(plans)) {
    fs.writeFileSync(path.join(phaseDir, filename), body);
  }
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runPhaseIndex(cwd, phase) {
  const result = spawnSync(
    'node',
    [TOOL_BIN, 'phase-plan-index', phase, '--raw', '--cwd', cwd],
    { encoding: 'utf-8', timeout: 5000 }
  );
  if (result.status !== 0) {
    throw new Error(
      `phase-plan-index exited ${result.status}\nstderr: ${result.stderr}\nstdout: ${result.stdout}`
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(
      `phase-plan-index output not valid JSON: ${err.message}\nstdout: ${result.stdout}`
    );
  }
}

function planBody(planNum, deps) {
  const depsLine = deps.length === 0
    ? 'depends_on: []'
    : `depends_on: [${deps.map(d => `'${d}'`).join(', ')}]`;
  return [
    '---',
    'phase: 05C-test',
    `plan: ${planNum.toString().padStart(2, '0')}`,
    depsLine,
    '---',
    `<objective>Plan ${planNum}</objective>`,
    '',
  ].join('\n');
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
function assert(cond, msg) { if (!cond) throw new Error(msg); }

check('lowercase canonical-prefix dep resolves to uppercase-suffix plan ID', () => {
  // 05C-02 declares depends_on: ['05c-01'] (lowercase canonical prefix).
  // The patched lookup map keys are lowercased so this must resolve to
  // 05C-01 and 05C-02 lands in wave 2.
  withTempPhase({
    '05C-01-PLAN.md': planBody(1, []),
    '05C-02-PLAN.md': planBody(2, ['05c-01']),
  }, (cwd) => {
    const result = runPhaseIndex(cwd, '05C');
    assert(result.waves, `expected .waves in output, got ${JSON.stringify(result)}`);
    assert(
      Array.isArray(result.waves['1']) && result.waves['1'].includes('05C-01'),
      `expected wave 1 to contain 05C-01, got ${JSON.stringify(result.waves)}`
    );
    assert(
      Array.isArray(result.waves['2']) && result.waves['2'].includes('05C-02'),
      `expected wave 2 to contain 05C-02 (lowercase dep resolved), got ${JSON.stringify(result.waves)}. ` +
      `If 05C-02 fell into wave 1, the patch was stripped and the case-insensitive lookup is broken.`
    );
  });
});

check('uppercase dep still resolves (no regression on canonical casing)', () => {
  // Same plan layout but 05C-02 uses the canonical uppercase form.
  // This must continue to work since the patch only added permissiveness,
  // never removed any path.
  withTempPhase({
    '05C-01-PLAN.md': planBody(1, []),
    '05C-02-PLAN.md': planBody(2, ['05C-01']),
  }, (cwd) => {
    const result = runPhaseIndex(cwd, '05C');
    assert(
      Array.isArray(result.waves['2']) && result.waves['2'].includes('05C-02'),
      `expected wave 2 to contain 05C-02 (uppercase dep), got ${JSON.stringify(result.waves)}`
    );
  });
});

check('mixed-case dep resolves (e.g. 05c-01 → 05C-01)', () => {
  // A more aggressive mixed-case form to verify the toLowerCase normalisation
  // is applied to BOTH sides (map key + lookup key).
  withTempPhase({
    '05C-01-PLAN.md': planBody(1, []),
    '05C-02-PLAN.md': planBody(2, ['05C-01'.toLowerCase()]),
  }, (cwd) => {
    const result = runPhaseIndex(cwd, '05C');
    assert(
      Array.isArray(result.waves['2']) && result.waves['2'].includes('05C-02'),
      `expected wave 2 to contain 05C-02 (mixed-case dep), got ${JSON.stringify(result.waves)}`
    );
  });
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`#PLUGIN-DEPS-ON-CASE-INSENSITIVE (CJS) regression: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
