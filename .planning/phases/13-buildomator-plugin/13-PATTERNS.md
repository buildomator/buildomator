# Phase 13: Buildomator Plugin - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 8 (2 new, 4 modified, 2 read-only transform inputs)
**Analogs found:** 8 / 8 (all in-repo from Phase 12)

Phase 13 is almost entirely EXTENSION of Phase 12 machinery. Every new/modified file
has a concrete in-repo analog. The single genuinely-new artifact is the shared
transform helper module and its unit tests; everything else widens an existing
guard, test, CI job, or manifest stamp. There are NO no-analog files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bin/lib/bm-transform.cjs` (NEW) | utility/library | transform (string->string) | `bin/build-bm.cjs` exported pure helpers + `bin/maintenance/rewrite-command-namespace.cjs` regex | role-match (composite) |
| `bin/build-bm.cjs` (MODIFY) | build script | file-I/O + transform | itself (Phase 12 `generate()` / `stampBmManifest`) | exact (self) |
| `tests/build-bm-drift.test.cjs` (MODIFY) | test | transform assertions | itself (widen 2 cases) | exact (self) |
| `tests/bm-parity.test.cjs` (NEW, discretion) | test | inventory + integration | `tests/build-bm-drift.test.cjs` harness | exact |
| bm-transform unit tests (NEW; own file or folded into drift test) | test | pure I/O pairs | `tests/build-bm-drift.test.cjs` `stampBmManifest`/`shouldExclude` cases | exact |
| `.github/workflows/check-drift.yml` (MODIFY) | config/CI | request-response (job) | its own `bm-build-drift` job | exact (self) |
| `.github/workflows/install-smoke.yml` (MODIFY) | config/CI | request-response (job) | its own `bm-package-smoke` job | exact (self) |
| `hooks/hooks.json` (READ-ONLY input) | config | — | stamped by build, NEVER mutated (D-04) | n/a |
| `.claude-plugin/plugin.json` (READ-ONLY input) | config | — | stamped by build, NEVER mutated (D-05) | n/a |

Note on the two read-only inputs: D-04/D-05 stamp the COPIED bytes inside `generate()`.
The authored `hooks/hooks.json` and `.claude-plugin/plugin.json` are inputs to the
transform, not files this phase edits. Do not run the maintenance rewriter over `dist/`.

## Pattern Assignments

### `bin/lib/bm-transform.cjs` (NEW — utility/library, transform)

**Analogs (composite):**
- `bin/build-bm.cjs` lines 49-82 — the pure-exported-helper shape (JSDoc + `module.exports`)
- `bin/maintenance/rewrite-command-namespace.cjs` lines 62-91 — the anchored-substitution rewrite mechanics (but the colon form supersedes the skill-name alternation — see Shared Patterns / F-1)

**Module-header + zero-dep pattern** to copy from `bin/build-bm.cjs` lines 37-47:
```javascript
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
```
(bm-transform.cjs needs no `fs`/`child_process` for the pure string helpers; keep only
what it uses. Match the `'use strict';` + top-of-file JSDoc block convention.)

**Pure-helper + export shape** to copy from `bin/build-bm.cjs` lines 65-82, 221-223:
```javascript
/**
 * Return a stamped copy of the authored manifest for the bm package.
 * Mutates ONLY name, displayName, description; ...
 * Does not mutate its input.
 */
