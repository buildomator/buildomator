# Redux upstream comparison vs last followed v1.42.3

**Date:** 2026-05-22
**Plugin version at writing:** 2.43.6
**Last followed upstream:** GSD 1.42.3 (`gsd-build/get-shit-done` tag at commit `7dfeb7ad`)
**New upstream:** [`open-gsd/get-shit-done-redux`](https://github.com/open-gsd/get-shit-done-redux)

This document records the upstream-state delta as of the v2.43.6 release (the upstream-pointer switch). It informs the timing and scope of the next sync cycle. Re-run a similar comparison before each upstream sync to gauge merge cost.

## Method

Used the GitHub Compare API (`gh api repos/open-gsd/get-shit-done-redux/compare/<v1.42.3-sha>...main`) to enumerate ahead/behind counts and file deltas. Cross-checked `sdk/src/query/phase.ts` (which we knew was changed by upstream PR #88) to calibrate the API's file-list truncation behavior. The response caps at 300 files; spot-checks confirmed sdk-tree changes beyond the cap.

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Commits ahead of v1.42.3 | 290 | Includes post-v1.42.3 gsd-build development, redux migration commits, and PR #88 (case-insensitive fix) |
| Commits behind v1.42.3 | 41 | **Not actually missing.** Migration rebased history; original SHAs still exist as orphaned objects (e.g. `2fd93736` is reachable by SHA but not via redux `main`). Same content, different ancestry graph. |
| Files changed | 300+ | API truncated at 300; spot-check confirms `sdk/src/query/phase.ts` is among the truncated entries |
| Tag preservation | broken | redux has 1 tag (`v1.0.0`); the migration announcement's "229 tags mirrored" did not produce tag refs in the new repo. The v1.42.3 commit exists; the v1.42.3 tag does not. |

## Commit-type distribution (latest ~250 of 290)

| Type | Count |
|---|---|
| fix | 117 |
| test | 25 |
| feat | 23 |
| chore | 20 |
| refactor | 14 |
| docs | 11 |
| ci | 2 |

Heavy stabilization since v1.42.3 (117 fix commits, 25 test commits). Post-v1.42.3 gsd-build main was actively maturing before the rug-pull.

## Plugin-patched files modified upstream

All three plugin-patched `bin/lib/*.cjs` files have upstream changes that will need 3-way merge on the next sync:

| File | Plugin patch | Upstream churn | Action on next sync |
|---|---|---|---|
| `get-shit-done/bin/lib/core.cjs` | `#PLUGIN-AGENTS-DIR` (resolveGsdRoot/getAgentsDir) | 296 lines changed | 3-way merge; re-insert `#PLUGIN-AGENTS-DIR` patch at `getAgentsDir()` site |
| `get-shit-done/bin/lib/model-catalog.cjs` | `#PLUGIN-MODEL-CATALOG-PATH` (flat-layout candidate) | Modified | 3-way merge; re-insert flat-layout candidate at position 0 of the resolver list |
| `get-shit-done/bin/lib/phase.cjs` | `#PLUGIN-DEPS-ON-CASE-INSENSITIVE` (case-insensitive deps_on) | 257 lines changed | **Patch retires.** Upstream now has the fix natively via PR #88, with a stronger collision-detection guard than the plugin's version. Drop the patch markers on sync. |

## SDK source path (also affected, hidden behind API truncation)

`sdk/src/query/phase.ts` is in the redux delta but did not appear in the GitHub compare API's file list (capped at 300). Confirmed by direct file-content diff at the two refs: at v1.42.3 the file uses strict-case `Map.has()` lookups; at redux main it uses lowercased keys plus a case-fold collision guard (`if (seenLower.has(lower))` block at lines 566-590). This is the upstream version of `#PLUGIN-DEPS-ON-CASE-INSENSITIVE` from plugin v2.43.5, landed as redux PR #88. The plugin's bundled SDK at `sdk/dist/cli.js` will pick this up on the next rebuild after sync.

## New upstream modules

These new files will arrive in the plugin tree on the next sync. None of them touch existing plugin patches; they are additive:

| Module | Size | Purpose |
|---|---|---|
| `get-shit-done/bin/lib/prompt-budget.cjs` | 399 LOC | New module |
| `get-shit-done/bin/lib/runtime-artifact-layout.cjs` | 301 LOC | Paired with ADR 3660 |
| `get-shit-done/bin/lib/cjs-sdk-bridge.cjs` | 136 LOC | CJS/SDK bridging seam |
| `get-shit-done/bin/lib/command-routing-hub.cjs` | 239 LOC | New |
| `get-shit-done/bin/lib/configuration.generated.cjs` | 253 LOC | Codegen output |
| `get-shit-done/bin/lib/schema-detect.generated.cjs` | 170 LOC | Codegen output |
| `docs/agents/cjs-sdk-seam.md` | 269 LOC | Contributor doc referenced by redux's CONTRIBUTING.md |
| `docs/RELEASE-v1.42.3.md` | 157 LOC | Post-hoc release notes that gsd-build never published |

The `docs/agents/cjs-sdk-seam.md` doc is referenced from CONTRIBUTING.md as a contributor requirement when working on `bin/lib/*.cjs` or `sdk/src/**`. Worth reading before the next sync since several plugin patches touch those files.

## Workflows: 45 modified

`workflows/execute-phase.md` alone has 193 lines of changes. Plugin maintains its own copy of every workflow in the flat-layout `workflows/` dir, so each modified workflow needs 3-way merge OR wholesale upstream copy. Pattern of past syncs is wholesale copy with hand-inspection of executor-related workflows for plugin-patched behaviors.

## Agents: 9 modified

`gsd-executor`, `gsd-planner`, `gsd-roadmapper`, `gsd-phase-researcher`, `gsd-research-synthesizer`, `gsd-intel-updater`, plus 3 others. Most modifications are scope-tightening or prompt-clarity. Worth diffing before deciding which to merge wholesale vs hold.

## Migration-specific scrubs

Files where `$GSD` token references, founder social handles (`@official_taches`), or crypto-adjacent language were scrubbed during the migration to redux. Plugin can adopt these scrubs wholesale; no behavior change for users:

- `.changeset/opengsd-org-rename.md` (rename changeset)
- 6 `agents/*.md` files
- 4 `commands/gsd/*.md` files (`help.md`, `plan-phase.md`, `profile-user.md`, `surface.md`)
- `get-shit-done/bin/gsd-tools.cjs`
- `get-shit-done/bin/lib/gsd2-import.cjs`
- `bin/gsd-sdk.js`
- `docs/gsd-sdk-query-migration-blurb.md`

## Removed upstream

- `.github/workflows/canary.yml` (157 lines)

Plugin does not mirror this file (it's CI for the npm-published package, not the plugin). No action needed.

## Migration fidelity note

The `behind_by: 41` stat is potentially alarming on first read. It is not a fidelity problem. The migration appears to have rebased the post-v1.42.3 commit chain (probably to clean up `$GSD`-related commits into squashed scrub commits, or to apply systematic author rewrites). The original commit objects (e.g., `2fd93736` "chore: bump version to 1.42.3 for hotfix") still exist in the redux repo and resolve by SHA; they just are not reachable from `main`. Functional content is preserved. Implication for plugin tooling: any plugin tool that hashes upstream commits for drift detection (`bin/maintenance/check-upstream-schema.cjs` and friends) will need a re-baseline against redux SHAs after the next sync.

## Implications for plugin sync cycle

1. **No urgency.** The current plugin (v2.43.6) is functionally identical to v2.43.5 plus the documentation/pointer switch. All upstream changes can wait for a natural sync cycle.

2. **Next sync will be substantial.** ~290 commits, 300+ files. 3-way merge required on 3 plugin-patched files. Plus the case-insensitive patch retirement. Plus 6 new modules to fold in. Plus 45 workflow updates. Plus 9 agent updates.

3. **Wait for the first redux release.** Redux currently has only one tag (`v1.0.0` at the migration commit, 2026-05-22 20:45 UTC). The first real post-migration release (probably v1.43.0 in redux's scope, or v2.0.0 if they restart numbering) is the natural sync trigger. Right now the redux main is still in active migration cleanup.

4. **Deferred maintenance items from v2.43.6** become natural pickup at next sync:
   - `bin/maintenance/check-upstream-schema.cjs` retarget from `gsd-build/get-shit-done` to `open-gsd/get-shit-done-redux`, including the tarball-naming change (`get-shit-done-${clean}` → `get-shit-done-redux-${clean}`).
   - `sdk/package.json` self-identification from `@gsd-build/sdk` to `@gsd-redux/sdk`.
   - `sdk/README.md` namespace references.

5. **Patch retirement target:** `#PLUGIN-DEPS-ON-CASE-INSENSITIVE` retires on first redux-based sync (upstream now has its own version with collision-detection guard). Inventory update needed in `feedback_plugin_patches_inventory.md` memory after the sync.
