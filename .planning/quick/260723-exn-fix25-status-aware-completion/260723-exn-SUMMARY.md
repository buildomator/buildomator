---
phase: quick-260723-exn
plan: 01
subsystem: completion-count
tags: [cjs-sdk-parity, plan-scan, completion-count, resume-safety, execute-phase]
requires: []
provides: [status-aware-completion, plan-scan-status-set, plan-info-complete-field]
affects: [plan-scan, phase-plan-index, verify-phase-completeness, checkpoint-handoff, roadmap-ticker, phase-runner, check-completion, execute-phase, transition]
tech-stack:
  added: []
  patterns: [status-aware-summary-count, incomplete-status-set, dual-cjs-sdk-twin-parity]
key-files:
  created:
    - tests/status-aware-completion.test.cjs
    - tests/checkpoint-status-aware.test.cjs
  modified:
    - bin/lib/plan-scan.cjs
    - sdk/src/query/plan-scan.ts
    - bin/lib/phase.cjs
    - bin/lib/core.cjs
    - bin/lib/verify.cjs
    - sdk/src/query/verify.ts
    - bin/lib/checkpoint.cjs
    - bin/lib/roadmap.cjs
    - bin/lib/init.cjs
    - sdk/src/query/phase.ts
    - sdk/src/query/roadmap-update-plan-progress.ts
    - sdk/src/query/check-completion.ts
    - sdk/src/phase-runner.ts
    - sdk/src/types.ts
    - workflows/execute-phase.md
    - workflows/transition.md
    - sdk/dist/
    - dist/bm/
decisions:
  - "Reused the audit-open incomplete-status pattern but as a SUPERSET set (adds paused, not-complete, not_complete); did NOT modify bin/lib/audit.cjs"
  - "Kept has_summary = filename existence for backward compat; added a NEW status-aware complete field feeding incomplete/skip/PhaseRunner rather than redefining has_summary"
  - "Broadened the trust-roadmap-over-disk override to promote only when planCount === 0 (not just guarding 'partial'), because a single-plan phase with a paused summary scans as 'planned', not 'partial'"
  - "Added lazy require of plan-scan.cjs inside core.cjs searchPhaseInDir to avoid the core -> plan-scan -> frontmatter -> core circular top-level require"
metrics:
  duration: ~35min
  completed: 2026-07-23
status: complete
---

# Quick 260723-exn: Status-Aware Plan/Phase Completion Summary

