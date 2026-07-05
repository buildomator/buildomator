# Phase 13: Buildomator Plugin - Research

**Researched:** 2026-07-06
**Domain:** Build tooling / plugin packaging (deterministic source-to-package transform for Claude Code)
**Confidence:** HIGH (all findings measured against the actual repo; MCP naming verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The build (`bin/build-bm.cjs`) rewrites command self-references `/gsd:<skill>` -> `/bm:<skill>` across all tracked text/doc files in the generated `dist/bm` tree. Phase 12 D-02 assigned this rewrite to Phase 13. Source has ~179 files / ~1,234 `/gsd:` occurrences (this research measured 219 files / 1,512 occurrences in the shipped tree; see Finding F-1).
- **D-02:** The rewrite touches ONLY command-invocation self-references matching `/gsd:<skill-name>`. It MUST NOT touch: functional identity strings (`cache/gsd-plugin/gsd`, `gsd-tools.cjs`, `gsd-sdk`, `gsd-session-state.sh`, any `gsd-*` filename), the MCP resource scheme (`gsd://...`) and short tool names (`gsd_*`) inside `server.cjs`, or branding prose ("GSD" / "Get Shit Done", Phase 15). Reuse the proven regex approach in `bin/maintenance/rewrite-command-namespace.cjs`, retargeted `gsd:` -> `bm:`. Prefer factoring one shared transform used by both the maintenance rewriter and the build. **(Research refines the token-source of this decision, see F-1.)**
- **D-03:** The Phase 12 byte-drift guard widens from "identical except name/displayName/description" to "identical after applying the deterministic bm transform (identity stamp + command-prefix self-ref rewrite + hook-path stamp)." The `--check` regenerate-and-diff mode accommodates the wider transform automatically; what changes is the assertion in `tests/build-bm-drift.test.cjs`.
- **D-04:** The build stamps the hook fallback cache segment `/gsd` -> `/bm` so bm hooks fall back to `.../cache/gsd-plugin/bm/<version>/`. Only the trailing plugin-name segment is stamped; the marketplace-name segment `gsd-plugin` STAYS. The primary `${CLAUDE_PLUGIN_ROOT}` path already resolves per-plugin (Phase 12 D-10), so only the FALLBACK literal is stamped. The "GSD:" stderr prefix stays for Phase 15.
- **D-05:** Stamp the manifest `mcpServers` key `gsd` -> `bm` in the bm `plugin.json`. `mcp/server.cjs` stays BYTE-IDENTICAL (internal `name: 'gsd'`, `gsd_*` tools, `gsd://` URIs unchanged). Sanity-check confirmed (see F-4).
- **D-06:** Acceptance is an automated command-inventory parity test that (a) enumerates every skill/command in source and asserts an identically-named one exists in `dist/bm`; (b) asserts every `dist/bm` file equals its source counterpart AFTER applying the deterministic bm transform. Wire into `.github/workflows/check-drift.yml` (`bm-build-drift` job).
- **D-07:** Extend the `bm-package-smoke` job in `install-smoke.yml` to prove runtime parity for BM-03 (bm MCP server starts and lists the same tools/resources under its own key; a bm hook fires resolving via bm `CLAUDE_PLUGIN_ROOT`). Keep the gsd job byte-untouched.

### Claude's Discretion
- Exact module boundary for the shared `/gsd:`->`/bm:` transform (new `bin/lib/*` helper vs. exported function on `build-bm.cjs`).
- Precise file-type/extension filter for the rewrite (mirror the `git ls-files` text-file handling already in the build).
- Whether the parity test is a new `tests/bm-parity.test.cjs` or folded into `tests/build-bm-drift.test.cjs`.
- Exact smoke assertions for the MCP tool-list comparison.

### Deferred Ideas (OUT OF SCOPE)
- Double-fire dedup + "no duplicate MCP writers" + STATE.md write coordination when BOTH plugins are enabled: Phase 14.
- `/gsd:` deprecation nudge pointing at `/bm:` + v5.0 retirement timeline: Phase 14.
- Branding prose ("GSD"/"Get Shit Done" -> "Buildomator", the "GSD:" hook stderr prefix, README/CHANGELOG/buildomator.com copy): Phase 15.
- Retiring `/gsd:` and flipping the authored identity to bm: v5.0 (breaking).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BM-01 | A Buildomator plugin whose `plugin.json`/`marketplace.json` name is `bm`, so every command surfaces as `/bm:*` | Already satisfied by Phase 12's name stamp (`stampBmManifest` sets `name: 'bm'`); `/bm:*` derives solely from `plugin.json` name (verified in Phase 12). Phase 13 adds no new registration work here. |
| BM-02 | Every GSD command/skill is available under `/bm:` with behavior identical to its `/gsd:` equivalent | The 86 skill dirs are copied byte-for-byte into `dist/bm` (already passing). BM-02's remaining gap is CONTENT self-consistency: the ~1,512 `/gsd:` self-references must become `/bm:` (D-01/D-02, Finding F-1) so a bm user's Next-Up breadcrumbs route to bm, not the sibling gsd plugin. Parity test (D-06) is the gate. |
| BM-03 | The Buildomator plugin's agents, hooks, and MCP server function identically to the gsd plugin's | Hooks: D-04 stamps the fallback cache segment (17 occurrences of `cache/gsd-plugin/gsd` in `hooks/hooks.json`, F-2). MCP: `server.cjs` stays byte-identical, only the manifest `mcpServers` key stamps (D-05, F-4). Agents: copied byte-identical, already covered by the whitelist walk. Runtime proof: extended smoke (D-07). |
</phase_requirements>

## Summary

Phase 13 is a pure build-tooling phase. There is one deterministic transform `T` applied by `bin/build-bm.cjs` to generate `dist/bm` from the authored `gsd` source, and the entire phase is about widening `T` and its drift/parity gate. Phase 12 already generates the package with identity/branding stamped; Phase 13 adds two content operations to `T` (the `/gsd:` -> `/bm:` command self-reference rewrite, and the hook fallback-path stamp), widens the byte-drift guard to expect them, and proves parity via one extended CI drift job and one extended CI smoke job. No new libraries, no runtime code, no external dependencies: everything is zero-dependency Node built-ins, matching the established Phase 12 pattern.

The single most important finding (F-1) is a correction to the transform's token source. The CONTEXT decision D-02 suggests literally reusing the skill-name-alternation regex from `bin/maintenance/rewrite-command-namespace.cjs`. Investigation shows that regex, built from `skills/<name>/` directories, silently MISSES real command references such as `/gsd:capture` (35 occurrences), `/gsd:local-patches` (22), `/gsd:edit-phase` (8), and `/gsd:extract-learnings` (the skill dir is `extract_learnings` with an underscore). These would leak un-rewritten into `dist/bm` and fail the D-06 parity gate. The colon form `/gsd:` is far more specific than the dash form the maintenance rewriter was built for, so a simpler leading-slash-anchored substitution rewrites ALL command references while naturally sparing `gsd://` (38 occurrences, never leading-slash-prefixed), `gsd-tools.cjs`, `gsd-sdk`, and the cache-path literals.

**Primary recommendation:** Single-source one deterministic transform `T = stampManifest + rewriteCommandRefs + stampHookFallback`, used by both `build-bm.cjs` (build) and the parity/`--check` gate (verify). For `rewriteCommandRefs`, use a leading-slash-anchored `/gsd:` -> `/bm:` substitution (not the skill-name alternation), because the colon form is unambiguous and the alternation under-rewrites. Make the parity acceptance signal concrete and strong: after `T`, `grep -r '/gsd:' dist/bm` returns ZERO leading-slash command references (the 38 `gsd://` URIs and all `gsd-*` identity strings survive because they never carry the `/gsd:` shape).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Command self-reference rewrite (`/gsd:`->`/bm:`) | Build script (`bin/build-bm.cjs`) | Shared lib helper (`bin/lib/*`) | Generation-time text transform; the divergence lever must live in one place so `--check` stays honest. |
| Hook fallback-path stamp | Build script | `hooks/hooks.json` (input) | The stamp is applied to the copied `hooks.json` at generation time; the source hooks.json is never mutated. |
| MCP server-key stamp | Build script (manifest write) | `.claude-plugin/plugin.json` (input) | Same family as the existing `name`/`displayName` stamp already in `stampBmManifest`. |
| Parity / drift gate | CI (`check-drift.yml`) + `tests/*.test.cjs` | `build-bm.cjs --check` | CI-as-release-gate: a stale/hand-edited `dist/bm` fails the tag. |
| Runtime hook/MCP parity proof | CI (`install-smoke.yml`) | `dist/bm` package under its own `CLAUDE_PLUGIN_ROOT` | Runtime signals (server starts, hook resolves primary path) can only be proven by executing the generated package. |
| Command prefix `/bm:` registration | Claude Code loader (external) | `plugin.json` `name` | Already satisfied in Phase 12; no Phase 13 work. Prefix derives solely from the name field. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `os`, `path`, `child_process`) | Node 22 (CI matrix) | All build, transform, and test logic | The entire Phase 12 build + drift infrastructure is zero-dependency by deliberate design; the install-smoke job proves the package needs no `npm ci`. Adding a dependency would break the "no node_modules touched" invariant. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | Do not introduce any. The zero-dep constraint is load-bearing (F-5). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled anchored regex substitution | A markdown-AST rewriter (e.g. `remark`) | Rejected: adds a dependency, breaks the zero-dep smoke invariant, and is overkill. The `/gsd:` token is a flat lexical pattern, not a structural one. |
| Reusing the skill-name alternation from `rewrite-command-namespace.cjs` | Simple leading-slash-anchored `/gsd:` substitution | The alternation under-rewrites (F-1). The anchored form is simpler AND more complete. |

