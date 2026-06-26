/**
 * Convention Derivation + Conformance (Phase 10, plan 10-01).
 *
 * The single deterministic source of truth (D-04) for:
 *   - deriveConventions(files, opts)  → 4-axis majority-vote derivation
 *       (file-name casing, identifier casing, export style, import style)
 *       with normalized Shannon entropy + a 0.70 dominance / 8-sample gate.
 *   - checkConformance(changedFiles, derived) → per-file advisory findings
 *       (casing deviation, verb-vs-body intent, architectural-split), all at
 *       the never-blocking `CONVENTION` tier (D-03).
 *
 * Called by BOTH gsd-pattern-mapper (writes the PATTERNS.md Conventions
 * section) and gsd-code-reviewer (emits CONVENTION-tier findings). No second
 * extraction implementation anywhere — building a CJS twin and an SDK twin of
 * this derivation would itself be the drift this milestone exists to surface.
 *
 * Design (mirrors bin/lib/drift.cjs + bin/lib/schema-detect.cjs):
 *   - Pure. Node built-ins only (node:fs, node:path) — zero new runtime dep.
 *   - NEVER throws. Both public functions validate input, wrap the body in
 *     try/catch, and return a `{ skipped: true, reason, ... }` result whose
 *     field set mirrors the success path emptied, so callers never branch on
 *     shape.
 *   - Idiom checks (verb-vs-body, architectural-split) are JS/TS rule packs;
 *     on a non-JS/TS file they skip gracefully (D-05) — never an error.
 *   - Every finding is `{ tier:'CONVENTION', blocking:false, ... }` (D-03).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── Constants ────────────────────────────────────────────────────────────────

// The four derivation axes (D-01).
const AXES = Object.freeze(['file-name-casing', 'identifier-casing', 'export-style', 'import-style']);

// File extensions the JS/TS idiom rule packs apply to (D-05). Other extensions
// still participate in the language-agnostic casing axes but skip idiom checks.
const JS_TS_RE = /\.(c|m)?[jt]sx?$/;

// A conservative allowlist for path arguments (no `..`, no absolute, no shell
// metachars). Copied verbatim from bin/lib/drift.cjs:66 (security, V5 / T-10-01).
const SAFE_PATH_RE = /^(?!.*\.\.)(?:[A-Za-z0-9_.][A-Za-z0-9_.\-]*)(?:\/[A-Za-z0-9_.][A-Za-z0-9_.\-]*)*$/;

// Cap per-file scan size to keep regexes bounded (T-10-02 DoS).
const MAX_SCAN_BYTES = 512 * 1024;

// Frozen casing classifier table — first-match wins (mirrors schema-detect.cjs
// SCHEMA_PATTERNS and drift.cjs classifyFile shape). Order matters: CONSTANT
// before Pascal so ALL_CAPS does not fall through to Pascal; kebab/snake before
// camel/Pascal so a single-token name lands on camel/Pascal not kebab/snake.
const CASING_RULES = Object.freeze([
  { re: /^[a-z0-9]+(-[a-z0-9]+)+$/, label: 'kebab' },
  { re: /^[a-z0-9]+(_[a-z0-9]+)+$/, label: 'snake' },
  { re: /^[A-Z0-9]+(_[A-Z0-9]+)*$/, label: 'CONSTANT' },
  { re: /^[a-z][a-zA-Z0-9]*$/, label: 'camel' },
  { re: /^[A-Z][a-zA-Z0-9]*$/, label: 'Pascal' },
]);

// Verb taxonomy (RESEARCH §Pattern 6, cherry-picked from VibeDrift).
const READ_VERBS = Object.freeze([
  'get', 'list', 'find', 'read', 'is', 'has', 'should', 'can', 'to',
  'compute', 'derive', 'select', 'resolve', 'parse', 'format',
]);
const MUTATE_VERBS = Object.freeze([
  'set', 'update', 'create', 'delete', 'remove', 'save', 'write', 'push',
  'add', 'insert', 'apply', 'mutate', 'upsert', 'sync', 'commit', 'register',
]);

// ─── Path sanitization (security V5 / T-10-01) ─────────────────────────────────

/**
 * Filter `paths` to only those safe to read or splice into a prompt. Drops any
 * path that is absolute, contains traversal, or has shell metachars.
 * Copied verbatim from bin/lib/drift.cjs:292-302.
 */
