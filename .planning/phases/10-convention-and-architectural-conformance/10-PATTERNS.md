# Phase 10: Convention and Architectural Conformance - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7 (every file has a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bin/lib/conventions.cjs` (NEW) | utility (deterministic lib module) | transform (text-in -> structured-result-out) | `bin/lib/drift.cjs` + `bin/lib/schema-detect.cjs` | exact (same `bin/lib` contract) |
| `bin/lib/verify.cjs` (MODIFY) | command (JSON subcommand handler) | request-response (args -> JSON) | `cmdVerifySchemaDrift` / `cmdVerifyCodebaseDrift` in same file | exact (sibling function) |
| `bin/lib/verify-command-router.cjs` (MODIFY) | route (dispatch) | request-response | the `schema-drift` / `codebase-drift` branches in same file | exact |
| `sdk/src/query/command-manifest.verify.ts` (MODIFY) | config (manifest) | static data | `verify.schema-drift` manifest entry | exact |
| `bin/lib/command-aliases.generated.cjs` (REGEN) | config (generated) | static data | the `verify.schema-drift` generated entry | exact (do not hand-edit; regenerate) |
| `tests/conventions.test.cjs` (NEW) | test | batch (assertions) | `tests/base-branch-resolver.test.cjs` | exact (zero-dep harness) |
| `.github/workflows/check-drift.yml` (MODIFY) | config (CI) | batch | the `user-docs-jargon` / `mcp-stdio-framing` jobs | exact |
| `agents/gsd-pattern-mapper.md` (MODIFY) | agent def (markdown) | n/a | existing Step 5 -> Step 6 insertion | insertion point only |
| `agents/gsd-code-reviewer.md` (MODIFY) | agent def (markdown) | n/a | existing `<adversarial_stance>` tier block | insertion point only |
| `workflows/code-review.md` (MODIFY) | workflow (markdown) | n/a | existing fallow structural pre-pass Bash step | insertion point only |

> The three markdown files (mapper, reviewer, review-workflow) are insertion-point edits, documented in **Insertion Points** below. The load-bearing analog work is the CJS substrate: the module, the verify subcommand, the router branch, the manifest/alias entry, the test, and the CI job. Those carry full excerpts.

---

## Pattern Assignments

### `bin/lib/conventions.cjs` (NEW — utility / transform)

**Analog:** `bin/lib/drift.cjs` (module structure, never-throw contract, `skipped()` shape, path sanitization) + `bin/lib/schema-detect.cjs` (frozen `{pattern,label}` classifier table, `module.exports` shape).

**Module header + strict mode + imports** — copy from `bin/lib/drift.cjs:31-34`:
```js
'use strict';

const fs = require('node:fs');
const { platformWriteSync } = require('./shell-command-projection.cjs');
```
The conventions module needs `node:fs` (read the corpus files) and `node:path`. It does NOT need `platformWriteSync` unless it ever persists output — per research the mapper/reviewer own the writes, so omit it. Keep the imports to Node built-ins only (zero runtime deps, hard constraint).

**Frozen classifier table** — copy the shape from `bin/lib/schema-detect.cjs:17-37` (`SCHEMA_PATTERNS`) and `bin/lib/drift.cjs:44-61`:
```js
// Source: bin/lib/schema-detect.cjs:17 — frozen array of {pattern, label} rules
const SCHEMA_PATTERNS = [
  { pattern: /^src\/collections\/.*\.ts$/, orm: 'payload' },
  // ...
];
```
Use this exact shape for the casing-classification table (`CASING_RULES = [{ re, label }]`) and the architectural-idiom catalog. Classify with a first-match loop (see `classifyFile` at `drift.cjs:76-83`):
```js
// Source: bin/lib/drift.cjs:76 — first-match classifier, null/empty guarded
function classifyFile(file) {
  if (typeof file !== 'string' || !file) return null;
  const norm = file.replace(/\\/g, '/');
  if (MIGRATION_RES.some((r) => r.test(norm))) return 'migration';
  // ...
  return null;
}
```

