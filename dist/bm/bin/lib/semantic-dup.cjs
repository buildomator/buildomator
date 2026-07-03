/**
 * Structural Near-Clone Detector (DRIFT-05 layer 3).
 *
 * Native MinHash+LCS structural near-clone detector. Ports the exact constants
 * and algorithm from @vibedrift/cli@0.14.4 (read locally during research; NEVER
 * installed as a runtime dependency). Pure CJS, Node built-ins only.
 *
 * Design contracts (mirrors bin/lib/conventions.cjs):
 *   - Zero runtime deps. Node built-ins (node:fs, node:path) + ./conventions.cjs.
 *   - NEVER throws. detect() validates input, wraps the body in try/catch, and
 *     returns { skipped:true, reason, pairs:[], suppressed:[] } on bad input or
 *     any exception. Per-file reads use try/catch skip — one bad file never fails
 *     the run.
 *   - Deterministic. Fixed PERM_SEEDS (seeded FNV-1a), no Math.random. Sorted
 *     output. Two runs on the same corpus yield deepStrictEqual results.
 *   - Advisory-tier. detect() returns pairs[], suppressed[] for caller rendering.
 *     Never exits non-zero; callers decide what to do with findings.
 *   - D-09 noise excluded. Does NOT compute or emit line-count,
 *     unreachable-after-return, unused-export, or comment-density signals.
 *
 * Public API:
 *   detect(corpus, opts?) → { skipped:false, pairs, suppressed } | { skipped:true, reason, pairs:[], suppressed:[] }
 *   corpus = string[] of cwd-relative file paths.
 *   opts.cwd = base dir for reads. opts.allow = { pairs:[{a,b,reason}], ignore:[] }.
 *
 * Internals exposed for tests (module.exports tail):
 *   buildShingles, minHashSignature, findLshCandidatePairs, lcsSimilarity, findDuplicatePairs
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const conventions = require('./conventions.cjs');

// ─── Ported constants (verbatim from @vibedrift/cli@0.14.4) ──────────────────

const DEFAULT_SHINGLE_SIZE  = 5;    // operation-sequence k-gram size
const DEFAULT_PERMUTATIONS  = 128;  // MinHash signature length
const DEFAULT_LSH_BANDS     = 16;   // bands x rows = 128 (16x8)
const DEFAULT_LSH_ROWS      = 8;
const MIN_BODY_TOKENS       = 15;   // skip tiny functions (Pitfall 1)
const FLAG_THRESHOLD        = 0.7;  // LCS-similarity flag cutoff

// ─── Deterministic seeded permutation table (no Math.random — Pitfall 5) ─────

// FNV-1a seeded permutation table. Fixed seeds derived from FNV offset + golden
// ratio multiplication — fully deterministic, no Math.random.
const PERM_SEEDS = (() => {
  const arr = new Uint32Array(DEFAULT_PERMUTATIONS);
  for (let i = 0; i < DEFAULT_PERMUTATIONS; i++) {
    arr[i] = Math.imul(2166136261 ^ (i * 2654435769), 16777619) >>> 0;
  }
  return arr;
})();

// ─── MinHash primitives ───────────────────────────────────────────────────────

/**
 * Build k-gram shingles from a token array (k = size).
 * Normalization (identifier→VAR, number→NUM) has already been applied to tokens
 * before this call, making the detector Type-2/3 tolerant.
 * @param {string[]} tokens
 * @param {number} [size]
 * @returns {string[]}
 */
function buildShingles(tokens, size = DEFAULT_SHINGLE_SIZE) {
  if (tokens.length < size) return [tokens.join('\t')];
  const out = new Array(tokens.length - size + 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = tokens.slice(i, i + size).join('\t');
  }
  return out;
}

/**
 * FNV-1a hash of `str` seeded with `seed`.
 * @param {string} str
 * @param {number} seed
 * @returns {number} unsigned 32-bit integer
 */
