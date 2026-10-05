# Phase 16: Catalog and Trust Gate Foundation - Pattern Map

**Mapped:** 2026-10-05
**Files analyzed:** 9 (new + modified)
**Analogs found:** 9 / 9 (every new file has a strong in-repo analog)

This is a CJS + SDK twin tooling phase. There is no frontend/UI. Almost every file
carries a twin obligation: a change in `bin/lib/*.cjs` has a mirror in `sdk/src/**`,
both must stay byte-parallel in behavior, then `npm --prefix sdk run build` rebuilds
`sdk/dist` and `node bin/build-bm.cjs` regenerates `dist/bm`, and `--check` must PASS.
Phase 16 builds ON TOP of the existing agent_skills injection path; it does not fork a
new injector and must not widen the strict `trusted_global_roots` default.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `sdk/shared/craft-skill-catalog.json` (new) | config/data | single JSON source, read by both twins | `sdk/shared/model-catalog.json` | exact (same twin-source pattern) |
| `bin/lib/craft-skill-catalog.cjs` (new) | utility (reader) | file-I/O + transform | `bin/lib/model-catalog.cjs` | exact |
| `sdk/src/craft-skill-catalog.ts` (new) | utility (reader) | file-I/O + transform | `sdk/src/model-catalog.ts` | exact |
| `bin/lib/skill-trust-gate.cjs` (new) | service (validator) | transform (input -> findings/verdict) | `bin/lib/security.cjs` (validatePath / loadTrustedGlobalRoots / scanForInjection) | role-match |
| `sdk/src/skill-trust-gate.ts` (new, if SDK reach needed) | service (validator) | transform | `sdk/src/query/skills.ts` guard helpers | role-match |
| `bin/lib/init.cjs` buildAgentSkillsBlock + a scoped-insertion writer (modify) | service | event-driven (accept -> write config + .planning record) | existing `buildAgentSkillsBlock` / `cmdAgentSkills` | exact (reuse) |
| `sdk/src/query/skills.ts` (modify, if insertion touches resolver) | service | request-response | itself (current resolver) | exact (reuse) |
| `bin/lib/config-schema.cjs` + `sdk/src/query/config-schema.ts` (modify) | config | key registration | existing `agent_skills.<agent-type>` dynamic pattern + `agent_skills_security.trusted_global_roots` static key | exact |
| `tests/craft-skill-catalog.test.cjs` + trust-gate + no-vendoring tests (new) | test | batch assertions | `tests/fable-tier.test.cjs`, `tests/trusted-global-roots.test.cjs`, `tests/agent-skills-plugin-form.test.cjs`, `sdk/src/query/skills.test.ts` | exact |

## Pattern Assignments

### `sdk/shared/craft-skill-catalog.json` (config/data, single twin-source)

**Analog:** `sdk/shared/model-catalog.json`

This is the CAT-01 artifact. Follow the model-catalog precedent exactly: ONE JSON file
under `sdk/shared/` is the single source, read by both the CJS reader and the SDK reader.
Store metadata + pins only (no skill bodies). Shape each entry after the catalog's
flat-record style (model-catalog uses `agents: { "<name>": { golden, balanced, ... } }`).

A catalog entry should carry the RESEARCH fields: `source`, `pinned_commit`, `license`
(SPDX string), `trust_tier` (A/B/C), `bundles_scripts` (bool), `publisher`, plus a
one-line license `obligations` summary (CAT-04). Seed with SEO
(`coreyhaines31/marketingskills`, MIT) and DuckDB (`duckdb/duckdb-skills`, MIT).

Structural shape to mirror (model-catalog.json lines 101-136 keyed-record style):
```json
"agents": {
  "bm-planner": { "golden": "fable", "balanced": "opus", "budget": "sonnet", "phaseType": "planning", "routingTier": "heavy" },
  ...
}
```
A top-level `publisherAllowlist` array (consumed by the trust gate, CAT-03) fits the
same "declare validation inputs in the data file" idea as model-catalog's `profiles` /
`phaseTypes` enum arrays (lines 2-3).

