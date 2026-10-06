---
phase: 17-v1-capability-wiring-and-propose-on-fit
plan: 05
subsystem: testing
tags: [craft-skill, ci, drift-gate, build-bm, sdk-twin, propose-on-fit]

# Dependency graph
requires:
  - phase: 17-02
    provides: references/craft-skill-propose-on-fit.md and the tokens the guard asserts
  - phase: 17-03
    provides: the three surface wirings (discuss-phase, quick, autonomous) and the executor note
  - phase: 17-04
    provides: the match pre-filter and the insertion spec the guard protects
provides:
  - Static propose-on-fit wiring guard (tests/craft-skill-propose-on-fit-guard.test.cjs) run in CI
  - README feature-table row documenting propose-on-fit
  - Rebuilt and committed sdk/dist and dist/bm carrying craftSkillMatch, drift check PASS
affects: [future craft-skill edits, upstream syncs touching workflows or references]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static wiring ratchet: a zero-dep node:assert guard asserts fixed tokens and indexOf/lastIndexOf orderings across prose files so a dropped call fails CI"
    - "Build discipline: git add sdk/dist BEFORE node bin/build-bm.cjs because build-bm enumerates tracked files via git ls-files"

key-files:
  created:
    - tests/craft-skill-propose-on-fit-guard.test.cjs
  modified:
    - .github/workflows/check-drift.yml
    - README.md
    - sdk/dist (regenerated)
    - dist/bm (regenerated)

key-decisions:
  - "The guard runs directly after the CJS/SDK parity step in CI and asserts orderings with indexOf/lastIndexOf on fixed tokens, never regexes built from file content"
  - "README row labeled v4.9.2 (next patch) with no version bump to plugin.json or marketplace.json, per the phase scope"
  - "Tasks committed atomically (guard+CI, README, artifacts) rather than one combined commit; the final artifact commit regenerates sdk/dist and dist/bm after every other edit landed"

patterns-established:
  - "Propose-on-fit wiring is now a ratchet: losing any match call, reference pointer, release, the allow gate, the quick re-capture ordering, or the executor note trips the guard"

requirements-completed: [CAT-02, CAT-06]

# Metrics
duration: ~10min
completed: 2026-10-06
---

# Phase 17 Plan 05: Propose-on-fit wiring guard and artifact regeneration Summary

**Static wiring guard (16 checks) that ratchets the propose-on-fit surfaces, a CI step running it, a README feature row, and regenerated sdk/dist + dist/bm with `bm drift check: PASS`.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-10-06T20:42:41Z
- **Tasks:** 3
- **Files modified:** 4 (one created, plus regenerated sdk/dist and dist/bm trees)

## Accomplishments
- Added `tests/craft-skill-propose-on-fit-guard.test.cjs`: a zero-dep `node:assert` guard with 16 named checks covering the reference headings and tokens, the three surface wirings, the two orderings for quick and autonomous, the `--sticky` and `craft-skill.insert` absences, the executor document-deliverable note, and the SKILL.md / hooks startup-path absences. The required mutation check (replacing `verdict === 'allow'`) trips the guard and the file restores clean.
- Wired the guard into `.github/workflows/check-drift.yml` directly after the parity step.
- Added a README "Added features beyond upstream" row for propose-on-fit (v4.9.2, no version bump).
- Rebuilt the SDK, staged `sdk/dist`, regenerated `dist/bm`, and proved `node bin/build-bm.cjs --check` prints `bm drift check: PASS` on the committed tree.

## Task Commits

Each task was committed atomically:

1. **Task 1: Propose-on-fit static wiring guard + CI step** - `63a5356` (test)
2. **Task 2: README feature-table row** - `a35961d` (docs)
3. **Task 3: Regenerate sdk/dist and dist/bm** - `01e46fa` (chore)

## Files Created/Modified
- `tests/craft-skill-propose-on-fit-guard.test.cjs` - Static wiring guard, 16 checks, mutation-provable
- `.github/workflows/check-drift.yml` - Runs the guard after the parity step
- `README.md` - Propose-on-fit feature row
- `sdk/dist/*` - Rebuilt SDK bundle carrying `craftSkillMatch`
- `dist/bm/*` - Regenerated bm plugin (27 files) carrying the new guard, workflows, reference, README and SDK twin

## Verification Results (observed)
- `node tests/craft-skill-propose-on-fit-guard.test.cjs` -> exit 0, 16 `ok -` lines, "all propose-on-fit wiring checks passed"
- Mutation check (`verdict === 'allow'` -> `verdict === maybe`) -> "guard trips as expected"; `git diff --quiet workflows/autonomous.md` exit 0 (restored)
- `node bin/build-bm.cjs --check` -> "bm drift check: PASS (committed dist/bm matches a fresh build)", exit 0 on the committed tree
- `git diff --quiet sdk/dist dist/bm` -> exit 0 (artifacts fully committed)
- `node dist/bm/bin/gsd-tools.cjs craft-skill match "Audit my site SEO"` -> `candidates[0].id = seo-audit`
- `grep -c craftSkillMatch` -> sdk/dist 1, dist/bm/sdk/dist 1
- craft-skill suite: `craft-skill-catalog` 37/37, `skill-trust-gate` 40/40, `craft-skill-insertion` 30/30, `craft-skill-no-vendoring` 8/8, `craft-skill-sdk-parity` all passed, `craft-skill-propose-on-fit-guard` all passed (each exit 0)
- `npm --prefix sdk test` (vitest run --project unit) -> 132 files, 1975 tests passed, exit 0
- All three commit messages: 0 em/en-dashes, 0 Co-Authored-By trailers

## Decisions Made
- Committed atomically per task rather than one combined commit; the plan's single-message suggestion was a convenience, atomic per-task commits are the repo convention.
- README row uses the v4.9.2 label (next patch) without touching plugin.json or marketplace.json, matching the phase scope.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `npm --prefix sdk test` runs ~132s and exceeded the 120s foreground limit; it completed in the background with exit 0 (1975 tests passed). Not a failure, just a long suite.

## Next Phase Readiness
- Phase 17 is closed: all five plans shipped source, tests, prose wiring, the guard, CI, the README row, and regenerated artifacts.
- The committed artifacts carry the match command in both the SDK bundle and the generated bm plugin; drift check passes.
- Out-of-scope working-tree changes (modified `.planning/` PLAN notes from earlier phases, `gsd-bugs-housekeeping.rtf`) were left untouched.

---
*Phase: 17-v1-capability-wiring-and-propose-on-fit*
*Completed: 2026-10-06*
