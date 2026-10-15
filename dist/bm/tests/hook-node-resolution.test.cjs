#!/usr/bin/env node
'use strict';

// Proof that the shipped hooks and the MCP wrapper resolve node even when
// Claude Code is launched without a login shell (desktop launcher, systemd
// unit, terminal -e), so the inherited PATH lacks version-manager node.
//
// Two launch paths are covered. Hooks run under sh -c, so every command in
// hooks.json (gsd) and dist/bm/hooks.json (bm) carries one identical POSIX
// preamble that, only when `command -v node` fails, probes the usual install
// dirs and prepends the first hit to PATH before the untouched node -e payload.
// The MCP server has no shell, so it launches through bin/gsd-node, which does
// the same lookup. PATH is always consulted first, so a normal install where
// node is already on PATH sees no change at all.
//
// Commands are read verbatim from the committed manifests, never re-typed, so
// the test exercises what actually ships. Each case runs in its own fresh HOME.
// The planted stub writes its marker on one line and its observed PATH on a
// separate line tagged `PATH=`, because the SessionStart payload writes its own
// stderr notices; the assertions read only the tagged line.
//
// Zero-dep harness, fail-loud footer. Run: node tests/hook-node-resolution.test.cjs

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const GSD_CMD = require(path.join(ROOT, 'hooks', 'hooks.json')).hooks.SessionStart[0].hooks[0].command;
const BM_CMD = require(path.join(ROOT, 'dist', 'bm', 'hooks', 'hooks.json')).hooks.SessionStart[0].hooks[0].command;
const WRAPPER = path.join(ROOT, 'bin', 'gsd-node');

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const cleanup = [];
function freshHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-nr-'));
  cleanup.push(home);
  return home;
}

