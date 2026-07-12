# Phase 15: Buildomator Identity and Communications - Research

**Researched:** 2026-07-12
**Domain:** Prose / metadata / branding, gated by a deterministic byte-transform (`bin/build-bm.cjs`)
**Confidence:** HIGH (all findings verified against the working tree, tests, and CI config)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hard calendar date. `/gsd:` retires at **v5.0 on 2026-10-01**. Stated identically in the CHANGELOG 4.1.0 entry, the README "Migrating from /gsd:" section, and the marketplace legacy-entry description. Also update the wording of the already-shipped Phase 14 deprecation nudge string to name `2026-10-01` (string only, do NOT touch the nudge mechanism). BRAND-03's "retirement date" is satisfied by this date.
- **D-02:** Point BOTH `homepage` AND `repository` at `https://buildomator.com` in `plugin.json` and in BOTH marketplace.json plugin entries. README brand + docs links point to buildomator.com.
- **D-03:** Do NOT change the marketplace `source` fields (`./` for gsd, `./dist/bm` for bm). Repo + cache id stay `gsd-plugin`. Accepted residual: `repository` semantically expects a VCS URL; pointing it at buildomator.com is a deliberate branding choice. The git source stays github.com/jnuyens/gsd-plugin and installs are unaffected.
- **D-04:** Full README rebrand. H1 becomes Buildomator, intro prose rebrands, all command examples switch to `/bm:`. Add a "Migrating from /gsd:" section: `/gsd:` keeps working through all of 4.x, `/bm:X` is identical to `/gsd:X`, and `/gsd:` retires at v5.0 on 2026-10-01.
- **D-05:** Install + troubleshooting sections keep real identifiers unchanged (`gsd-sdk`, `gsd-plugin`, cache paths `~/.claude/plugins/cache/gsd-plugin/`, filenames). Only brand-name prose changes.
- **D-06:** New logo. Copy a Buildomator logo from `/Users/jnuyens/src/buildomator.com` (READ-ONLY, never write there) into `assets/`, reference it in the README header, replacing `assets/gsd-plugin-logo.png`. Candidates: `buildomator-logo-big.png`, `src/assets/logo-small.png`, `src/assets/logo-square.png`.
- **D-07:** bm entry = primary. `displayName: "Buildomator"`; description leads as the primary plugin ("use /bm:").
- **D-08:** gsd entry = legacy alias. `displayName: "Buildomator (legacy /gsd:)"`; description: same plugin, original `/gsd:` prefix, retires v5.0 on 2026-10-01, new users install Buildomator. Both descriptions contain "Buildomator".
- **D-09:** The gsd `plugin.json` `description` also flips to Buildomator-worded. Keep `name: "gsd"` and the `gsd` keyword.
- **D-10:** Promote `[Unreleased]` to a `[4.1.0]` entry: (a) explains the rebrand, (b) describes the additive strategy (`/bm:` added, `/gsd:` fully retained through 4.x), (c) states `/gsd:` retires at v5.0 on 2026-10-01. Keep the gsd-core provenance line per convention.
- **D-11:** Bump to `4.1.0` in `plugin.json`, both `marketplace.json` entries, and the README "Plugin version" line. Ships as a git tag.

### Claude's Discretion

- Exact logo file choice + header width (match the current ~320px header).
- Exact README H1 wording, section ordering, whether to add a short "why the rename" note.
- Exact CHANGELOG and marketplace prose, within the D-08/D-10 constraints.

### Deferred Ideas (OUT OF SCOPE)

- Flipping the authored identity (plugin `name` -> bm, `/gsd:` removal, bm primary by default): v5.0 (breaking).
- Building buildomator.com site content: separate repo.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | Project presents as "Buildomator" in README, plugin description, and marketplace text, with `/bm:` as the documented command surface | README rebrand (D-04), `plugin.json` description flip (D-09) plus the `stampBmManifest` decision below, both marketplace entries (D-07/D-08). The bm transform already flips `/gsd:` command examples to `/bm:` in the generated package. |
| BRAND-02 | buildomator.com wired into plugin/repo metadata and README links | `homepage`/`repository` edits (D-02) in `plugin.json` + both marketplace entries; README brand/docs links. Note `plugin.json` has no `homepage` field today (only `repository`); one must be added. |
| BRAND-03 | CHANGELOG documents the rebrand, the `/gsd:` -> `/bm:` migration path, and the v5.0 retirement timeline | CHANGELOG `[4.1.0]` entry (D-10); retirement date 2026-10-01 (D-01). Consistency map below lists every location the date must appear. |
</phase_requirements>