**Installation:** None. No packages are installed in this phase.

## Package Legitimacy Audit

Not applicable. This phase installs no external packages. All logic uses Node.js built-in modules (`fs`, `os`, `path`, `child_process`, `node:assert`). The `slopcheck` gate is moot because the dependency count is zero, and the install-smoke CI job actively asserts that no `node_modules` directory is ever created during a run.

## Architecture Patterns

### System Architecture Diagram

```
                    authored gsd source (repo root)
                    .claude-plugin/plugin.json (name: gsd)
                    skills/  workflows/  agents/  references/
                    templates/  hooks/hooks.json  mcp/server.cjs
                    bin/  sdk/dist/  .github/
                              |
                              |  git ls-files -z  (tracked only)
                              v
                    shouldExclude() filter
                    (drops .git .planning .claude node_modules
                     dist scratchpad + root marketplace.json)
                              |
                              v
        +---------- deterministic transform T ----------+
        |                                                |
        |  1. stampBmManifest(plugin.json)               |   <- EXISTS (Phase 12)
        |       name gsd->bm, displayName, description   |
        |       mcpServers key gsd->bm  (D-05, NEW)      |   <- Phase 13
        |                                                |
        |  2. rewriteCommandRefs(file text)              |   <- Phase 13 (D-01/02)
        |       /gsd:<cmd> -> /bm:<cmd>  (anchored)      |
        |       spares gsd://  gsd-*  cache/gsd-plugin   |
        |                                                |
        |  3. stampHookFallback(hooks.json)              |   <- Phase 13 (D-04)
        |       cache/gsd-plugin/gsd -> cache/.../bm     |
        |       (17 literal sites; filenames untouched)  |
        +------------------------------------------------+
                              |
              +---------------+----------------+
              |                                |
     build path (default)             verify path (--check / parity test)
              |                                |
              v                                v
        write dist/bm/                 regenerate into temp dir,
        (committed on release)         byte-compare vs committed dist/bm
                                       + grep dist/bm for /gsd: == 0
                                              |
                                              v
                                       CI gate: fail the tag on any
                                       drift the transform can't explain
```

