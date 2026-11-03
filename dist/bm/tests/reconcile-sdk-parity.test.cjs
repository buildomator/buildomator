#!/usr/bin/env node
'use strict';

// Parity guard: the CJS reconcile twin (bin/lib/reconcile.cjs, driven through
// bin/gsd-tools.cjs) and the SDK twin (sdk/src/query/reconcile.ts, built into
// sdk/dist/cli.js) are independent implementations of the same mechanical
// engine. They must return identical candidate lists, ledger decisions, pending
// contents and safety-gate verdicts for the same fixtures.
//
// Requires a built SDK at sdk/dist/cli.js (npm --prefix sdk run build).
// Zero-dep harness: node:assert + a check() runner + a process.exit(1) footer.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GSD_TOOLS = path.join(REPO_ROOT, 'bin', 'gsd-tools.cjs');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'reconcile');
const NAMES = ['enrolment-clear', 'ambiguous', 'no-candidate'];

if (!fs.existsSync(SDK_CLI)) {
  console.error('FAIL: sdk/dist/cli.js is missing. Build the SDK first: npm --prefix sdk run build');
  process.exit(1);
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function run(twin, root, args) {
  const argv = twin === 'sdk' ? [SDK_CLI, 'query', ...args] : [GSD_TOOLS, ...args];
  const res = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `${twin} ${args.join(' ')} exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

function fresh(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `reconcile-parity-${name}-`));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

for (const name of NAMES) {
  check(`candidates parity: ${name}`, () => {
    const dir = fresh(name);
    const cjs = run('cjs', dir, ['reconcile', 'candidates', '--latest']);
    const sdk = run('sdk', dir, ['reconcile', 'candidates', '--latest']);
    assert.deepStrictEqual(sdk, cjs);
  });

  check(`sweep parity: ${name}`, () => {
    const dir = fresh(name);
    assert.deepStrictEqual(run('sdk', dir, ['reconcile', 'sweep']), run('cjs', dir, ['reconcile', 'sweep']));
  });
}

check('fixture expectations hold through the SDK entry point', () => {
  const clear = run('sdk', fresh('enrolment-clear'), ['reconcile', 'candidates', '--latest']);
  assert.strictEqual(clear.candidates.length, 2);
  assert.strictEqual(clear.candidates.filter((c) => c.autoRewritable).length, 1);
  const none = run('sdk', fresh('no-candidate'), ['reconcile', 'candidates', '--latest']);
  assert.deepStrictEqual(none.candidates, []);
  assert.strictEqual(none.modelNeeded, false);
});

check('ledger and pending parity: same hash, same on-disk contents', () => {
  const a = fresh('ambiguous');
  const b = fresh('ambiguous');
  const hash = run('cjs', a, ['reconcile', 'candidates', '--latest']).decisionHash;
  assert.strictEqual(run('sdk', b, ['reconcile', 'candidates', '--latest']).decisionHash, hash);

  run('cjs', a, ['reconcile', 'pending', hash]);
  run('sdk', b, ['reconcile', 'pending', hash]);
  const pa = fs.readFileSync(path.join(a, '.planning', 'reconcile-pending.json'), 'utf8');
  const pb = fs.readFileSync(path.join(b, '.planning', 'reconcile-pending.json'), 'utf8');
  assert.strictEqual(pb, pa);

  const ra = run('cjs', a, ['reconcile', 'record', hash, '--outcome', 'dismissed']);
  const rb = run('sdk', b, ['reconcile', 'record', hash, '--outcome', 'dismissed']);
  assert.deepStrictEqual(rb, ra);
  assert.strictEqual(ra.drainedPending, true);
  const la = JSON.parse(fs.readFileSync(path.join(a, '.planning', 'reconcile-ledger.json'), 'utf8'));
  const lb = JSON.parse(fs.readFileSync(path.join(b, '.planning', 'reconcile-ledger.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(lb.entries), Object.keys(la.entries));
  assert.strictEqual(lb.entries[hash].outcome, la.entries[hash].outcome);
});

check('safety-gate parity on the same inputs', () => {
  const sdkMod = require(path.join(REPO_ROOT, 'bin', 'lib', 'reconcile.cjs'));
  const doc = '# Rules\n\n## Profile\n\n> do not edit manually\n\n- Rule here.\n';
  assert.strictEqual(sdkMod.assessTargetDoc('CLAUDE.md', '# R\n\n- plain\n', 2).autoRewritable, true);
  assert.strictEqual(sdkMod.assessTargetDoc('ROADMAP.md', '# R\n\n- plain\n', 2).autoRewritable, false);
  assert.strictEqual(sdkMod.assessTargetDoc('CLAUDE.md', doc, 6).autoRewritable, false);
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nreconcile parity: all checks passed');
