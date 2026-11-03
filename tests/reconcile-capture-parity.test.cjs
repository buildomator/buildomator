#!/usr/bin/env node
'use strict';

// Parity guard: state.add-decision must attach the same reconcile directive in
// the CJS twin (bin/gsd-tools.cjs) and the SDK twin (sdk/dist/cli.js).
// Requires a built SDK (npm --prefix sdk run build).

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GSD_TOOLS = path.join(REPO_ROOT, 'bin', 'gsd-tools.cjs');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'reconcile');

if (!fs.existsSync(SDK_CLI)) {
  console.error('FAIL: sdk/dist/cli.js is missing. Build the SDK first: npm --prefix sdk run build');
  process.exit(1);
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function freshCopy(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-parity-'));
  fs.cpSync(path.join(FIXTURES, name), root, { recursive: true });
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.renameSync(path.join(root, 'STATE.md'), path.join(root, '.planning', 'STATE.md'));
  return root;
}

function addDecision(twin, root, summary) {
  const args = ['--phase', '4', '--summary', summary];
  const argv = twin === 'sdk'
    ? [SDK_CLI, 'query', 'state.add-decision', ...args]
    : [GSD_TOOLS, 'state', 'add-decision', ...args];
  const res = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `${twin} exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

const CASES = [
  ['enrolment-clear', 'Cohort enrolment and invoicing need one approval ask only', true],
  ['no-candidate', 'Adopt quarterly telemetry dashboards', false],
];

for (const [fixture, summary, expectDirective] of CASES) {
  check(`${fixture}: twins are field-identical`, () => {
    const cjs = addDecision('cjs', freshCopy(fixture), summary);
    const sdk = addDecision('sdk', freshCopy(fixture), summary);
    assert.deepStrictEqual(cjs, sdk);
    assert.strictEqual('reconcile' in cjs, expectDirective);
    if (expectDirective) {
      assert.ok(cjs.reconcile.candidates.length > 0);
      assert.ok(cjs.reconcile.directive.includes('references/decision-reconciliation.md'));
    }
  });
}

if (failures) process.exit(1);