function stampBmManifest(srcManifest) { /* ... */ }
// ...
// Export pure helpers for tests; run main only when invoked directly.
module.exports = { stampBmManifest, shouldExclude };
```
New module exports the three (or two, if `stampBmManifest` stays in build-bm) pure
transform stages: `rewriteCommandRefs`, `stampHookFallback`, and optionally the moved
`stampBmManifest`. Each is a pure `string->string` / `object->object`.

**`rewriteCommandRefs` core pattern** — RESEARCH F-1 says do NOT reuse the skill-name
alternation from `rewrite-command-namespace.cjs` (it under-rewrites `/gsd:capture`,
`/gsd:local-patches`, `/gsd:edit-phase`, `/gsd:extract-learnings`). Use the anchored
colon substitution (RESEARCH Pattern 1, verified excerpt):
```javascript
function rewriteCommandRefs(text) {
  // Leading boundary: preceding char is not an identifier char, so `abcgsd:` and
  // `gsd://` (no leading slash) can never match. The `/` is part of the token.
  return text.replace(/(^|[^A-Za-z0-9])\/gsd:/g, '$1/bm:');
}
```

**`stampHookFallback` core pattern** — targeted literal stamp, NOT a blanket replace
(RESEARCH Pattern 2, verified excerpt):
```javascript
function stampHookFallback(hooksJsonText) {
  // Trailing plugin-name segment only; marketplace segment gsd-plugin stays (D-04).
  return hooksJsonText.split('cache/gsd-plugin/gsd').join('cache/gsd-plugin/bm');
}
```
Confirmed: `grep -c "cache/gsd-plugin/gsd" hooks/hooks.json` == **17** stamp targets.
Every occurrence is the fallback resolver's `const d=p.join(o.homedir(),'.claude/plugins/cache/gsd-plugin/gsd')`.
Identity tokens that MUST survive on the same lines: `gsd-tools.cjs`, `run-bash-hook.cjs`,
`gsd-*.js` hook filenames, `gsd-session-state.sh` / `gsd-validate-commit.sh` /
`gsd-phase-boundary.sh` args, and the `GSD:` stderr prefix (17x, Phase 15). The
`.split().join()` literal replace touches only the exact directory string, sparing all.

---

### `bin/build-bm.cjs` (MODIFY — build script, file-I/O + transform)

**Analog:** itself (the Phase 12 build). Two edit sites.

**Edit 1 — wire the text transform into `generate()`** (current copy loop, lines 105-120):
```javascript
/** Copy the included tree into `outDir` and write the stamped bm manifest. */
function generate(root, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of includedFiles(root)) {
    const src = path.join(root, rel);
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);          // <-- current: verbatim copy for EVERY file
  }
  const srcManifest = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const bmManifest = stampBmManifest(srcManifest);
  fs.writeFileSync(
    path.join(outDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify(bmManifest, null, 2) + '\n',
  );
  return srcManifest.version;
}
```
Replace the unconditional `fs.copyFileSync` with a text-file branch (RESEARCH Code
Examples, "Extending generate()"). CRITICAL (Pitfall 4): the rewrite must live INSIDE
`generate()` so the `--check` temp-dir regeneration runs identical logic — otherwise
`--check` reports every file as `differs:`. Binary files stay on `fs.copyFileSync`.
```javascript
const TEXT_EXT = /\.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)$/i;  // mirror rewrite-command-namespace.cjs line 67
// inside the loop:
if (TEXT_EXT.test(rel)) {
  let text = fs.readFileSync(src, 'utf8');
  text = rewriteCommandRefs(text);                                 // D-01/D-02
  if (rel === 'hooks/hooks.json') text = stampHookFallback(text);  // D-04
  fs.writeFileSync(dest, text);
} else {
  fs.copyFileSync(src, dest);
}
```
The `TEXT_EXT` set matches the existing `textExt` in `rewrite-command-namespace.cjs`
line 67 (`.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)`) — reuse that filter verbatim.

**Edit 2 — extend `stampBmManifest` for the mcpServers key** (current, lines 72-82):
```javascript
function stampBmManifest(srcManifest) {
  const brandedDescription =
    'Buildomator -- ' + String(srcManifest.description || '').replace(/^Get Shit Done -- /, '');
  return {
    ...srcManifest,
    name: 'bm',
    displayName: 'Buildomator',
    description: brandedDescription,
    version: srcManifest.version,
  };
}
```
D-05 adds the `mcpServers` gsd->bm rekey (RESEARCH excerpt). The authored manifest
(`.claude-plugin/plugin.json` lines 17-23) has exactly one `mcpServers.gsd` entry:
```javascript
  const out = { ...srcManifest, name: 'bm', displayName: 'Buildomator', description: brandedDescription, version: srcManifest.version };
  if (out.mcpServers && out.mcpServers.gsd && !out.mcpServers.bm) {
    out.mcpServers = { bm: out.mcpServers.gsd };  // server.cjs bytes unchanged
  }
  return out;