---

### `bin/lib/craft-skill-catalog.cjs` (utility reader, CJS twin)

**Analog:** `bin/lib/model-catalog.cjs`

Copy the whole reader skeleton. Key patterns to reproduce:

**Prioritised candidate-path resolver** (model-catalog.cjs lines 28-56) so the reader
works in flat plugin layout, co-located install layout, and source-repo dev layout, and
throws a diagnostic listing all candidates when none resolve:
```javascript
const _catalogCandidates = [
  path.resolve(__dirname, '..', '..', 'sdk', 'shared', 'model-catalog.json'), // [PLUGIN PATCH] flat layout
  path.resolve(__dirname, '..', 'shared', 'model-catalog.json'),
  path.resolve(__dirname, '..', '..', '..', 'sdk', 'shared', 'model-catalog.json'),
  process.env.GSD_MODEL_CATALOG ? path.resolve(process.env.GSD_MODEL_CATALOG) : null,
].filter(Boolean);
// loop: require each; only MODULE_NOT_FOUND/ENOENT recoverable, rethrow real errors
```
Reuse the exact "only missing-file is recoverable, rethrow parse/permission errors"
discipline (lines 44-50) and the final throw-with-candidates (lines 52-56). Add a new
env override name (e.g. `GSD_CRAFT_SKILL_CATALOG`) following the `GSD_MODEL_CATALOG` slot.

**Derived maps + named exports** (lines 58-92, 152-170): derive the lookups you need
(e.g. a trigger->entry map, a publisher allowlist set) via `Object.fromEntries(...)` and
export them as named `module.exports` members. CJS uses `'use strict'` + `require` +
`module.exports` (convention axis for `bin/lib`: export-style cjs 100%, import-style cjs
100%).

**File-name casing note:** `bin/lib` file-name casing is a contested hotspot (kebab 42,
camel 29). `model-catalog.cjs` is kebab; stay kebab to match its twin pair.

---

### `sdk/src/craft-skill-catalog.ts` (utility reader, SDK twin)

**Analog:** `sdk/src/model-catalog.ts`

Mirror the CJS reader in ESM/TS. Key patterns:

**URL-relative single-file read** (model-catalog.ts lines 29-30) — SDK resolves the JSON
once relative to the module, no candidate list needed on this side:
```typescript
const CATALOG_PATH = new URL('../shared/craft-skill-catalog.json', import.meta.url);
export const catalog: CraftSkillCatalog = JSON.parse(readFileSync(fileURLToPath(CATALOG_PATH), 'utf-8'));
```
**Typed interfaces then derived exports** (lines 4-60): declare an interface per record
shape, type the parsed catalog, then `export const` the derived maps. SDK convention:
export-style esm (99%), import-style esm (100%), file-name kebab (73%, named contract) —
so `craft-skill-catalog.ts` is the correct name.

Keep the two readers behaviorally identical (same derived keys, same validation inputs).
This is the model-catalog twin contract applied to the new catalog.

---

### `bin/lib/skill-trust-gate.cjs` (service / validator, CJS)

**Analog:** `bin/lib/security.cjs`

This is the CAT-03 (safety) + CAT-04 (license) gate. `security.cjs` is the pattern home
for "structural checks that return a verdict, never model-vouched."

**Verdict-object return shape** — reuse the `{ safe, ..., error }` and
`{ clean, findings: [] }` conventions:
```javascript
// validatePath style (security.cjs lines 34-98): structured verdict, not throw
function validatePath(filePath, baseDir, opts = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { safe: false, resolved: '', error: 'Empty or invalid file path' };
  }
  ...
  return { safe: true, resolved: resolvedPath };
}
```
```javascript
// scanForInjection style (security.cjs lines 224-266): accumulate findings, clean flag
function scanForInjection(text, opts = {}) {
  const findings = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) findings.push(`Matched injection pattern: ${pattern.source}`);
  }
  return { clean: findings.length === 0, findings };
}
```
Model the license decision as a three-way classifier returning
`{ verdict: 'allow'|'flag'|'block', spdx, obligations, reason }`: allow MIT/Apache-2.0/
BSD/ISC, flag copyleft + source-available, block no-license/unknown/NC/proprietary
(CAT-04). Model the safety gate as structural checks (publisher in allowlist, pinned
commit present / not floating HEAD, `bundles_scripts` -> require review-or-ban) returning
a findings array like `scanForInjection`.

