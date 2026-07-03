#!/usr/bin/env node
'use strict';

// Regression test for the default/base-branch resolver (core.resolveBaseBranch
// + `gsd-tools.cjs base-branch`). Fixes the main-vs-master divergence: the old
// per-workflow bash detected only origin/HEAD then hardcoded :-main, so any
// checkout where origin/HEAD is unset (git init + remote add, fresh fetch, many
// worktrees, CI) silently fell back to main even on a master repo.
//
// Precedence: git.base_branch config > origin/HEAD > git remote show origin >
// local master/main existence > main. Pure git, no gsd-sdk dependency.

const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../bin/lib/core.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

const tmps = [];
function newRepo(branch) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-test-'));
  tmps.push(d);
  cp.execSync('git init -q', { cwd: d });
  cp.execSync('git config user.email a@b.c && git config user.name x', { cwd: d });
  cp.execSync(`git checkout -q -b ${branch}`, { cwd: d });
  fs.writeFileSync(path.join(d, 'f'), 'x');
  cp.execSync('git add -A && git commit -qm c', { cwd: d });
  return d;
}

check('resolveBaseBranch is exported', () => {
  assert.strictEqual(typeof core.resolveBaseBranch, 'function');
});

check('master-only repo (no origin) resolves master, not main', () => {
  assert.strictEqual(core.resolveBaseBranch(newRepo('master')), 'master');
});

check('main-only repo resolves main', () => {
  assert.strictEqual(core.resolveBaseBranch(newRepo('main')), 'main');
});

check('git.base_branch config override wins', () => {
  const d = newRepo('main');
  fs.mkdirSync(path.join(d, '.planning'));
  fs.writeFileSync(path.join(d, '.planning/config.json'), JSON.stringify({ git: { base_branch: 'develop' } }));
  assert.strictEqual(core.resolveBaseBranch(d), 'develop');
});

check('flat git.base_branch key also honored (defensive)', () => {
  const d = newRepo('master');
  fs.mkdirSync(path.join(d, '.planning'));
  fs.writeFileSync(path.join(d, '.planning/config.json'), JSON.stringify({ 'git.base_branch': 'release' }));
  assert.strictEqual(core.resolveBaseBranch(d), 'release');
});

check('CLI subcommand `gsd-tools.cjs base-branch` prints the bare name', () => {
  const d = newRepo('master');
  const out = cp.execSync(`node "${path.join(__dirname, '..', 'bin', 'gsd-tools.cjs')}" base-branch`, { cwd: d, encoding: 'utf8' });
  assert.strictEqual(out.trim(), 'master');
  assert.ok(!out.startsWith('{'), 'output should be bare name, not JSON');
});

// No workflow should still hardcode a `:-main` (or `:-master`) branch fallback.
check('no workflow hardcodes a :-main/:-master branch fallback', () => {
  const wfDir = path.join(__dirname, '..', 'workflows');
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) {
        const body = fs.readFileSync(full, 'utf8');
        // BRANCH/DEFAULT_BRANCH/BASE_BRANCH/TARGET=...:-main}  (the divergence bug)
        if (/(BRANCH|TARGET)\}?=?\$?\{?[^\n]*:-(main|master)\}/.test(body)
            && /(DEFAULT_BRANCH|BASE_BRANCH|TARGET)=\$\{[^}]*:-(main|master)\}/.test(body)) {
          offenders.push(path.relative(path.join(__dirname, '..'), full));
        }
      }
    }
  };
  walk(wfDir);
  assert.deepStrictEqual(offenders, [], `workflows still hardcoding branch fallback: ${offenders.join(', ')}`);
});

for (const d of tmps) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

if (failures) { console.error(`\nbase-branch-resolver: ${failures} failure(s)`); process.exit(1); }
console.log('\nbase-branch-resolver: all checks passed');
