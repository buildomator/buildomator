/**
 * Phantom Scaffolding Detector.
 *
 * DRIFT-05 layer 2: detects two categories of phantom/scaffolding code:
 *
 *   1. phantom-export: a CRUD-named export (get/fetch/delete/update/create/...)
 *      that appears in NO file's imported-names set across the corpus. Cross-file
 *      graph built in a single pass (linear, not O(files^2) -- Pitfall 3).
 *      Covers BOTH ESM (import { x } from ...) and CJS (const { x } = require(...)).
 *
 *   2. placeholder-stub: a function body containing `return null|undefined|{}|[]`
 *      paired with a TODO/TBD/FIXME/not-implemented comment (case-insensitive).
 *      Uses conventions.blankSpans pre-pass so a TODO inside a string is never
 *      matched (string-safety).
 *
 * D-09 compliance: does NOT emit "unused-export", "comment-density",
 * "unreachable-after-return", or "function-too-long" findings.
 *
 * Design (mirrors bin/lib/conventions.cjs contracts):
 *   - Pure. Node built-ins only (node:fs, node:path) -- zero new runtime dep.
 *   - NEVER throws. detect() returns { skipped:true, reason, findings:[] } on
 *     bad input or any exception. Per-file reads use try/catch + continue.
 *   - Reuses conventions.cjs blankSpans, sanitizePaths, MAX_SCAN_BYTES.
 *   - Covers BOTH module systems (ESM import + CJS require) for import detection.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const conventions = require('./conventions.cjs');

// ─── Constants ────────────────────────────────────────────────────────────────

// Cap per-file scan size (reuse conventions.cjs contract).
const MAX_SCAN_BYTES = conventions.blankSpans ? 512 * 1024 : 512 * 1024;

// CRUD verb buckets (from RESEARCH §Phantom code example + conventions.cjs taxonomy).
// Includes conventions.cjs READ_VERBS/MUTATE_VERBS overlap where sensible; extends
// with fetch/load/query/search/find/insert/store/put/post/modify/edit/destroy/drop/revoke.
const CRUD_VERB_BUCKETS = Object.freeze({
  retrieval: Object.freeze(['fetch', 'get', 'load', 'read', 'find', 'query', 'list', 'search']),
  mutation:  Object.freeze(['create', 'insert', 'add', 'save', 'store', 'write', 'put', 'post']),
  update:    Object.freeze(['update', 'patch', 'modify', 'edit', 'set']),
  deletion:  Object.freeze(['delete', 'remove', 'destroy', 'drop', 'revoke']),
});

// Flat sorted array of all CRUD verbs for leading-verb matching.
const ALL_CRUD_VERBS = Object.freeze(
  Object.values(CRUD_VERB_BUCKETS).flat().sort((a, b) => b.length - a.length) // longest first
);

// Export patterns: covers both single-name exports and brace-form re-exports.
// MUST NOT include `*/` in a RegExp literal (block comment terminators).
// Source: RESEARCH §Phantom-scaffolding import-graph (EXPORT_NAMED_PATTERNS).
const EXPORT_NAMED_PATTERNS = Object.freeze([
  // export function/class/const/let/var/type/interface/enum Name
  /export\s+(?:async\s+)?(?:function\s*\*?\s*|class\s+|const\s+|let\s+|var\s+|type\s+|interface\s+|enum\s+)([A-Za-z_$][\w$]*)/g,
  // export { a, b as c, ... }  (brace-form — handled separately in extractExports)
]);

// Import patterns: covers ESM import and CJS require (Pitfall 3 -- both module systems).
// Source: RESEARCH §Phantom-scaffolding (IMPORT_PATTERNS).
const IMPORT_PATTERNS = Object.freeze([
  // ESM: import { a, b } from '...'
  /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g,
  // ESM: import defaultName from '...'
  /import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+['"]/g,
  // ESM: import * as ns from '...'  (namespace — the ns identifier)
  /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+['"]/g,
  // CJS: const { a, b } = require('...')
  /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/g,
  // CJS: const x = require('...')
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/g,
]);

// Placeholder return values (null/undefined/{}/[]) -- signal co-located with a TODO comment.
const PLACEHOLDER_RETURN_RE = /return\s+(?:null|undefined|\{\s*\}|\[\s*\])\s*;?/;

// TODO/TBD/FIXME/not-implemented pattern in source (matched against original src).
// We check original source for this (comments pass through), but use blanked source
// to detect placeholder returns (string-safety).
const TODO_PATTERN_RE = /\b(?:TODO|TBD|FIXME|not\s+implemented)\b/i;

// ─── classifyVerb ─────────────────────────────────────────────────────────────

/**
 * Test whether an identifier starts with a CRUD verb (camelCase leading-verb).
 * Returns the bucket name ('retrieval'|'mutation'|'update'|'deletion') or null.
 * @param {string} name
 * @returns {string|null}
 */
function classifyVerb(name) {
  if (typeof name !== 'string' || !name) return null;
  // Extract the leading "word" from camelCase: everything before the first uppercase-start
  // of a subsequent word. We lowercase and prefix-match.
  const lower = name.toLowerCase();
  for (const verb of ALL_CRUD_VERBS) {
    if (lower.startsWith(verb)) {
      // Ensure it's a true leading-verb split: next char is uppercase, digit, _, or end
      const rest = name.slice(verb.length);
      if (rest === '' || /^[A-Z0-9_$]/.test(rest)) {
        // Find which bucket
        for (const [bucket, verbs] of Object.entries(CRUD_VERB_BUCKETS)) {
          if (verbs.includes(verb)) return bucket;
        }
      }
    }
  }
  return null;
}

// ─── extractExports ──────────────────────────────────────────────────────────

/**
 * Extract named exports from (blankSpans-cleaned) source.
 * Returns [{ name, line }].
 * @param {string} src  - original source (blankSpans applied internally)
 * @returns {Array<{name: string, line: number}>}
 */
function extractExports(src) {
  if (typeof src !== 'string') return [];
  const blanked = conventions.blankSpans(src);
  const results = [];

  // Single-name form: export function/class/const/let/var/async Name
  const singleRe = /export\s+(?:async\s+)?(?:function\s*\*?\s*|class\s+|const\s+|let\s+|var\s+|type\s+|interface\s+|enum\s+)([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = singleRe.exec(blanked)) !== null) {
    results.push({ name: m[1], line: lineOf(src, m.index) });
  }

  // Brace-form: export { a, b as c, ... }
  const braceRe = /export\s*\{([^}]+)\}/g;
  while ((m = braceRe.exec(blanked)) !== null) {
    const inner = m[1];
    // each item: "name" or "name as alias" -- we want the exported name (alias if present)
    for (const item of inner.split(',')) {
      const parts = item.trim().split(/\s+as\s+/);
      const exportedName = (parts[1] || parts[0]).trim().replace(/[^A-Za-z_$\w]/g, '');
      if (exportedName && /^[A-Za-z_$]/.test(exportedName)) {
        results.push({ name: exportedName, line: lineOf(src, m.index) });
      }
    }
  }

  // CJS: module.exports = { a, b } or module.exports.fn = function
  // Simple case: module.exports = { key: value, ... }
  const cjsObjRe = /module\.exports\s*=\s*\{([^}]*)\}/g;
  while ((m = cjsObjRe.exec(blanked)) !== null) {
    const inner = m[1];
    for (const item of inner.split(',')) {
      const key = item.trim().split(/\s*:\s*/)[0].trim().replace(/[^A-Za-z_$\w]/g, '');
      if (key && /^[A-Za-z_$]/.test(key)) {
        results.push({ name: key, line: lineOf(src, m.index) });
      }
    }
  }

  return results;
}

// ─── extractImportedNames ────────────────────────────────────────────────────

/**
 * Extract all imported identifier names from (blankSpans-cleaned) source.
 * Covers BOTH ESM import and CJS require (Pitfall 3).
 * Returns a flat array of name strings (may have duplicates; caller uses a Set).
 * @param {string} src  - original source (blankSpans applied internally)
 * @returns {string[]}
 */
function extractImportedNames(src) {
  if (typeof src !== 'string') return [];
  const blanked = conventions.blankSpans(src);
  const names = [];

  // ESM: import { a, b as c } from '...'
  const esmBraceRe = /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*['"][^'"]*['"]/g;
  let m;
  while ((m = esmBraceRe.exec(blanked)) !== null) {
    for (const item of m[1].split(',')) {
      const parts = item.trim().split(/\s+as\s+/);
      // "name" or "originalName as localAlias" -- we track the local alias (what callers use)
      const localName = (parts[1] || parts[0]).trim().replace(/[^A-Za-z_$\w]/g, '');
      if (localName) names.push(localName);
      // Also track the original name in case the export side matches that
      const originalName = parts[0].trim().replace(/[^A-Za-z_$\w]/g, '');
      if (originalName && originalName !== localName) names.push(originalName);
    }
  }

  // ESM: import DefaultName from '...'
  const esmDefaultRe = /import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]*['"]/g;
  while ((m = esmDefaultRe.exec(blanked)) !== null) {
    names.push(m[1]);
  }

  // ESM: import * as ns from '...' (the ns identifier)
  const esmNsRe = /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]*['"]/g;
  while ((m = esmNsRe.exec(blanked)) !== null) {
    names.push(m[1]);
  }

  // CJS: const { a, b } = require('...')
  const cjsDestructRe = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"][^'"]*['"]\s*\)/g;
  while ((m = cjsDestructRe.exec(blanked)) !== null) {
    for (const item of m[1].split(',')) {
      // "key" or "key: localVar" -- track both
      const parts = item.trim().split(/\s*:\s*/);
      const key = parts[0].trim().replace(/[^A-Za-z_$\w]/g, '');
      if (key) names.push(key);
      if (parts[1]) {
        const local = parts[1].trim().replace(/[^A-Za-z_$\w]/g, '');
        if (local) names.push(local);
      }
    }
  }

  // CJS: const x = require('...') (single binding)
  const cjsSingleRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"][^'"]*['"]\s*\)/g;
  while ((m = cjsSingleRe.exec(blanked)) !== null) {
    names.push(m[1]);
  }

  return names;
}

// ─── placeholder detection ────────────────────────────────────────────────────

/**
 * Scan a source file for placeholder stubs: functions that return null/undefined/{}
 * and have a TODO/TBD/FIXME/not-implemented comment nearby.
 *
 * String-safety strategy:
 *   - Use blankSpans to find placeholder RETURN statements (so a "return null" inside
 *     a string or comment is invisible to the return scanner).
 *   - Use the ORIGINAL source to find TODO patterns (so comments are visible).
 *   - The blankSpans check prevents a "TODO: nothing" inside a string from being
 *     matched: blankSpans blanks string contents, so if we verify the TODO position
 *     exists in the original source but NOT in the blanked source (where strings are
 *     erased), we know it was in a string (not a comment).
 *
 * @param {string} src
 * @param {string} file
 * @returns {Array<{kind:'placeholder-stub', file, line, name, severity}>}
 */
function detectPlaceholders(src, file) {
  const findings = [];
  if (typeof src !== 'string') return findings;

  // Apply blankSpans: string/comment contents become spaces.
  const blanked = conventions.blankSpans(src);

  // Quick pre-check: does the original source have a TODO-family pattern?
  // (comments pass through; strings have TODO visible here too)
  const hasTodoInOrig = TODO_PATTERN_RE.test(src);
  if (!hasTodoInOrig) return findings;

  // Now check: is the TODO present in the blanked source?
  // If YES -> it's NOT in a string or comment (bare code TODO, unusual but valid).
  // If NO  -> it was in a string or comment.
  //   - If in a comment: we WANT to flag it (that's a TODO comment).
  //   - If in a string: we do NOT want to flag it.
  // We need to distinguish "in a comment" from "in a string".
  // Strategy: check the blanked source. If TODO is absent from blanked, check if
  // the original source has it inside a line-comment or block-comment pattern.
  const hasTodoInBlanked = TODO_PATTERN_RE.test(blanked);

  // A TODO that survives blanking is in live code (unusual; treat as a comment-like signal).
  // A TODO that vanishes in blanking was inside a string OR inside a comment.
  // We detect the "string" case by checking if the pattern exists at the same position
  // in both original and blanked. If blanked has it, it's live code (ok to flag).
  // If blanked does NOT have it, we need the comment check.

  // Simplified approach: scan for TODO inside comment-like constructs in the original.
  // Line comments: //.*TODO  Block comments: /* ...TODO... */
  const todoInComment = /(?:\/\/[^\n]*\b(?:TODO|TBD|FIXME|not\s+implemented)\b|\/\*[\s\S]*?\b(?:TODO|TBD|FIXME|not\s+implemented)\b[\s\S]*?\*\/)/i.test(src);

  if (!todoInComment && !hasTodoInBlanked) {
    // TODO exists only in strings (not in comments, not in live code) -> skip
    return findings;
  }

  // Check if any function returns null/undefined/{}/[] (in blanked source for string-safety)
  const hasPlaceholderReturn = PLACEHOLDER_RETURN_RE.test(blanked);
  if (!hasPlaceholderReturn) return findings;

  // Emit one finding per function that has a placeholder return in its body.
  // Also check for nearby TODO: look in a window around the function (including the
  // lines before the function where a "// TODO: implement this" comment typically lives).
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = fnRe.exec(blanked)) !== null) {
    const fnName = m[1];
    const bodyStart = fnRe.lastIndex;
    // Brace-balance to find body end
    let depth = 1;
    let j = bodyStart;
    while (j < blanked.length && depth > 0) {
      if (blanked[j] === '{') depth++;
      else if (blanked[j] === '}') depth--;
      j++;
    }
    const body = blanked.slice(bodyStart, j - 1);

    // Does this function's body have a placeholder return?
    if (!PLACEHOLDER_RETURN_RE.test(body)) continue;

    // Look for a TODO comment: inside the body (blanked doesn't help for comments, so
    // check original source body slice), OR in the 5 lines above the function.
    const fnStart = m.index;
    // Include a window of 200 chars before the function declaration (captures leading comments)
    const windowStart = Math.max(0, fnStart - 200);
    const windowSrc = src.slice(windowStart, j);

    // Check if the window in the original source has a TODO in a comment
    const windowHasTodo = /(?:\/\/[^\n]*\b(?:TODO|TBD|FIXME|not\s+implemented)\b|\/\*[\s\S]*?\b(?:TODO|TBD|FIXME|not\s+implemented)\b[\s\S]*?\*\/)/i.test(windowSrc);

    // Also check if TODO appears bare in the window (live code or anywhere)
    const windowBlanked = conventions.blankSpans(windowSrc);
    const windowHasTodoInBlanked = TODO_PATTERN_RE.test(windowBlanked);

    if (windowHasTodo || windowHasTodoInBlanked) {
      findings.push({
        kind: 'placeholder-stub',
        file,
        line: lineOf(src, m.index),
        name: fnName,
        severity: 'warning',
      });
    }
  }

  // Fallback: file has both signals (TODO in comment + placeholder return) but no named
  // function was matched (e.g., arrow functions, function expressions).
  if (findings.length === 0 && (todoInComment || hasTodoInBlanked) && hasPlaceholderReturn) {
    findings.push({
      kind: 'placeholder-stub',
      file,
      line: 1,
      name: '(unknown)',
      severity: 'info',
    });
  }

  return findings;
}

// ─── detect ──────────────────────────────────────────────────────────────────

/**
 * Run phantom-export + placeholder-stub detection over a corpus of files.
 * Never throws. Returns { skipped:true, reason, findings:[] } on bad input
 * or any top-level exception. Per-file errors are caught and skipped.
 *
 * @param {string[]|null} corpus - cwd-relative file paths
 * @param {{ cwd?: string }} [opts]
 * @returns {{ skipped:false, findings:Array } | { skipped:true, reason:string, findings:[] }}
 */
function detect(corpus, opts) {
  try {
    if (!Array.isArray(corpus)) return { skipped: true, reason: 'invalid-input', findings: [] };
    const cwd = (opts && typeof opts.cwd === 'string' && opts.cwd) ? opts.cwd : process.cwd();
    const safe = conventions.sanitizePaths(corpus);

    // FIRST PASS: build the flat Set of ALL imported names across the entire corpus (Pitfall 3).
    const allImportedNames = new Set();
    // Also collect sources for second pass (to avoid double-read).
    const sources = new Map(); // relPath -> src

    for (const rel of safe) {
      let src;
      try {
        const full = path.resolve(cwd, rel);
        const stat = fs.statSync(full);
        if (!stat.isFile() || stat.size > MAX_SCAN_BYTES) continue;
        src = fs.readFileSync(full, 'utf8');
      } catch { continue; }
      sources.set(rel, src);
      for (const name of extractImportedNames(src)) {
        allImportedNames.add(name);
      }
    }

    // SECOND PASS: phantom-export + placeholder per file.
    const findings = [];
    for (const [rel, src] of sources) {
      // Phantom-export: CRUD-named exports absent from allImportedNames
      let exports;
      try {
        exports = extractExports(src);
      } catch { exports = []; }
      for (const exp of exports) {
        if (classifyVerb(exp.name) !== null && !allImportedNames.has(exp.name)) {
          findings.push({
            kind: 'phantom-export',
            file: rel,
            line: exp.line,
            name: exp.name,
            severity: 'warning',
          });
        }
      }

      // Placeholder stubs
      try {
        for (const f of detectPlaceholders(src, rel)) {
          findings.push(f);
        }
      } catch { /* per-file skip */ }
    }

    return { skipped: false, findings };
  } catch (err) {
    return {
      skipped: true,
      reason: 'exception:' + (err && err.message ? err.message : String(err)),
      findings: [],
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lineOf(src, index) {
  let line = 1;
  for (let k = 0; k < index && k < src.length; k++) if (src[k] === '\n') line++;
  return line;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { detect, extractExports, extractImportedNames, classifyVerb };