**Reuse, do not re-implement, the path hardening.** `loadTrustedGlobalRoots`
(security.cjs lines 124-150) and `validatePath` already exist and are exported; the gate
should import them rather than duplicate symlink-escape logic. Keep the strict default
untouched (RESEARCH gotcha).

**Convention:** `bin/lib` identifier-casing camel (98%, named), export-style cjs (100%).
Add the gate's functions to `module.exports` the way security.cjs does (lines 519-546).

---

### `sdk/src/skill-trust-gate.ts` (service / validator, SDK twin — only if the gate must run in the SDK path)

**Analog:** the guard helpers already inlined in `sdk/src/query/skills.ts`
(`resolveWithinBase` lines 45-58, `loadTrustedGlobalRoots` lines 69-95)

If the gate needs an SDK twin (decide in planning based on where insertion runs), mirror
the CJS gate in ESM/TS using the skills.ts guard helpers as the structural-check
precedent. skills.ts already shows the SDK-side symlink-escape guard and the
trusted-roots loader ported from `security.cjs`; the gate's SDK twin follows the same
port. If the gate only runs from the CJS CLI (gsd-tools), an SDK twin may be unnecessary;
flag this as a planner decision, not an automatic twin.

---

### `bin/lib/init.cjs` buildAgentSkillsBlock + scoped-insertion writer (modify) & `sdk/src/query/skills.ts` (modify)

**Analog:** the existing injection path itself (reuse, do not rebuild)

CAT-05 scoped insertion writes an `agent_skills.<agent>` entry through the EXISTING path
plus a `.planning` record. The resolver that consumes that entry is already correct and
must not be forked:

**CJS reader** (init.cjs lines 1708-1817): `buildAgentSkillsBlock` reads
`lookupByAgentName(config.agent_skills, agentType)`, validates each entry
(project-relative via `validatePath`, `global:<name>`, `global:<plugin>:<skill>`), and
emits:
```javascript
return `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>`;
```
**SDK reader** (skills.ts lines 97-214): the `agentSkills` QueryHandler does the same and
returns `{ data: block, format: 'text' }`.

What Phase 16 ADDS here is the write side (accept a candidate -> set
`agent_skills.<agent>` + record pinned commit in `.planning`), ephemeral by default,
sticky as explicit opt-in. For the config-write mechanism use the existing config-set
path (`cmdAgentSkills` neighbours in init.cjs show how config is loaded via
`loadConfig(cwd)`; the config-schema dynamic key already permits `agent_skills.<agent>`).
For the `.planning` reproducibility record, remember `.planning` is gitignored (git add
-f) and the executor runs on the MAIN tree.

Do not change the emitted block format: `tests/agent-skills-plugin-form.test.cjs`
enforces byte-identical output between the twins (the parity contract, no golden covers
agent-skills).

---

### `bin/lib/config-schema.cjs` + `sdk/src/query/config-schema.ts` (modify both twins)

**Analog:** the existing `agent_skills` dynamic pattern + `trusted_global_roots` static key

If Phase 16 introduces a new config key (e.g. an insertion/ephemeral marker, or a sticky
flag namespace), register it in BOTH twins the same way existing skill keys are
registered.