The key structural property: `T` is applied identically on the build path and the verify path. The verify path never invents a separate notion of "correct output"; it regenerates through the same `T` and byte-compares. This is why the transform MUST be single-sourced (D-03 / CONTEXT specifics).

### Recommended Project Structure
```
bin/
├── build-bm.cjs            # build + --check entrypoint (extend: call T's new steps)
├── lib/
│   └── bm-transform.cjs    # NEW (discretion): pure exported transform helpers
│                           #   rewriteCommandRefs(text) -> text
│                           #   stampHookFallback(hooksJsonText) -> text
│                           #   (stampBmManifest can move here or stay in build-bm.cjs)
└── maintenance/
    └── rewrite-command-namespace.cjs  # dash-form rewriter (unchanged; different job)
tests/
├── build-bm-drift.test.cjs # EXTEND: widen whitelist walk to expect T (D-03)
└── bm-parity.test.cjs      # NEW or folded (discretion): command-inventory parity (D-06)
.github/workflows/
├── check-drift.yml         # EXTEND bm-build-drift job (D-06)
└── install-smoke.yml       # EXTEND bm-package-smoke job (D-07)
```

### Pattern 1: Pure exported transform helpers, unit-tested without disk I/O
**What:** Each stage of `T` is a pure `string -> string` (or `object -> object`) function exported for direct unit testing, mirroring how `stampBmManifest` and `shouldExclude` are already exported from `build-bm.cjs` and exercised in `build-bm-drift.test.cjs` without touching the filesystem.
**When to use:** For `rewriteCommandRefs` and `stampHookFallback`. Unit tests assert the tricky cases (below) as pure input/output pairs; a small number of integration cases run the real build and inspect `dist/bm`.
**Example:**
```javascript
// Pure helper shape, matching bin/build-bm.cjs's existing stampBmManifest export.
// Anchored so it can only match a command self-reference, never gsd:// or a gsd- filename.
function rewriteCommandRefs(text) {
  // Leading boundary: preceding char is not an identifier char, so `abcgsd:` and
  // `gsd://` (no leading slash) can never match. The `/` is part of the token.
  return text.replace(/(^|[^A-Za-z0-9])\/gsd:/g, '$1/bm:');
}
```

### Pattern 2: Targeted literal stamp, never a blanket token replace
**What:** The hook fallback stamp (D-04) replaces exactly the directory literal `cache/gsd-plugin/gsd`, not every `gsd` in `hooks.json`.
**When to use:** Always, for D-04. `hooks/hooks.json` contains 17 stamp targets AND many identity tokens that MUST survive: `GSD:` stderr (17x), `gsd-tools.cjs` (10x), `run-bash-hook.cjs` (6x), plus `gsd-*.js` hook filenames and `gsd-session-state.sh` / `gsd-validate-commit.sh` / `gsd-phase-boundary.sh` args. A blanket `gsd`->`bm` would corrupt all of them (F-2).
**Example:**
```javascript
function stampHookFallback(hooksJsonText) {
  // Trailing plugin-name segment only; marketplace segment gsd-plugin stays (D-04).
  return hooksJsonText.split('cache/gsd-plugin/gsd').join('cache/gsd-plugin/bm');
}
```

### Anti-Patterns to Avoid
- **Skill-name alternation for the colon rewrite:** builds the token list from `skills/<name>/` dirs and silently misses real command refs that have no skill dir (`capture`, `local-patches`, `edit-phase`) or a dash/underscore mismatch (`extract-learnings` vs `extract_learnings`). See F-1.
- **Blanket `gsd` -> `bm` replace anywhere:** corrupts filenames, `gsd://` URIs, `gsd_*` tool names, cache marketplace segment, and stderr branding. Every stamp must be a precisely anchored literal.
- **Running `rewrite-command-namespace.cjs` over `dist/`:** `dist/` is deliberately excluded from that maintenance rewriter and from `check-file-layout.cjs`. The bm rewrite happens INSIDE `build-bm.cjs` on the copied bytes, never by pointing the maintenance tool at the generated tree.
- **Two sources of truth for `T`:** if the build and the `--check`/parity path compute divergence differently, `--check` stops being honest. Single-source `T`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enumerating the shipped file set | A custom fs walk | `git ls-files -z` + `shouldExclude` (already in `build-bm.cjs`) | Deterministic across machines; guarantees untracked/secret files can never enter the published package (threat T-12-02). |
| Regenerate-and-diff | A new diff mechanism | The existing `check(root)` in `build-bm.cjs` | It already regenerates into a temp dir and byte-compares every path; the wider transform flows through it automatically (D-03). |
| Version lockstep across manifests | Manual bumps | `syncMarketplaceVersions` + `check-version-alignment.cjs` (Phase 12) | Already single-sources version from `plugin.json`; the bm smoke job asserts it. |
| Manifest schema validity of the generated package | A bespoke check | `bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` (already wired in `bm-build-drift`) | Reuse; the stamped mcpServers key must still pass this. |

