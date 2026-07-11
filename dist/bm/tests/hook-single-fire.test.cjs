'use strict';

// Single-fire election coverage for both shared hook dispatch points.
//
// When both the gsd and bm hook copies are enabled, a per-session bm marker
// (bin/lib/coexist.cjs) must make the gsd copy YIELD so every merged hook fires
// exactly once. Two dispatch points carry the election:
//   1. bin/gsd-tools.cjs `case 'hook'` -- the four state-mutating branches
//      (session-start, post-tool-use, pre-compact, stop).
//   2. hooks/run-bash-hook.cjs -- the single launcher for the three bash hooks
//      (gsd-session-state.sh, gsd-validate-commit.sh, gsd-phase-boundary.sh).
//
// The repo copy always resolves identity to 'gsd' (its path has no /bm/), so
// every spawned dispatch here is exactly the copy whose yield we must prove.
//
// Assertions:
//   (a) COMPAT-01 no-op: with NO marker, gsd-tools post-tool-use writes
//       HANDOFF.json exactly as today, and run-bash-hook runs its bash hook.
//   (b) COMPAT-02 single fire (gsd-tools): with a marker, the gsd copy writes
//       nothing (it yielded).
//   (c) COMPAT-02 single fire (run-bash-hook): with a marker, the gsd copy does
//       NOT run the bash hook (session-state emits nothing; validate-commit does
//       not block); with NO marker it does. Covers session-state AND
//       validate-commit so both named bash hooks are proven to fire exactly once.
//   (d) SessionStart residual bound: shouldYield('gsd', S) is false before the
//       marker lands and true after -- models the at-most-one gsd fire before
//       bm's marker (D-03 accepted residual).
//
// RED until the election is wired (Task 2); GREEN after.

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GSD_TOOLS = path.join(ROOT, 'bin', 'gsd-tools.cjs');
const RUN_BASH_HOOK = path.join(ROOT, 'hooks', 'run-bash-hook.cjs');
const coexist = require(path.join(ROOT, 'bin', 'lib', 'coexist.cjs'));

// Marker files live in the shared GSD temp dir (os.tmpdir()/gsd), independent of
// the temp project cwd. Compose the path directly so we can clean up.
const MARKER_DIR = path.join(os.tmpdir(), 'gsd');
function markerPath(id) {
  return path.join(MARKER_DIR, 'bm-active-' + id + '.marker');
}
function clearMarker(id) {
  try { fs.unlinkSync(markerPath(id)); } catch { /* already gone */ }
}