**Static key** (config-schema.cjs line 88 / config-schema.ts line 90):
```javascript
'agent_skills_security.trusted_global_roots',
```
**Dynamic pattern** (config-schema.cjs line 106):
```javascript
{ topLevel: 'agent_skills', test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k), description: 'agent_skills.<agent-type>' },
```
The SDK twin (config-schema.ts lines 112-117) carries BOTH a `test` function AND a
`source` string, and the parity test enforces `source === CJS regex .source`. So any new
dynamic pattern must be added to both files with matching `.source`.

---

### Tests (new)

**Catalog-reader test** — analog `tests/fable-tier.test.cjs`. Same harness: `require`
the CJS reader + config-schema, `ok(label, cond)` into a `checks` array, print
PASS/FAIL, `process.exit(failed ? 1 : 0)` (fable-tier.test.cjs lines 18-19, 62-66).
Assert the seed entries resolve (SEO MIT, DuckDB MIT) and the derived maps are correct.
Also read the raw JSON directly to assert shape (fable-tier.test.cjs line 33 reads
`sdk/shared/model-catalog.json` directly).

**No-vendoring / drift test** — analog fable-tier's raw-JSON read. Assert the catalog
holds metadata + pins only: each entry has `source` + `pinned_commit` and NO embedded
skill body / SKILL.md content (RESEARCH constraint: a test or drift gate must prove
reference-not-redistribute).

**Trust-gate test** — analog `tests/trusted-global-roots.test.cjs`. Reuse its
`check(name, fn)` + `assert` harness (lines 21-30) and tmp-project helpers
(`withProject`, `writeConfig`, lines 32-47). Prove the gate blocks no-license/unknown,
proprietary, non-allowlisted publisher, unreviewed `scripts/`, and floating HEAD; flags
copyleft/source-available.

**Scoped-insertion test** — analogs `tests/agent-skills-plugin-form.test.cjs` and
`sdk/src/query/skills.test.ts`. The CJS test spawns `gsd-tools.cjs agent-skills <agent>`
in a tmp project (plugin-form test lines 59-67) to prove a skill appears for its target
agent type only, not others, not at startup (CAT-05 success criterion 3). The SDK test
(skills.test.ts, vitest: `describe/it/expect`, tmp dirs via `mkdtemp`, lines 9-53) covers
the SDK twin.

## Shared Patterns

### Twin-source + twin-reader (model-catalog precedent)
**Source:** `sdk/shared/model-catalog.json` + `bin/lib/model-catalog.cjs` + `sdk/src/model-catalog.ts`
**Apply to:** the new catalog data file and its two readers.
One JSON under `sdk/shared/`; CJS reader uses the prioritised candidate-path resolver
(flat/install/dev + env override); SDK reader uses `new URL('../shared/<file>.json',
import.meta.url)`. Derived maps via `Object.fromEntries`. Keep both readers behaviorally
identical.

### Agent-name normalization (bm- / gsd- compat)
**Source:** `bin/lib/model-catalog.cjs` lines 105-122, `sdk/src/model-catalog.ts` lines 66-83
**Apply to:** any new code that looks up a value by agent type.
```javascript
function lookupByAgentName(map, name) {
  if (!map) return undefined;
  const direct = map[name];
  if (direct !== undefined) return direct;
  const norm = map[normalizeAgentName(name)];   // gsd-foo -> bm-foo
  if (norm !== undefined) return norm;
  return map[legacyAgentName(name)];            // bm-foo -> gsd-foo
}
```
Scoped insertion writes `agent_skills.<agent>`; reads must go through
`lookupByAgentName` so both bm- and gsd- spellings resolve (removed at v5.0).

### Verdict-object validation (never-throw, findings array)
**Source:** `bin/lib/security.cjs` `validatePath` (lines 34-98), `scanForInjection` (lines 224-266)
**Apply to:** the trust gate (safety + license).
Return structured `{ safe/clean, findings/verdict, error }` objects so callers decide;
reserve throwing for `requireSafePath`-style convenience wrappers (lines 104-110).