Made plan and phase completion status-aware across both resolver twins, the completion rollup, the HANDOFF resume scanner, the ROADMAP ticker, the SDK PhaseRunner, and the execute-phase/transition workflows, so a plan paused at a blocking checkpoint (partial SUMMARY, `status: paused`) is no longer counted complete, skipped on resume, has its successor dispatched early, or its phase auto-advanced past. This closes the STATUS axis of the completion-by-existence bug family (gsd-core issue #25 root cause: completion decided by paired-SUMMARY existence without reading `status:`).

## What shipped

**Task 1 (60b3886), status-aware count in both plan-scan twins.** Added `INCOMPLETE_SUMMARY_STATUSES` (paused, partial, incomplete, blocked, gaps, gaps_found, not-complete, not_complete; case-insensitive), plus `summaryFileIsComplete` (unreadable = not complete; absent/complete/other = complete) and `resolveSummaryPath` (root vs nested layout), all exported from both `bin/lib/plan-scan.cjs` and `sdk/src/query/plan-scan.ts`. New `countMatchedCompleteSummaries` feeds `scanPhasePlans` `summaryCount`/`completed`; `countMatchedSummaries` kept exported unchanged for backward compat.

**Task 2 (14d3cfb), every completion/skip consumer routed through status-aware logic.**
- `phase.cjs`/`phase.ts`: added a per-plan status-aware `complete` field; `incomplete` now keys on it; `has_summary` kept as existence.
- `core.cjs` `searchPhaseInDir` + `verify.cjs`/`verify.ts` `verifyPhaseCompleteness`: `summaryIds` excludes paused/unreadable summaries (verify twins kept byte-behavior identical).
- `checkpoint.cjs` local `scanPhasePlans`: a paused/unreadable matched summary stays in `remaining`, so HANDOFF resume routes back to it.
- `roadmap.cjs` `cmdRoadmapUpdatePlanProgress` + SDK `roadmap-update-plan-progress.ts`: status-aware count; per-plan checkbox only ticks a complete summary. Trust-over-disk override in `roadmap.cjs` `cmdRoadmapAnalyze` + `init.cjs` now promotes only when `planCount === 0`.
- `check-completion.ts` `checkPhaseCompletion`: a paused summary lands in `missing_summaries`, keeps `complete` false.
- `phase-runner.ts` `runExecuteStep`: filters on `!p.complete` (not `!p.has_summary`); `PlanInfo` gained `complete: boolean` in `types.ts`.

**Task 3 (ade710f), phase-progression workflows.** execute-phase skip-filters (both sites) key on `complete: true`; `safe_resume_gate` gained the inverse branch (SUMMARY exists but self-declares partial/paused routes resume to THAT plan) plus a STATE.md `stopped_at`-vs-file-count disagreement surface; transition `verify_completion` now decides completeness via the status-aware CLI (`phase-plan-index` / `verify.phase-completeness`) instead of raw `ls`/count.

**Task 4 (714182a), rebuilt sdk/dist, regenerated dist/bm.**

## Live proof (run against a temp phase: plan A paused SUMMARY + plan B no summary)

```
scanPhasePlans:              {planCount:2, summaryCount:0, completed:false}
CJS phase-plan-index incomplete: ["40-01","40-02"]
  plans: [{id:40-01, has_summary:true, complete:false}, {id:40-02, has_summary:false, complete:false}]
SDK phase-plan-index incomplete: ["40-01","40-02"]  (identical plans array)
CJS verify.phase-completeness:  complete=false, incomplete_plans=["40-01","40-02"]
SDK verify.phase-completeness:  complete=false, incomplete_plans=["40-01","40-02"]
```

A (paused) reports incomplete and B is not counted complete / not dispatched; the two twins agree.

## Verification (RUN, real output)

- CJS regressions: `tests/plan-scan-matched-summaries.test.cjs` 11/11 PASS; `tests/status-aware-completion.test.cjs` 3/3 PASS; `tests/checkpoint-status-aware.test.cjs` 3/3 PASS.
- SDK unit: `npm --prefix sdk run test` 1842/1842 pass (129 files; was 1838 pre-change, +4 new regression tests).
- SDK integration: `npm --prefix sdk run test:integration` baseline (captured before edits) = 14 failed / 72 passed; post-change = 14 failed / 72 passed. Zero NEW failures; failing set unchanged (pre-existing archived-v4.1 CJS/SDK milestone-parse / "Phase not found" divergence, plus the state.load core.cjs-not-found probe). The `verify.phase-completeness` golden-file case fails identically at baseline because the SDK returns `{error: "Phase not found"}` before reaching the summary-status code path. The `roadmap.update-plan-progress` subprocess parity test PASSES.
- Build gates: `npm --prefix sdk run build` succeeds; `node bin/build-bm.cjs` regenerates dist/bm; `node bin/build-bm.cjs --check` reports PASS.
- Hygiene: diff of `bin/lib`/`sdk/src`/`tests` scanned for issue/PR numbers, wave, or status bookkeeping introduced by this change: none. The #25 reference lives only in this SUMMARY.

## Deviations from Plan

None as bugs. Two mechanical decisions recorded (see frontmatter `decisions`): the `planCount === 0` broadening of the trust-over-disk override (the plan called this out explicitly as WARNING 1), and a lazy `require('./plan-scan.cjs')` inside `core.cjs` `searchPhaseInDir` to avoid a top-level circular require (core -> plan-scan -> frontmatter -> core). Both are internal mechanics.

## Notes

- No version bump, no CHANGELOG entry (release cut separately, per constraints).
- `bin/lib/audit.cjs` untouched; the init/init-complex `hasAnySummary` milestone-progress heuristic was left out of scope as instructed.
- `checkpoint.cjs` now exports `scanPhasePlans` (was internal) so the new regression test can exercise the HANDOFF classifier directly.

## Self-Check: PASSED

- tests/status-aware-completion.test.cjs: FOUND
- tests/checkpoint-status-aware.test.cjs: FOUND
- Commits 60b3886, 14d3cfb, ade710f, 714182a: all FOUND in git log
