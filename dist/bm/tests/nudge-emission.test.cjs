#!/usr/bin/env node
'use strict';

// Deprecation-nudge emission gate (D-06 / COMPAT-04).
//
// Proves the two halves of the nudge contract:
//   1. The gsd package EMITS the /bm: + v5.0 rename notice on SessionStart, and
//      keeps emitting it even when it yields the stateful work to an active bm
//      copy (the notice is written before the yield, so a both-active gsd
//      session still surfaces it). The notice carries no em-dash/en-dash.
//   2. The generated bm package NEVER emits it: dist/bm/bin/gsd-tools.cjs carries
//      neither the sentinel literal nor the notice sentence, because the build's
//      suppressNudge strip removed the whole block. This is a source assertion,
//      not a spawn: the strip in the shipped copy is the guarantee under test.
//
// Zero-dep harness (node:assert, a bare check(name, fn) runner, a failure
// counter, a process.exit(1) footer), mirroring tests/bm-parity.test.cjs.
//
// This file is a member of build-bm's SUPPRESS_EXCLUDE because it embeds the
// BM-NUDGE literal on purpose, so its own dist/bm copy keeps that literal. Do
// not assert on the dist/bm copy of THIS file.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GSD_TOOLS = path.join(ROOT, 'bin', 'gsd-tools.cjs');
const DIST_GSD_TOOLS = path.join(ROOT, 'dist', 'bm', 'bin', 'gsd-tools.cjs');
const coexist = require(path.join(ROOT, 'bin', 'lib', 'coexist.cjs'));

// Marker files live in the shared GSD temp dir (os.tmpdir()/gsd), independent of
// the spawned project cwd. Compose the path directly so cleanup is reliable.
const MARKER_DIR = path.join(os.tmpdir(), 'gsd');
function clearMarker(id) {
  try { fs.unlinkSync(path.join(MARKER_DIR, 'bm-active-' + id + '.marker')); }
  catch { /* already gone */ }
}

// Unique-ish session ids so the test never collides with a live session marker.
let sidSeq = 0;
function freshSid(tag) { sidSeq += 1; return 'nudge' + tag + process.pid + 'x' + sidSeq; }

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Run the repo gsd-tools SessionStart hook with a session_id on stdin, in a
// throwaway cwd with no .planning/ so the run stays a plain gsd session.
function runSessionStart(sessionId) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-nudge-'));
  try {
    const r = spawnSync('node', [GSD_TOOLS, 'hook', 'session-start'], {
      cwd,
      input: JSON.stringify({ session_id: sessionId, source: 'startup' }),
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, `hook exited ${r.status} (nudge must never break session start): ${r.stderr}`);
    return r.stdout;
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

const NOTICE_MARKERS = ['/bm:', 'v5.0'];
const EM_EN_DASH = /[—–]/;

// ─── gsd emits ───────────────────────────────────────────────────────────────

check('gsd SessionStart emits the /bm: + v5.0 rename notice (no bm marker)', () => {
  const sid = freshSid('emit');
  const out = runSessionStart(sid);
  for (const m of NOTICE_MARKERS) {
    assert.ok(out.includes(m), `gsd SessionStart stdout must contain ${JSON.stringify(m)}: got ${JSON.stringify(out)}`);
  }
  assert.ok(!EM_EN_DASH.test(out), 'emitted notice must be free of em-dash/en-dash characters');
});

check('gsd SessionStart still emits the notice under yield (bm active this session)', () => {
  const sid = freshSid('yield');
  coexist.markBmActive(sid);
  try {
    assert.ok(coexist.isBmActive(sid), 'precondition: bm marker must be planted for the yield case');
    const out = runSessionStart(sid);
    for (const m of NOTICE_MARKERS) {
      assert.ok(out.includes(m), `notice must survive the yield (D-06 exemption); missing ${JSON.stringify(m)}: got ${JSON.stringify(out)}`);
    }
    assert.ok(!EM_EN_DASH.test(out), 'emitted notice must be free of em-dash/en-dash characters');
  } finally {
    clearMarker(sid);
  }
});

// ─── bm suppresses ───────────────────────────────────────────────────────────

check('generated bm gsd-tools.cjs carries neither the sentinel nor the notice', () => {
  assert.ok(fs.existsSync(DIST_GSD_TOOLS), 'dist/bm/bin/gsd-tools.cjs must exist (run node bin/build-bm.cjs)');
  const bm = fs.readFileSync(DIST_GSD_TOOLS, 'utf8');
  assert.ok(!bm.includes('BM-NUDGE'), 'dist/bm/bin/gsd-tools.cjs must not contain the BM-NUDGE sentinel');
  assert.ok(!bm.includes('is being renamed to'), 'dist/bm/bin/gsd-tools.cjs must not contain the rename notice sentence');
});

// ─── footer ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll nudge-emission tests passed');