**Key insight:** Phase 12 already built every mechanism this phase needs (git-tracked copy, pure exported helpers, regenerate-and-diff `--check`, CI-as-gate, smoke harness). Phase 13 is almost entirely EXTENSION, not new construction. The only genuinely new logic is two pure string transforms and their unit tests.

## Runtime State Inventory

This is a rebrand-adjacent phase, so the inventory is completed explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No datastore keys, collection names, or IDs embed `gsd` as a rewrite target. The MCP `gsd://` resource scheme and `gsd_*` tool names are functional identity and stay byte-identical (D-02/D-05). Verified: `mcp/server.cjs` is unchanged. | None (verified). |
| Live service config | None. There is no external service holding a `gsd`-keyed config for this plugin. The MCP server is stdio-spawned per session from the manifest, not a persistent registration. | None (verified). |
| OS-registered state | The plugin cache directory `~/.claude/plugins/cache/gsd-plugin/bm/<version>/` is filesystem state created by Claude Code at install. The bm hooks' FALLBACK literal currently points at `.../gsd/` (17 sites in the committed `dist/bm/hooks/hooks.json`, F-2). D-04 stamps these to `.../bm/`. The primary `${CLAUDE_PLUGIN_ROOT}` path already resolves per-plugin (Phase 12 D-10), so this fallback fires only after an upgrade prunes the baked path. | Code stamp (D-04) applied at build time; no manual OS action. |
| Secrets/env vars | `CLAUDE_PLUGIN_ROOT` is resolved by Claude Code per plugin; no rename. No secret keys reference `gsd`. | None (verified). |
| Build artifacts | `dist/bm/` IS the build artifact. It is committed on release (Phase 12 D-04) and currently carries 17 un-stamped hook fallbacks and 1,522 un-rewritten `/gsd:` refs (F-2, baseline). After Phase 13, a fresh `node bin/build-bm.cjs` regenerates it with the wider transform; a stale committed `dist/bm` is caught by `--check`/parity. | Regenerate `dist/bm` via the extended build; commit it. |