```
Note the current header comment (lines 65-71) says "mcpServers key stays 'gsd' per D-02"
— that comment must be updated to reflect D-05.

**Import the shared helpers** (if factored to `bin/lib/bm-transform.cjs`): add a
`require('./lib/bm-transform.cjs')` near the top and re-export from `module.exports`
(line 222) so the drift test can `require` them the same way it does today.

---

### `tests/build-bm-drift.test.cjs` (MODIFY — test)

**Analog:** itself. Two case edits (RESEARCH Wave 0 gap 2).

**Widen the whitelist walk** (current, lines 164-186). Today text files are asserted
byte-equal to raw source; they must be asserted equal to `T(source)`:
```javascript
check('whitelist walk: every included source file has a byte-equal copy (except stamped plugin.json)', () => {
  // ...
  for (const rel of included) {
    // ...
    if (rel === '.claude-plugin/plugin.json') {
      const a = readJson(path.join(ROOT, rel));
      const b = readJson(dest);
      for (const k of ['name', 'displayName', 'description']) { delete a[k]; delete b[k]; }
      try { assert.deepStrictEqual(a, b); } catch { mismatches.push(`stamp-diff: ${rel}`); }
      continue;
    }
    const src = fs.readFileSync(path.join(ROOT, rel));
    const cpy = fs.readFileSync(dest);
    if (!src.equals(cpy)) mismatches.push(`bytes: ${rel}`);   // <-- widen: compare cpy to T(src) for text files
  }
```
For text files, compare `cpy` against `T(readFileSync(src))` (rewriteCommandRefs, plus
stampHookFallback for `hooks/hooks.json`). The `plugin.json` branch must now also account
for `mcpServers` being rekeyed (delete/normalize `mcpServers` alongside the 3 stamped keys,
or assert the bm key explicitly).

**Update the two mcpServers assertions** (current, lines 79-88 and the SRC_MANIFEST fixture
lines 50-61). These currently assert the gsd key survives — flip to expect `bm`:
```javascript
check('stampBmManifest leaves every other key deep-equal (incl. gsd mcpServers)', () => {
  // ...
  assert.deepStrictEqual(out.mcpServers, SRC_MANIFEST.mcpServers);   // <-- change
  assert.ok(out.mcpServers.gsd, 'mcpServers.gsd must survive');      // <-- change to expect bm
});
```
RESEARCH is explicit: this is an EXPECTED test change (D-03/D-05), not a regression.
Rename the case and assert `out.mcpServers.bm` deep-equals the source gsd server config
and that `out.mcpServers.gsd` is now absent.

**Also update** the byte-equal case for `hooks/hooks.json` (current lines 156-162): today
it asserts `dist/bm/hooks/hooks.json` is byte-equal to source; after D-04 it must equal
`stampHookFallback(source)`, not raw source.

---

### `tests/bm-parity.test.cjs` (NEW, discretion — test) OR folded into the drift test

**Analog:** `tests/build-bm-drift.test.cjs` (the entire harness shape).

**Zero-dep harness header + runner** to copy from lines 1-39:
```javascript
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'bm');
const SCRIPT = path.join(ROOT, 'bin', 'build-bm.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}
```

**Footer** to copy from lines 228-232:
```javascript
if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll build-bm-drift tests passed');   // rename string
```

**Command-inventory parity (D-06a)** — enumerate `skills/*/SKILL.md` in source, assert an
identically-named counterpart exists in `dist/bm`. Reuse the `git ls-files -z` +
`shouldExclude` enumeration pattern from lines 164-168:
```javascript
const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
const files = listed.stdout.toString('utf8').split('\0').filter(Boolean);
```

**Strong `/gsd:` == 0 parity assertion (D-06b)** — RESEARCH "strong parity assertion"
excerpt (grep exits 1 on no match, so wrap in try/catch; a match is a failure):
```javascript
const { execFileSync } = require('child_process');
// After rebuild, no leading-slash /gsd: command reference remains in dist/bm.
// gsd:// URIs (38) and gsd-* identity strings survive because they lack the /gsd: shape.
let leaks = '';
try { leaks = execFileSync('grep', ['-rIl', '/gsd:', OUT], { encoding: 'utf8' }).trim(); }
catch (e) { /* grep exit 1 == no match == pass */ }
assert.strictEqual(leaks, '', `un-rewritten /gsd: refs leaked into dist/bm:\n${leaks}`);
```
Document (RESEARCH Pitfall 3) that Phase 14's deprecation nudge will relax this; the
primary gate remains `dist/bm == T(source)` byte-for-byte.

---

### bm-transform unit tests (NEW — test)

**Analog:** the `stampBmManifest` / `shouldExclude` pure-helper cases in
`tests/build-bm-drift.test.cjs` lines 43-129 (pure input/output pairs, no disk I/O).

**Required assertions (RESEARCH Wave 0 gap 3):**
- `rewriteCommandRefs`: DOES rewrite `/gsd:capture`, `/gsd:local-patches`, `/gsd:edit-phase`,
  `/gsd:extract-learnings`, `/gsd:plan-phase`; SPARES `gsd://config` (F-3: never
  leading-slash), `gsd-tools.cjs`, `gsd-sdk`, `cache/gsd-plugin/gsd`, and a bare
  `gsd:` with no leading slash/boundary.