function sanitizePaths(paths) {
  if (!Array.isArray(paths)) return [];
  const out = [];
  for (const p of paths) {
    if (typeof p !== 'string') continue;
    if (p.startsWith('/')) continue;
    if (!SAFE_PATH_RE.test(p)) continue;
    out.push(p);
  }
  return out;
}

// ─── Casing classification ─────────────────────────────────────────────────────

/**
 * Classify an identifier/basename into a casing label. First-match over the
 * frozen CASING_RULES table; returns 'other' when nothing matches.
 * @param {string} name
 * @returns {'kebab'|'snake'|'camel'|'Pascal'|'CONSTANT'|'other'}
 */
function classifyCasing(name) {
  if (typeof name !== 'string' || !name) return 'other';
  for (const { re, label } of CASING_RULES) if (re.test(name)) return label;
  return 'other';
}

// ─── Source pre-pass: blank strings / templates / regex / comments (Pitfall 2) ──

/**
 * Replace the *contents* of string literals, template literals, regex literals,
 * and comments with spaces (preserving length and newlines) so a subsequent
 * brace count / identifier scan is not fooled by braces or keywords inside them.
 * Linear single pass (T-10-02: no backtracking).
 * @param {string} src
 * @returns {string}
 */
function blankSpans(src) {
  if (typeof src !== 'string') return '';
  const n = src.length;
  const out = new Array(n);
  let i = 0;
  let prevSignificant = ''; // last non-space significant char, to disambiguate `/`
  while (i < n) {
    const c = src[i];
    // line comment
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      out[i] = ' '; out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out[i] = src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    // string literals
    if (c === '"' || c === "'") {
      const quote = c;
      out[i] = c; i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
        out[i] = src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out[i] = quote; i++; }
      prevSignificant = quote;
      continue;
    }
    // template literal (does not handle nested ${} braces precisely; blanks whole span — acceptable for advisory tier)
    if (c === '`') {
      out[i] = c; i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
        out[i] = src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out[i] = '`'; i++; }
      prevSignificant = '`';
      continue;
    }
    // regex literal: a `/` is a regex start only when the previous significant
    // char suggests an expression position (not after an identifier, number, or `)`/`]`).
    if (c === '/' && !/[A-Za-z0-9_$)\]]/.test(prevSignificant)) {
      out[i] = c; i++;
      let inClass = false;
      while (i < n && (src[i] !== '/' || inClass)) {
        if (src[i] === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        if (src[i] === '\n') break; // unterminated; bail
        out[i] = ' '; i++;
      }
      if (i < n && src[i] === '/') { out[i] = '/'; i++; }
      prevSignificant = '/';
      continue;
    }
    out[i] = c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  return out.join('');
}

// ─── Identifier extraction (regex over blanked source) ─────────────────────────

/**
 * Extract declared identifiers by kind. Approximate by design (advisory tier).
 * RESEARCH §Code Examples "Identifier extraction".
 * @param {string} src
 * @returns {{ fns: string[], consts: string[], classes: string[] }}
 */
