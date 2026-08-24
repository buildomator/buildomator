---
phase: quick-260824-t2h
verified: 2026-08-24T22:00:00Z
status: passed
score: 12/12 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Quick 260824-t2h: Port batch of 10 upstream gsd-core Claude fixes Verification Report

**Task Goal:** Port a batch of 10 Claude-relevant correctness fixes from upstream gsd-core into both hand-synced resolver twins (CJS bin/lib + SDK sdk/src) plus workflows/skills. All 10 items must land in both twins where the plan says both, with regression tests, zero new test failures, dist/bm --check PASS, and no GSD bookkeeping in product source.

**Verified:** 2026-08-24
**Status:** passed
**Method:** Direct grep/read of actual source at HEAD (not SUMMARY prose), plus live execution of every test suite and gate command.

## Item-by-item verification (10 triage items across 8 commits)

| # | Item | CJS twin | SDK twin | Test evidence | Status |
|---|------|----------|----------|----------------|--------|
| 1 | BOM tolerance before frontmatter fence | `bin/lib/frontmatter.cjs:100` `content.charCodeAt(0) === 0xFEFF` strip | `sdk/src/query/frontmatter.ts:199` identical strip in `extractFrontmatterLeading` | `tests/frontmatter-bom.test.cjs` PASS; `sdk frontmatter.test.ts` 36 tests PASS | VERIFIED |
| 2 | Segment-boundary letter-named phase membership | `bin/lib/core.cjs:1984-2011` `normalizedIdsLongestFirst` + letter-leading branch | `sdk/src/query/state.ts:68-90` identical logic | `tests/letter-phase-ids.test.cjs` PASS; `sdk state.test.ts` 30 tests PASS | VERIFIED |
| 3 | Letter-prefixed ids in roadmap.analyze | `bin/lib/roadmap.cjs:207,230,324` `[A-Za-z]?\d+` widening at heading/boundary/checklist | `sdk/src/query/roadmap.ts:713,727,815` identical widening | `tests/letter-phase-ids.test.cjs` PASS; `sdk roadmap.test.ts` 59 tests PASS | VERIFIED |
| 4 | Scope phase add/add-batch to active milestone | `bin/lib/core.cjs:1164` `currentMilestoneSectionRange`, `:1177` `phaseEntryInsertOffset`; wired at `phase.cjs:672,742` | `sdk/src/query/roadmap.ts:221,261` same two functions; wired at `phase-lifecycle.ts:195,312` | `tests/phase-add-milestone-scope.test.cjs` PASS; `sdk phase-lifecycle.test.ts` 82 tests PASS | VERIFIED |
| 5 | One-liner anchored to summary-shaped heading (3 sites) | `bin/lib/core.cjs:1728-1745` `/summary\|overview\|accomplish/i` gate | `sdk/src/query/phase-lifecycle-policy.ts:54-70` AND `sdk/src/query/summary.ts:30-46`, both with identical gate | `tests/one-liner-summary-heading.test.cjs` PASS; direct-import tests in `phase-lifecycle.test.ts:1830-1852` (policy copy) and `summary.test.ts` (5 tests) PASS | VERIFIED |
| 6 | Zero-plan progress no-op | `bin/lib/state.cjs:419-420` `totalPlans === 0` early return, exact reason string | `sdk/src/query/state-mutation.ts:724-725` identical | `tests/progress-and-frontier.test.cjs` PASS; `sdk state-mutation.test.ts` 61 tests PASS | VERIFIED |
| 7 | init.progress next_phase from roadmap order | `bin/lib/init.cjs:1499-1500` `frontier = phases.find(pending\|not_started)` | `sdk/src/query/init-complex.ts:458-459` identical | `tests/progress-and-frontier.test.cjs` PASS; `sdk init-complex.test.ts` 30 tests PASS | VERIFIED |
| 8 | Sentinel guard on W006/W007 + consistency loops | `bin/lib/verify.cjs:19` `isSentinelPhaseId`, applied at 5 sites (523,531,542,864,875) | `sdk/src/query/validate.ts:45` same predicate, applied at 5 sites (249,257,275,666,677) | `tests/sentinel-validate-guard.test.cjs` PASS; `sdk validate.test.ts` 41 tests PASS | VERIFIED |
| 9 | Remove `effort:` from skill frontmatter | `grep -rn "^effort:" skills/*/SKILL.md` = empty; `dist/bm/skills/*/SKILL.md` = empty | n/a (skills-only) | `tests/effort-frontmatter.test.cjs` PASS (inverted guard, scans source + dist/bm) | VERIFIED |
| 10 | Isolate claude reviewer lane | `workflows/review.md`: env-prefix count = 2; `dist/bm/workflows/review.md`: count = 2 | n/a (workflow-only) | Direct grep count matches required "2" on both source and dist/bm | VERIFIED |