// Unique-ish session ids so the test never collides with a live session marker.
let sidSeq = 0;
function freshSid(tag) {
  sidSeq += 1;
  return 'hsf' + tag + process.pid + 'x' + sidSeq;
}

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function bashAvailable() {
  try {
    const r = cp.spawnSync('bash', ['--version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch { return false; }
}
const BASH = bashAvailable();

// Temp GSD project with a non-trivial STATE.md so post-tool-use writes a real
// (non-skeleton) HANDOFF.json rather than being skipped by the trivial guard.
function withStateProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-single-fire-'));
  try {
    fs.mkdirSync(path.join(dir, '.planning'));
    fs.writeFileSync(
      path.join(dir, '.planning', 'STATE.md'),
      '# Project State\n\nPhase: 14 - Backward Compatibility And Coexistence\n' +
      'Plan: 03\nTask: 2\nStatus: Wiring the election\n'
    );
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Temp GSD project with community hooks enabled so the opt-in bash hooks do
// their observable work (session-state emits a reminder; validate-commit blocks).
function withCommunityProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-single-fire-bash-'));
  try {
    fs.mkdirSync(path.join(dir, '.planning'));
    fs.writeFileSync(
      path.join(dir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'standard', hooks: { community: true } }, null, 2)
    );
    fs.writeFileSync(
      path.join(dir, '.planning', 'STATE.md'),
      '# Project State\n\nPhase: 14 - Backward Compatibility\nPlan: 03\n'
    );
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function spawnGsdHook(hookType, sessionId, cwd) {
  return cp.spawnSync(process.execPath, [GSD_TOOLS, 'hook', hookType], {
    cwd,
    input: JSON.stringify({ session_id: sessionId, source: 'startup' }),
    encoding: 'utf8',
  });
}

function spawnBashHook(hookName, cwd, input) {
  return cp.spawnSync(process.execPath, [RUN_BASH_HOOK, hookName], {
    cwd,
    input,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PLUGIN_ROOT: ROOT }),
  });
}

// PreToolUse-shaped payload: session_id (for the election) AND tool_input (for
// validate-commit). run-bash-hook must forward these exact bytes to the child.
function commitInput(sessionId) {
  return JSON.stringify({
    session_id: sessionId,
    tool_input: { command: 'git commit -m "bad message no prefix"' },
  });
}

// ── (a) COMPAT-01 no-op: gsd-tools writes HANDOFF when no marker ─────────────

check('gsd-tools post-tool-use writes HANDOFF.json when no marker (COMPAT-01)', () => {
  withStateProject((dir) => {
    const sid = freshSid('NoMark');
    clearMarker(sid);
    const handoff = path.join(dir, '.planning', 'HANDOFF.json');
    assert(!fs.existsSync(handoff), 'precondition: HANDOFF.json must not exist yet');
    spawnGsdHook('post-tool-use', sid, dir);
    assert(
      fs.existsSync(handoff),
      'gsd copy must write HANDOFF.json when no bm marker is present (gsd-only no-op unchanged)'
    );
  });
});

// ── (b) COMPAT-02 single fire (gsd-tools branch): yields under a marker ──────

check('gsd-tools post-tool-use YIELDS (no HANDOFF write) when bm marker present (COMPAT-02)', () => {
  withStateProject((dir) => {
    const sid = freshSid('Yield');
    coexist.markBmActive(sid);
    try {
      const handoff = path.join(dir, '.planning', 'HANDOFF.json');
      assert(!fs.existsSync(handoff), 'precondition: HANDOFF.json must not exist yet');
      spawnGsdHook('post-tool-use', sid, dir);
      assert(
        !fs.existsSync(handoff),
        'gsd copy must NOT write HANDOFF.json when the bm marker is present (must yield)'
      );
    } finally {
      clearMarker(sid);
    }
  });
});

// ── (c) COMPAT-02 single fire (run-bash-hook): session-state + validate-commit ─

check('run-bash-hook runs gsd-session-state.sh when no marker (control)', () => {
  if (!BASH) { assert(true, 'skipped: bash unavailable'); return; }
  withCommunityProject((dir) => {
    const sid = freshSid('BashCtl');
    clearMarker(sid);
    const r = spawnBashHook('gsd-session-state.sh', dir, JSON.stringify({ session_id: sid }));
    assert(
      /Project State Reminder/.test(r.stdout || ''),
      'bash hook must run and emit its reminder when no marker: got ' + JSON.stringify(r.stdout)
    );
  });
});

check('run-bash-hook YIELDS gsd-session-state.sh when bm marker present (COMPAT-02, W2)', () => {
  if (!BASH) { assert(true, 'skipped: bash unavailable'); return; }
  withCommunityProject((dir) => {
    const sid = freshSid('BashYield');
    coexist.markBmActive(sid);
    try {
      const r = spawnBashHook('gsd-session-state.sh', dir, JSON.stringify({ session_id: sid }));
      assert(
        !/Project State Reminder/.test(r.stdout || ''),
        'gsd run-bash-hook must NOT run the bash hook when the marker is present (must yield): got ' +
          JSON.stringify(r.stdout)
      );
    } finally {
      clearMarker(sid);
    }
  });
});

check('run-bash-hook runs gsd-validate-commit.sh (exit 2 block) when no marker (control)', () => {
  if (!BASH) { assert(true, 'skipped: bash unavailable'); return; }
  withCommunityProject((dir) => {
    const sid = freshSid('VcCtl');
    clearMarker(sid);
    const r = spawnBashHook('gsd-validate-commit.sh', dir, commitInput(sid));
    assert(
      r.status === 2,
      'validate-commit must run and block a non-conforming commit (exit 2) when no marker: got status ' +
        r.status + ' stderr ' + (r.stderr || '')
    );
  });
});

check('run-bash-hook YIELDS gsd-validate-commit.sh when bm marker present (bm copy owns the block)', () => {
  if (!BASH) { assert(true, 'skipped: bash unavailable'); return; }
  withCommunityProject((dir) => {
    const sid = freshSid('VcYield');
    coexist.markBmActive(sid);
    try {
      const r = spawnBashHook('gsd-validate-commit.sh', dir, commitInput(sid));
      assert(
        r.status === 0,
        'gsd validate-commit must yield (exit 0, bash not run) when the marker is present: got status ' +
          r.status
      );
    } finally {
      clearMarker(sid);
    }
  });
});

// ── (d) SessionStart residual bound ──────────────────────────────────────────

check('shouldYield residual bound: false before marker, true after markBmActive', () => {
  const sid = freshSid('Residual');
  clearMarker(sid);
  assert(
    coexist.shouldYield('gsd', sid) === false,
    'with no marker the gsd copy must not yield (models the at-most-one pre-marker fire)'
  );
  coexist.markBmActive(sid);
  try {
    assert(
      coexist.shouldYield('gsd', sid) === true,
      'once bm announces itself the gsd copy yields'
    );
  } finally {
    clearMarker(sid);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`hook single-fire: ${passed}/${checks.length} checks passed${BASH ? '' : ' (bash unavailable -- bash-dispatch cases skipped)'}`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
