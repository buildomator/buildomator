#!/usr/bin/env node
'use strict';

// Back-compat tripwire for the bm-sdk / gsd-sdk dual CLI name.
//
// bm-sdk is the primary command; gsd-sdk remains a fully working alias through
// the 4.x line. This test proves both wrappers exist, both resolve to the same
// bundled SDK, and both produce byte-identical output for the same query, and
// that the npm bin field maps both names to the same entry point.

const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(REPO_ROOT, 'bin');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

check('both POSIX wrappers exist and are executable', () => {
  for (const name of ['bm-sdk', 'gsd-sdk']) {
    const p = path.join(BIN, name);
    assert.ok(fs.existsSync(p), `${name} wrapper missing`);
    // Executable bit for owner.
    const mode = fs.statSync(p).mode;
    assert.ok((mode & 0o100) !== 0, `${name} is not executable`);
  }
});

check('both Windows wrappers exist', () => {
  for (const name of ['bm-sdk.cmd', 'gsd-sdk.cmd']) {
    assert.ok(fs.existsSync(path.join(BIN, name)), `${name} wrapper missing`);
  }
});

check('bm-sdk and gsd-sdk produce byte-identical output for the same query', () => {
  const args = ['query', 'resolve-model', 'gsd-planner', '--raw'];
  const opts = { cwd: REPO_ROOT, encoding: 'utf8' };
  const bmOut = cp.execFileSync(path.join(BIN, 'bm-sdk'), args, opts);
  const gsdOut = cp.execFileSync(path.join(BIN, 'gsd-sdk'), args, opts);
  assert.strictEqual(bmOut, gsdOut, 'wrapper outputs differ');
  // Sanity: output is the expected resolver payload. Assert the payload SHAPE,
  // not a resolved value: the model string is config-dependent and is empty in
  // a fresh checkout with no project config, so check the keys and types.
  const parsed = JSON.parse(bmOut);
  assert.ok(typeof parsed.model === 'string', 'resolve-model output missing model field');
  assert.ok(typeof parsed.profile === 'string', 'resolve-model output missing profile field');
});

check('sdk/package.json bin maps both bm-sdk and gsd-sdk to ./dist/cli.js', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'sdk', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.bin['bm-sdk'], './dist/cli.js', 'bm-sdk bin mapping wrong');
  assert.strictEqual(pkg.bin['gsd-sdk'], './dist/cli.js', 'gsd-sdk bin mapping wrong');
});

console.log(failures ? `\nFAILED (${failures})` : '\nAll bm-sdk alias checks passed');
process.exit(failures ? 1 : 0);
