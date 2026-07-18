'use strict';

// Regression spec for applySurface / _syncGsdDir in bin/lib/surface.cjs.
//
// An empty or unresolvable manifest resolves to empty skill/agent sets. Without
// a guard, the sync treats every installed gsd-* file as superseded and deletes
// it. These cases prove:
//   - Case 1: _syncGsdDir with an existing-but-empty staged dir leaves all dest
//             files untouched (including gsd-* agents).
//   - Case 2: applySurface with an empty Map() manifest leaves existing gsd-*
//             agents untouched.
//   - Case 3 (control): _syncGsdDir with a populated staged dir still prunes a
//             superseded gsd-* file and never touches a non-gsd file.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { applySurface, _syncGsdDir } = require(path.join(__dirname, '..', 'bin', 'lib', 'surface.cjs'));

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

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seedAgents(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gsd-planner.md'), 'planner\n');
  fs.writeFileSync(path.join(dir, 'gsd-executor.md'), 'executor\n');
  fs.writeFileSync(path.join(dir, 'other.md'), 'not a gsd file\n');
}

// Case 1: empty staged dir must not prune anything.
check('empty staged dir leaves all dest agents untouched', () => {
  const root = tmpDir('gsd-surface-empty-');
  try {
    const staged = path.join(root, 'staged');
    const dest = path.join(root, 'agents');
    fs.mkdirSync(staged, { recursive: true });
    seedAgents(dest);

    _syncGsdDir(staged, dest, 'agents');

    const after = new Set(fs.readdirSync(dest));
    assert(after.has('gsd-planner.md'), 'gsd-planner.md must survive');
    assert(after.has('gsd-executor.md'), 'gsd-executor.md must survive');
    assert(after.has('other.md'), 'other.md must survive');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Case 2: applySurface with an empty manifest must not touch installed agents.
check('applySurface with empty Map manifest leaves gsd-* agents untouched', () => {
  const root = tmpDir('gsd-surface-empty-');
  try {
    const runtimeConfigDir = path.join(root, 'config');
    const commandsDir = path.join(root, 'commands', 'gsd');
    const agentsDir = path.join(root, 'agents');
    fs.mkdirSync(runtimeConfigDir, { recursive: true });
    fs.mkdirSync(commandsDir, { recursive: true });
    seedAgents(agentsDir);

    applySurface(runtimeConfigDir, commandsDir, agentsDir, new Map(), undefined);

    const after = new Set(fs.readdirSync(agentsDir));
    assert(after.has('gsd-planner.md'), 'gsd-planner.md must survive empty manifest');
    assert(after.has('gsd-executor.md'), 'gsd-executor.md must survive empty manifest');
    assert(after.has('other.md'), 'other.md must survive empty manifest');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Case 3 (control): populated staged set still prunes superseded gsd-* files.
check('populated staged set prunes superseded gsd-* and keeps non-gsd', () => {
  const root = tmpDir('gsd-surface-empty-');
  try {
    const staged = path.join(root, 'staged');
    const dest = path.join(root, 'agents');
    fs.mkdirSync(staged, { recursive: true });
    fs.writeFileSync(path.join(staged, 'gsd-planner.md'), 'planner\n');
    seedAgents(dest);

    _syncGsdDir(staged, dest, 'agents');

    const after = new Set(fs.readdirSync(dest));
    assert(after.has('gsd-planner.md'), 'staged gsd-planner.md must remain');
    assert(!after.has('gsd-executor.md'), 'superseded gsd-executor.md must be pruned');
    assert(after.has('other.md'), 'non-gsd other.md must never be touched');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`surface empty manifest agents: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