- `stampHookFallback`: exactly the `cache/gsd-plugin/gsd` literal becomes
  `cache/gsd-plugin/bm`; `gsd-tools.cjs`, `run-bash-hook.cjs`, `GSD:` stderr, and
  `.sh`/`.js` hook filenames/args survive unchanged. Assert on a representative hooks.json
  line fixture (copy one of the 17 resolver strings).
- `stampBmManifest` (if moved): keep the existing lines 63-95 cases, updated for the bm key.

## Shared Patterns

### The single deterministic transform T (single-source it)
**Source of truth:** `bin/build-bm.cjs` `generate()` (build path) + `check()` (verify path,
lines 166-209).
**Apply to:** build-bm.cjs, both test files, both CI jobs.
`check()` already regenerates into a temp dir and byte-compares (lines 172-197), so the
widened transform flows through `--check` automatically — PROVIDED the rewrite lives inside
`generate()`, not on a separate build-only path (RESEARCH Pitfall 4). Never compute
divergence two different ways.

### Anchored/literal stamps, never blanket token replace
**Source:** RESEARCH Patterns 1 & 2 (verified excerpts above).
**Apply to:** `rewriteCommandRefs`, `stampHookFallback`, `stampBmManifest`.
- Command rewrite: leading-`/gsd:`-anchored. Colon form is unambiguous; it naturally
  spares `gsd://` (F-3, 38 hits, zero `/gsd://`), `gsd-*` filenames, and cache literals.
- Hook fallback: exact `cache/gsd-plugin/gsd` literal only (17 sites, measured).
- Manifest: rekey the single `mcpServers.gsd` entry; `mcp/server.cjs` stays BYTE-IDENTICAL
  (its internal `name: 'gsd'`, the 8 `gsd_*` tool names, and 5 `gsd://` resource URIs are
  never touched because it contains no `/gsd:` shape).

### Git-tracked-only source enumeration
**Source:** `bin/build-bm.cjs` `includedFiles()` lines 94-102 + `shouldExclude()` lines 53-63.
**Apply to:** any new file walk. Use `git ls-files -z` + `shouldExclude`, never a raw fs
walk (deterministic; keeps untracked/secret files out — threat T-12-02). `dist/` is
excluded via `EXCLUDE_ROOTS` (line 45) — the bm rewrite happens on the copied bytes inside
the build, NOT by pointing `rewrite-command-namespace.cjs` at `dist/`.

### Zero-dep test harness
**Source:** `tests/build-bm-drift.test.cjs` lines 16-39, 228-232.
**Apply to:** all new/modified tests. `node:assert` + bare `check(name, fn)` runner +
failure counter + `process.exit(1)` footer. Integration cases shell out with `spawnSync`.
No test framework, no `npm ci`. Run directly as `node tests/<file>.test.cjs`.

### CI-as-release-gate (extend jobs, don't add new ones)
**Source:** `.github/workflows/check-drift.yml` `bm-build-drift` job (lines ~150-172) and
`.github/workflows/install-smoke.yml` `bm-package-smoke` job.
**Apply to:** D-06 (extend `bm-build-drift` with the parity test step) and D-07 (extend
`bm-package-smoke`).

**`bm-build-drift` extension (D-06)** — add a parity-test step next to the existing three:
```yaml
      - name: Run build-bm drift test (unit + integration)
        run: node tests/build-bm-drift.test.cjs
      - name: Regenerate bm and fail on any drift from the committed dist/bm (D-06)
        run: node bin/build-bm.cjs --check
      # ADD:
      - name: Run bm command-inventory parity test (D-06)
        run: node tests/bm-parity.test.cjs
      - name: Validate the generated bm manifest stays schema-valid
        run: node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json
```
No `npm ci` (the job comment states zero-dep; keep it). `validate-plugin.cjs` must still
pass with the stamped `mcpServers.bm` key.

