#!/usr/bin/env node
'use strict';

// Pins the resolve-model behavior when .planning/config.json is absent, and
// proves the two resolver twins (bin/gsd-tools.cjs + sdk/dist/cli.js) agree.
//
// A project with no config file must resolve exactly like a project with an
// empty {} config: gsd-planner -> opus, not an empty model id. The empty-model
// path once lived only in the SDK; these checks fail if it ever comes back or
// if the twins drift apart.
//
// resolveModelInternal(cwd, agentType) is the exact function init.cjs uses to
// pick planner_model / executor_model when spawning agents. Note the signature:
// cwd first, then the agent type.
//
// Every fixture points GSD_HOME at an empty temp dir so a developer's real
// ~/.gsd/defaults.json (which may set resolve_model_ids) cannot skew the
// no-.planning fallback path.
//
// Zero-dep harness: bare check/assert, a failure counter, process.exit(1)
// footer. Run directly via `node tests/resolve-model-missing-config.test.cjs`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Isolate global defaults for the in-process resolveModelInternal calls.
const EMPTY_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rmmc-home-'));
process.env.GSD_HOME = EMPTY_HOME;

const { resolveModelInternal } = require(path.join(ROOT, 'bin', 'lib', 'core.cjs'));

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const cleanup = [EMPTY_HOME];
function freshProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmmc-proj-'));
  cleanup.push(dir);
  return dir;
}

function subEnv() {
  const env = { ...process.env, GSD_HOME: EMPTY_HOME };
  delete env.CLAUDE_PLUGIN_ROOT;
  return env;
}

// Spawn a resolver twin in the given project dir and return parsed { model, profile }.
function runGsdTools(cwd, agent) {
  const r = cp.spawnSync('node', [path.join(ROOT, 'bin', 'gsd-tools.cjs'), 'resolve-model', agent], {
    cwd, env: subEnv(), encoding: 'utf8',
  });
  assert(r.status === 0, `gsd-tools exit ${r.status} (stderr: ${r.stderr})`);
  return JSON.parse(r.stdout);
}
function runSdk(cwd, agent) {
  const r = cp.spawnSync('node', [path.join(ROOT, 'sdk', 'dist', 'cli.js'), 'query', 'resolve-model', agent], {
    cwd, env: subEnv(), encoding: 'utf8',
  });
  assert(r.status === 0, `sdk cli exit ${r.status} (stderr: ${r.stderr})`);
  return JSON.parse(r.stdout);
}

// ── Check 1: resolveModelInternal returns opus with no config present ─────────

check('resolveModelInternal(cwd, gsd-planner) -> opus with no .planning/', () => {
  const dir = freshProject();
  const model = resolveModelInternal(dir, 'gsd-planner');
  assert(model === 'opus', `expected opus, got ${JSON.stringify(model)}`);
});

check('resolveModelInternal(cwd, gsd-planner) -> opus with .planning/ but no config.json', () => {
  const dir = freshProject();
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  const model = resolveModelInternal(dir, 'gsd-planner');
  assert(model === 'opus', `expected opus, got ${JSON.stringify(model)}`);
});

// ── Check 2: missing config == empty {} config, for planner and executor ──────

for (const agent of ['gsd-planner', 'gsd-executor']) {
  check(`resolveModelInternal missing config == empty {} for ${agent}`, () => {
    const dir = freshProject();
    fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
    const missing = resolveModelInternal(dir, agent);
    assert(missing !== '' && missing != null, `missing-config model was empty for ${agent}`);

    fs.writeFileSync(path.join(dir, '.planning', 'config.json'), '{}');
    const empty = resolveModelInternal(dir, agent);
    assert(missing === empty, `missing (${missing}) != empty-{} (${empty}) for ${agent}`);
  });
}

// ── Check 3: cross-twin parity on model + profile ─────────────────────────────

check('gsd-tools and sdk twins agree on model+profile (missing config, then {})', () => {
  const dir = freshProject();
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });

  const toolsMissing = runGsdTools(dir, 'gsd-planner');
  const sdkMissing = runSdk(dir, 'gsd-planner');
  assert(sdkMissing.model !== '', `sdk returned empty model with missing config: ${JSON.stringify(sdkMissing)}`);
  assert(toolsMissing.model === sdkMissing.model,
    `twin model mismatch (missing): tools=${toolsMissing.model} sdk=${sdkMissing.model}`);
  assert(toolsMissing.profile === sdkMissing.profile,
    `twin profile mismatch (missing): tools=${toolsMissing.profile} sdk=${sdkMissing.profile}`);

  fs.writeFileSync(path.join(dir, '.planning', 'config.json'), '{}');
  const toolsEmpty = runGsdTools(dir, 'gsd-planner');
  const sdkEmpty = runSdk(dir, 'gsd-planner');
  assert(toolsEmpty.model === sdkEmpty.model,
    `twin model mismatch ({}): tools=${toolsEmpty.model} sdk=${sdkEmpty.model}`);
  assert(toolsEmpty.profile === sdkEmpty.profile,
    `twin profile mismatch ({}): tools=${toolsEmpty.profile} sdk=${sdkEmpty.profile}`);

  // And missing == empty across the whole shape for the SDK twin.
  assert(sdkMissing.model === sdkEmpty.model && sdkMissing.profile === sdkEmpty.profile,
    `sdk missing != empty: ${JSON.stringify(sdkMissing)} vs ${JSON.stringify(sdkEmpty)}`);
});

// ── cleanup ──────────────────────────────────────────────────────────────────

for (const dir of cleanup) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ── summary (fail-loud) ──────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;
console.log('');
console.log(`resolve-model missing config: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