function fnv1aWithSeed(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Compute the MinHash signature for a set of shingles.
 * Uses fixed PERM_SEEDS — fully deterministic across calls.
 * @param {string[]} shingles
 * @param {number} [perms]
 * @returns {Uint32Array}
 */
function minHashSignature(shingles, perms = DEFAULT_PERMUTATIONS) {
  const sig = new Uint32Array(perms);
  sig.fill(0xFFFFFFFF);
  for (const sh of shingles) {
    for (let p = 0; p < perms; p++) {
      const h = fnv1aWithSeed(sh, PERM_SEEDS[p % PERM_SEEDS.length]);
      if (h < sig[p]) sig[p] = h;
    }
  }
  return sig;
}

/**
 * LSH banding: collect candidate pairs whose signatures share a complete band.
 * Only same-bucket functions become candidates; cross-bucket pairs are pruned.
 * @param {Uint32Array[]} signatures
 * @param {number} [bands]
 * @param {number} [rows]
 * @returns {Set<string>} set of "i-j" strings (i < j)
 */
function findLshCandidatePairs(signatures, bands = DEFAULT_LSH_BANDS, rows = DEFAULT_LSH_ROWS) {
  const candidates = new Set();
  for (let b = 0; b < bands; b++) {
    const buckets = new Map();
    for (let i = 0; i < signatures.length; i++) {
      let key = '';
      for (let r = 0; r < rows; r++) {
        key += (r ? '|' : '') + signatures[i][b * rows + r].toString(36);
      }
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(i);
      } else {
        buckets.set(key, [i]);
      }
    }
    for (const bucket of buckets.values()) {
      for (let x = 0; x < bucket.length; x++) {
        for (let y = x + 1; y < bucket.length; y++) {
          const a = bucket[x];
          const c = bucket[y];
          candidates.add(a < c ? `${a}-${c}` : `${c}-${a}`);
        }
      }
    }
  }
  return candidates;
}

/**
 * LCS-based similarity between two token arrays.
 * Uses two rolling Int32Array rows (memory-light, Pitfall 4).
 * Early-out: if min/max length ratio < 0.5, returns 0 immediately.
 * Returns: (2 * lcs_length) / (a.length + b.length)
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} similarity in [0, 1]
 */
function lcsSimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.5) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let prev = new Int32Array(shorter.length + 1);
  let curr = new Int32Array(shorter.length + 1);
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++) {
      curr[j] = longer[i - 1] === shorter[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
    }
    // swap rows
    const tmp = prev; prev = curr; curr = tmp;
    curr.fill(0);
  }
  return (2 * prev[shorter.length]) / (a.length + b.length);
}

/**
 * From an indexed array of { fn:{file,name,startLine}, tokens, signature },
 * find all cross-file duplicate pairs above FLAG_THRESHOLD.
 * Applies: same-file skip, token-length-ratio guard (< 0.6), LCS verification.
 * @param {Array<{fn:{file:string,name:string,startLine:number},tokens:string[],signature:Uint32Array}>} indexed
 * @returns {Array<{a:object,b:object,similarity:number}>}
 */
function findDuplicatePairs(indexed) {
  const pairs = [];
  const candidateKeys = findLshCandidatePairs(indexed.map((i) => i.signature));
  for (const key of candidateKeys) {
    const [aStr, bStr] = key.split('-');
    const a = indexed[+aStr];
    const b = indexed[+bStr];
    if (a.fn.file === b.fn.file) continue;  // same-file skip
    if (Math.min(a.tokens.length, b.tokens.length) /
        Math.max(a.tokens.length, b.tokens.length) < 0.6) continue;  // ratio guard
    const sim = lcsSimilarity(a.tokens, b.tokens);
    if (sim >= FLAG_THRESHOLD) {
      pairs.push({ a: a.fn, b: b.fn, similarity: sim });
    }
  }
  return pairs;
}

// ─── Function extraction ──────────────────────────────────────────────────────

/**
 * Normalize a function body token sequence for Type-2/3 structural comparison:
 *   - identifiers (except call targets) → 'VAR'
 *   - numeric literals → 'NUM'
 *   - operators, keywords, call targets are kept as-is
 * This makes renamed-identifier near-clones collide in MinHash space.
 * @param {string} blankedBody - blankSpans()-cleaned function body text
 * @returns {string[]} normalized token array
 */