### Path hardening reuse (do not duplicate, do not widen)
**Source:** `bin/lib/security.cjs` `loadTrustedGlobalRoots` (124-150) + `validatePath`; SDK equivalents in `sdk/src/query/skills.ts` (45-95)
**Apply to:** anything touching `global:` resolution or insertion.
Import these; keep the strict empty default for `trusted_global_roots` unchanged.

### Config-key registration parity
**Source:** `bin/lib/config-schema.cjs` (88, 106) + `sdk/src/query/config-schema.ts` (90, 114-117)
**Apply to:** any new config key. Add to both twins; SDK dynamic patterns carry a
`source` string that must equal the CJS regex `.source` (parity test enforced).

### CJS test harness (checks array + exit code)
**Source:** `tests/fable-tier.test.cjs` (18-19, 62-66), `tests/trusted-global-roots.test.cjs` (21-30)
**Apply to:** all new `.cjs` tests. Collect `[pass, label]`, print PASS/FAIL, exit
nonzero on any failure. Tmp projects via `fs.mkdtempSync` + `withProject`.

### Generated-code hygiene
**Source:** project CLAUDE.md
**Apply to:** all product source. No GSD bookkeeping (CAT-0x, issue/PR numbers,
wave/status) in `bin/lib`, `sdk/src`, the JSON catalog, or their comments. Existing
`#NNNN` references in the analogs are pre-existing upstream provenance; new code describes
behavior only.

## No Analog Found

None. Every file to create or modify has a direct in-repo analog. The only genuinely new
behavior (license classifier verdicts, publisher-allowlist / bundled-scripts / pinned-
commit safety checks, and the accept -> config-write + `.planning` record step) is
new domain logic, but each reuses an existing structural pattern
(`security.cjs` verdict objects, `config-set` / `loadConfig`, `.planning` writes).

## Conventions

Derived via `gsd-tools.cjs verify conventions --derive` for the two directories the new
files land in. `sdk/shared` skipped (JSON-only, no code tokens to sample).

### bin/lib (the new `.cjs` reader, gate, and schema edits)

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab | 58% | 0.713 | contested hotspot |
| identifier casing | camel | 98% | 0.122 | named contract |
| export style | cjs (`module.exports`) | 100% | 0.000 | named contract |
| import style | cjs (`require`) | 100% | 0.000 | named contract |

### sdk/src (the new `.ts` reader and config-schema edit)

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab | 73% | 0.660 | named contract |
| identifier casing | camel | 95% | 0.181 | named contract |
| export style | esm (`export`) | 99% | 0.057 | named contract |
| import style | esm (`import`) | 100% | 0.000 | named contract |

**Contested hotspots (author's choice).** `bin/lib` file-name casing is below the 70%
dominance threshold (kebab 42, camel 29), so it is a contested hotspot, not a contract:
you cannot deviate from "author's choice" here. In practice, match the local twin pair:
`model-catalog.cjs` and `security.cjs` are kebab, so the new reader/gate files are kebab
(`craft-skill-catalog.cjs`, `skill-trust-gate.cjs`).

This repo is the prototype intentional-contested split: the **CJS <-> SDK dual resolver**.
`bin/lib/**` is CJS (`module.exports` / `require`) and `sdk/src/**` is ESM (`export` /
`import`); each half is internally consistent per-directory and only looks contested when
measured repo-wide. Match the directory's local style: `module.exports`/`require` under
`bin/lib`, `export`/`import` under `sdk/src`. The model-catalog + skills + config-schema
trios are the living examples of writing the same behavior twice, once per resolver.

## Metadata

**Analog search scope:** `sdk/shared/`, `bin/lib/`, `sdk/src/`, `sdk/src/query/`, `tests/`
**Files read for excerpts:** model-catalog.json, model-catalog.cjs, model-catalog.ts,
skills.ts, security.cjs, init.cjs (buildAgentSkillsBlock), config-schema.cjs,
config-schema.ts, fable-tier.test.cjs, trusted-global-roots.test.cjs,
agent-skills-plugin-form.test.cjs, skills.test.ts
**Pattern extraction date:** 2026-10-05
