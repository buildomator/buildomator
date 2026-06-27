/**
 * Drift Allowlist Loader + Suppression Matcher (Phase 11, plan 11-02).
 *
 * Provides two public functions:
 *   - load(cwd)                          -> { pairs, ignore }  (never throws)
 *   - isSuppressed(fileA, fileB, allow)  -> { suppressed, reason? }
 *
 * Design (mirrors bin/lib/conventions.cjs + bin/lib/drift.cjs contracts):
 *   - Pure. Node built-ins only (node:fs, node:path) -- zero new runtime dep.
 *   - NEVER throws. load() wraps both reads in try/catch; missing or malformed
 *     files return { pairs:[], ignore:[] } (empty-but-valid) so callers never
 *     branch on shape.
 *   - isSuppressed() is symmetric: (fileA, fileB) matches iff glob(a)~A && glob(b)~B
 *     OR glob(a)~B && glob(b)~A -- dual-resolver rule fires in either order.
 *   - Suppressed pairs are NEVER silently dropped (D-07 auditability): callers
 *     move them to a suppressed:[] section of the report, not the findings:[].
 *
 * Allowlist file shapes:
 *   .gsd/drift-allowlist.json  (GSD-native pair-allowlist):
 *     { "intentional": [ { "a": "glob/**", "b": "glob/**", "reason": "..." } ] }
 *   .vibedriftignore (portable gitignore-syntax path exclusions, optional):
 *     plain text; lines starting with # are comments; blank lines are skipped.
 *
 * Glob matching: simple glob-star match (prefix double-star). NOT a full
 * glob engine (RESEARCH Alternatives Considered). Translates ** to "any path
 * segments" and * to "any non-slash run", anchored at start of path string.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── Constants ────────────────────────────────────────────────────────────────

// Allowlist JSON location relative to cwd.
const ALLOWLIST_PATH = '.gsd/drift-allowlist.json';

// Portable exclusion file relative to cwd.
const VIBEDRIFT_IGNORE_PATH = '.vibedriftignore';

// ─── Glob matching ────────────────────────────────────────────────────────────

/**
 * Convert a glob pattern to a RegExp.
 * Supports: ** (any path segments, including none), * (any non-slash run).
 * Anchored at start and end.
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegex(glob) {
  // Escape regex special chars except * and /
  let re = '';
  let i = 0;
  const g = String(glob);
  while (i < g.length) {
    if (g[i] === '*' && g[i + 1] === '*') {
      // ** matches any path segment sequence (including a single file name or empty)
      // Pattern: prefix/** matches prefix/file, prefix/dir/file, etc.
      // We absorb any following slash and emit a pattern that matches the remainder.
      i += 2;
      if (g[i] === '/') i++;
      if (i >= g.length) {
        // ** at end: match anything (including nothing)
        re += '.*';
      } else {
        // ** in middle: match zero or more path segments including the separator
        re += '(?:.*/)?';
      }
    } else if (g[i] === '*') {
      // * matches any non-slash sequence (including empty)
      re += '[^/]*';
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(g[i])) {
      re += '\\' + g[i];
      i++;
    } else {
      re += g[i];
      i++;
    }
  }
  return new RegExp('^' + re + '$');
}

/**
 * Test whether a path matches a glob pattern.
 * @param {string} glob
 * @param {string} filePath
 * @returns {boolean}
 */
function globMatch(glob, filePath) {
  try {
    return globToRegex(glob).test(filePath);
  } catch {
    return false;
  }
}

// ─── load ────────────────────────────────────────────────────────────────────

/**
 * Load the drift allowlist from cwd.
 * Reads .gsd/drift-allowlist.json (pairs) and .vibedriftignore (ignore list).
 * Never throws — returns empty-but-valid { pairs:[], ignore:[] } on any error.
 * @param {string} cwd
 * @returns {{ pairs: Array<{a:string, b:string, reason:string}>, ignore: string[] }}
 */
function load(cwd) {
  let pairs = [];
  let ignore = [];

  // Load pair-allowlist
  try {
    const raw = fs.readFileSync(path.resolve(cwd, ALLOWLIST_PATH), 'utf8');
    const cfg = JSON.parse(raw);
    pairs = Array.isArray(cfg.intentional) ? cfg.intentional : [];
  } catch {
    pairs = [];
  }

  // Load .vibedriftignore (portable gitignore-syntax exclusions)
  try {
    const raw = fs.readFileSync(path.resolve(cwd, VIBEDRIFT_IGNORE_PATH), 'utf8');
    ignore = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch {
    ignore = [];
  }

  return { pairs, ignore };
}

// ─── isSuppressed ────────────────────────────────────────────────────────────

/**
 * Check whether a file pair (A, B) is suppressed by an intentional allowlist entry.
 * Matching is symmetric: (a~A && b~B) OR (a~B && b~A).
 * Returns { suppressed:true, reason } on first match, { suppressed:false } otherwise.
 * @param {string} fileA
 * @param {string} fileB
 * @param {{ pairs: Array<{a:string, b:string, reason:string}>, ignore: string[] }} allow
 * @returns {{ suppressed: boolean, reason?: string }}
 */
function isSuppressed(fileA, fileB, allow) {
  if (!allow || !Array.isArray(allow.pairs)) return { suppressed: false };
  for (const pair of allow.pairs) {
    if (!pair || typeof pair.a !== 'string' || typeof pair.b !== 'string') continue;
    const forwardMatch = globMatch(pair.a, fileA) && globMatch(pair.b, fileB);
    const reverseMatch = globMatch(pair.a, fileB) && globMatch(pair.b, fileA);
    if (forwardMatch || reverseMatch) {
      return { suppressed: true, reason: pair.reason || '' };
    }
  }
  return { suppressed: false };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { load, isSuppressed };