function normalizeTokens(blankedBody) {
  // Tokenize: extract meaningful tokens from the blanked body
  // Keep keywords and punctuation; replace identifiers with VAR, numbers with NUM.
  // Call targets (word followed by '(') are kept as their name.
  const tokens = [];
  // Simple token regex: identifiers, numbers, operators, punctuation
  const TOKEN_RE = /([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)|([+\-*/%=<>!&|^~?:,;.[\]{}()])/g;
  const KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'instanceof', 'in', 'of', 'void', 'const', 'let', 'var', 'function',
    'class', 'extends', 'super', 'this', 'true', 'false', 'null', 'undefined',
    'import', 'export', 'default', 'async', 'await', 'yield', 'static', 'get', 'set',
  ]);

  // First pass: collect raw tokens with positions
  const raw = [];
  let m;
  while ((m = TOKEN_RE.exec(blankedBody)) !== null) {
    raw.push({ val: m[0], kind: m[1] ? 'id' : m[2] ? 'num' : 'op', pos: m.index });
  }

  // Second pass: normalize
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];
    if (tok.kind === 'num') {
      tokens.push('NUM');
    } else if (tok.kind === 'op') {
      tokens.push(tok.val);
    } else {
      // identifier: keep if keyword or call target
      if (KEYWORDS.has(tok.val)) {
        tokens.push(tok.val);
      } else {
        // Is this a call target? Look for the next non-whitespace token
        const next = raw[i + 1];
        if (next && next.val === '(') {
          // Keep call target names — they are semantically significant
          tokens.push(tok.val);
        } else {
          tokens.push('VAR');
        }
      }
    }
  }
  return tokens;
}

/**
 * Extract named functions from source text using brace-balanced regex over
 * blankSpans()-cleaned source. Extracts:
 *   - named function declarations: function name(...) { ... }
 *   - const/let/var arrow/function expressions: const name = (...) => { ... }
 *   - const/let/var function expressions: const name = function(...) { ... }
 * Skips anonymous/immediately-invoked patterns.
 * Records name + startLine for each function.
 *
 * @param {string} src - raw source text
 * @returns {Array<{name:string, startLine:number, body:string}>}
 */
