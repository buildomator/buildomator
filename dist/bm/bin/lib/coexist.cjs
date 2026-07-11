'use strict';

/**
 * Single shared run-vs-yield election for the moment both the gsd and bm hook
 * copies are enabled at once. Identity is a pure function of the resolved script
 * path, so it works even when CLAUDE_PLUGIN_ROOT is unset. "bm active this
 * session" is a bm self-announced per-session marker file in the shared GSD temp
 * dir, keyed on session_id. The marker uses a `bm-active-` prefix that the temp
 * reaper (default `gsd-` prefix) never sweeps, so a long-lived session keeps its
 * marker. Single-sourcing the election here means a hook added later cannot
 * forget it, and its no-op behavior when no marker exists preserves the
 * gsd-only experience.
 */

const fs = require('fs');
const path = require('path');

const { GSD_TEMP_DIR, ensureGsdTempDir } = require('./core.cjs');

// Reaper-safe prefix: outside the reaper's default `gsd-` match, so a marker is
// never swept mid-session. See core.cjs reapStaleTempFiles.
const MARKER_PREFIX = 'bm-active-';

// session_id arrives from hook stdin JSON and is used to compose a filename in a
// shared temp dir. Restrict to characters that cannot escape the directory:
// no slash, no dot-segment, no backslash. Anything else is treated as absent.
const SESSION_ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Derive plugin identity ('gsd' or 'bm') from a resolved script path. Robust
 * when CLAUDE_PLUGIN_ROOT is unset: keys on the on-disk path segment that the
 * bm build stamps (`cache/gsd-plugin/bm` and `/bm/bin/`). Any other path,
 * including a bare repo checkout, is the authored default 'gsd'.
 * @param {string} [resolvedPath] - defaults to this module's own __filename
 * @returns {'gsd'|'bm'}
 */
function pluginIdentity(resolvedPath) {
  const p = String(resolvedPath || __filename).replace(/\\/g, '/');
  if (p.includes('/cache/gsd-plugin/bm/') || p.includes('/bm/bin/')) return 'bm';
  return 'gsd';
}

/**
 * True when session_id is a safe, non-empty token that can be embedded in a
 * filename without composing a traversal path.
 * @param {*} sessionId
 * @returns {boolean}
 */
function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && SESSION_ID_RE.test(sessionId);
}

/**
 * Absolute path of the marker file for a validated session_id.
 * @param {string} sessionId - must already be validated
 * @returns {string}
 */
function markerPath(sessionId) {
  return path.join(GSD_TEMP_DIR, MARKER_PREFIX + sessionId + '.marker');
}

/**
 * bm self-announces that it is active for this session. No-op on a malformed or
 * missing session_id (never composes a path from an untrusted id). Writes the
 * current epoch millis and refreshes the marker mtime on every fire, so a long
 * session is never reaped mid-run.
 * @param {*} sessionId
 * @returns {void}
 */
function markBmActive(sessionId) {
  if (!isValidSessionId(sessionId)) return;
  try {
    ensureGsdTempDir();
    fs.writeFileSync(markerPath(sessionId), String(Date.now()));
  } catch {
    // A shared user-owned temp dir; a write failure just means "not announced".
  }
}

/**
 * Whether bm has announced itself for this session. Any invalid id or read error
 * reads as false (run normally).
 * @param {*} sessionId
 * @returns {boolean}
 */
function isBmActive(sessionId) {
  if (!isValidSessionId(sessionId)) return false;
  try {
    return fs.existsSync(markerPath(sessionId));
  } catch {
    return false;
  }
}

/**
 * The election: a gsd copy yields only when bm is active for this session. The
 * bm copy never yields, and a gsd-only session (no marker) never yields, which
 * is what preserves today's single-plugin behavior.
 * @param {'gsd'|'bm'} identity
 * @param {*} sessionId
 * @returns {boolean}
 */
function shouldYield(identity, sessionId) {
  return identity === 'gsd' && isBmActive(sessionId);
}

module.exports = { pluginIdentity, markBmActive, isBmActive, shouldYield };