## Summary

This is a prose / metadata / branding phase with one sharp technical edge: everything you edit in the authored `gsd` source (README, `plugin.json`, and the deprecation-nudge string) is fed through `bin/build-bm.cjs`, a deterministic byte-transform that generates the committed `dist/bm/` Buildomator package. The transform blindly rewrites every `gsd:` namespace prefix to `bm:` in every text file it does not explicitly exclude, and it rebuilds the bm `plugin.json` description by string-munging the gsd description. Two edits in this phase collide with that machinery and must be handled deliberately, or the generated Buildomator package ships wrong (not just ugly, but factually incorrect: telling Buildomator users that `/bm:` retires at v5.0, or a doubled "Buildomator -- Buildomator --" description).

The marketplace descriptions (both entries) are hand-authored in the root `marketplace.json`, which the transform excludes from the copy entirely, so those are fully under manual control with no transform surprises. The CHANGELOG is also excluded from the command-rewrite (history is preserved verbatim), so `/gsd:` written there survives literally. The README is NOT excluded, so its migration narrative is the single highest-risk artifact: literal `/gsd:` tokens in it flip to `/bm:` in the bm package.

The automated gates (`build-bm.cjs --check`, `tests/bm-parity.test.cjs` census, `tests/build-bm-drift.test.cjs`, `check-version-alignment.cjs`) prove the bm package is byte-deterministic and leak-free, but they cannot catch semantic wrongness in flipped prose. A human read of `dist/bm/README.md` after the build is a required verification step.

**Primary recommendation:** Do the prose edits, then treat two transform interactions as first-class tasks: (1) word the README migration/retirement statements so the blunt `gsd:`->`bm:` flip produces a correct sentence in BOTH packages (use the bare word `gsd` with no colon for the retirement statement, which the transform leaves untouched); (2) update `stampBmManifest` in `bin/build-bm.cjs` to emit a fixed, correct bm description instead of deriving it from the (now Buildomator-worded) gsd description, and update the assertion in `tests/build-bm-drift.test.cjs`. Bump the version via `plugin.json`, run `node bin/build-bm.cjs` to regenerate `dist/bm` and sync marketplace versions, then run the full bm gate suite plus a manual `dist/bm/README.md` read.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brand prose (README, marketplace descriptions) | Authored source (repo root) | Generated bm package (`dist/bm`) via transform | README + `plugin.json` are gsd source that flows through `build-bm.cjs`; marketplace.json is authored directly and excluded from the copy |
| Metadata links (homepage/repository) | `plugin.json` + `marketplace.json` | Generated `dist/bm/.claude-plugin/plugin.json` | `stampBmManifest` preserves `repository`/keywords; `homepage` is not currently a `plugin.json` field |
| Deprecation-nudge date string | `bin/gsd-tools.cjs` SessionStart branch (gsd only) | bm package suppresses the whole block (`suppressNudge`) | Phase 14 mechanism; this phase edits the string only |
| bm package description | `stampBmManifest` in `bin/build-bm.cjs` | `tests/build-bm-drift.test.cjs` assertion | Derived from the gsd description today; D-09 breaks the derivation |
| Version single-sourcing | `plugin.json` `version` | `syncMarketplaceVersions` + `README` "Plugin version" line (manual) | build-bm reads plugin.json and stamps every manifest site; README line is manual and currently stale (`4.0.1`) |
| Logo asset | `assets/` (tracked) | Copied verbatim into `dist/bm/assets/` | Binary file, byte-identical copy; filename has no colon so no transform interaction |

## Project Constraints (from CLAUDE.md)