**Never-throw contract + `skipped()` shape** — copy from `bin/lib/drift.cjs:121-229`. This is the load-bearing pattern: validate input at the top, wrap the whole body in try/catch, return a `skipped` result on any bad input or exception. NEVER throw.
```js
// Source: bin/lib/drift.cjs:121 — entry guard + try/catch wrapping the whole body
function detectDrift(input) {
  try {
    if (!input || typeof input !== 'object') {
      return skipped('invalid-input');
    }
    // ...pure logic...
    return { skipped: false, elements, /* ... */ };
  } catch (err) {
    // Non-blocking: never throw from this function.
    return skipped('exception:' + (err && err.message ? err.message : String(err)));
  }
}

// Source: bin/lib/drift.cjs:218 — uniform skipped() with the SAME field set as the
// success path, so callers never branch on shape.
function skipped(reason) {
  return {
    skipped: true,
    reason,
    elements: [],          // mirror the success-path fields, emptied
    actionRequired: false,
    directive: 'none',
    // ...
  };
}
```
Apply to BOTH public functions: `deriveConventions(files)` returns `{ skipped:false, axes:[...] }` or `skipped('insufficient-data'|'invalid-input'|'exception:...')`; `checkConformance(changedFiles, derived)` returns `{ skipped:false, findings:[...] }` or a skipped shape with `findings: []`. The skipped shape MUST include the same keys (emptied) the success path returns so the reviewer/mapper never crash on a skip.

**Path sanitization (security, V5)** — copy `SAFE_PATH_RE` (`drift.cjs:66`) and `sanitizePaths` (`drift.cjs:292-302`) verbatim; reuse them before any `--files` path is read or spliced into a prompt:
```js
// Source: bin/lib/drift.cjs:66 — no traversal, no absolute, no shell metachars
const SAFE_PATH_RE = /^(?!.*\.\.)(?:[A-Za-z0-9_.][A-Za-z0-9_.\-]*)(?:\/[A-Za-z0-9_.][A-Za-z0-9_.\-]*)*$/;

// Source: bin/lib/drift.cjs:292
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
```

**`module.exports` shape** — copy `bin/lib/drift.cjs:369-379` (named exports object, helpers exposed for tests/CLI reuse):
```js
// Source: bin/lib/drift.cjs:369
module.exports = {
  deriveConventions,
  checkConformance,
  // expose internals the test harness and CLI reuse:
  summarizeAxis,
  classifyCasing,
  sanitizePaths,
};
```

**Result-payload finding shape (D-03, never-block).** Each finding object MUST carry the advisory tier and never set a blocking flag. Mirror `schema-detect.cjs`'s explicit `blocking:` field (`schema-detect.cjs:142,156,180`) but pin it false:
```js
// Each finding: tier 'CONVENTION', never blocks, recommend-fix framing
{ tier: 'CONVENTION', blocking: false, file, line, deviation, convention, fix }
```
`schema-detect.cjs` returns `blocking: true` for its gate — invert that: the CONVENTION tier is ALWAYS `blocking: false`. Test D-03 asserts no finding has `blocking: true`.

---

### `bin/lib/verify.cjs` (MODIFY — add `cmdVerifyConventions`)

**Analog:** `cmdVerifySchemaDrift` (`verify.cjs:1188-1262`) and `cmdVerifyCodebaseDrift` (`verify.cjs:1272-...`), same file.

**Function signature + lazy require + usage error** — copy `verify.cjs:1188-1194`:
```js
// Source: bin/lib/verify.cjs:1188
function cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw) {
  const { detectSchemaFiles, checkSchemaDrift } = require('./schema-detect.cjs');

  if (!phaseArg) {
    error('Usage: verify schema-drift <phase> [--skip]');
    return;
  }
  // ...
}
```
New: `function cmdVerifyConventions(cwd, opts, raw)` that lazily `require('./conventions.cjs')`, parses `--derive`/`--check`/`--scope`/`--files`, and on bad usage calls `error('Usage: verify conventions (--derive --scope <dir> | --check --files a,b,c)')`.

**JSON emission via `output(...)`** — copy the `output({...}, raw)` calls at `verify.cjs:1200,1253-1261`:
```js
// Source: bin/lib/verify.cjs:1253 — flat snake_case JSON keys, raw passthrough
output({
  drift_detected: result.driftDetected,
  blocking: result.blocking,
  schema_files: result.schemaFiles,
  // ...
  skipped: result.skipped || false,
}, raw);
```
`output` is imported from `./core.cjs` (`verify.cjs:8`); it is defined at `core.cjs:221-244` and already handles the >50KB tmpfile spill. Emit a stable snake_case shape, e.g. `output({ derived: {...}, findings: [...], skipped: false }, raw)`.

