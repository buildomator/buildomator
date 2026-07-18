---
phase: quick-260718-vxw
plan: 01
subsystem: cjs-sdk-parity
tags: [upstream-sync, cjs-sdk-parity, surface, config-set, plan-scan, completion-count]
provenance:
  source: gsd-core 1.7.0
  prs: [2018, 1581, 1988]
  triage: 260718-vhs-FINDINGS.md
requires: []
provides:
  - surface-empty-manifest-guard
  - config-set-finite-and-string-key-coercion
  - phase-completion-summary-pairing
affects:
  - bin/lib/surface.cjs
  - bin/lib/config.cjs
  - bin/lib/plan-scan.cjs
  - bin/lib/roadmap.cjs
  - bin/lib/init.cjs
  - sdk/src/query/config-mutation.ts
  - sdk/src/query/plan-scan.ts
  - sdk/src/query/roadmap-update-plan-progress.ts
  - sdk/src/query/init-complex.ts
  - sdk/src/query/roadmap.ts
key-files:
  created:
    - tests/surface-empty-manifest-agents.test.cjs
    - tests/config-set-coercion.test.cjs
    - tests/plan-scan-matched-summaries.test.cjs
  modified:
    - bin/lib/surface.cjs
    - bin/lib/config.cjs
    - bin/lib/plan-scan.cjs
    - bin/lib/roadmap.cjs
    - bin/lib/init.cjs
    - sdk/src/query/config-mutation.ts
    - sdk/src/query/config-mutation.test.ts
    - sdk/src/query/plan-scan.ts
    - sdk/src/query/plan-scan.test.ts
    - sdk/src/query/roadmap-update-plan-progress.ts
    - sdk/src/query/roadmap-update-plan-progress.test.ts
    - sdk/src/query/init-complex.ts
    - sdk/src/query/init-complex.test.ts
    - sdk/src/query/roadmap.ts
    - sdk/src/query/roadmap.test.ts
    - sdk/dist/
    - dist/bm/
metrics:
  tasks: 4
  commits: 4
  files_changed: 18
  completed: 2026-07-19
---

# Quick 260718-vxw: Port upstream gsd-core 1.7.0 Tier-1 correctness fixes Summary

