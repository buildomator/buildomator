'use strict';

// Unit spec for bin/lib/coexist.cjs, the single shared run-vs-yield election
// used when both the gsd and bm hook copies are enabled.
//
// Covers:
//   - pluginIdentity: path-derived gsd/bm, robust with no CLAUDE_PLUGIN_ROOT
//   - markBmActive / isBmActive: per-session marker lifecycle
//   - shouldYield: full truth table (identity x marker presence)
//   - malformed session_id: never composes a traversal path, no file written
//   - reaper safety: the bm-active- marker survives reapStaleTempFiles('gsd-')

const fs = require('fs');
const path = require('path');

const coexist = require(path.join(__dirname, '..', 'bin', 'lib', 'coexist.cjs'));
const core = require(path.join(__dirname, '..', 'bin', 'lib', 'core.cjs'));

const { pluginIdentity, markBmActive, isBmActive, shouldYield } = coexist;
const { GSD_TEMP_DIR } = core;

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

// Unique session id per test run so parallel/leftover runs never collide.
function freshSessionId(tag) {
  return `test-${tag}-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function markerPathFor(sessionId) {
  return path.join(GSD_TEMP_DIR, `bm-active-${sessionId}.marker`);
}

const createdMarkers = [];
function trackMarker(sessionId) {
  createdMarkers.push(markerPathFor(sessionId));
}

// ── pluginIdentity: path-derived, env-independent ────────────────────────────

check('pluginIdentity returns bm for a stamped cache/gsd-plugin/bm path', () => {
  assert(
    pluginIdentity('/x/cache/gsd-plugin/bm/4.1.0/bin/gsd-tools.cjs') === 'bm',
    'cache/gsd-plugin/bm path must resolve to bm'
  );
});

check('pluginIdentity returns bm for a /bm/bin/ path', () => {
  assert(
    pluginIdentity('/somewhere/bm/bin/gsd-tools.cjs') === 'bm',
    '/bm/bin/ path must resolve to bm'
  );
});

check('pluginIdentity returns gsd for the stamped gsd cache path', () => {
  assert(
    pluginIdentity('/x/cache/gsd-plugin/bm/4.1.0/bin/gsd-tools.cjs') === 'gsd',
    'cache/gsd-plugin/bm path must resolve to gsd'
  );
});

check('pluginIdentity returns gsd for a bare repo path (no CLAUDE_PLUGIN_ROOT)', () => {
  assert(
    pluginIdentity('/Users/me/src/gsd-plugin/bin/gsd-tools.cjs') === 'gsd',
    'a plain repo path must default to gsd'
  );
});

check('pluginIdentity normalizes Windows backslashes', () => {
  assert(
    pluginIdentity('C:\\x\\cache\\gsd-plugin\\bm\\4.1.0\\bin\\gsd-tools.cjs') === 'bm',
    'backslash path segments must be recognized as bm'
  );
});

check('pluginIdentity with no argument returns a valid identity (uses __filename)', () => {
  const id = pluginIdentity();
  assert(id === 'gsd' || id === 'bm', `no-arg identity must be gsd or bm, got: ${id}`);
});

// ── marker lifecycle: markBmActive / isBmActive ──────────────────────────────

check('isBmActive is false for an unmarked session', () => {
  const sid = freshSessionId('unmarked');
  assert(isBmActive(sid) === false, 'an unmarked session must not be active');
});

check('markBmActive then isBmActive is true; marker file exists under GSD_TEMP_DIR', () => {
  const sid = freshSessionId('marked');
  trackMarker(sid);
  markBmActive(sid);
  assert(isBmActive(sid) === true, 'a marked session must be active');
  assert(
    fs.existsSync(markerPathFor(sid)),
    'the marker file must exist under the gsd temp dir'
  );
});

// ── shouldYield truth table ──────────────────────────────────────────────────

check('shouldYield(gsd, marked) === true', () => {
  const sid = freshSessionId('yield-gsd-marked');
  trackMarker(sid);
  markBmActive(sid);
  assert(shouldYield('gsd', sid) === true, 'gsd must yield when the bm marker exists');
});

check('shouldYield(gsd, unmarked) === false (COMPAT-01 no-op)', () => {
  const sid = freshSessionId('yield-gsd-unmarked');
  assert(shouldYield('gsd', sid) === false, 'gsd-only session must never yield');
});

check('shouldYield(bm, marked) === false (bm always runs)', () => {
  const sid = freshSessionId('yield-bm-marked');
  trackMarker(sid);
  markBmActive(sid);
  assert(shouldYield('bm', sid) === false, 'bm must never yield to itself');
});

check('shouldYield(bm, unmarked) === false', () => {
  const sid = freshSessionId('yield-bm-unmarked');
  assert(shouldYield('bm', sid) === false, 'bm must never yield');
});

// ── malformed session_id: no traversal, no file written ──────────────────────

const malformed = ['a/b', '..', '../evil', '', undefined, null, 'a\\b'];
for (const bad of malformed) {
  check(`malformed session_id ${JSON.stringify(bad)} is a no-op and not active`, () => {
    const before = fs.existsSync(GSD_TEMP_DIR) ? fs.readdirSync(GSD_TEMP_DIR) : [];
    markBmActive(bad);
    assert(isBmActive(bad) === false, 'a malformed id must never read as active');
    const after = fs.existsSync(GSD_TEMP_DIR) ? fs.readdirSync(GSD_TEMP_DIR) : [];
    assert(
      after.length === before.length,
      `markBmActive(${JSON.stringify(bad)}) must not create any file under the gsd temp dir`
    );
    // shouldYield with a malformed id must also be a safe no-op for gsd.
    assert(shouldYield('gsd', bad) === false, 'gsd must not yield for a malformed id');
  });
}

// ── reaper safety: bm-active- prefix survives the default gsd- reap ──────────

check('bm-active- marker survives reapStaleTempFiles() with an aged mtime', () => {
  const sid = freshSessionId('reaper');
  trackMarker(sid);
  markBmActive(sid);
  const mp = markerPathFor(sid);
  assert(fs.existsSync(mp), 'precondition: marker must exist before reap');

  // Age the marker well past the 5-minute default so mtime is not what saves it.
  const oldTime = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(mp, oldTime, oldTime);

  core.reapStaleTempFiles(); // default 'gsd-' prefix must NOT match 'bm-active-'

  assert(
    fs.existsSync(mp),
    'the bm-active- marker must survive the default gsd- reap (Pitfall 3)'
  );
  assert(isBmActive(sid) === true, 'the session must still read as active after reap');
});

// ── cleanup ──────────────────────────────────────────────────────────────────

for (const mp of createdMarkers) {
  try { fs.unlinkSync(mp); } catch { /* already gone */ }
}

// ── summary (fail-loud) ──────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`coexist election: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