**Never-exit-nonzero contract for the subcommand** — copy the `cmdVerifyCodebaseDrift` pattern (`verify.cjs:1272-1303`): every failure path emits a `{ skipped: true, reason }` JSON and returns; the command never exits non-zero, so the review/plan gate cannot fail the phase.
```js
// Source: bin/lib/verify.cjs:1272 — emit() wrapper + skipped JSON on every failure
function cmdVerifyCodebaseDrift(cwd, raw) {
  const drift = require('./drift.cjs');
  const emit = (payload) => output(payload, raw);
  try {
    // ...
    if (!fs.existsSync(structurePath)) {
      emit({ skipped: true, reason: 'no-structure-md', action_required: false, /* ... */ });
      return;
    }
    // ...
  } catch (err) { emit({ skipped: true, reason: 'exception:' + err.message }); }
}
```

**Add to `module.exports`** — append `cmdVerifyConventions` to the export object at `verify.cjs:1399-1412` (after `cmdVerifyCodebaseDrift`).

---

### `bin/lib/verify-command-router.cjs` (MODIFY — add `conventions` branch)

**Analog:** the `schema-drift` branch (`verify-command-router.cjs:20-26`), same file.
```js
// Source: bin/lib/verify-command-router.cjs:20
} else if (subcommand === 'schema-drift') {
  const rest = args.slice(2);
  const skipFlag = rest.includes('--skip');
  const phaseArg = rest.find((arg) => !arg.startsWith('-'));
  verify.cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw);
} else if (subcommand === 'codebase-drift') {
  verify.cmdVerifyCodebaseDrift(cwd, raw);
} else {
  error(`Unknown verify subcommand. Available: ${VERIFY_SUBCOMMANDS.join(', ')}`);
}
```
Add a `} else if (subcommand === 'conventions') {` branch before the final `else`: parse `args.slice(2)` for `--derive`/`--check`/`--scope <dir>`/`--files <csv>`, then call `verify.cmdVerifyConventions(cwd, parsedOpts, raw)`. `VERIFY_SUBCOMMANDS` (the unknown-subcommand help list) is sourced from the generated manifest — adding the manifest entry (next file) auto-updates that list.

> Note: `gsd-tools.cjs` itself does NOT need editing for the subcommand body — its `case 'verify':` (`gsd-tools.cjs:610-619`) already delegates wholesale to `routeVerifyCommand`. The `gsd-tools.cjs` usage-comment block (`gsd-tools.cjs:114-115`) lists `verify schema-drift` / `verify codebase-drift`; add a `verify conventions` line there for the help text.

---

### `sdk/src/query/command-manifest.verify.ts` (MODIFY) + `bin/lib/command-aliases.generated.cjs` (REGEN)

