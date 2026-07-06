#!/usr/bin/env node
/**
 * Shared bash-hook launcher with Cygwin fork-failure retry (issue #16).
 *
 * Usage: node run-bash-hook.cjs <hook-filename>
 *   e.g. node run-bash-hook.cjs gsd-session-state.sh
 *
 * Path resolution: CLAUDE_PLUGIN_ROOT first, then newest semver dir under
 * ~/.claude/plugins/cache/gsd-plugin/bm/ (same logic as the inline node -e
 * bootstraps in hooks.json).
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

  const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'gsd-plugin', 'bm');
  try {
    const versions = fs.readdirSync(cacheBase)
      .filter((x) => /^\d+\.\d+\.\d+$/.test(x))
      .sort((a, b) => {
        const A = a.split('.').map(Number);
        const B = b.split('.').map(Number);
        return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];
      });
    for (const v of versions) {
      candidates.push(path.join(cacheBase, v, 'hooks', hookName));
    }
  } catch (_) {
    // Cache dir absent -- dev/test environment, ignore.
  }

  return candidates;
}

/**
 * Run bash with the given hook path.
 * Stdout is inherited (visible directly). Stderr is captured so we can
 * inspect it for the fork-failure signature, then re-emitted unchanged.
 *
 * Returns { status: number, stderrText: string }.
 */
function runHook(hookPath) {
  const result = cp.spawnSync('bash', [hookPath], {
    stdio: ['inherit', 'inherit', 'pipe'],
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
    let { status, stderrText } = runHook(hookPath);

    // Retry loop (up to MAX_RETRIES times) on Cygwin fork-failure only.
    let retries = 0;
    while (retries < MAX_RETRIES && isForkFailure(stderrText, status)) {
      process.stderr.write(
        'GSD: bash fork() failed (Cygwin/BLODA); retrying ' +
        hookName + ' (attempt ' + (retries + 2) + ')...\n'
      );
      const retry = runHook(hookPath);
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
