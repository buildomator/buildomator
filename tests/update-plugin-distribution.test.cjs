#!/usr/bin/env node
'use strict';

// Guard test for the update workflow's distribution routing.
//
// The update workflow must detect a Claude Code marketplace-plugin install
// (a plugin cache dir exists) and route it to /plugin refresh + /reload-plugins
// guidance, never the npm/npx upstream installer. The npx install path stays
// reachable only through the no-plugin fallback.
//
// This suite asserts, for BOTH the gsd source (workflows/update.md) and the
// generated bm copy (dist/bm/workflows/update.md):
//   1. a detect_distribution step exists BEFORE the first npx upstream install.
//   2. the detect step body carries the plugin-cache glob + /reload-plugins
//      guidance and contains no npx / @opengsd string itself.
//   3. functional: the extracted detect bash block prints DISTRIBUTION=plugin
//      (newest cached version, reload guidance, no npx) against a fake cache,
//      and prints exactly DISTRIBUTION=npm against an empty HOME.
//   4. transform sanity: the bm copy says /bm:update, the source says /gsd:update.
//
// Zero-dep harness mirroring tests/build-bm-drift.test.cjs: node:assert, a bare
// check(name, fn) runner, a failure counter, a process.exit(1) footer, and
// spawnSync for shelling out. CI runs this directly via
// `node tests/update-plugin-distribution.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'workflows', 'update.md');
const DIST = path.join(ROOT, 'dist', 'bm', 'workflows', 'update.md');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Extract the fenced bash block inside the detect_distribution step.
function extractDetectBlock(text) {
  const stepStart = text.indexOf('<step name="detect_distribution">');
  assert.ok(stepStart >= 0, 'detect_distribution step not found');
  const stepEnd = text.indexOf('</step>', stepStart);
  assert.ok(stepEnd > stepStart, 'detect_distribution step is not closed');
  const step = text.slice(stepStart, stepEnd);
  const fenceOpen = step.indexOf('```bash');
  assert.ok(fenceOpen >= 0, 'no bash fence in detect_distribution step');
  const bodyStart = step.indexOf('\n', fenceOpen) + 1;
  const fenceClose = step.indexOf('\n```', bodyStart);
  assert.ok(fenceClose > bodyStart, 'bash fence is not closed');
  return step.slice(bodyStart, fenceClose);
}

// Run an extracted block with a temp HOME and a stub dir prefixed onto PATH so
// gh/curl are shadowed (dead) while sed/grep/sort/node stay reachable.
function runBlock(blockText, homeDir) {
  const blockFile = path.join(os.tmpdir(), `ucm-block-${process.pid}-${Math.random().toString(36).slice(2)}.sh`);
  fs.writeFileSync(blockFile, blockText);
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucm-stub-'));
  for (const tool of ['gh', 'curl']) {
    const p = path.join(stubDir, tool);
    fs.writeFileSync(p, '#!/bin/sh\nexit 1\n');
    fs.chmodSync(p, 0o755);
  }
  const r = spawnSync('bash', [blockFile], {
    encoding: 'utf8',
    env: { ...process.env, HOME: homeDir, PATH: `${stubDir}:${process.env.PATH}` },
  });
  fs.rmSync(blockFile, { force: true });
  fs.rmSync(stubDir, { recursive: true, force: true });
  return r;
}

function makeFakeCacheHome(entries) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ucm-home-'));
  for (const { market, plugin, version } of entries) {
    const dir = path.join(home, '.claude', 'plugins', 'cache', market, plugin, version, '.claude-plugin');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name: plugin, version }));
  }
  return home;
}

const COPIES = [
  { label: 'source (gsd)', file: SOURCE },
  { label: 'dist (bm)', file: DIST },
];

for (const { label, file } of COPIES) {
  const text = fs.readFileSync(file, 'utf8');

  check(`${label}: detect_distribution step precedes the npx upstream install`, () => {
    const detectIdx = text.indexOf('<step name="detect_distribution">');
    const installIdx = text.indexOf('--package=@opengsd');
    assert.ok(detectIdx >= 0, 'detect_distribution step missing');
    assert.ok(installIdx >= 0, 'expected the npx upstream install to still exist in the npm fallback');
    assert.ok(detectIdx < installIdx, 'detect_distribution must come before the npx upstream install');
  });

  check(`${label}: detect step carries plugin-cache glob + reload guidance, no npx`, () => {
    const stepStart = text.indexOf('<step name="detect_distribution">');
    const stepEnd = text.indexOf('</step>', stepStart);
    const step = text.slice(stepStart, stepEnd);
    assert.ok(step.includes('plugins/cache'), 'missing plugins/cache glob marker');
    assert.ok(step.includes('/bm/'), 'missing /bm/ path segment');
    assert.ok(step.includes('/gsd/'), 'missing /gsd/ path segment');
    assert.ok(step.includes('/reload-plugins'), 'missing /reload-plugins guidance');
    assert.ok(!/npx/.test(step), 'detect step must not contain npx');
    assert.ok(!/@opengsd/.test(step), 'detect step must not contain @opengsd');
  });

  check(`${label}: functional plugin case (newest version, reload guidance, no npx)`, () => {
    const block = extractDetectBlock(text);
    const home = makeFakeCacheHome([
      { market: 'gsd-plugin', plugin: 'bm', version: '1.2.3' },
      { market: 'buildomator', plugin: 'gsd', version: '1.2.4' },
    ]);
    // junk marketplace-level dir that must be ignored
    fs.mkdirSync(path.join(home, '.claude', 'plugins', 'cache', 'gsd-plugin', 'temp_git_x'), { recursive: true });
    const r = runBlock(block, home);
    fs.rmSync(home, { recursive: true, force: true });
    assert.strictEqual(r.status, 0, `block exited non-zero: ${r.stderr}`);
    assert.ok(/DISTRIBUTION=plugin/.test(r.stdout), 'expected DISTRIBUTION=plugin');
    assert.ok(/INSTALLED_PLUGIN_VERSION=1\.2\.4/.test(r.stdout), 'expected newest version 1.2.4');
    assert.ok(/\/reload-plugins/.test(r.stdout), 'expected /reload-plugins guidance');
    assert.ok(!/npx|@opengsd/.test(r.stdout), 'plugin output must not mention npx/@opengsd');
  });

  check(`${label}: functional npm fallback case (empty HOME)`, () => {
    const block = extractDetectBlock(text);
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ucm-empty-'));
    const r = runBlock(block, home);
    fs.rmSync(home, { recursive: true, force: true });
    assert.strictEqual(r.status, 0, `block exited non-zero: ${r.stderr}`);
    assert.strictEqual(r.stdout.trim(), 'DISTRIBUTION=npm', `expected exactly DISTRIBUTION=npm, got: ${r.stdout}`);
  });
}

check('transform sanity: source says /gsd:update', () => {
  assert.ok(fs.readFileSync(SOURCE, 'utf8').includes('/gsd:update'), 'source must retain /gsd:update');
});

check('transform sanity: dist says /bm:update and never /gsd:update', () => {
  const dist = fs.readFileSync(DIST, 'utf8');
  assert.ok(dist.includes('/bm:update'), 'dist must say /bm:update');
  assert.ok(!dist.includes('/gsd:update'), 'dist must not contain /gsd:update');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll update plugin-distribution tests passed');