## Common Pitfalls

### Pitfall 1: Under-rewriting from the skill-name token source
**What goes wrong:** Reusing the `skills/<name>/` alternation leaves `/gsd:capture`, `/gsd:local-patches`, `/gsd:edit-phase`, `/gsd:extract-learnings`, and others un-rewritten in `dist/bm`.
**Why it happens:** Not every `/gsd:<token>` maps to a `skills/<name>/SKILL.md` directory. Some commands are documented in `workflows/help.md` and used in `templates/state.md` Next-Up breadcrumbs without a matching skill dir; `extract-learnings` uses a dash while the dir uses an underscore.
**How to avoid:** Use the leading-slash-anchored `/gsd:` -> `/bm:` substitution (rewrites all command forms), not the alternation. Then assert `grep -r '/gsd:' dist/bm` is empty.
**Warning signs:** The parity test passes on `plan-phase`-style refs but a raw grep of `dist/bm` still finds `/gsd:capture`.

### Pitfall 2: Corrupting identity strings with a blanket replace
**What goes wrong:** A global `gsd`->`bm` (or an over-broad hook stamp) turns `gsd-tools.cjs` into `bm-tools.cjs`, breaks `gsd://` URIs, or renames `gsd_*` tools, breaking runtime.
**Why it happens:** `hooks.json` mixes 17 stamp targets with dozens of identity tokens on the same lines.
**How to avoid:** Stamp only the exact literal `cache/gsd-plugin/gsd`. Anchor the command rewrite to the `/gsd:` shape. Keep `mcp/server.cjs` byte-identical (never touched by the rewrite because it contains `gsd://` and `gsd_*`, not `/gsd:`).
**Warning signs:** The bm smoke job's `gsd-sdk --version` step fails, or MCP `tools/list` returns renamed tools.