- **No em-dashes / en-dashes anywhere** (user global rule). The codebase uses the double-hyphen `--` as the stylistic stand-in (e.g. `"Buildomator -- structured workflow plugin..."`); match that, do not introduce `—` or `–`.
- **Never the word "canonical."**
- **Copy reads like a person wrote it:** no rule-of-three triads, no "seamless/robust/leverage/ensures/elevate", no hollow superlatives, no over-balanced parallelism.
- **Generated Code Hygiene:** no GSD workflow metadata (phase/plan/wave numbers, "skeleton only") in product source, comments, or commit messages. Applies to README/CHANGELOG/marketplace prose too.
- **No bundled `commands/`:** not touched by this phase; do not add one.
- **Release conventions:** every release bumps BOTH `plugin.json` and `marketplace.json` (build-bm's `syncMarketplaceVersions` does the marketplace half automatically); releases ship as git tags.
- **Keep functional identifiers unchanged** (`gsd-sdk`, `gsd-plugin`, `gsd-tools`, cache paths, filenames). Only brand-name prose changes.

## The bm Build Transform (the #1 risk, fully mapped)

`bin/build-bm.cjs` generates `dist/bm/` from `git ls-files` (tracked files only), applying, in order, to each text file that is not excluded:

1. `rewriteCommandRefs(text)` -- regex `/gsd:(?!\/)/g` -> `bm:` (every `gsd:` not followed by a slash), plus the exact-literal `/gsd[:-]` -> `/bm[:-]` sanitizer flip. `gsd://` URIs and bare `gsd` (no colon) survive. Case-sensitive: `GSD:` markers survive.
2. `stampHookFallback(text)` -- flips `cache/gsd-plugin/gsd` -> `cache/gsd-plugin/bm` and `'gsd-plugin', 'gsd'` -> `'gsd-plugin', 'bm'`.
3. `suppressNudge(text)` -- strips the line-anchored `// BM-NUDGE-START ... // BM-NUDGE-END` block.

Then `dist/bm/.claude-plugin/plugin.json` is OVERWRITTEN by `stampBmManifest(srcManifest)` (raw JSON parse of source `plugin.json`, NOT command-rewritten), and `syncMarketplaceVersions` writes every root marketplace entry's `version` to match `plugin.json`.

### Per-file behavior of every artifact this phase edits

| File | In command-rewrite? | In STAMP_EXCLUDE? | What happens to it in dist/bm |
|------|--------------------|--------------------|-------------------------------|
| `README.md` | YES (rewritten) | no | Every `/gsd:` flips to `/bm:`. Command examples become correct `/bm:` examples. **Migration narrative that means `/gsd:` literally becomes wrong** (see below). Census scans it for leaked `gsd:` tokens. |
| `.claude-plugin/plugin.json` (source) | copied then OVERWRITTEN | n/a | The copy is discarded; `stampBmManifest` rebuilds it from the raw source manifest. `description` is derived by prefix-stripping (see the description bug below). `repository`/`keywords`/`author`/`license` preserved verbatim; `homepage`, if added, is preserved verbatim. `name`->bm, `displayName`->Buildomator, `mcpServers` rekeyed gsd->bm. |
| `.claude-plugin/marketplace.json` | EXCLUDED from copy (`EXCLUDE_EXACT`) | n/a | Never enters dist/bm. Root file owns BOTH entries. Fully manual; `/bm:` and `/gsd:` in it are literal as written. `syncMarketplaceVersions` rewrites both entries' `version` on a real build. |
| `CHANGELOG.md` | EXCLUDED (`COMMAND_REWRITE_EXCLUDE`) AND in `STAMP_EXCLUDE` | yes | Preserved verbatim. `/gsd:` written here survives literally in both packages. Safe to write the retirement story with literal `/gsd:`. |
| `bin/gsd-tools.cjs` (nudge string) | YES (rewritten) | no | `/gsd:` -> `/bm:` in the nudge string, but `suppressNudge` then strips the entire BM-NUDGE block, so the bm package emits no nudge at all (Phase 14 D-06 confirmed). The date string only ever matters in the gsd package. |
| `assets/<new-logo>.png` | binary, verbatim copy | n/a | Byte-identical copy into `dist/bm/assets/`. Filename has no colon, no interaction. |

### Risk 1 -- README migration narrative flips to nonsense for bm

**VERIFIED** (`bin/lib/bm-transform.cjs:20`, `bin/build-bm.cjs:191`): README is command-rewritten. A D-04 sentence written as `"/gsd: retires at v5.0 on 2026-10-01"` becomes, in `dist/bm/README.md`, `"/bm: retires at v5.0 on 2026-10-01"` -- factually wrong and alarming for a Buildomator user. `"/bm:X is identical to /gsd:X"` becomes `"/bm:X is identical to /bm:X"` (pointless but harmless). The `bm-parity` census (below) will NOT catch this: it only flags leaked `gsd:` tokens, and after the flip there are none. Only a human read catches it.

**Two viable strategies (planner picks one):**

- **Strategy A -- prose engineering (recommended; no transform change, matches the "prose/metadata only" phase intent).** Write the retirement + identity statements with the bare word `gsd` (no colon, no slash), which `/gsd:(?!\/)/` never matches. Example that reads identically and stays correct in BOTH packages: `"The original gsd command prefix retires at v5.0 on 2026-10-01."` Reserve literal `/gsd:` -> `/bm:` flips for actual command examples, where the flip is desirable. Requires a careful human read of `dist/bm/README.md` to confirm the generated prose reads correctly (the mandatory verification step regardless).
- **Strategy B -- sentinel suppression (robust, but a transform change).** Mirror the proven `BM-NUDGE` pattern: wrap the gsd-only migration section in a new markdown sentinel (e.g. an HTML comment pair) and add a suppress pass to `bm-transform.cjs` + `build-bm.cjs`, so the bm README omits the section entirely. This touches the build transform, its tests, and forces a `dist/bm` regen; heavier, and arguably out of a "prose only" phase.

Recommendation: **Strategy A.** It keeps the phase within the prose/metadata layer, needs no transform edit, and the existing gates plus one manual read fully cover it. Flag Strategy B in the plan only as the fallback if the prose cannot be made to read cleanly in both packages.

### Risk 2 -- plugin.json description double-prefix under D-09

**VERIFIED** (`bin/build-bm.cjs:143-148`, `tests/build-bm-drift.test.cjs:89-98`). `stampBmManifest` builds the bm description as:

```js
'Buildomator -- ' + String(srcManifest.description || '').replace(/^Get Shit Done -- /, '')
```

Today the source description starts with `"Get Shit Done -- "`, so the strip fires and the result is clean: `"Buildomator -- a structured workflow plugin..."`. D-09 flips the source description to Buildomator-worded. If the new source description starts with `"Buildomator -- "` (or `"Buildomator (legacy /gsd:) -- "`), the `^Get Shit Done -- ` strip does NOT match, and the bm description becomes `"Buildomator -- Buildomator -- ..."` (doubled), possibly carrying a raw `(legacy /gsd:)` clause the bm package should never show. **The drift gate cannot catch this:** `--check` regenerates and byte-diffs against the committed `dist/bm`; if the planner regenerates after the edit, the doubled description is baked into both sides and `--check` passes. Only the semantic wrongness remains.

**Recommended fix:** change `stampBmManifest` to set a FIXED, authoritative bm description independent of the gsd wording, e.g.:

```js
description: 'Buildomator -- structured workflow plugin for Claude Code with planning, execution, verification, and MCP-backed project state',
```

This decouples the bm manifest from the gsd description entirely and removes the fragile prefix-strip. It is a small, safe edit to the "code-adjacent surface" the CONTEXT explicitly anticipates (`bin/build-bm.cjs`). It REQUIRES a matching update to `tests/build-bm-drift.test.cjs:89-98` (the assertion currently expects the derived string) and a `dist/bm` regen. `[ASSUMED]` on the exact fixed wording -- the planner/user should confirm the final bm description sentence.

### Confirmed non-risks

- **Nudge in bm:** `suppressNudge` strips the whole block; `dist/bm/bin/gsd-tools.cjs` emits nothing. Verified the sentinels at `bin/gsd-tools.cjs:1280-1287`.
- **Marketplace descriptions:** authored directly, excluded from the copy; no transform interaction. Verified `EXCLUDE_EXACT` at `bin/build-bm.cjs:59`.
- **CHANGELOG `/gsd:`:** preserved verbatim (double-excluded). Verified `COMMAND_REWRITE_EXCLUDE` + `STAMP_EXCLUDE` at `bin/build-bm.cjs:88,112`.
- **Version single-sourcing:** `plugin.json` is the single source; `syncMarketplaceVersions` propagates to both marketplace entries on a real build. Verified `bin/build-bm.cjs:216-231`.

## Files to Edit -- Current State Inventory

| File | Current relevant state | Required change |
|------|------------------------|-----------------|
| `README.md` | H1 `# Get Shit Done for Claude Code`; header `<img src="assets/gsd-plugin-logo.png" ... width="320" />` (line 1-3); `**Plugin version:** \`4.0.1\`` (line 7, STALE vs plugin.json 4.0.4); ~82 `/gsd:` command mentions; no "Migrating from /gsd:" section yet | D-04/D-05/D-06/D-11: rebrand H1 + intro, swap logo src, add migration section, bump version line to `4.1.0`, point brand/docs links at buildomator.com |
| `.claude-plugin/plugin.json` | `name: "gsd"`, `version: "4.0.4"`, `description: "Get Shit Done -- a structured workflow plugin..."`, `repository: github.com/jnuyens/gsd-plugin`, NO `homepage` field, `mcpServers.gsd` | D-09/D-02/D-11: flip description to Buildomator-worded, ADD `homepage: https://buildomator.com`, set `repository: https://buildomator.com`, bump `version: "4.1.0"`. Keep `name:"gsd"` + `gsd` keyword. |
| `.claude-plugin/marketplace.json` | Two entries. gsd: `description: "Get Shit Done -- ..."`, `homepage`/`repository` = github, `version: "4.0.4"`, no `displayName`. bm: `displayName: "Buildomator"` (Phase 13), `description: "Buildomator -- ..."`, github links, `version: "4.0.4"` | D-07/D-08/D-02/D-11: bm entry leads as primary ("use /bm:"); gsd entry `displayName: "Buildomator (legacy /gsd:)"` + legacy description naming 2026-10-01; both entries homepage+repository -> buildomator.com; both versions -> 4.1.0 (build-bm can sync the versions). |
| `CHANGELOG.md` | `## [Unreleased]` is empty; `## [4.0.4]` is the top real entry; entries carry a gsd-core provenance line | D-10: promote `[Unreleased]` to `## [4.1.0] - <date>` with rebrand + additive-strategy + 2026-10-01 retirement; keep the provenance line. |
| `bin/gsd-tools.cjs` (nudge) | Lines 1283-1284: `'...being renamed to /bm: (Buildomator). Both prefixes work throughout the 4.x line; /gsd: retires at v5.0.\n'` | D-01: add `on 2026-10-01` to the retirement clause. String only. Do not touch the `if (hookIdentity === 'gsd')` guard or sentinels. |
| `assets/` | `gsd-plugin-logo.png` (1276x522), `gsd-plugin-logo-1280-640.png` (1280x640) | D-06: add the chosen Buildomator logo file (copied from the read-only source), reference it in README. Old file may stay (harmless) or be removed. |
| `bin/build-bm.cjs` (`stampBmManifest`) | Derives bm description by stripping `^Get Shit Done -- ` | Set a fixed bm description (see Risk 2). |
| `tests/build-bm-drift.test.cjs` | Lines 76-98: mock `SRC_MANIFEST` with the old description + asserts the derived bm description | Update the assertion (and, if the fixed-string approach is used, the expectation) to match the new `stampBmManifest`. |
| `dist/bm/**` | Committed generated tree at version 4.0.4 | Regenerate via `node bin/build-bm.cjs` after all source edits; commit the result. |

## Logo Assets

Read-only source `/Users/jnuyens/src/buildomator.com`. The root and `src/assets/` copies are byte-identical pairs; the distinct options are:

| Candidate | Dimensions | Aspect | Notes |
|-----------|-----------|--------|-------|
| `buildomator-logo-big.png` (= `src/assets/logo-big.png`) | 2466 x 1470 | ~1.68:1 | Highest resolution; scales cleanly to a 320px header |
| `buildomator-logo-small.png` (= `src/assets/logo-small.png`) | 822 x 490 | ~1.68:1 | Same aspect, lower res |
| `buildomator-logo-square.png` (= `src/assets/logo-square.png`) | 1479 x 1479 | 1:1 | Square logo mark |

Current header logo `gsd-plugin-logo.png` is 1276 x 522 (~2.44:1 wide banner) at `width="320"`. No candidate matches that wide banner aspect; the closest wordmark-style options are the ~1.68:1 big/small pair. `buildomator-logo-big.png` gives the best resolution at a 320px render. Final choice is Claude's discretion (D-06); pick one, copy it into `assets/`, and set the `<img>` `src` + `width`. `[ASSUMED]` that a 320px width remains the desired header size; adjust if the chosen aspect looks too tall.

## Consistency Map -- retirement date "2026-10-01"

D-01 requires the date and additive-strategy story to read identically wherever it appears. Every location:

| Location | File | Transform note | Statement form to use |
|----------|------|----------------|-----------------------|
| CHANGELOG 4.1.0 entry | `CHANGELOG.md` | verbatim (excluded) | literal `/gsd:` is safe here |
| README migration section | `README.md` | command-rewritten | use bare `gsd` for the retirement statement so it stays correct in bm (Strategy A) |
| Marketplace legacy (gsd) entry description | `.claude-plugin/marketplace.json` | verbatim (excluded from copy) | literal `/gsd:` is safe here |
| Deprecation-nudge string | `bin/gsd-tools.cjs` | rewritten then suppressed in bm | matters only in gsd; literal `/gsd:` is fine |

The date token `2026-10-01` itself contains no `gsd`/`bm` token and is never transformed, so it appears identically in all four locations by construction. The only divergence risk is the surrounding words in the README (Strategy A neutralizes it).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Generate the bm package after edits | A manual copy/sed of `dist/bm` | `node bin/build-bm.cjs` | The transform is the single source of the bm package; hand-editing dist/bm guarantees a `--check` drift failure |
| Sync the marketplace version | Hand-edit both marketplace entries' `version` | `node bin/build-bm.cjs` (runs `syncMarketplaceVersions`) | Single-sources version from plugin.json; hand-editing risks a mismatch the version-alignment gate fails |
| Suppress the nudge / flip commands for bm | New ad-hoc string replaces | The existing `rewriteCommandRefs` / `suppressNudge` passes | Already proven, idempotent, gate-covered |

**Key insight:** the ONLY authored inputs are the source files; `dist/bm` is always regenerated, never edited. Every phase edit is "change source, rebuild, verify."

## Runtime State Inventory

This is a rebrand phase, but a prose/metadata one with no live external services. Explicit findings:

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | None. No datastore keys on "gsd"/"buildomator" strings are touched by this phase (verified: scope is docs + manifests only). | none |
| Live service config | None. buildomator.com is a separate repo; this phase only links to it. No n8n/Datadog/etc. state. | none |
| OS-registered state | None. No task-scheduler/cron/launchd descriptions change (the cron watchers key on `gsd-plugin`, which stays). | none |
| Secrets / env vars | None. No secret or env-var names reference the rebranded prose. `CLAUDE_PLUGIN_ROOT` and cache paths stay `gsd-plugin` (D-03/D-05). | none |
| Build artifacts | `dist/bm/` (committed generated tree) is STALE after these edits and MUST be regenerated (`node bin/build-bm.cjs`) and re-committed. Marketplace `version` fields are build-synced. | regenerate + commit dist/bm |

**The key question answered:** after the source edits, the only runtime/build system still carrying old strings is the committed `dist/bm` tree; regenerating it is a required task, gated by `build-bm.cjs --check`.

## Common Pitfalls

### Pitfall 1: Regenerating dist/bm hides semantic bugs behind a green drift gate
**What goes wrong:** You edit source, run `node bin/build-bm.cjs`, and `--check` passes, so you assume the bm package is correct. But `--check` only proves the committed tree equals a fresh build; a doubled description or a "`/bm:` retires" sentence is baked into both and passes.
**How to avoid:** After the build, READ `dist/bm/README.md` (migration section) and `dist/bm/.claude-plugin/plugin.json` (`description`) by eye. Make this an explicit verification task, not an afterthought.
**Warning signs:** any `Buildomator -- Buildomator` substring; any `/bm:` in a retirement/"identical to" sentence; a legacy `/gsd:` clause showing in the bm manifest.

### Pitfall 2: Editing dist/bm directly
**What goes wrong:** Fixing a typo in `dist/bm/README.md` directly makes `--check` fail (the committed tree no longer equals a fresh build), or worse, passes locally but diverges from source.
**How to avoid:** Only ever edit source, then rebuild.

### Pitfall 3: Forgetting the README "Plugin version" line
**What goes wrong:** It is manual (not build-synced) and is ALREADY stale at `4.0.1` while plugin.json is `4.0.4`. Bumping plugin.json to 4.1.0 will not touch it.
**How to avoid:** D-11 explicitly includes the README line; treat it as a separate edit. Consider stating the fix of the pre-existing 4.0.1->4.1.0 drift in the plan.

### Pitfall 4: Breaking the stampBmManifest description contract silently
**What goes wrong:** D-09 flips the source description; `stampBmManifest` still tries to strip `^Get Shit Done -- `; the bm description doubles. The unit test at `build-bm-drift.test.cjs:89` still passes only if you ALSO change it, otherwise it fails (this one the test WILL catch, because it uses a fixed mock input).
**How to avoid:** Change `stampBmManifest` and the test together; prefer a fixed bm description string.

### Pitfall 5: A `/gsd:` in the marketplace legacy description read as a command flip
**What goes wrong:** none, actually -- but do not "helpfully" try to make the transform touch marketplace.json. It is intentionally excluded. Write the gsd legacy entry with literal `/gsd:` as desired.

## Validation Architecture

> The nyquist config is not explicitly `false`, so this section is included. There is no `test/` unit-test framework for prose; validation is the existing zero-dep Node gate suite plus targeted manual reads. All commands run from the repo root, no `npm ci` needed (zero-dep, Node built-ins + git).

### (a) The bm transform still produces a correct, parity-clean bm package

Run, in order, after all source edits and the `node bin/build-bm.cjs` regen:

```bash
node bin/build-bm.cjs                 # regenerate dist/bm + sync marketplace versions
node tests/build-bm-drift.test.cjs    # unit + integration: stampBmManifest, shouldExclude, build
node bin/build-bm.cjs --check         # committed dist/bm == fresh deterministic build (exit 0)
node tests/bm-parity.test.cjs         # skill/full inventory + fail-closed gsd-leak census + --check
node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json   # bm manifest schema-valid
```

Plus the semantic check the gates cannot do (MANDATORY, manual):

```bash
# Read the generated bm prose by eye. Expect NO "/bm: retires", NO "Buildomator -- Buildomator",
# NO leftover "(legacy /gsd:)" in the bm manifest description.
sed -n '/Migrating/,/^## /p' dist/bm/README.md
node -e "console.log(require('./dist/bm/.claude-plugin/plugin.json').description)"
```

Expected: `bm-parity` census reports zero leaked `gsd:` tokens in `dist/bm` (it scans every non-STAMP_EXCLUDE text file including the regenerated README); `--check` exits 0; the manual read shows correct Buildomator prose.

### (b) The retirement date reads identically everywhere

```bash
grep -rn "2026-10-01" CHANGELOG.md README.md .claude-plugin/marketplace.json bin/gsd-tools.cjs
# Expect a hit in each of the four locations; eyeball that the surrounding sentence matches.
grep -c "2026-10-01" dist/bm/README.md dist/bm/CHANGELOG.md   # date survives the transform unchanged
```

### (c) Links resolve to buildomator.com

```bash
node -e "const p=require('./.claude-plugin/plugin.json'); console.log(p.homepage, p.repository)"
node -e "const m=require('./.claude-plugin/marketplace.json'); m.plugins.forEach(e=>console.log(e.name, e.homepage, e.repository))"
grep -n "buildomator.com" README.md
# Expect https://buildomator.com in plugin.json homepage+repository, both marketplace entries, and README brand/docs links.
```

Live-resolution of `https://buildomator.com` is out of scope (the site is a separate repo, may not be deployed yet); assert the STRINGS are wired, not that the URL 200s. `[ASSUMED]` the site will resolve by the time this ships.

### (d) Version is bumped consistently in all required files

```bash
node bin/maintenance/check-version-alignment.cjs   # plugin.json == marketplace entries; milestone major == plugin major
node tests/version-alignment.test.cjs
grep -n "Plugin version" README.md                 # must read 4.1.0 (was stale 4.0.1)
node -e "console.log(require('./.claude-plugin/plugin.json').version)"  # 4.1.0
```

`check-version-alignment` passes when plugin major (4) equals milestone major (v4.1 -> 4) and plugin.json == both marketplace entries. `build-bm.cjs` keeps marketplace in sync automatically; the README line is the one manual site to verify.

### Wave 0 gaps

- None for test infrastructure. The gate suite already exists (`tests/build-bm-drift.test.cjs`, `tests/bm-parity.test.cjs`, `tests/version-alignment.test.cjs`) and runs in CI (`.github/workflows/check-drift.yml` jobs `version-alignment`, `bm-build-drift`, `bm-coexistence`).
- The ONE new automated assertion needed: update `tests/build-bm-drift.test.cjs:89-98` to match the changed `stampBmManifest` description. This is an edit to an existing test, not new infra.
- The migration-prose semantic correctness has NO automated gate by nature; the manual `dist/bm/README.md` read is the coverage. State it as an explicit verification step in the plan.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages. All tooling (`node`, `git`, `sips` for logo dims) is already present. No npm/pip/cargo additions.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| node | build-bm + all gates | assumed (project runtime) | -- | none needed |
| git | build-bm `git ls-files`, tests | yes (repo) | -- | none |
| Read-only logo source `/Users/jnuyens/src/buildomator.com` | D-06 logo copy | yes | -- | none (verified the candidate PNGs exist) |

No missing dependencies. `sips` (used only to measure logo dimensions during research) is macOS-native and not required by the build.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Exact fixed bm `plugin.json` description wording (Risk 2 fix) needs user confirmation | The bm Transform / Risk 2 | Low: any clean "Buildomator -- ..." string works; wording is cosmetic |
| A2 | 320px header width remains desired for the new logo | Logo Assets | Low: purely visual; adjust after eyeballing the render |
| A3 | `https://buildomator.com` will resolve (site live) by ship time | Validation (c) | Medium: dead links in shipped README/metadata if the site is not deployed; wiring the string is still correct per D-02 |
| A4 | Strategy A (prose engineering) can express the migration section cleanly in both packages | Risk 1 | Low-Medium: if a sentence cannot be made correct in both, fall back to Strategy B (sentinel suppression, a transform change) |

## Open Questions

1. **Final bm plugin.json description wording (D-09 + Risk 2).**
   - What we know: it must be Buildomator-worded and must not double-prefix in the generated bm manifest.
   - What's unclear: exact sentence, and whether the gsd source description should carry a "(legacy /gsd:)" clause (which must NOT leak into bm).
   - Recommendation: set a fixed bm description in `stampBmManifest`; let the gsd source description carry whatever legacy wording D-09 wants, since the bm side no longer derives from it.

2. **Keep or remove the old `assets/gsd-plugin-logo.png`.**
   - What we know: it is only referenced by the README header, which D-06 repoints.
   - Recommendation: removing it is cleaner, but keeping it is harmless (it still ships into dist/bm as an unused asset). Claude's discretion.

## Sources

### Primary (HIGH confidence)
- `bin/build-bm.cjs` (working tree) -- transform order, exclude sets, `stampBmManifest`, `syncMarketplaceVersions`, `--check`.
- `bin/lib/bm-transform.cjs` -- `rewriteCommandRefs` regex, `stampHookFallback`, `suppressNudge` sentinels.
- `tests/bm-parity.test.cjs`, `tests/build-bm-drift.test.cjs` -- the census + the description assertion the phase must update.
- `.github/workflows/check-drift.yml` -- the CI jobs (`version-alignment`, `bm-build-drift`, `bm-coexistence`) and their exact commands.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`, `CHANGELOG.md`, `bin/gsd-tools.cjs:1280-1290` -- current state of every edited file.
- `sips` dimension probe of `assets/*.png` and the `/Users/jnuyens/src/buildomator.com` candidates.
- `.planning/phases/15-*/15-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` -- decisions and requirements.

### Secondary / Tertiary
- None. All findings are verified against the repository itself; no web sources needed for this phase.

## Metadata

**Confidence breakdown:**
- Transform behavior + risks: HIGH -- read directly from source, exclude sets, and the census test.
- File current-state inventory: HIGH -- read each file in this session.
- Logo dimensions: HIGH -- measured with `sips`.
- Final prose wording: MEDIUM -- Claude's discretion / user confirmation (Assumptions A1-A4).

**Research date:** 2026-07-12
**Valid until:** stable (repo-internal; valid until `bin/build-bm.cjs`, the exclude sets, or the edited files change materially)
</content>
</invoke>