Ported three Tier-1 correctness fixes from the 260718-vhs triage of gsd-core 1.7.0 into this fork: the applySurface empty-manifest agent-delete guard (CJS only, upstream #2018), the config-set Infinity/string-key coercion fix (both twins, upstream #1581), and the stray-summary phase-completion inflation fix threaded through every completion consumer in both twins (upstream #1988).

## What shipped

**Task 1 — surface empty-manifest guard (commit a89b3e3, CJS only)**
`applySurface` now refuses to sync when the manifest is null or empty, and `_syncGsdDir` skips the prune loop when nothing was staged. Previously an unresolvable install source or empty manifest resolved to empty skill/agent sets, and the prune loop then deleted every installed `gsd-*` agent. Regression test proves empty/null manifest and empty staged dir leave existing agents intact while a populated staged set still prunes superseded files.

**Task 2 — config-set coercion (commit 43e5913, both twins)**
Two coordinated changes kept byte-identical across the CJS and SDK config resolvers:
- The numeric branch now uses `Number.isFinite(Number(value))` (empty-string exclusion preserved), so `'Infinity'`/`'-Infinity'` fall through as literal strings instead of coercing to a non-finite number that `JSON.stringify` writes as `null`.
- A shared `STRING_CONFIG_KEYS` set (`project_code`, `phase_naming`, `response_language`, `claude_md_path`) bypasses coercion entirely so a numeric-looking value like `project_code "007"` persists as the string `"007"`. In CJS the carve-out sits before the coercion chain in `cmdConfigSet`; in the SDK it sits in `configSet` (keyed off the path), not in the key-context-free `parseConfigValue`. config-set golden parity stays green.

**Task 3 — summary-to-plan pairing (commit 9fcfffc, both twins)**
Added one shared `countMatchedSummaries(planFiles, summaryFiles)` helper per twin, built on a layout-agnostic `planSummaryBaseId` that strips the PLAN/SUMMARY marker in flat-suffix, bare, nested-prefix, and extended-infix positions. A summary counts only when its pairing id matches a real plan's id, so `30-FIX-CR02-SUMMARY.md` / `30-GAPCLOSURE-SUMMARY.md` are excluded. `scanPhasePlans` in both twins now derives `summaryCount` and `completed` from the paired count (keeping `summaryFiles` as the raw list), which automatically fixes the Group A callers (roadmap.cjs `countPhasePlansAndSummaries`, state.cjs, workstream-inventory). `roadmap update-plan-progress` was rerouted through the helper in both twins so a stray summary can never tick a phase checkbox. roadmap.update-plan-progress golden parity stays green.

**Task 4 — init and roadmap-analyze consumers + build gates (commit da101c6, both twins)**
Routed the three remaining raw-count consumers through the paired count: `bin/lib/init.cjs` (cmdInitManager and the init phase-list block now take planCount and the paired summaryCount from `scanPhasePlans`), and the two independent duplicate raw scanners in `sdk/src/query/init-complex.ts` (`listPhasePlanAndSummaryCounts`) and `sdk/src/query/roadmap.ts` (`countPhasePlansAndSummaries`) were deleted and replaced with the shared `scanPhasePlans` import. initProgress, initManager, and roadmap.analyze now inherit the paired count. Rebuilt `sdk/dist` and regenerated `dist/bm`; `node bin/build-bm.cjs --check` reports PASS.

## Group C sites left untouched (as scoped)

checkpoint.cjs:139 (already pairs by id), phase.cjs:373 / phase.ts:289 id-pairing, init.cjs:973/985 hasSummary activity checks, state.cjs, roadmap.cjs:41, and workstream-inventory. The display-only "X/Y plans complete" ratio in cmdPhaseComplete (phase.cjs ~1103 / phase-lifecycle.ts ~1073) gates nothing and was left as-is; no verification/completion gate was added there (the deferred #2022 decision remains out of scope). `bin/lib/audit.cjs` was not modified.

## Deviations from Plan

None beyond the notes below. No auto-fixes (Rules 1-3) were needed; all four tasks executed as written.

## Product-code hygiene

No upstream PR numbers or porting notes were introduced into product code or its comments. The PR provenance (#2018, #1581, #1988) lives only in this SUMMARY's frontmatter and prose. Pre-existing "Ported from config.cjs" doc comments in `sdk/src/query/config-mutation.ts` were left as found (not introduced by this work). No em-dashes used.

## Verification

- New CJS regression tests pass standalone: `surface-empty-manifest-agents` (3/3), `config-set-coercion` (4/4), `plan-scan-matched-summaries` (6/6, incl. the CJS `init progress` path).
- `config-schema-sdk-parity` passes.
- SDK unit suite green: 1833 tests, 129 files.
- Directly-relevant cross-boundary golden parity green: config-set (mutation) and roadmap.update-plan-progress (mutation).
- Duplicate raw scanners removed: `grep -c rootSummaries` reports 0 for both init-complex.ts and roadmap.ts; both import from `./plan-scan.js`.
- init.cjs raw completion path gone: `grep "listPhaseSummaryFiles(fullDir).length"` returns nothing.
- Build gates: `npm --prefix sdk run build` succeeds; `node bin/build-bm.cjs` regenerates dist/bm; `node bin/build-bm.cjs --check` reports PASS.

### Pre-existing integration-suite failures (not caused by this work)

The full `npm --prefix sdk run test:integration` suite has 13-14 read-only golden failures on a clean tree, confirmed by stashing this work and re-running (roadmap.analyze, stats.json, and the init.* family all fail on the clean checkout). Root cause: this repo's ROADMAP has an archived, shipped milestone (v4.1), which drives a CJS-vs-SDK divergence in milestone parsing (roadmap.analyze returns `milestones: []` from CJS vs a populated list from SDK), plus volatile/clock-derived fields (current-timestamp, stats.json, state.json) and a missing e2e fixture (`sdk/test-fixtures/sample-plan.md`). Requires `CLAUDE_PLUGIN_ROOT` set to the repo root to resolve the flat-layout CJS core at all. The post-Task-4 failing set is a strict subset of the clean-tree baseline (baseline minus a `current-timestamp` clock flake); this work introduced no new failures and in fact converged the count-related divergences (stats/phase-plan-index/state pass in isolation once both twins share the paired scanner). Logged here rather than fixed because the milestone-parsing divergence and missing e2e fixture are unrelated to these three correctness fixes.

## Self-Check

- Files created exist: tests/surface-empty-manifest-agents.test.cjs, tests/config-set-coercion.test.cjs, tests/plan-scan-matched-summaries.test.cjs — all present.
- Commits exist: a89b3e3, 43e5913, 9fcfffc, da101c6 — all in git log.