// Empty dir usable as a node-less PATH.
function emptyDir(home, rel) {
  const d = path.join(home, rel);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Create home/rel and symlink the running node into it as `node`.
function fakeNodeDir(home, rel) {
  const d = path.join(home, rel);
  fs.mkdirSync(d, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(d, 'node'));
  return d;
}

// Plant a fake gsd-tools.cjs that prints `marker` on its own line and then a
// TAGGED line `PATH=<the PATH the payload actually ran with>`, then exits 0.
function plantStub(home, marketplace, pkg, version, marker) {
  const dir = path.join(home, '.claude', 'plugins', 'cache', marketplace, pkg, version, 'bin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'gsd-tools.cjs'),
    `process.stderr.write(${JSON.stringify(marker + '\n')});` +
    `process.stderr.write('PATH=' + process.env.PATH + '\\n');` +
    `process.exit(0);\n`,
  );
}

// Return the value of the single stderr line beginning with `PATH=`.
function pathLine(stderr) {
  const lines = stderr.split('\n').filter((l) => l.startsWith('PATH='));
  assert(lines.length === 1, `expected exactly one PATH= line, got ${lines.length} (stderr: ${stderr})`);
  return lines[0].slice('PATH='.length);
}

// Run a hook command under /bin/sh (so Debian CI exercises dash) with HOME set
// and a chosen PATH, CLAUDE_PLUGIN_ROOT deleted, stdin `{}`.
function runHook(command, home, pathValue) {
  const project = path.join(home, 'project');
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  cp.spawnSync('git', ['init', '-q'], { cwd: project });
  const env = { HOME: home, PATH: pathValue };
  const r = cp.spawnSync('/bin/sh', ['-c', command], {
    cwd: project, env, input: '{}', encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── case 1: one identical preamble across all 36 commands ────────────────────

check('all 18 commands in both hooks.json files share one identical preamble', () => {
  const gsd = require(path.join(ROOT, 'hooks', 'hooks.json')).hooks;
  const bm = require(path.join(ROOT, 'dist', 'bm', 'hooks', 'hooks.json')).hooks;
  const prefixes = new Set();
  let n = 0;
  for (const hooks of [gsd, bm]) {
    for (const ev of Object.keys(hooks)) {
      for (const group of hooks[ev]) {
        for (const h of group.hooks) {
          const i = h.command.indexOf('node -e "');
          assert(i > 0, `no node -e payload found in: ${h.command.slice(0, 40)}`);
          prefixes.add(h.command.slice(0, i));
          assert(h.command.slice(i).startsWith('node -e "'), 'remainder must start with node -e "');
          n++;
        }
      }
    }
  }
  assert(n === 36, `expected 36 commands across both files, got ${n}`);
  assert(prefixes.size === 1, `expected one shared preamble, got ${prefixes.size}`);
  const pre = [...prefixes][0];
  assert(pre.startsWith('command -v node >/dev/null 2>&1 || { for d in "$HOME/.pixi/bin"'), `unexpected preamble: ${pre}`);
  assert(!pre.includes('CLAUDE_PLUGIN_ROOT'), 'preamble must not reference CLAUDE_PLUGIN_ROOT');
});

// ── cases 2 and 3: hooks boot with node off PATH via $HOME/.pixi/bin ──────────

function bootsOffPath(name, cmd, marketplace, pkg, marker) {
  check(name, () => {
    const home = freshHome();
    plantStub(home, marketplace, pkg, '9.9.9', marker);
    fakeNodeDir(home, '.pixi/bin');
    const empty = emptyDir(home, 'emptybin');
    const { status, stderr } = runHook(cmd, home, empty);
    assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
    const markerLines = stderr.split('\n').filter((l) => l === marker);
    assert(markerLines.length === 1, `expected ${marker} on its own line, got: ${stderr}`);
    const seen = pathLine(stderr);
    assert(seen.startsWith(path.join(home, '.pixi', 'bin') + ':'), `expected pixi dir prepended, got PATH=${seen}`);
  });
}

bootsOffPath('gsd SessionStart[0] boots with node off PATH via $HOME/.pixi/bin', GSD_CMD, 'gsd-plugin', 'gsd', 'NODE_OFF_PATH_GSD');
bootsOffPath('bm SessionStart[0] boots with node off PATH via $HOME/.pixi/bin', BM_CMD, 'gsd-plugin', 'bm', 'NODE_OFF_PATH_BM');

// ── case 4: on-PATH leaves PATH byte-identical ───────────────────────────────

check('on-PATH case leaves PATH byte-identical', () => {
  const home = freshHome();
  plantStub(home, 'gsd-plugin', 'gsd', '9.9.9', 'ON_PATH_GSD');
  const realbin = fakeNodeDir(home, 'realbin');
  fakeNodeDir(home, '.pixi/bin'); // a probe candidate exists but must not be used
  const { status, stderr } = runHook(GSD_CMD, home, realbin);
  assert(status === 0, `expected exit 0, got ${status} (stderr: ${stderr})`);
  assert(stderr.split('\n').includes('ON_PATH_GSD'), `expected marker, got: ${stderr}`);
  assert(pathLine(stderr) === realbin, `PATH must be unchanged, got PATH=${pathLine(stderr)} expected ${realbin}`);
});

// ── case 5: wrapper resolves node off PATH and passes argv intact ─────────────

check('wrapper resolves node off PATH and passes argv intact', () => {
  const home = freshHome();
  fakeNodeDir(home, '.pixi/bin');
  const empty = emptyDir(home, 'emptybin');
  const r = cp.spawnSync(WRAPPER, ['-e', 'console.log(process.argv.slice(1).join("|"))', 'a', 'b', "c'd"], {
    env: { HOME: home, PATH: empty }, encoding: 'utf8',
  });
  assert(r.status === 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr})`);
  assert(r.stdout.trim() === "a|b|c'd", `argv must round-trip, got: ${JSON.stringify(r.stdout)}`);
});

// ── case 6: wrapper keeps PATH unchanged when node is on PATH ─────────────────

check('wrapper keeps PATH unchanged when node is on PATH', () => {
  const home = freshHome();
  const realbin = fakeNodeDir(home, 'realbin');
  const r = cp.spawnSync(WRAPPER, ['-e', 'console.log("PATH=" + process.env.PATH)'], {
    env: { HOME: home, PATH: realbin }, encoding: 'utf8',
  });
  assert(r.status === 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr})`);
  assert(pathLine(r.stdout) === realbin, `PATH must be unchanged, got ${pathLine(r.stdout)} expected ${realbin}`);
});

// ── case 7: wrapper fails loudly when no node exists ─────────────────────────

check('wrapper fails loudly when no node exists', () => {
  const home = freshHome();
  let txt = fs.readFileSync(WRAPPER, 'utf8');
  txt = txt
    .replace('/opt/homebrew/bin', path.join(home, 'masked1'))
    .replace('/usr/local/bin', path.join(home, 'masked2'))
    .replace('/home/linuxbrew/.linuxbrew/bin', path.join(home, 'masked3'))
    .replace('/snap/bin', path.join(home, 'masked4'));
  const masked = path.join(home, 'gsd-node-masked');
  fs.writeFileSync(masked, txt, { mode: 0o755 });
  const empty = emptyDir(home, 'emptybin');
  const r = cp.spawnSync(masked, ['-e', '1'], { env: { HOME: home, PATH: empty }, encoding: 'utf8' });
  assert(r.status === 127, `expected exit 127, got ${r.status} (stderr: ${r.stderr})`);
  assert((r.stderr || '').includes('gsd-node:'), `expected gsd-node: on stderr, got: ${r.stderr}`);
});

// ── case 8: dist/bm twins match ──────────────────────────────────────────────

check('dist/bm twins match the source wrapper and manifest', () => {
  const srcNode = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-node'));
  const bmNode = fs.readFileSync(path.join(ROOT, 'dist', 'bm', 'bin', 'gsd-node'));
  assert(srcNode.equals(bmNode), 'dist/bm/bin/gsd-node must be byte-identical to bin/gsd-node');
  fs.accessSync(path.join(ROOT, 'dist', 'bm', 'bin', 'gsd-node'), fs.constants.X_OK);
  const srcCmd = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-node.cmd'));
  const bmCmd = fs.readFileSync(path.join(ROOT, 'dist', 'bm', 'bin', 'gsd-node.cmd'));
  assert(srcCmd.equals(bmCmd), 'dist/bm/bin/gsd-node.cmd must be byte-identical to bin/gsd-node.cmd');
  const gsdM = require(path.join(ROOT, '.claude-plugin', 'plugin.json')).mcpServers.gsd;
  const bmM = require(path.join(ROOT, 'dist', 'bm', '.claude-plugin', 'plugin.json')).mcpServers.bm;
  for (const [label, m] of [['gsd', gsdM], ['bm', bmM]]) {
    assert(m.command === '${CLAUDE_PLUGIN_ROOT}/bin/gsd-node', `${label} command wrong: ${m.command}`);
    assert(m.args[0] === '${CLAUDE_PLUGIN_ROOT}/mcp/server.cjs', `${label} args[0] wrong: ${m.args[0]}`);
  }
});

// ── cleanup ──────────────────────────────────────────────────────────────────

for (const dir of cleanup) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ── summary (fail-loud) ──────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;
console.log('');
console.log(`hook node resolution: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