### Pitfall 3: The parity test asserting "zero `/gsd:`" without accounting for the transform's own scope
**What goes wrong:** A raw "no `/gsd:` anywhere in `dist/bm`" assertion could false-fail if some file legitimately must retain a `/gsd:` reference (there are none in scope for Phase 13, but Phase 14's deprecation nudge will introduce intentional ones).
**Why it happens:** Conflating the byte-parity check (dist == T(source)) with a standalone grep.
**How to avoid:** Make the primary gate `dist/bm == T(source)` byte-for-byte (any `/gsd:` the transform deliberately skipped is by construction also present in `T(source)`, so parity still holds). Add the `grep '/gsd:' == 0` as a secondary belt-and-suspenders assertion that is currently expected to be zero, and document that Phase 14 will relax it.
**Warning signs:** The test is green but a human still sees `/gsd:` in `dist/bm`, or the test goes red on an intentional future reference.

### Pitfall 4: Divergent transform between build and check
**What goes wrong:** `build-bm.cjs` rewrites during `generate()` but `check()` compares against a differently-computed expectation, so `--check` passes on genuinely-drifted output or fails on correct output.
**Why it happens:** `check()` currently calls the same `generate()` into a temp dir (good). If the rewrite is added only to the build path and not into `generate()`, the temp-dir regeneration would not apply it and every file would "differ."
**How to avoid:** Add the rewrite INSIDE `generate()` (or inside the per-file copy it performs), so both the real build and the `--check` temp build run identical logic. The current `generate()` uses `fs.copyFileSync`; switch the copy of text files to read -> `T` -> write.
**Warning signs:** `--check` reports every file as `differs:` immediately after a build.

## Code Examples

### Extending `generate()` to apply the text transform during copy
```javascript
// Source: derived from the existing bin/build-bm.cjs generate() (repo), verified 2026-07-06.
// Current code uses fs.copyFileSync for every file. Text files now flow through T.
const TEXT_EXT = /\.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)$/i;

function generate(root, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of includedFiles(root)) {
    const src = path.join(root, rel);
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (TEXT_EXT.test(rel)) {
      let text = fs.readFileSync(src, 'utf8');
      text = rewriteCommandRefs(text);                       // D-01/D-02
      if (rel === 'hooks/hooks.json') text = stampHookFallback(text); // D-04
      fs.writeFileSync(dest, text);
    } else {
      fs.copyFileSync(src, dest);                            // binaries unchanged
    }
  }
  // ... existing stampBmManifest write (now also stamps mcpServers key gsd->bm, D-05)
}
```

### Stamping the mcpServers key in the manifest (D-05)
```javascript
// Source: extends the existing stampBmManifest in bin/build-bm.cjs (repo), verified 2026-07-06.
function stampBmManifest(srcManifest) {
  const brandedDescription =
    'Buildomator -- ' + String(srcManifest.description || '').replace(/^Get Shit Done -- /, '');
  const out = { ...srcManifest, name: 'bm', displayName: 'Buildomator', description: brandedDescription };
  // D-05: rekey the single mcpServers entry gsd -> bm; server.cjs contents unchanged.
  if (out.mcpServers && out.mcpServers.gsd && !out.mcpServers.bm) {
    out.mcpServers = { bm: out.mcpServers.gsd };
  }
  return out;
}
```
Note: the existing test `stampBmManifest leaves every other key deep-equal (incl. gsd mcpServers)` and `out.mcpServers.gsd must survive` will need to be UPDATED to expect the `bm` key (D-03 / D-05). This is an expected test change, not a regression.

### The strong parity assertion
```javascript
// After rebuild, no leading-slash /gsd: command reference remains in dist/bm.
// gsd:// URIs (38) and gsd-* identity strings survive because they lack the /gsd: shape.
const { execFileSync } = require('child_process');
const leaks = execFileSync('grep', ['-rIl', '/gsd:', 'dist/bm'], { encoding: 'utf8' }).trim();
// expect: grep exits 1 (no match) -> wrap in try/catch; a match is a parity failure.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dash-form command refs `/gsd-<skill>` normalized post-sync by `rewrite-command-namespace.cjs` | Colon-form `/gsd:<skill>` is the live surface; bm needs `/bm:` self-consistency | 2026-04 rename | The colon form is unambiguous, so the bm rewrite does NOT need the alternation machinery the dash rewriter required. |
| `dist/bm` byte-identical except 3 manifest fields (Phase 12) | `dist/bm` = deterministic transform `T` of source (identity + command rewrite + hook stamp) | Phase 13 (this) | The drift whitelist widens; expected, not a Phase 12 regression (D-03). |

**Deprecated/outdated:**
- The CONTEXT's file/occurrence estimate (~179 files / ~1,234 refs, inherited from Phase 12's ~1,179 figure) is stale. Measured 2026-07-06: 1,512 `/gsd:` occurrences across 219 files in the shipped tree (F-1). Plan capacity against the current number.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The anchored `/gsd:` -> `/bm:` substitution is the intended and correct token source, refining D-02's "reuse the skill alternation" wording | F-1 / Patterns | If the user specifically wants ONLY registered-skill refs rewritten (leaving `capture`/`local-patches` pointing at gsd intentionally), the anchored form over-rewrites. Low risk: leaving them un-rewritten contradicts D-01's stated goal (bm self-consistency). Recommend confirming in discuss/plan. |
| A2 | Rewriting `/gsd:foo` placeholder comments inside `bin/maintenance/*.cjs` to `/bm:foo` in `dist/bm` is harmless | F-1 | Negligible: those are internal maintenance-script comments shipped but never user-facing; parity still holds because the transform is deterministic. |
| A3 | No file in scope must retain a `/gsd:` reference in Phase 13 | Pitfall 3 | Low: intentional cross-references (deprecation nudge) are explicitly Phase 14. If one exists now it would surface as a parity failure and can be allowlisted. |

## Open Questions

1. **Token source for the command rewrite (the one decision worth a sentence of confirmation).**
   - What we know: D-02 says reuse the skill-name alternation; investigation shows it under-rewrites real refs (F-1). The anchored colon substitution is simpler and complete.
   - What's unclear: whether the CONTEXT author intended the alternation's under-coverage or assumed it covered everything.
   - Recommendation: adopt the anchored substitution; note the refinement to D-02 in the plan. This is Claude's-discretion territory ("exact module boundary / regex") but the coverage delta is material, so flag it for the plan-checker.

2. **`extract_learnings` dash/underscore mismatch.**
   - What we know: the skill dir is `extract_learnings`; refs use `/gsd:extract-learnings`. The anchored substitution rewrites the ref text to `/bm:extract-learnings` regardless. The command itself (dir name) is unaffected.
   - What's unclear: whether `/gsd:extract-learnings` is even a valid command (the dir uses underscore). This is a pre-existing gsd doc inconsistency, not created by Phase 13.
   - Recommendation: rewrite the ref as-is (the anchored form does this automatically); do not try to "fix" the underscore here (out of scope, would be a content change beyond the prefix rewrite).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build + tests + smoke | ✓ | 22 (CI matrix); local `node` present | — |
| git | `git ls-files` source enumeration; drift integration tests | ✓ | present (repo is a git checkout) | — |
| grep | optional secondary parity assertion | ✓ | POSIX grep on macOS/Linux CI | Replace with an in-Node file scan for portability. |

No external services, databases, or network dependencies. The `bm-build-drift` CI job deliberately runs without `npm ci` (zero-dep). The `bm-package-smoke` job runs in a fresh `debian:trixie` container with only `nodejs`, `ca-certificates`, and `git`.

## Validation Architecture

`.planning/config.json` has no `workflow.nyquist_validation` key, so validation is treated as enabled. This phase is gated by automated CI, not manual UAT.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Zero-dep Node harness: `node:assert` + a bare `check(name, fn)` runner + `process.exit(1)` footer (mirrors `tests/build-bm-drift.test.cjs` and `tests/version-alignment.test.cjs`). |
| Config file | None (tests are standalone executables run as `node tests/<file>.test.cjs`). |
| Quick run command | `node tests/build-bm-drift.test.cjs` |
| Full suite command | `node bin/build-bm.cjs --check && node tests/build-bm-drift.test.cjs && node tests/bm-parity.test.cjs` (parity test name is discretion). |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BM-02 | Every source skill/command has an identically-named counterpart in `dist/bm` | unit+integration | `node tests/bm-parity.test.cjs` (enumerate `skills/*/SKILL.md`, assert present in `dist/bm`) | ❌ Wave 0 |
| BM-02 | No leading-slash `/gsd:` command ref leaks into `dist/bm` | integration | grep/scan `dist/bm` for `/gsd:` == 0 after build | ❌ Wave 0 |
| BM-02 | `dist/bm` == `T(source)` byte-for-byte (widened drift) | integration | `node bin/build-bm.cjs --check` + widened whitelist walk in `build-bm-drift.test.cjs` | ⚠️ EXTEND existing |
| BM-03 (hooks) | bm hook resolves via bm `CLAUDE_PLUGIN_ROOT`; fallback stamped to `.../bm/`, tripwire never fires | integration (smoke) | `bm-package-smoke` primary-path-wins step (already present); add a bm-fallback-target assertion | ⚠️ EXTEND existing |
| BM-03 (MCP) | bm MCP server starts and lists identical tools/resources under the bm-keyed server | integration (smoke) | NEW smoke step: spawn `dist/bm/mcp/server.cjs`, send `initialize`+`tools/list`+`resources/list`, assert the 8 `gsd_*` tools and 4 `gsd://` resources | ❌ Wave 0 |
| BM-01 | bm manifest name `bm`, version matches root, schema-valid | integration | already covered by `bm-package-smoke` manifest step + `validate-plugin.cjs` | ✓ |

### Sampling Rate
- **Per task commit:** `node tests/build-bm-drift.test.cjs` (fast, exercises pure helpers + a real build).
- **Per wave merge:** full suite (`--check` + drift test + parity test).
- **Phase gate:** `bm-build-drift` and `bm-package-smoke` CI jobs green before `/gsd:verify-work`.

**Sampling rationale (Nyquist):** the parity test's byte-for-byte `dist/bm == T(source)` walk over all ~219 shipped files with `/gsd:` content is a full census, not a sample: every one of the ~1,512 occurrences is verified transitively because any un-transformed byte makes a file differ. The `grep '/gsd:' == 0` scan is an independent second signal on the same population. For runtime parity (BM-03), the smoke job samples the two observable interfaces that can actually diverge: the MCP tool/resource list (8 tools + 4 resources, enumerable in full) and one representative hook firing through the fallback resolver. These two are sufficient because `mcp/server.cjs` and every hook script are proven byte-identical by the census, so behavior cannot diverge except through the two identity seams the phase deliberately changes (the manifest server key and the hook fallback literal), and both seams are directly asserted.

### Wave 0 Gaps
- [ ] `tests/bm-parity.test.cjs` (or folded into `build-bm-drift.test.cjs`): command-inventory enumeration + `grep '/gsd:' == 0` (covers BM-02).
- [ ] Extend `tests/build-bm-drift.test.cjs`: widen the `whitelist walk` case so text files are compared against `T(source)`, not raw source; update the two `stampBmManifest` mcpServers assertions to expect the `bm` key (D-03/D-05).
- [ ] New pure helpers + unit tests: `rewriteCommandRefs` (assert it spares `gsd://`, `gsd-tools.cjs`, `cache/gsd-plugin/gsd`, and DOES rewrite `capture`/`local-patches`/`edit-phase`), `stampHookFallback` (assert exactly the 17 literal sites change and filenames/`GSD:`/args survive).
- [ ] New smoke step in `bm-package-smoke`: spawn the bm MCP server and diff its `tools/list` + `resources/list` against the gsd server's (D-07).

## Security Domain

`security_enforcement` is absent from config, so it is treated as enabled. This is a build-tooling phase with no authentication, session, access-control, or cryptography surface, so most ASVS categories are not applicable. The relevant security concern is supply-chain integrity of the generated, committed, published package.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | partial | The build reads only git-tracked files (`git ls-files`); untracked/secret/scratch files can never enter `dist/bm` (`shouldExclude` + tracked-only source list, Phase 12 threat T-12-02). Keep this invariant. |
| V6 Cryptography | no | — |
| V14 Configuration / Supply chain | yes | `dist/bm` is committed and published; the `--check`/parity gate (D-06) plus `validate-plugin.cjs` ensure the published bytes equal a deterministic transform of the audited source. No new dependencies (zero-dep) keeps the supply-chain surface flat. |

### Known Threat Patterns for build-tooling / package generation
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited or stale `dist/bm` shipped in a release | Tampering | `bin/build-bm.cjs --check` regenerate-and-diff CI gate blocks the tag (D-06). |
| Untracked/secret file leaking into the published package | Information disclosure | Tracked-only source list via `git ls-files` + `shouldExclude` (carried from Phase 12). |
| Blanket token replace corrupting a security-relevant hook (`gsd-read-guard.js`, `gsd-prompt-guard.js`, injection scanner) | Tampering / DoS | Precisely anchored stamps only; the byte-parity census proves every hook script is unchanged (F-2). |
| Dependency introduction expanding attack surface | Tampering | Zero-dep invariant asserted by the install-smoke "no node_modules touched" step. |

## Sources

### Primary (HIGH confidence)
- Repo files, read and measured 2026-07-06: `bin/build-bm.cjs`, `bin/maintenance/rewrite-command-namespace.cjs`, `tests/build-bm-drift.test.cjs`, `hooks/hooks.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `mcp/server.cjs`, `.github/workflows/check-drift.yml`, `.github/workflows/install-smoke.yml`, `.planning/config.json`.
- CONTEXT.md (13 and 12) and REQUIREMENTS.md, read 2026-07-06.
- Claude Code MCP tool naming convention: [anthropics/claude-code plugin-dev mcp-integration tool-usage.md](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md) and [Claude Code MCP docs](https://code.claude.com/docs/en/mcp). Confirms full tool id form `mcp__plugin_<plugin-name>_<server-name>__<tool-name>` (F-4).

### Secondary (MEDIUM confidence)
- Measured token counts via `git ls-files` + `grep` over the shipped tree (reproducible; commands recorded in this session).

### Tertiary (LOW confidence)
- None. All claims are either measured against the repo or cited to official docs.

## Metadata

### Key measured findings (referenced above as F-n)
- **F-1:** 1,512 `/gsd:` occurrences across 219 shipped files. The skill-name alternation misses real refs: `/gsd:capture` (35), `/gsd:local-patches` (22), `/gsd:edit-phase` (8), `/gsd:extract-learnings` (dir is `extract_learnings`), plus others with no `skills/<name>/` dir. Simulation confirmed the alternation rewrites `/gsd:plan-phase` but NOT `/gsd:capture`/`/gsd:local-patches`/`/gsd:edit-phase`/`/gsd:extract-learnings`.
- **F-2:** `hooks/hooks.json` has exactly 17 `cache/gsd-plugin/gsd` stamp targets, alongside 17 `GSD:` stderr, 10 `gsd-tools.cjs`, 6 `run-bash-hook.cjs`, and multiple `gsd-*.js`/`gsd-*.sh` identity tokens that must survive. Committed `dist/bm/hooks/hooks.json` still carries all 17 un-stamped (the known limitation D-04 closes).
- **F-3:** `gsd://` appears 38 times and NEVER with a leading slash, so a leading-slash-anchored `/gsd:` rewrite cannot touch it. Zero `/gsd://` matches in the repo.
- **F-4:** Verified against official Claude Code docs: harness tool id = `mcp__plugin_<pluginName>_<serverKey>__<tool>`. Because `<pluginName>` is `bm` (from `plugin.json` name) regardless, bm tools are already distinctly namespaced even before the D-05 key stamp; stamping `gsd`->`bm` makes it `mcp__plugin_bm_bm__*` for identity cleanliness. Zero source references to any `mcp__plugin_*` id (only `.planning/` docs), so no internal consumer hardcodes the key. D-05 is safe.
- **F-5:** Zero external dependencies; the install-smoke job asserts no `node_modules` is created. Do not introduce any package.

**Confidence breakdown:**
- Standard stack (zero-dep Node): HIGH: verified against the shipped build + CI invariants.
- Architecture (single transform + regenerate-and-diff): HIGH: the mechanisms exist in-repo; Phase 13 extends them.
- Command-rewrite token source (F-1): HIGH on the measurement, MEDIUM on the recommendation (refines a locked decision, flagged as A1/Open Question 1).
- MCP namespacing (D-05): HIGH: official docs + zero-hit source scan.
- Hook stamp precision (F-2): HIGH: exact occurrence counts measured.

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 (30 days; stable build-tooling domain, but re-measure `/gsd:` counts if the source tree changes materially before planning).
