#!/usr/bin/env node
'use strict';

// Unit + integration tests for bin/build-bm.cjs (the generate-and-stamp build).
//
// Two layers:
//   1. Pure-helper units (stampBmManifest, shouldExclude) exercised without disk.
//   2. Integration cases that actually run `node bin/build-bm.cjs` (build +
//      --check) and inspect the generated dist/bm tree.
//
// Zero-dep harness mirroring tests/version-alignment.test.cjs: node:assert,
// a bare check(name, fn) runner, a failure counter, and a process.exit(1)
// footer. Integration cases shell out with spawnSync. CI runs this directly
// via `node tests/build-bm-drift.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'bm');
const SCRIPT = path.join(ROOT, 'bin', 'build-bm.cjs');

const { stampBmManifest, shouldExclude } = require('../bin/build-bm.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function runBuild(args) {
  return spawnSync('node', [SCRIPT, ...(args || [])], { cwd: ROOT, encoding: 'utf8' });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ─── exports ─────────────────────────────────────────────────────────────────

check('exports the pure helpers', () => {
  assert.strictEqual(typeof stampBmManifest, 'function', 'missing stampBmManifest');
  assert.strictEqual(typeof shouldExclude, 'function', 'missing shouldExclude');
});

// ─── stampBmManifest ─────────────────────────────────────────────────────────

const SRC_MANIFEST = {
  name: 'gsd',
  version: '4.0.4',
  description:
    'Get Shit Done -- a structured workflow plugin for Claude Code that adds ' +
    'planning, execution, and verification commands with MCP-backed project state',
  author: { name: 'Jasper Nuyens' },
  repository: 'https://github.com/jnuyens/gsd-plugin',
  license: 'MIT',
  keywords: ['workflow', 'planning', 'execution', 'project-management', 'gsd'],
  mcpServers: { gsd: { type: 'stdio', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/mcp/server.cjs'] } },
};

check('stampBmManifest sets name bm, displayName Buildomator, Buildomator description', () => {
  const out = stampBmManifest(SRC_MANIFEST);
  assert.strictEqual(out.name, 'bm');
  assert.strictEqual(out.displayName, 'Buildomator');
  assert.strictEqual(
    out.description,
    'Buildomator -- a structured workflow plugin for Claude Code that adds ' +
      'planning, execution, and verification commands with MCP-backed project state',
  );
});

check('stampBmManifest preserves version from source', () => {
  assert.strictEqual(stampBmManifest(SRC_MANIFEST).version, '4.0.4');
  assert.strictEqual(stampBmManifest({ ...SRC_MANIFEST, version: '9.9.9' }).version, '9.9.9');
});

check('stampBmManifest leaves every other key deep-equal (incl. gsd mcpServers)', () => {
  const out = stampBmManifest(SRC_MANIFEST);
  assert.deepStrictEqual(out.author, SRC_MANIFEST.author);
  assert.deepStrictEqual(out.repository, SRC_MANIFEST.repository);
  assert.deepStrictEqual(out.license, SRC_MANIFEST.license);
  assert.deepStrictEqual(out.keywords, SRC_MANIFEST.keywords);
  // mcpServers stays "gsd" per D-02 (byte-identical policy).
  assert.deepStrictEqual(out.mcpServers, SRC_MANIFEST.mcpServers);
  assert.ok(out.mcpServers.gsd, 'mcpServers.gsd must survive');
});

check('stampBmManifest does not mutate its input', () => {
  const src = JSON.parse(JSON.stringify(SRC_MANIFEST));
  stampBmManifest(src);
  assert.strictEqual(src.name, 'gsd');
  assert.strictEqual(src.displayName, undefined);
});

// ─── shouldExclude ───────────────────────────────────────────────────────────

check('shouldExclude is true for excluded first-segment dirs', () => {
  for (const p of [
    '.git/config', '.planning/STATE.md', '.claude/settings.json',
    'node_modules/foo/index.js', 'dist/bm/x', 'scratchpad/tmp.txt',
  ]) {
    assert.strictEqual(shouldExclude(p), true, `expected excluded: ${p}`);
  }
});

check('shouldExclude is true for nested node_modules and .git segments', () => {
  assert.strictEqual(shouldExclude('sdk/node_modules/dep/index.js'), true);
  assert.strictEqual(shouldExclude('some/deep/.git/HEAD'), true);
});

check('shouldExclude is true for any .DS_Store basename', () => {
  assert.strictEqual(shouldExclude('.DS_Store'), true);
  assert.strictEqual(shouldExclude('skills/foo/.DS_Store'), true);
});

check('shouldExclude is true for exactly the root marketplace.json', () => {
  assert.strictEqual(shouldExclude('.claude-plugin/marketplace.json'), true);
});

check('shouldExclude is false for shipping paths', () => {
  for (const p of [
    'sdk/dist/cli.js', '.claude-plugin/plugin.json', 'hooks/hooks.json',
    'bin/gsd-tools.cjs', '.gsd/drift-allowlist.json',
  ]) {
    assert.strictEqual(shouldExclude(p), false, `expected included: ${p}`);
  }
});

// ─── integration: build ──────────────────────────────────────────────────────

check('build succeeds (exit 0)', () => {
  const r = runBuild();
  assert.strictEqual(r.status, 0, `build failed: ${r.stderr || r.stdout}`);
});

check('built bm manifest is stamped and version-locked to root plugin.json', () => {
  const root = readJson(path.join(ROOT, '.claude-plugin', 'plugin.json'));
  const bm = readJson(path.join(OUT, '.claude-plugin', 'plugin.json'));
  assert.strictEqual(bm.name, 'bm');
  assert.strictEqual(bm.displayName, 'Buildomator');
  assert.strictEqual(bm.version, root.version);
});

check('dist/bm does NOT contain a nested marketplace.json', () => {
  assert.strictEqual(fs.existsSync(path.join(OUT, '.claude-plugin', 'marketplace.json')), false);
});

check('dist/bm excludes .git, .planning, node_modules, scratchpad, and nested dist', () => {
  for (const rel of ['dist', '.git', '.planning', 'node_modules', 'scratchpad']) {
    assert.strictEqual(fs.existsSync(path.join(OUT, rel)), false, `dist/bm/${rel} must not exist`);
  }
});

check('sdk/dist/cli.js and hooks/hooks.json are byte-equal copies', () => {
  for (const rel of ['sdk/dist/cli.js', 'hooks/hooks.json']) {
    const a = fs.readFileSync(path.join(ROOT, rel));
    const b = fs.readFileSync(path.join(OUT, rel));
    assert.ok(a.equals(b), `dist/bm/${rel} differs from source`);
  }
});

check('whitelist walk: every included source file has a byte-equal copy (except stamped plugin.json)', () => {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
  assert.strictEqual(listed.status, 0, 'git ls-files failed');
  const files = listed.stdout.toString('utf8').split('\0').filter(Boolean);
  const included = files.filter((f) => !shouldExclude(f));
  let mismatches = [];
  for (const rel of included) {
    const dest = path.join(OUT, rel);
    if (!fs.existsSync(dest)) { mismatches.push(`missing: ${rel}`); continue; }
    if (rel === '.claude-plugin/plugin.json') {
      // Equal after deleting the stamped keys from both sides.
      const a = readJson(path.join(ROOT, rel));
      const b = readJson(dest);
      for (const k of ['name', 'displayName', 'description']) { delete a[k]; delete b[k]; }
      try { assert.deepStrictEqual(a, b); } catch { mismatches.push(`stamp-diff: ${rel}`); }
      continue;
    }
    const src = fs.readFileSync(path.join(ROOT, rel));
    const cpy = fs.readFileSync(dest);
    if (!src.equals(cpy)) mismatches.push(`bytes: ${rel}`);
  }
  assert.deepStrictEqual(mismatches, [], `whitelist walk mismatches: ${mismatches.slice(0, 5).join(', ')}`);
});

check('dist/bm contains no file without a source counterpart', () => {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
  const included = new Set(
    listed.stdout.toString('utf8').split('\0').filter(Boolean).filter((f) => !shouldExclude(f)),
  );
  const extras = [];
  function walk(dir, prefix) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
      else if (!included.has(rel)) extras.push(rel);
    }
  }
  walk(OUT, '');
  assert.deepStrictEqual(extras, [], `dist/bm has orphan files: ${extras.slice(0, 5).join(', ')}`);
});

// ─── integration: --check ────────────────────────────────────────────────────

check('--check exits 0 immediately after a build', () => {
  runBuild();
  const r = runBuild(['--check']);
  assert.strictEqual(r.status, 0, `--check should pass on fresh build: ${r.stdout}${r.stderr}`);
});

check('--check exits 1 and names the path after tampering, rebuild restores 0', () => {
  runBuild();
  const victim = path.join(OUT, '.claude-plugin', 'plugin.json');
  fs.appendFileSync(victim, ' ');
  const bad = runBuild(['--check']);
  assert.strictEqual(bad.status, 1, '--check must fail on drift');
  assert.match(bad.stdout + bad.stderr, /plugin\.json/, 'must name the differing path');
  const good = runBuild();
  assert.strictEqual(good.status, 0, 'rebuild should succeed');
  const after = runBuild(['--check']);
  assert.strictEqual(after.status, 0, '--check should pass after rebuild');
});

// ─── footer ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll build-bm-drift tests passed');