function extractIdentifiers(src) {
  const blanked = blankSpans(src);
  const fns = [...blanked.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  const consts = [...blanked.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
  const classes = [...blanked.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  return { fns, consts, classes };
}

// ─── Per-file axis observation ─────────────────────────────────────────────────

/**
 * Tally one file's contribution to each axis. Returns null on unreadable/empty.
 * @param {string} file - repo-relative path
 * @param {string} src - source text
 */
function observeFile(file, src) {
  if (typeof src !== 'string' || !src) return null;
  const blanked = blankSpans(src);
  const obs = { 'file-name-casing': {}, 'identifier-casing': {}, 'export-style': {}, 'import-style': {} };

  // file-name casing (basename without extension), language-agnostic
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  obs['file-name-casing'][classifyCasing(base)] = 1;

  // identifier casing: functions + classes (skip consts — they mix value/const
  // styles too much to be a clean axis; functions+classes are the signal)
  const { fns, classes } = extractIdentifiers(src);
  for (const name of [...fns, ...classes]) {
    const label = classifyCasing(name);
    obs['identifier-casing'][label] = (obs['identifier-casing'][label] || 0) + 1;
  }

  // export style (CJS vs ESM), per file → count once each direction present
  const hasCjsExport = /\bmodule\.exports\b/.test(blanked) || /\bexports\.[A-Za-z_$]/.test(blanked);
  const hasEsmExport = /\bexport\s+(default\s+|const\s+|function\s+|class\s+|\{|\*)/.test(blanked);
  if (hasCjsExport) obs['export-style'].cjs = 1;
  if (hasEsmExport) obs['export-style'].esm = 1;

  // import style (require vs import)
  const hasRequire = /\brequire\s*\(/.test(blanked);
  const hasImport = /\bimport\s+[^;]*\bfrom\b/.test(blanked) || /\bimport\s*\(/.test(blanked);
  if (hasRequire) obs['import-style'].cjs = 1;
  if (hasImport) obs['import-style'].esm = 1;

  return obs;
}

// ─── Axis summary: normalized entropy + dominance (CONV-01) ────────────────────

/**
 * Summarize a variant tally into a named / contested / insufficient-data axis
 * verdict. Normalized Shannon entropy H_norm = -Σ p·log(p) / log(n);
 * 0 = single variant, 1 = perfectly even. Dominance = max share.
 * RESEARCH §Code Examples "Normalized Shannon entropy + dominance".
 * @param {Object} counts - { variant: n }
 * @param {Object} [opts] - { minSamples=8, dominanceThreshold=0.70 }
 */
function summarizeAxis(counts, opts = {}) {
  const minSamples = opts.minSamples ?? 8;
  const dominanceThreshold = opts.dominanceThreshold ?? 0.70;
  const safeCounts = counts && typeof counts === 'object' ? counts : {};
  const variants = Object.entries(safeCounts).filter(([, n]) => typeof n === 'number' && n > 0);
  const total = variants.reduce((s, [, n]) => s + n, 0);
  if (total < minSamples || variants.length === 0) {
    return { status: 'insufficient-data', total, dominant: null, share: 0, entropy: null, contested: false, variants: Object.fromEntries(variants) };
  }
  variants.sort((a, b) => b[1] - a[1]);
  const [domName, domN] = variants[0];
  const share = domN / total;
  let H = 0;
  for (const [, n] of variants) { const p = n / total; H -= p * Math.log(p); }
  const Hnorm = variants.length > 1 ? H / Math.log(variants.length) : 0;
  const contested = share < dominanceThreshold;
  return {
    status: contested ? 'contested' : 'named',
    dominant: contested ? null : domName,
    share,
    entropy: Number(Hnorm.toFixed(3)),
    contested,
    total,
    variants: Object.fromEntries(variants),
  };
}

// ─── deriveConventions (CONV-01) ───────────────────────────────────────────────

function derivedSkipped(reason) {
  return { skipped: true, reason, axes: [] };
}

/**
 * Derive the four conventions by majority vote over a list of source files.
 * NEVER throws — returns a skipped result on bad input or any exception.
 * @param {string[]} files - repo-relative paths (sanitized internally)
 * @param {Object} [opts] - { minSamples, dominanceThreshold, scope, cwd, sources }
 *   - opts.scope: optional directory subtree to judge against (CONV-01 / Pitfall 1).
 *   - opts.sources: optional Map/object of { path: src } to avoid disk reads (tests).
 * @returns {{ skipped:false, axes:Object[] } | { skipped:true, reason, axes:[] }}
 */
function deriveConventions(files, opts = {}) {
  try {
    if (!Array.isArray(files)) return derivedSkipped('invalid-input');
    const cwd = opts.cwd || process.cwd();
    const sources = opts.sources && typeof opts.sources === 'object' ? opts.sources : null;
    let list = sanitizePaths(files);
    if (opts.scope && typeof opts.scope === 'string') {
      const norm = opts.scope.replace(/\\/g, '/').replace(/\/+$/, '');
      list = list.filter((p) => p.replace(/\\/g, '/').startsWith(norm + '/') || p === norm);
    }
    if (list.length === 0) return derivedSkipped('no-readable-files');

    const tallies = { 'file-name-casing': {}, 'identifier-casing': {}, 'export-style': {}, 'import-style': {} };
    let observed = 0;
    for (const rel of list) {
      let src;
      if (sources && Object.prototype.hasOwnProperty.call(sources, rel)) {
        src = sources[rel];
      } else {
        try {
          const full = path.resolve(cwd, rel);
          const stat = fs.statSync(full);
          if (!stat.isFile() || stat.size > MAX_SCAN_BYTES) continue;
          src = fs.readFileSync(full, 'utf8');
        } catch { continue; }
      }
      const obs = observeFile(rel, src);
      if (!obs) continue;
      observed++;
      for (const axis of AXES) {
        for (const [variant, n] of Object.entries(obs[axis])) {
          tallies[axis][variant] = (tallies[axis][variant] || 0) + n;
        }
      }
    }
    if (observed === 0) return derivedSkipped('no-readable-files');

    const axes = AXES.map((name) => Object.assign({ name }, summarizeAxis(tallies[name], opts)));
    return { skipped: false, axes };
  } catch (err) {
    return derivedSkipped('exception:' + (err && err.message ? err.message : String(err)));
  }
}

// ─── Architectural classification (CONV-04) ────────────────────────────────────

/**
 * Classify a source's architectural idioms: env access style + catch-block
 * handling style. Returns { envStyle, catchStyles }.
 * @param {string} src
 */
function classifyArchitecture(src) {
  const blanked = blankSpans(src);
  const envStyle = /\bprocess\.env\b/.test(blanked) ? 'direct-env' : 'injected';

  // Classify each catch block by scanning its brace-balanced body.
  const catchStyles = [];
  const catchRe = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = catchRe.exec(blanked)) !== null) {
    const bodyStart = catchRe.lastIndex; // just after the opening brace
    let depth = 1;
    let j = bodyStart;
    while (j < blanked.length && depth > 0) {
      const ch = blanked[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      j++;
    }
    const blankedBody = blanked.slice(bodyStart, j - 1);
    let style;
    if (/\bthrow\s+new\b/.test(blankedBody) || /\bcause\b/.test(blankedBody)) style = 'wrap';
    else if (/\bthrow\b/.test(blankedBody)) style = 'rethrow';
    else if (/\S/.test(blankedBody.replace(/\bconsole\.[a-z]+\s*\([^)]*\)\s*;?/g, ''))) style = 'swallow-partial';
    else style = 'swallow';
    catchStyles.push({ style, line: lineOf(src, bodyStart) });
  }
  return { envStyle, catchStyles };
}

// ─── Verb-vs-body intent (CONV-03) ─────────────────────────────────────────────

/**
 * Find read-verb functions whose body has a strong mutation signal on a
 * parameter / outer-scope name or side-effecting I/O. Flags only that
 * direction (Pattern 6); ignores local-array mutation (Pitfall 4).
 * @param {string} src
 * @returns {{ name:string, line:number }[]}
 */
function verbBodyViolations(src) {
  const blanked = blankSpans(src);
  const out = [];
  // function NAME(params) {  — capture name, param list, and body slice
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = fnRe.exec(blanked)) !== null) {
    const name = m[1];
    const verb = leadingVerb(name);
    if (!READ_VERBS.includes(verb)) continue; // only the read-verb direction
    const params = m[2].split(',').map((p) => p.trim().replace(/[=:].*$/, '').replace(/^\.\.\./, '').trim()).filter(Boolean);
    const bodyStart = fnRe.lastIndex;
    let depth = 1;
    let j = bodyStart;
    while (j < blanked.length && depth > 0) {
      const ch = blanked[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      j++;
    }
    const body = blanked.slice(bodyStart, j - 1);

    // locals declared inside the body are NOT side effects (Pitfall 4)
    const locals = new Set([
      ...[...body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((mm) => mm[1]),
    ]);

    let mutates = false;
    // 1) side-effecting I/O — always a strong signal
    if (/\bfs\.(writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|rmSync|unlinkSync)\b/.test(body)) mutates = true;
    if (/\bprocess\.env\.[A-Za-z_$][\w$]*\s*=/.test(body)) mutates = true;
    if (/\bawait\b[^\n;]*\.(write|save|update|create|delete|insert)\b/.test(body)) mutates = true;
    // 2) assignment to a parameter or outer-scope name (member-assign x.y = or x =)
    if (!mutates) {
      const assignRe = /([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*\s*=(?!=)/g;
      let a;
      while ((a = assignRe.exec(body)) !== null) {
        const target = a[1];
        if (params.includes(target) && !locals.has(target)) { mutates = true; break; }
      }
    }
    // 3) array mutation on a PARAMETER (not a local)
    if (!mutates) {
      const pushRe = /([A-Za-z_$][\w$]*)\.(push|pop|splice|shift|unshift)\s*\(/g;
      let pmm;
      while ((pmm = pushRe.exec(body)) !== null) {
        const target = pmm[1];
        if (params.includes(target) && !locals.has(target)) { mutates = true; break; }
      }
    }
    if (mutates) out.push({ name, line: lineOf(src, m.index) });
  }
  return out;
}

function leadingVerb(name) {
  // split a camelCase / snake_case identifier and take the first token, lowercased
  const head = String(name).replace(/[_-].*$/, '').replace(/([a-z0-9])([A-Z]).*$/, '$1');
  return head.toLowerCase();
}

function lineOf(src, index) {
  let line = 1;
  for (let k = 0; k < index && k < src.length; k++) if (src[k] === '\n') line++;
  return line;
}

// ─── checkConformance (CONV-02 + CONV-03 + CONV-04) ────────────────────────────

function conformanceSkipped(reason) {
  return { skipped: true, reason, findings: [] };
}

function finding(file, line, deviation, convention, fix) {
  return { tier: 'CONVENTION', blocking: false, file, line, deviation, convention, fix };
}

/**
 * Check each changed file against a derived contract. Emits findings ONLY for
 * axes whose status is 'named' (skips contested + insufficient-data — CONV-02).
 * Idiom rule packs (verb-vs-body, architectural-split) run on JS/TS files only;
 * non-JS/TS files skip them gracefully (D-05). NEVER throws.
 * @param {Array<{file:string, src:string}>} changedFiles
 * @param {Object} derived - the deriveConventions result
 * @returns {{ skipped:false, findings:Object[] } | { skipped:true, reason, findings:[] }}
 */
function checkConformance(changedFiles, derived) {
  try {
    if (!Array.isArray(changedFiles)) return conformanceSkipped('invalid-input');
    const axes = derived && Array.isArray(derived.axes) ? derived.axes : [];
    const named = {};
    for (const a of axes) if (a && a.status === 'named') named[a.name] = a;

    const findings = [];
    for (const entry of changedFiles) {
      if (!entry || typeof entry !== 'object') continue;
      const file = typeof entry.file === 'string' ? entry.file : '';
      const src = typeof entry.src === 'string' ? entry.src : '';
      if (!file) continue;

      // ── file-name-casing (language-agnostic, CONV-02) ──
      const fileAxis = named['file-name-casing'];
      if (fileAxis) {
        const base = path.basename(file).replace(/\.[^.]+$/, '');
        const got = classifyCasing(base);
        if (got !== fileAxis.dominant && got !== 'other') {
          findings.push(finding(
            file, 1,
            `file name casing is ${got} (${base})`,
            `file-name-casing should be ${fileAxis.dominant}`,
            `rename to ${fileAxis.dominant}-cased basename`,
          ));
        }
      }

      // ── idiom rule packs: JS/TS only (D-05) ──
      if (!JS_TS_RE.test(file)) continue;
      if (!src) continue;

      // identifier-casing (CONV-02) — functions/classes against the named axis
      const idAxis = named['identifier-casing'];
      if (idAxis) {
        const { fns, classes } = extractIdentifiers(src);
        for (const name of [...fns, ...classes]) {
          const got = classifyCasing(name);
          // classes are conventionally Pascal even under a camel function axis; don't flag them
          if (classes.includes(name)) continue;
          if (got !== idAxis.dominant && got !== 'other') {
            findings.push(finding(
              file, lineOf(src, src.indexOf(name)),
              `identifier casing is ${got} (${name})`,
              `identifier-casing should be ${idAxis.dominant}`,
              `rename ${name} to ${idAxis.dominant} case`,
            ));
          }
        }
      }

      // export-style / import-style (CONV-02) — only if NAMED (contested skipped)
      const blanked = blankSpans(src);
      const exportAxis = named['export-style'];
      if (exportAxis) {
        const hasCjs = /\bmodule\.exports\b/.test(blanked) || /\bexports\.[A-Za-z_$]/.test(blanked);
        const hasEsm = /\bexport\s+(default\s+|const\s+|function\s+|class\s+|\{|\*)/.test(blanked);
        const got = hasCjs && !hasEsm ? 'cjs' : (!hasCjs && hasEsm ? 'esm' : null);
        if (got && got !== exportAxis.dominant) {
          findings.push(finding(
            file, 1,
            `export style is ${got}`,
            `export-style should be ${exportAxis.dominant}`,
            `use the ${exportAxis.dominant} export style for this directory`,
          ));
        }
      }

      // ── CONV-03: verb-vs-body intent ──
      for (const v of verbBodyViolations(src)) {
        findings.push(finding(
          file, v.line,
          `verb-vs-body: read-verb function ${v.name} mutates state / does side-effecting I/O`,
          `read-verb names (get/list/find/read/...) should not mutate (intent mismatch)`,
          `rename ${v.name} to a mutating verb, or remove the side effect`,
        ));
      }

      // ── CONV-04: architectural-split (DI-vs-env + catch handling) ──
      // Ship conservatively (Pattern 7): classify, never throw; only surface a
      // catch-style note when a clearly-swallowed error appears. The dominant
      // env/catch style is corpus-derived; here we attach the per-file classification
      // as advisory findings without blocking.
      const arch = classifyArchitecture(src);
      void arch.envStyle; // env split is reported at the corpus level by the mapper; per-file flag deferred
      for (const c of arch.catchStyles) {
        if (c.style === 'swallow') {
          findings.push(finding(
            file, c.line,
            `catch block swallows the error (empty / no rethrow)`,
            `architectural-split: error handling — swallowed catches hide failures`,
            `rethrow, wrap (throw new Error(..., { cause })), or log-and-handle deliberately`,
          ));
        }
      }
    }

    return { skipped: false, findings };
  } catch (err) {
    return conformanceSkipped('exception:' + (err && err.message ? err.message : String(err)));
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  deriveConventions,
  checkConformance,
  // internals exposed for tests / CLI reuse:
  summarizeAxis,
  classifyCasing,
  sanitizePaths,
  // additional internals (handy for tests / the verify subcommand in 10-02):
  classifyArchitecture,
  extractIdentifiers,
  blankSpans,
};
