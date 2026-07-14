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
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'bin', 'build-bm.cjs');

// This suite tests the build MECHANISM against an isolated tree, never the
// committed dist/bm, so a concurrent reader of the committed tree
// (tests/bm-parity.test.cjs) can never observe a half-written or rm'd tree.
// Every runBuild() and every OUT inspection below is routed here via BM_DIST_DIR;
// the committed-artifact drift gate lives in tests/bm-parity.test.cjs (its
// --check case), which reads the committed tree this suite leaves untouched.
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-drift-'));

const {
  stampBmManifest, shouldExclude, rewriteCommandRefs, stampHookFallback, suppressNudge, isTextFile,
  STAMP_EXCLUDE, SUPPRESS_EXCLUDE, COMMAND_REWRITE_EXCLUDE,
} = require('../bin/build-bm.cjs');

// The expected transformed bytes for a source text file, mirroring generate()
// exactly: the command-ref rewrite runs UNLESS rel is in COMMAND_REWRITE_EXCLUDE,
// then the hook stamp runs UNLESS rel is in STAMP_EXCLUDE, then the nudge strip
// runs UNLESS rel is in SUPPRESS_EXCLUDE. Every exclusion set is imported from the
// build so the drift walk and the build never diverge.
function expectedText(rel, srcText) {
  let text = srcText;
  if (!COMMAND_REWRITE_EXCLUDE.has(rel)) text = rewriteCommandRefs(text);
  if (!STAMP_EXCLUDE.has(rel)) text = stampHookFallback(text);
  if (!SUPPRESS_EXCLUDE.has(rel)) text = suppressNudge(text);
  return text;
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function runBuild(args) {
  return spawnSync('node', [SCRIPT, ...(args || [])], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, BM_DIST_DIR: OUT },
  });
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
    'Buildomator: structured workflow plugin for Claude Code with planning, ' +
      'execution, verification, and MCP-backed project state',
  );
});

check('stampBmManifest preserves version from source', () => {
  assert.strictEqual(stampBmManifest(SRC_MANIFEST).version, '4.0.4');
  assert.strictEqual(stampBmManifest({ ...SRC_MANIFEST, version: '9.9.9' }).version, '9.9.9');
});

check('stampBmManifest leaves non-identity keys deep-equal', () => {
  const out = stampBmManifest(SRC_MANIFEST);
  assert.deepStrictEqual(out.author, SRC_MANIFEST.author);
  assert.deepStrictEqual(out.repository, SRC_MANIFEST.repository);
  assert.deepStrictEqual(out.license, SRC_MANIFEST.license);
  assert.deepStrictEqual(out.keywords, SRC_MANIFEST.keywords);
});