function extractFunctions(src) {
  const functions = [];
  const blanked = conventions.blankSpans(src);

  // Pattern 1: named function declarations
  // function name (...) {
  const NAMED_FN_RE = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  // Pattern 2: const/let/var name = function(...) {
  const VAR_FN_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*(?:[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*\{/g;
  // Pattern 3: const/let/var name = (...) => {
  const ARROW_FN_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/g;
  // Pattern 4: class methods — methodName(...) {  (not constructors for simplicity)
  const METHOD_RE = /\b([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;

  const patterns = [
    { re: NAMED_FN_RE, priority: 1 },
    { re: VAR_FN_RE, priority: 2 },
    { re: ARROW_FN_RE, priority: 3 },
    { re: METHOD_RE, priority: 4 },
  ];

  // METHOD_RE also matches control-flow heads (if/for/while/...). Skip those so
  // they are never extracted as functions. Declared-form matches (priorities
  // 1-3) already claim their bodyStart via `seen`, so a real method is only
  // picked up here when no earlier pattern matched it.
  const CONTROL_FLOW = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'do', 'else',
    'with', 'await', 'yield', 'case', 'throw', 'typeof', 'void', 'delete', 'in', 'of', 'new',
  ]);

  const seen = new Set(); // avoid double-extraction at the same offset

  for (const { re } of patterns) {
    let m;
    while ((m = re.exec(blanked)) !== null) {
      const name = m[1];
      if (CONTROL_FLOW.has(name)) continue;
      const bodyStart = m.index + m[0].length - 1; // position of opening '{'

      if (seen.has(bodyStart)) continue;
      seen.add(bodyStart);

      // Count startLine
      const startLine = (src.slice(0, m.index).match(/\n/g) || []).length + 1;

      // Extract brace-balanced body
      let depth = 1;
      let i = bodyStart + 1;
      while (i < blanked.length && depth > 0) {
        if (blanked[i] === '{') depth++;
        else if (blanked[i] === '}') depth--;
        i++;
      }
      const body = src.slice(bodyStart, i);

      // Use blankedBody for tokenization (safe from string/comment contents)
      const blankedBody = blanked.slice(bodyStart, i);
      const tokens = normalizeTokens(blankedBody);

      if (tokens.length >= MIN_BODY_TOKENS) {
        functions.push({ name, startLine, body, tokens });
      }
    }
  }

  return functions;
}

// ─── Allowlist matching ────────────────────────────────────────────────────────

/**
 * Simple glob-prefix match: pattern is a glob like 'a-*.cjs' or 'bin/lib/**'.
 * Converts * to match any non-separator chars and ** to match anything.
 * This is intentionally simple (not a full glob engine per RESEARCH §Alternatives).
 * @param {string} pattern
 * @param {string} filePath - cwd-relative path
 * @returns {boolean}
 */
function globMatch(pattern, filePath) {
  // Escape special regex chars except *, then expand globs: ** (any depth,
  // crosses separators) before * (single path segment). The escape step leaves
  // * untouched, so the ** match is on the literal pattern, not the escaped form.
  const reStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DSTAR__/g, '.*');
  const re = new RegExp('^' + reStr + '$');
  return re.test(filePath);
}

/**
 * Check if a pair (fileA, fileB) matches an allowlist entry (either order).
 * @param {string} fileA
 * @param {string} fileB
 * @param {{a:string,b:string,reason:string}} entry
 * @returns {string|null} reason string if matched, null if not
 */
function matchAllowEntry(fileA, fileB, entry) {
  if ((globMatch(entry.a, fileA) && globMatch(entry.b, fileB)) ||
      (globMatch(entry.a, fileB) && globMatch(entry.b, fileA))) {
    return entry.reason || 'intentional';
  }
  return null;
}

// ─── Skipped sentinel ─────────────────────────────────────────────────────────

function dupSkipped(reason) {
  return { skipped: true, reason, pairs: [], suppressed: [] };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Detect structural near-clone pairs across a file corpus.
 *
 * @param {string[]} corpus - cwd-relative file paths
 * @param {{cwd?:string, allow?:{pairs:Array,ignore:Array}}|undefined} opts
 * @returns {{ skipped:false, pairs:Array, suppressed:Array } | { skipped:true, reason:string, pairs:[], suppressed:[] }}
 */
function detect(corpus, opts) {
  try {
    if (!Array.isArray(corpus)) {
      return dupSkipped('invalid-input: corpus must be an array');
    }

    const o = (opts && typeof opts === 'object') ? opts : {};
    const cwd = (typeof o.cwd === 'string' && o.cwd) ? o.cwd : process.cwd();
    const allow = o.allow && typeof o.allow === 'object' ? o.allow : { pairs: [], ignore: [] };
    const allowPairs = Array.isArray(allow.pairs) ? allow.pairs : [];

    // Index all functions from the corpus
    const indexed = [];

    // Reuse sanitizePaths for path safety
    const safePaths = conventions.sanitizePaths(corpus);

    for (const relPath of safePaths) {
      let src;
      try {
        const absPath = path.resolve(cwd, relPath);
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > (512 * 1024)) continue;  // MAX_SCAN_BYTES
        src = fs.readFileSync(absPath, 'utf8');
      } catch {
        continue;  // one bad file never fails the run
      }

      let fns;
      try {
        fns = extractFunctions(src);
      } catch {
        continue;
      }

      for (const fn of fns) {
        const shingles = buildShingles(fn.tokens);
        const signature = minHashSignature(shingles);
        indexed.push({
          fn: { file: relPath, name: fn.name, startLine: fn.startLine },
          tokens: fn.tokens,
          signature,
        });
      }
    }

    // Find duplicate pairs
    const rawPairs = findDuplicatePairs(indexed);

    // Apply allowlist: suppress matched pairs
    const pairs = [];
    const suppressed = [];

    for (const pair of rawPairs) {
      let matched = null;
      for (const entry of allowPairs) {
        const reason = matchAllowEntry(pair.a.file, pair.b.file, entry);
        if (reason) { matched = reason; break; }
      }
      if (matched) {
        suppressed.push({ a: pair.a, b: pair.b, similarity: pair.similarity, reason: matched });
      } else {
        pairs.push(pair);
      }
    }

    // Sort both arrays deterministically (by file+startLine)
    const sortKey = (p) => `${p.a.file}:${p.a.startLine}:${p.b.file}:${p.b.startLine}`;
    pairs.sort((x, y) => sortKey(x) < sortKey(y) ? -1 : sortKey(x) > sortKey(y) ? 1 : 0);
    suppressed.sort((x, y) => sortKey(x) < sortKey(y) ? -1 : sortKey(x) > sortKey(y) ? 1 : 0);

    return { skipped: false, pairs, suppressed };
  } catch (err) {
    return dupSkipped('exception: ' + (err && err.message ? err.message : String(err)));
  }
}

// ─── Exports (internals exposed for tests per conventions.cjs tail) ─────────

module.exports = {
  detect,
  // internals exposed for tests:
  buildShingles,
  minHashSignature,
  findLshCandidatePairs,
  lcsSimilarity,
  findDuplicatePairs,
};
