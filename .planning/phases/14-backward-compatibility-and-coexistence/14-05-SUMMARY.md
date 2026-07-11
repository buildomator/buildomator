---
phase: 14-backward-compatibility-and-coexistence
plan: 05
subsystem: infra
tags: [ci, github-actions, coexistence, single-fire, drift]

# Dependency graph
requires:
  - phase: 14-backward-compatibility-and-coexistence
    provides: "tests/coexist.test.cjs, tests/hook-single-fire.test.cjs, tests/handoff-write-lock.test.cjs, tests/nudge-emission.test.cjs (Plans 01-04)"
provides:
  - "bm-coexistence CI job gating the four coexistence tests on every push"
  - "Package-level both-plugins single-fire smoke in bm-package-smoke (marker-present yield + no-marker control)"
  - "Confirmed 14-VALIDATION.md contract (wave_0_complete: true, Status column green)"
affects: [release-gate, bm-rebrand, coexistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI gate per coexistence test as its own zero-dep run: step (no npm ci)"
    - "Package-level single-fire proof: plant bm-active marker, assert gsd copy yields HANDOFF.json write, with a no-marker control to defeat false passes"

key-files:
  created:
    - ".planning/phases/14-backward-compatibility-and-coexistence/14-05-SUMMARY.md"
  modified:
    - ".github/workflows/check-drift.yml"
    - ".github/workflows/install-smoke.yml"
    - ".planning/phases/14-backward-compatibility-and-coexistence/14-VALIDATION.md"
    - "dist/bm/.github/workflows/check-drift.yml"
    - "dist/bm/.github/workflows/install-smoke.yml"

key-decisions:
  - "Added a sibling bm-coexistence job rather than appending to bm-build-drift, keeping BUILD gates and COMPAT gates named separately"
  - "The single-fire smoke seeds a non-trivial STATE.md (Phase + Task fields) so the control checkpoint is not skipped by writeCheckpoint's trivial-write guard"

patterns-established:
  - "Each coexistence test filename appears on exactly one run: line so the release-gate grep count stays deterministic"
  - "Smoke cleans its bm-active marker from the shared temp dir before and after, so a fixed session_id cannot leak across CI jobs"

requirements-completed: [COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-04]

# Metrics
duration: ~20min
completed: 2026-07-12
---

# Phase 14 Plan 05: Coexistence Release Gates Summary

**The four coexistence tests now run as a bm-coexistence CI job on every push, and install-smoke proves package-level single-fire (the gsd copy yields its HANDOFF.json write when a bm-active marker is present, with a no-marker control).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 5 (2 source workflows, 2 dist/bm mirrors, 1 validation contract)

## Accomplishments

- Added a `bm-coexistence` job to check-drift.yml running coexist, hook-single-fire, handoff-write-lock, and nudge-emission as one run: step each, named for the COMPAT requirement each gates.
- Extended bm-package-smoke with a both-plugins single-fire smoke: it plants a bm-active marker for a session, runs the gsd copy's `hook post-tool-use`, and asserts no HANDOFF.json is written (yield). A no-marker control run first asserts the gsd copy DOES write, so the smoke cannot pass falsely.
- Confirmed 14-VALIDATION.md: Status column flipped green for every task in Plans 01-05, Wave 0 requirement boxes checked, `wave_0_complete: true`, `nyquist_compliant: true` retained.

## Task Commits

1. **Task 1: Gate the four coexistence tests in check-drift.yml** - `68fa25b` (ci)
2. **Task 2: Package-level single-fire smoke + confirm VALIDATION.md** - `9d69220` (ci)

## Files Created/Modified

- `.github/workflows/check-drift.yml` - New `bm-coexistence` job; four run: steps, one per coexistence test.
- `.github/workflows/install-smoke.yml` - New both-plugins single-fire smoke step in bm-package-smoke (marker-present yield + no-marker control).
- `.planning/phases/14-backward-compatibility-and-coexistence/14-VALIDATION.md` - Status column green, Wave 0 boxes checked, `wave_0_complete: true`.
- `dist/bm/.github/workflows/check-drift.yml`, `dist/bm/.github/workflows/install-smoke.yml` - Regenerated bm mirrors of the two edited workflows (build-bm drift-clean).

## Decisions Made

- Chose a sibling `bm-coexistence` job over appending to `bm-build-drift` so COMPAT gates read separately from BUILD gates. Acceptance (grep count == 4, existing steps intact, valid YAML) holds either way.
- Kept each test filename on exactly one `run:` line and used COMPAT requirement names in the `name:` lines, so the release-gate grep count is a stable 4.
- The smoke's synthetic project uses a STATE.md with `Phase` and `Task` fields. writeCheckpoint skips trivial (phase:null, task:null) automatic checkpoints via a guard, so an empty STATE.md would make the no-marker control silently write nothing and give a false pass. A non-trivial STATE.md makes the control genuinely write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated dist/bm workflow mirrors after editing the source workflows**
- **Found during:** Task 2 (after-wave full suite run)
- **Issue:** `bin/build-bm.cjs` mirrors `.github/workflows/` into `dist/bm/`. Editing check-drift.yml (Task 1) and install-smoke.yml (Task 2) put the committed dist/bm copies out of sync, so `node bin/build-bm.cjs --check` and `tests/bm-parity.test.cjs` failed with drift on both files.
- **Fix:** Ran `node bin/build-bm.cjs` to regenerate dist/bm, then re-ran the drift check and bm-parity (both green). The regenerated mirrors were committed with Task 2.
- **Files modified:** dist/bm/.github/workflows/check-drift.yml, dist/bm/.github/workflows/install-smoke.yml
- **Verification:** `node bin/build-bm.cjs --check` PASS, `node tests/bm-parity.test.cjs` PASS
- **Committed in:** 9d69220 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The dist/bm regeneration is a required build artifact of editing mirrored workflow source; without it the release gate itself would fail. No scope creep.

## Issues Encountered

- Initial local reproduction of the smoke showed the no-marker control writing no HANDOFF.json. Root cause: an empty synthetic STATE.md yields a trivial checkpoint that writeCheckpoint's guard skips. Resolved by seeding a non-trivial STATE.md (Phase + Task), matching the guard's contract, which the committed smoke step now does.

## Next Phase Readiness

- Coexistence correctness (COMPAT-01..04) is now a standing release gate: four tests on every push plus a package-level single-fire smoke with a false-pass control.
- 14-VALIDATION.md is confirmed complete and nyquist-compliant; the phase's validation contract reflects executed results.
- No blockers.

---
*Phase: 14-backward-compatibility-and-coexistence*
*Completed: 2026-07-12*
