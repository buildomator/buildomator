#!/usr/bin/env node
'use strict';

// End-to-end proof that the ACTUAL inline SessionStart resolvers (the ones
// shipped in hooks.json for gsd and dist/bm/hooks/hooks.json for bm) resolve the
// plugin via the marketplace-agnostic cache fallback when CLAUDE_PLUGIN_ROOT is
// unset. A future edit that reintroduces a hardcoded marketplace segment, drops a
// marketplace from the scan, or breaks the global-newest-version ordering fails
// here instead of silently shipping a plugin that cannot boot its hooks.
//
// Each case runs in its OWN fresh mkdtempSync HOME planting exactly ONE
// marketplace/package combo whose gsd-tools.cjs stub writes a DISTINCT marker to
// stderr and exits 0, so the asserted marker is unambiguous (no alternation). The
// command string is extracted verbatim from the committed hooks.json / dist/bm
// hooks.json, never re-typed, so the test exercises what actually ships.
//
// Zero-dep harness: node:assert-free bare check/assert, a failure counter, and a
// process.exit(1) footer. Run directly via `node tests/hook-fallback-resolution.test.cjs`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// The real SessionStart[0] resolver command for each package, read from the
// committed manifests so the test can never drift from what ships.
const GSD_CMD = require(path.join(ROOT, 'hooks', 'hooks.json')).hooks.SessionStart[0].hooks[0].command;
const BM_CMD = require(path.join(ROOT, 'dist', 'bm', 'hooks', 'hooks.json')).hooks.SessionStart[0].hooks[0].command;

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const cleanup = [];
function freshHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-fb-'));
  cleanup.push(home);
  return home;
}

// Plant a fake gsd-tools.cjs at cache/<marketplace>/<pkg>/<version>/bin that
// prints `marker` to stderr and exits 0. The inline resolver require()s the first
// existing candidate, so this stub stands in for the real hook entry point.
function plantStub(home, marketplace, pkg, version, marker) {
  const dir = path.join(home, '.claude', 'plugins', 'cache', marketplace, pkg, version, 'bin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'gsd-tools.cjs'),
    `process.stderr.write(${JSON.stringify(marker + '\n')});process.exit(0);\n`,
  );
}

// Run the resolver command with CLAUDE_PLUGIN_ROOT unset and HOME pointed at the
// isolated fixture, feeding `{}` on stdin from inside a synthetic git project.
// Returns { status, stderr }.
function runResolver(command, home) {
  const project = path.join(home, 'project');
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  cp.spawnSync('git', ['init', '-q'], { cwd: project });
  const env = { ...process.env, HOME: home };
  delete env.CLAUDE_PLUGIN_ROOT;
  const r = cp.spawnSync('bash', ['-c', command], {
    cwd: project, env, input: '{}', encoding: 'utf8',
  });
  return { status: r.status, stderr: r.stderr || '' };
}

// ── the four isolated single-marker cases ────────────────────────────────────

check('gsd loader resolves cache/gsd-plugin/gsd (backward compat, GSD_LEGACY)', () => {
  const home = freshHome();
  plantStub(home, 'gsd-plugin', 'gsd', '9.9.9', 'GSD_LEGACY');
  const { status, stderr } = runResolver(GSD_CMD, home);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.includes('GSD_LEGACY'), `expected GSD_LEGACY marker, got: ${stderr}`);
});

check('gsd loader resolves cache/buildomator/gsd (new marketplace, GSD_NEWMKT)', () => {
  const home = freshHome();
  plantStub(home, 'buildomator', 'gsd', '9.9.9', 'GSD_NEWMKT');
  const { status, stderr } = runResolver(GSD_CMD, home);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.includes('GSD_NEWMKT'), `expected GSD_NEWMKT marker, got: ${stderr}`);
});

check('bm loader resolves cache/gsd-plugin/bm (backward compat, BM_LEGACY)', () => {
  const home = freshHome();
  plantStub(home, 'gsd-plugin', 'bm', '9.9.9', 'BM_LEGACY');
  const { status, stderr } = runResolver(BM_CMD, home);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.includes('BM_LEGACY'), `expected BM_LEGACY marker, got: ${stderr}`);
});

check('bm loader resolves cache/buildomator/bm (new marketplace, BM_NEWMKT)', () => {
  const home = freshHome();
  plantStub(home, 'buildomator', 'bm', '9.9.9', 'BM_NEWMKT');
  const { status, stderr } = runResolver(BM_CMD, home);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.includes('BM_NEWMKT'), `expected BM_NEWMKT marker, got: ${stderr}`);
});

// ── global newest-version-wins across marketplaces ───────────────────────────

check('gsd loader picks the globally-highest version across two marketplaces', () => {
  const home = freshHome();
  // Older copy under one marketplace, newer under another. The union sort must
  // pick 2.0.0 regardless of readdirSync enumeration order.
  plantStub(home, 'gsd-plugin', 'gsd', '1.0.0', 'VERSION_OLD');
  plantStub(home, 'buildomator', 'gsd', '2.0.0', 'VERSION_NEW');
  const { status, stderr } = runResolver(GSD_CMD, home);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.includes('VERSION_NEW'), `expected the newer 2.0.0 copy to win, got: ${stderr}`);
  assert(!stderr.includes('VERSION_OLD'), `the older 1.0.0 copy must not fire, got: ${stderr}`);
});

// ── cleanup ──────────────────────────────────────────────────────────────────

for (const dir of cleanup) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ── summary (fail-loud) ──────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;
console.log('');
console.log(`hook fallback resolution: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