**Analog:** the `verify.schema-drift` manifest entry (`command-manifest.verify.ts:13-14`).
```ts
// Source: sdk/src/query/command-manifest.verify.ts:13
{ family: 'verify', canonical: 'verify.schema-drift', aliases: ['verify schema-drift'], mutation: false, outputMode: 'json' },
{ family: 'verify', canonical: 'verify.codebase-drift', aliases: ['verify codebase-drift'], mutation: false, outputMode: 'json' },
```
Add:
```ts
{ family: 'verify', canonical: 'verify.conventions', aliases: ['verify conventions'], mutation: false, outputMode: 'json' },
```
**This resolves Open Question 2 / assumption A5:** `command-aliases.generated.cjs` (the CJS routing source for `VERIFY_SUBCOMMANDS`) is GENERATED from the TS manifest via `sdk/scripts/gen-command-aliases.ts`, and `sdk/scripts/check-command-aliases-fresh.mjs` gates freshness in CI. Do NOT hand-edit `command-aliases.generated.cjs` (`command-aliases.generated.cjs:3-6` says GENERATED). Instead: edit the TS manifest, rebuild the SDK (`sdk/dist`), run the alias generator, and commit the regenerated `command-aliases.generated.cjs` (which will gain the `verify.conventions` entry mirroring lines 227-239's `verify.schema-drift` block). The CJS<->SDK dual-source here is itself an instance of the contested split this milestone surfaces.

---

### `tests/conventions.test.cjs` (NEW — test / zero-dep harness)

**Analog:** `tests/base-branch-resolver.test.cjs` (entire file, 96 lines).

**Shebang + strict + built-in-only requires** — copy `base-branch-resolver.test.cjs:1-18`:
```js
#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const conventions = require('../bin/lib/conventions.cjs');
```

**Bare `check(name, fn)` runner + failure counter** — copy `base-branch-resolver.test.cjs:20-24`:
```js
// Source: tests/base-branch-resolver.test.cjs:20
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}
```

**Test bodies use `node:assert`** — copy the assertion style at `base-branch-resolver.test.cjs:38-69`:
```js
// Source: tests/base-branch-resolver.test.cjs:38
check('resolveBaseBranch is exported', () => {
  assert.strictEqual(typeof core.resolveBaseBranch, 'function');
});
```

**Integration check spawns gsd-tools via child_process** — copy `base-branch-resolver.test.cjs:26-36,64-69` (`cp.execSync` of `gsd-tools.cjs`, assert the parsed shape):
```js
// Source: tests/base-branch-resolver.test.cjs:64
check('CLI subcommand prints expected', () => {
  const out = cp.execSync(`node "${path.join(__dirname, '..', 'bin', 'gsd-tools.cjs')}" base-branch`, { cwd: d, encoding: 'utf8' });
  assert.strictEqual(out.trim(), 'master');
});
```
For conventions, spawn `... verify conventions --check --files a,b` and `JSON.parse` stdout, asserting `tier === 'CONVENTION'` and no `blocking: true`.

**Exit code + summary footer** — copy `base-branch-resolver.test.cjs:93-96` verbatim:
```js
// Source: tests/base-branch-resolver.test.cjs:93
for (const d of tmps) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

if (failures) { console.error(`\nbase-branch-resolver: ${failures} failure(s)`); process.exit(1); }
console.log('\nbase-branch-resolver: all checks passed');
```
Cover the Research Test Map: CONV-01 (named >=70%, contested below, entropy ~0 / ~1), CONV-02 (flag deviating / pass conforming / never flag contested axis), CONV-03 (read-verb+mutation flagged, mutating-verb+pure body passes), CONV-04 (process.env vs injection, catch swallow/rethrow/wrap), D-03 (every finding `tier:'CONVENTION'`, none `blocking:true`), D-05 (non-JS/TS input skips idiom checks gracefully, returns no findings not an error).

---

### `.github/workflows/check-drift.yml` (MODIFY — add a test job)

**Analog:** the `user-docs-jargon` job (`check-drift.yml:55-66`) — it runs a maintenance check AND a `node tests/<f>.test.cjs` in one job. Simplest mirror is the `mcp-stdio-framing` job (`check-drift.yml:33-42`), a single `node tests/<f>.test.cjs` step:
```yaml
# Source: .github/workflows/check-drift.yml:33
  mcp-stdio-framing:
    name: MCP stdio framing (regression for #3)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Run MCP stdio ndjson framing regression test
        run: node tests/mcp-stdio-framing.test.cjs
```
Add a `conventions` job with the same scaffold (checkout + setup-node@v4 node 22 + `run: node tests/conventions.test.cjs`). No `npm ci` needed (zero-dep test); only the `handoff-schema` job (`check-drift.yml:19-31`) installs devDeps for `ajv` — conventions does not.

---

## Insertion Points (markdown edits — terse, no analog excerpts needed)

> Per the minimize-workflow-tokens steer, keep these additions compact.

### `agents/gsd-pattern-mapper.md`
- **Where:** between Step 5 "Identify Shared Patterns" (`:136`) and Step 6 "Write PATTERNS.md" (`:145`). Add a Step 5.5 "Derive Conventions" that runs `node "$ROOT/bin/gsd-tools.cjs" verify conventions --derive --scope <dir>` via Bash and parses the JSON.
- **Output:** a new `## Conventions` section in PATTERNS.md (additive; existing analog output unchanged — D-02). Section shape per RESEARCH §Pattern 4 (axis table + contested-hotspot note that names the CJS<->SDK dual resolver).
- Resolve the `$ROOT` the standard way (RESEARCH §"Agent invocation"): `${CLAUDE_PLUGIN_ROOT:-...}` resolver form.

### `agents/gsd-code-reviewer.md`
- **Where:** the `<adversarial_stance>` classification list (`:28-31`) currently defines BLOCKER + WARNING only. Add a third tier line: `- **CONVENTION** — advisory consistency deviation; NEVER blocks, NEVER gates a merge; states the deviation, the derived convention it violates, and a suggested fix (recommend-fix framing).` (ranked below WARNING — D-03).
- **Where:** `<depth_levels>` (`:59-90`) is the home for the JS/TS rule packs (verb-vs-body, architectural-split); add the three checks there as language-aware checks that skip gracefully on no-pack languages (D-05).
- **Invocation:** reviewer calls the SAME module at review time via Bash: `node "$ROOT/bin/gsd-tools.cjs" verify conventions --check --files "<csv>"`, parses JSON, emits CONVENTION-tier findings into REVIEW.md. Standalone — does NOT depend on the mapper having run (D-04).

### `workflows/code-review.md`
- **Where:** the workflow already computes the changed-`files` set and has a Bash structural pre-pass step (the fallow block at `:354-403`) feeding the `spawn_reviewer` step (`:405`). The conventions call is the SAME shape: optional Bash pre-pass that runs `verify conventions --check --files "${REVIEW_FILES[@]}"` and either injects the JSON or lets the reviewer self-invoke. Prefer reviewer self-invocation (D-04 standalone); the workflow note is minimal.
- Use the existing `${CLAUDE_PLUGIN_ROOT:-...}` resolver already present at `:355`.

---

## Shared Patterns

### Never-throw / never-block contract
**Source:** `bin/lib/drift.cjs:121-229` (try/catch + `skipped()`), `bin/lib/schema-detect.cjs:142-230` (explicit `blocking:` field).
**Apply to:** `conventions.cjs` (both public functions), `cmdVerifyConventions` (emit `{skipped:true}` JSON, never exit non-zero), every CONVENTION finding (`blocking:false`, D-03). This is the load-bearing invariant of the whole phase: a missed or spurious finding costs a glance, never a blocked merge.

### Frozen `{re,label}` classifier table + first-match `classify()`
**Source:** `bin/lib/schema-detect.cjs:17-37,102-124`, `bin/lib/drift.cjs:44-83`.
**Apply to:** file-name casing rules, identifier casing rules, architectural-idiom catalog in `conventions.cjs`. Do not hand-roll if/else chains.

### JSON subcommand: manifest -> generated alias -> router -> handler -> `output()`
**Source chain:** `command-manifest.verify.ts:13` -> (generator) `command-aliases.generated.cjs:227-239` -> `verify-command-router.cjs:20-26` -> `verify.cjs:1188` (`cmdVerify*`) -> `core.cjs:221` (`output`).
**Apply to:** the `verify conventions` subcommand. Touch all four layers; the alias layer is REGENERATED, not edited.

### Path sanitization (security V5)
**Source:** `bin/lib/drift.cjs:66` (`SAFE_PATH_RE`), `:292-302` (`sanitizePaths`).
**Apply to:** every `--files` path before reading it or splicing into a prompt. Reuse the helper, do not re-derive the regex.

### Zero-dep test harness
**Source:** `tests/base-branch-resolver.test.cjs` (full file).
**Apply to:** `tests/conventions.test.cjs`. `node:assert` + bare `check()` + failure counter + `process.exit(1)` footer. No jest/vitest. CI runs it directly via `node tests/conventions.test.cjs`.

---

## No Analog Found

None. Every Phase 10 file maps to an existing in-repo pattern. The novel logic (normalized Shannon entropy, verb taxonomy, brace-balanced body slicing) lives INSIDE `conventions.cjs` and has no in-repo analog, but its container (module shape, never-throw, classifier tables, exports) is fully patterned. For the entropy/verb/idiom internals, the planner should use RESEARCH.md's Code Examples (§"Normalized Shannon entropy", §"Identifier extraction", §Pattern 6, §Pattern 7) — those are the spec, not a copy-from-codebase.

| Internal logic (no codebase analog — use RESEARCH.md spec) | Source in RESEARCH.md |
|------------------------------------------------------------|-----------------------|
| `summarizeAxis` (entropy + dominance) | §Code Examples "Normalized Shannon entropy + dominance" |
| `extractIdentifiers` (regex, string-blanking pre-pass) | §Code Examples "Identifier extraction" + §Pitfall 2 |
| Verb taxonomy + verb-vs-body | §Pattern 6 |
| Architectural-split (DI-vs-env, catch classification) | §Pattern 7 |

---

## Metadata

**Analog search scope:** `bin/lib/`, `bin/`, `tests/`, `.github/workflows/`, `sdk/src/query/`, `agents/`, `workflows/`.
**Files scanned:** drift.cjs, schema-detect.cjs, verify.cjs (targeted), verify-command-router.cjs, command-aliases.generated.cjs, command-manifest.verify.ts, base-branch-resolver.test.cjs, check-drift.yml, gsd-tools.cjs (targeted), core.cjs (output helper), gsd-pattern-mapper.md, gsd-code-reviewer.md, code-review.md.
**Pattern extraction date:** 2026-06-26