check('stampBmManifest rekeys mcpServers gsd -> bm with the same server config', () => {
  const out = stampBmManifest(SRC_MANIFEST);
  assert.ok(out.mcpServers.bm, 'mcpServers.bm must exist');
  assert.strictEqual(out.mcpServers.gsd, undefined, 'mcpServers.gsd must be absent');
  assert.deepStrictEqual(out.mcpServers.bm, SRC_MANIFEST.mcpServers.gsd);
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

check('sdk/dist/cli.js is a byte-equal copy (no command refs to rewrite)', () => {
  const a = fs.readFileSync(path.join(ROOT, 'sdk/dist/cli.js'), 'utf8');
  const b = fs.readFileSync(path.join(OUT, 'sdk/dist/cli.js'), 'utf8');
  assert.strictEqual(b, expectedText('sdk/dist/cli.js', a), 'sdk/dist/cli.js differs from source');
});

check('the three fallback carriers ship stamped (command-ref rewrite + hook fallback)', () => {
  for (const rel of ['hooks/hooks.json', 'hooks/run-bash-hook.cjs', 'bin/check-plugin-update.sh']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const dist = fs.readFileSync(path.join(OUT, rel), 'utf8');
    assert.strictEqual(dist, expectedText(rel, src), `dist/bm/${rel} is not the stamped transform of source`);
  }
});

check('the fallback carriers flip the plugin segment to bm with zero gsd-form literals', () => {
  // Marketplace-agnostic carriers no longer embed cache/gsd-plugin/<seg>; the
  // marketplace directory is a runtime readdirSync wildcard and only the fixed
  // plugin-name segment is stamped. Each carrier has one distinct literal shape.
  const hooks = fs.readFileSync(path.join(OUT, 'hooks/hooks.json'), 'utf8');
  assert.strictEqual((hooks.match(/g='bm'/g) || []).length, 17, "hooks.json must carry 17 g='bm'");
  assert.strictEqual((hooks.match(/g='gsd'/g) || []).length, 0, "no g='gsd' may remain in hooks.json");
  assert.strictEqual((hooks.match(/cache\/gsd-plugin\/gsd/g) || []).length, 0, 'no gsd-form slash literal in hooks.json');
  const launcher = fs.readFileSync(path.join(OUT, 'hooks/run-bash-hook.cjs'), 'utf8');
  assert.strictEqual((launcher.match(/const pkgSegment = 'bm'/g) || []).length, 1);
  assert.strictEqual((launcher.match(/const pkgSegment = 'gsd'/g) || []).length, 0);
  assert.strictEqual((launcher.match(/cache\/gsd-plugin\/gsd/g) || []).length, 0);
  const notifier = fs.readFileSync(path.join(OUT, 'bin/check-plugin-update.sh'), 'utf8');
  assert.strictEqual((notifier.match(/PKG_SEGMENT="bm"/g) || []).length, 1);
  assert.strictEqual((notifier.match(/PKG_SEGMENT="gsd"/g) || []).length, 0);
  assert.strictEqual((notifier.match(/cache\/gsd-plugin\/gsd/g) || []).length, 0);
});

check('mcp/server.cjs is a byte-identical copy', () => {
  const a = fs.readFileSync(path.join(ROOT, 'mcp/server.cjs'));
  const b = fs.readFileSync(path.join(OUT, 'mcp/server.cjs'));
  assert.ok(a.equals(b), 'dist/bm/mcp/server.cjs must be byte-identical to source');
});

check('no /gsd: leaks in dist/bm text files outside COMMAND_REWRITE_EXCLUDE', () => {
  const leaks = [];
  function walk(dir, prefix) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(path.join(dir, ent.name), rel); continue; }
      const buf = fs.readFileSync(path.join(dir, ent.name));
      if (!isTextFile(rel, buf)) continue;
      // COMMAND_REWRITE_EXCLUDE files legitimately retain /gsd: (CHANGELOG.md
      // shipped history, the parity positive-control fixtures) by design.
      if (COMMAND_REWRITE_EXCLUDE.has(rel)) continue;
      if (buf.toString('utf8').includes('/gsd:')) leaks.push(rel);
    }
  }
  walk(OUT, '');
  assert.deepStrictEqual(leaks, [], `dist/bm has /gsd: leaks: ${leaks.slice(0, 5).join(', ')}`);
});

check('whitelist walk: every included file equals the deterministic transform of source', () => {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
  assert.strictEqual(listed.status, 0, 'git ls-files failed');
  const files = listed.stdout.toString('utf8').split('\0').filter(Boolean);
  const included = files.filter((f) => !shouldExclude(f));
  let mismatches = [];
  for (const rel of included) {
    const dest = path.join(OUT, rel);
    if (!fs.existsSync(dest)) { mismatches.push(`missing: ${rel}`); continue; }
    if (rel === '.claude-plugin/plugin.json') {
      // Equal after normalizing the stamped identity keys and the mcpServers rekey.
      const a = readJson(path.join(ROOT, rel));
      const b = readJson(dest);
      try {
        assert.ok(b.mcpServers.bm && !b.mcpServers.gsd, 'bm manifest must rekey mcpServers to bm');
        assert.deepStrictEqual(b.mcpServers.bm, a.mcpServers.gsd);
      } catch { mismatches.push(`mcp-rekey: ${rel}`); }
      for (const k of ['name', 'displayName', 'description', 'mcpServers']) { delete a[k]; delete b[k]; }
      try { assert.deepStrictEqual(a, b); } catch { mismatches.push(`stamp-diff: ${rel}`); }
      continue;
    }
    const srcBuf = fs.readFileSync(path.join(ROOT, rel));
    if (isTextFile(rel, srcBuf)) {
      const cpy = fs.readFileSync(dest, 'utf8');
      if (cpy !== expectedText(rel, srcBuf.toString('utf8'))) mismatches.push(`transform: ${rel}`);
      continue;
    }
    const cpy = fs.readFileSync(dest);
    if (!srcBuf.equals(cpy)) mismatches.push(`bytes: ${rel}`);
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
  // OUT is the isolated BM_DIST_DIR tree, so tampering and rebuilding here never
  // touches the committed dist/bm and never races tests/bm-parity.test.cjs.
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

fs.rmSync(OUT, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll build-bm-drift tests passed');