## Must-Haves Truths (from PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BOM tolerance, both twins, BOM-less unaffected | VERIFIED | Grep + test run above |
| 2 | getMilestonePhaseFilter letter-named membership, both twins | VERIFIED | Grep + test run above |
| 3 | roadmap.analyze nonzero phase_count for letter-prefixed ids, both twins | VERIFIED | Grep + test run above |
| 4 | phase add/add-batch insert inside active milestone, both twins, legacy fallback preserved | VERIFIED | Grep + test run above; row 3 (no-milestone fallback) covered in `phase-add-milestone-scope.test.cjs` |
| 5 | extractOneLinerFromBody anchored at all 3 sites, shared logic incl. labeled form | VERIFIED | All 3 call sites confirmed byte-consistent gate; SDK copies brought up to CJS labeled/bare/null logic |
| 6 | state update-progress no-op on zero-plan scan; legitimate 0% still writes | VERIFIED | Code + test (`progress-and-frontier.test.cjs` A-1/A-2/A-3 rows) |
| 7 | init.progress next_phase follows roadmap order over stray artifact dir | VERIFIED | Code + test (B-1/B-2 rows) |
| 8 | validate suppresses W006/W007/consistency/gap warnings for sentinel phases only | VERIFIED | Code (5 sites each twin) + test rows including non-sentinel-still-warns case |
| 9 | No skill emits effort:, source nor dist/bm, guarded by rewritten test | VERIFIED | Grep empty both locations; inverted test passes |
| 10 | Both claude reviewer invocations carry the two-var env prefix | VERIFIED | grep count = 2 in both workflows/review.md and dist/bm copy |
| 11 | sdk/dist rebuilt, dist/bm regenerated, build-bm --check PASS, SDK unit green, integration failures subset of baseline, new CJS tests wired into CI | VERIFIED | `build-bm --check` = PASS; SDK unit 129/129 files, 1889/1889 tests; SDK integration 14/14 failures identical set to `integration-baseline.txt`; CI wiring confirmed in `.github/workflows/check-drift.yml` |
| 12 | No issue/PR numbers, no em/en dashes, no "canonical" in added lines | VERIFIED | `git diff 8f59719..HEAD -- bin sdk/src tests skills workflows` added lines: zero matches for `#[0-9]{4}`, em/en dash chars, and "canonical" |

**Score:** 12/12 truths verified

## Regression / Gate Results (run directly, not taken from SUMMARY)

- `for f in tests/*.test.cjs; do node "$f"; done` -> only `tests/context-monitor-hook-event.test.cjs` and `tests/version-command.test.cjs` fail. These are the documented pre-existing baseline failures (confirmed in prior session notes / memory) and unrelated to this batch's files. Zero new CJS failures.
- All 7 new/rewritten regression tests (`frontmatter-bom`, `letter-phase-ids`, `phase-add-milestone-scope`, `one-liner-summary-heading`, `progress-and-frontier`, `sentinel-validate-guard`, `effort-frontmatter`) individually run: exit 0.
- `npm --prefix sdk run test`: 129 files / 1889 tests passed, 0 failed.
- `npm --prefix sdk run test:integration`: 14 failed / 72 passed / 13 skipped -- identical failing-test-name set to `integration-baseline.txt` captured before the batch. Zero new integration failures.
- `node bin/build-bm.cjs --check`: "bm drift check: PASS (committed dist/bm matches a fresh build)."
- `.github/workflows/check-drift.yml` contains run steps for all 6 new CJS test files plus `tests/effort-frontmatter.test.cjs`.
- Out-of-scope items confirmed untouched: `bin/lib/phase.cjs` diff only touches `cmdPhaseAdd`/`cmdPhaseAddBatch` insertion lines (Task 3 scope) -- `cmdPhaseComplete` (#2648) and the next-phase-complete scan (#3350) have zero diff; `workflows/execute-phase.md` (#2868) has zero diff in `git log 8f59719..HEAD`.

## Anti-Patterns Found

None. Hygiene greps (issue numbers, em/en dashes, "canonical") over all added lines in `bin/`, `sdk/src/`, `tests/`, `skills/`, `workflows/` returned zero matches. No TODO/FIXME/XXX/placeholder markers found in the modified resolver files during review.

## Human Verification Required

None. All must-haves are mechanically verifiable via grep, direct test execution, and gate commands, and all were executed directly in this verification pass.

## Gaps Summary

No gaps found. All 10 triage items land in both twins where required (8 both-twin fixes: items 2-8 map to shared logic in `bin/lib/*` and `sdk/src/query/*`; item 5 spans 3 sites including 2 SDK copies), the 2 skills/workflow-only items (9, 10) are correctly single-surface. Every regression test passes, SDK unit suite is fully green, SDK integration failures are byte-identical to the pre-batch baseline (zero new), `build-bm --check` passes, and hygiene greps are clean. The SUMMARY.md claims match the actual codebase state.

---

_Verified: 2026-08-24_
_Verifier: Claude (gsd-verifier)_
