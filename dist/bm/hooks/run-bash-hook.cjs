#!/usr/bin/env node
/**
 * Shared bash-hook launcher with Cygwin fork-failure retry (issue #16).
 *
 * Usage: node run-bash-hook.cjs <hook-filename>
 *   e.g. node run-bash-hook.cjs gsd-session-state.sh
 *
 * Path resolution: CLAUDE_PLUGIN_ROOT first, then the globally-newest semver
 * dir found by scanning every marketplace under ~/.claude/plugins/cache/, i.e.
 * ~/.claude/plugins/cache/<marketplace>/<pkg>/<version>/. Versions from all
 * marketplaces are merged and sorted descending so the highest wins regardless
 * of which marketplace holds it (same logic as the inline node -e bootstraps in
 * hooks.json).
 *
 * On Windows with BLODA antivirus (e.g. Kaspersky), Cygwin/MSYS2 bash can
 * intermittently fail with a fork() EPERM: the AV-injected DLL collides with
 * the address the forked child needs for its cygheap mount table. This helper
 * retries ONCE when the captured stderr matches that signature.
 *
 * Retry predicate (ONLY for Cygwin fork failures):
 *   /fatal error|add_item|fork|cygheap|resource temporarily unavailable/i
 *
 * IMPORTANT: do NOT retry on arbitrary non-zero exits. gsd-validate-commit.sh
 * returns exit 2 to BLOCK a non-conforming commit; that must never be retried.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const { pluginIdentity, markBmActive, shouldYield } = require('../bin/lib/coexist.cjs');

// Maximum number of retry attempts after a fork failure (not counting first run).
const MAX_RETRIES = 1;

// Cygwin fork-failure signature. Matches messages like:
//   fatal error - add_item ("\??\C:\git", "/", ...) failed, errno 1
//   fatal error - couldn't allocate cygheap, Win32 error 5
//   fatal error - fork: can't reserve memory for stack, ... Resource temporarily unavailable
const FORK_FAILURE_RE = /fatal error|add_item|fork|cygheap|resource temporarily unavailable/i;

/**
 * Resolve candidate paths for the named hook file.
 * Returns an array ordered from most-preferred to least-preferred.
 */
function resolveCandidates(hookName) {
  const candidates = [];

  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'hooks', hookName));
  }

  // Marketplace-agnostic scan: the plugin can be cached under any marketplace
  // directory (the historical `gsd-plugin`, a new `buildomator`, ...). Walk every
  // marketplace, collect every semver version dir for this package, then sort the
  // UNION descending so the globally-highest version wins no matter which
  // marketplace holds it. The plugin-name segment is fixed per package.
  const cacheRoot = path.join(os.homedir(), '.claude', 'plugins', 'cache');
  const pkgSegment = 'bm';
  const found = [];
  let marketplaces = [];
  try {
    marketplaces = fs.readdirSync(cacheRoot);
  } catch (_) {
    // Cache dir absent -- dev/test environment, ignore.
  }
  for (const mp of marketplaces) {
    let versions;
    try {
      versions = fs.readdirSync(path.join(cacheRoot, mp, pkgSegment));
    } catch (_) {
      continue; // This marketplace has no copy of the package.
    }
    for (const v of versions) {
      if (/^\d+\.\d+\.\d+$/.test(v)) {
        found.push({ version: v, path: path.join(cacheRoot, mp, pkgSegment, v, 'hooks', hookName) });
      }
    }
  }
  found.sort((a, b) => {
    const A = a.version.split('.').map(Number);
    const B = b.version.split('.').map(Number);
    return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];
  });
  for (const entry of found) candidates.push(entry.path);

  return candidates;
}

/**
 * Run bash with the given hook path.
 * Stdout is inherited (visible directly). Stderr is captured so we can
 * inspect it for the fork-failure signature, then re-emitted unchanged.
 *
 * Returns { status: number, stderrText: string }.
 */
function runHook(hookPath, stdinInput) {
  const result = cp.spawnSync('bash', [hookPath], {
    // stdin is a pipe fed the exact buffered bytes (the election drained fd 0
    // once, so the bash child can no longer inherit it directly); stdout stays
    // inherited and stderr is captured for the fork-failure signature.
    stdio: ['pipe', 'inherit', 'pipe'],
    input: stdinInput,
  });

  const stderrText = result.stderr ? result.stderr.toString() : '';
  if (stderrText) {
    process.stderr.write(stderrText);
  }

  return {
    status: result.status !== null ? result.status : (result.error ? 1 : 0),
    stderrText,
  };
}

/**
 * Returns true when the stderr output matches the Cygwin fork-failure
 * signature and therefore a retry is appropriate.
 */
function isForkFailure(stderrText, exitStatus) {
  // A fork failure always exits non-zero.
  if (exitStatus === 0) return false;
  return FORK_FAILURE_RE.test(stderrText);
}

function main() {
  const hookName = process.argv[2];
  if (!hookName) {
    process.stderr.write('run-bash-hook: hook name argument required\n');
    process.exit(1);
  }

  // Coexistence election (single dispatch point for the three bash hooks:
  // session-state, validate-commit, phase-boundary). Buffer stdin once, self-
  // announce if this is the bm copy, then yield if the gsd copy sees the bm
  // marker for this session. When not yielding, forward the exact buffered
  // bytes to the bash child so a hook that reads stdin (validate-commit parses
  // tool_input.command and returns exit 2 to block) still receives them. A
  // single-plugin session has no marker, so shouldYield is false and behavior
  // is unchanged.
  let stdinBuf = Buffer.alloc(0);
  try { stdinBuf = fs.readFileSync(0); } catch { /* stdin may be unavailable */ }
  let sessionId;
  try {
    const parsed = JSON.parse(stdinBuf.toString('utf-8'));
    sessionId = parsed && parsed.session_id;
  } catch { /* stdin absent or not JSON — fail open, run normally */ }
  const identity = pluginIdentity(__filename);
  if (identity === 'bm') markBmActive(sessionId);
  if (shouldYield(identity, sessionId)) process.exit(0);

  const candidates = resolveCandidates(hookName);
  const firstCandidate = process.env.CLAUDE_PLUGIN_ROOT
    ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'hooks', hookName)
    : null;

  for (const hookPath of candidates) {
    if (!fs.existsSync(hookPath)) continue;

    // Warn when falling back from a stale CLAUDE_PLUGIN_ROOT to cached copy.
    if (firstCandidate && hookPath !== firstCandidate) {
      process.stderr.write('GSD: plugin path stale, using ' + hookPath + '\n');
    }

    // First attempt.
    let { status, stderrText } = runHook(hookPath, stdinBuf);

    // Retry loop (up to MAX_RETRIES times) on Cygwin fork-failure only.
    let retries = 0;
    while (retries < MAX_RETRIES && isForkFailure(stderrText, status)) {
      process.stderr.write(
        'GSD: bash fork() failed (Cygwin/BLODA); retrying ' +
        hookName + ' (attempt ' + (retries + 2) + ')...\n'
      );
      const retry = runHook(hookPath, stdinBuf);
      status = retry.status;
      stderrText = retry.stderrText;
      retries++;
    }

    process.exit(status);
  }

  // No candidate found -- not fatal; hook may not exist in this layout.
  process.exit(0);
}

main();