**`bm-package-smoke` extension (D-07)** — the hook primary-path-wins tripwire step ALREADY
exists (`bm Test - primary-path-wins hook proof`). Add:
1. A **fallback-target assertion**: after D-04, the extracted hook `command`'s fallback
   literal should read `cache/gsd-plugin/bm`, not `.../gsd`. Assert against the
   `dist/bm/hooks/hooks.json` bytes.
2. A **new MCP parity step**: spawn `dist/bm/mcp/server.cjs`, send `initialize` +
   `tools/list` + `resources/list`, assert the 8 `gsd_*` tools
   (`gsd_plan_status`, `gsd_advance_plan`, `gsd_record_metric`, `gsd_add_decision`,
   `gsd_add_blocker`, `gsd_resolve_blocker`, `gsd_record_session`, `gsd_commit_docs`) and
   the `gsd://` resources (`gsd://config`, `gsd://state`, `gsd://requirements`,
   `gsd://roadmap`, `gsd://phase/` template) match the gsd server. Model the JSON-RPC framing
   on `tests/mcp-stdio-framing.test.cjs` (already invoked as smoke Test 5). Keep the gsd
   `fresh-debian-install` job byte-untouched (Phase 12 D-12).

### RELEASING.md note (minor)
**Source:** `RELEASING.md` dual-package release procedure (canonical ref in CONTEXT).
**Apply to:** if the release steps reference the drift check, note the widened transform
(identity stamp + command rewrite + hook stamp). Low-priority doc touch; verify whether the
existing wording already covers `--check` generically before editing.

## Conventions

Derived via `node bin/gsd-tools.cjs verify conventions --derive --scope bin` (the same
deterministic module `gsd-code-reviewer` uses). New files land under `bin/lib/` and
`tests/`; the `bin/` derivation is the governing scope for the helper module.

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab (`build-bm`, `rewrite-command-namespace`) | 63% | 0.68 | contested hotspot |
| identifier casing | camelCase | 98% | 0.12 | named contract |
| export style | CJS (`module.exports`) | 100% | 0.00 | named contract |
| import style | CJS (`require`) | 100% | 0.00 | named contract |

**Named contracts (must follow):** the new `bin/lib/bm-transform.cjs` and its tests use
CJS `require` / `module.exports` and camelCase identifiers (`rewriteCommandRefs`,
`stampHookFallback`). This matches every analog above (`build-bm.cjs`,
`rewrite-command-namespace.cjs`, `build-bm-drift.test.cjs`).

**File-name casing is a contested hotspot** (63% kebab, below the 70% named-contract
threshold), but the practical convention is unambiguous here: kebab-case `.cjs` for
`bin/lib/` modules (`bm-transform.cjs`) and `<subject>.test.cjs` for tests
(`bm-parity.test.cjs`) — both match the dominant kebab variant and the direct sibling
analogs. Match the local directory style.

**Contested hotspots (author's choice) — the CJS<->SDK dual resolver:** repo-wide, export
and import style look split because `bin/lib/**` is CJS (`module.exports` / `require`)
while `sdk/src/**` is ESM (`export` / `import`). This is the prototype intentional-contested
split: each half is internally consistent per-directory, contested only when measured
repo-wide. All Phase 13 work is CJS build-tooling under `bin/` and `tests/`, so follow the
CJS half — never introduce ESM here.

## No Analog Found

None. Every file has a concrete in-repo analog from Phase 12. This is a pure extension phase.

## Metadata

**Analog search scope:** `bin/`, `bin/maintenance/`, `bin/lib/`, `tests/`, `hooks/`,
`mcp/`, `.claude-plugin/`, `.github/workflows/`.
**Files scanned:** `bin/build-bm.cjs`, `bin/maintenance/rewrite-command-namespace.cjs`,
`tests/build-bm-drift.test.cjs`, `hooks/hooks.json`, `.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, `mcp/server.cjs`,
`.github/workflows/check-drift.yml`, `.github/workflows/install-smoke.yml`.
**Measured facts:** 17 `cache/gsd-plugin/gsd` stamp targets in `hooks/hooks.json`;
8 `gsd_*` MCP tools; 5 `gsd://` resource URIs; 1 `mcpServers.gsd` manifest entry.
**Pattern extraction date:** 2026-07-06
