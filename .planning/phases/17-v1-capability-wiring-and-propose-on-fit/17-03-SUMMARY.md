---
phase: 17-v1-capability-wiring-and-propose-on-fit
plan: 03
subsystem: infra
tags: [craft-skill, propose-on-fit, discuss-phase, quick, autonomous, workflow-wiring]

# Dependency graph
requires:
  - phase: 17-01
    provides: craft-skill.match read-only trigger pre-filter in both twins
  - phase: 17-02
    provides: references/craft-skill-propose-on-fit.md single source of truth
provides:
  - discuss-phase proposes catalog candidates once the domain boundary is known, records acceptances in CONTEXT.md, inserts in-session only on the explicit chain
  - quick proposes and inserts before the executor with a fresh skills capture, releases the exact record after the executor returns
  - autonomous auto-inserts only allow-verdict relevant candidates ephemerally with a run-log line, releases after execute
affects: [craft-skill catalog, propose-on-fit, future catalog surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-task craft-skill.match call sits inside the scope-known step only; no surface reads the catalog at session start"
    - "Scope text passed as one quoted argument treated as data; never interpolated into another command"
    - "Lazy-load references/craft-skill-propose-on-fit.md only when candidates are non-empty"

key-files:
  created: []
  modified:
    - workflows/discuss-phase.md
    - workflows/discuss-phase/templates/context.md
    - workflows/discuss-phase/modes/chain.md
    - workflows/quick.md
    - skills/quick/SKILL.md
    - workflows/autonomous.md
    - skills/autonomous/SKILL.md

key-decisions:
  - "discuss-phase records acceptances only (never inserts itself); the explicit chain and autonomous own the in-session insert"
  - "autonomous gate is written literally as verdict === 'allow' since insert only structurally refuses block; the surface owns the flag check"
  - "the literal --sticky token is kept out of autonomous.md (worded 'never uses the sticky flag') to satisfy the no-sticky assertion"

patterns-established:
  - "Interactive surfaces inject nothing before accept; autonomous injects only allow-verdict relevant candidates, ephemeral, logged"
  - "Release is wired with --id on every surface that inserts so another surface's ephemeral record is never cleared"

requirements-completed: [CAT-02, CAT-06]

# Metrics
duration: ~16min
completed: 2026-10-06
---

# Phase 17 Plan 03: v1 Capability Wiring and Propose-on-Fit Summary

**Threaded craft-skill propose-on-fit into discuss-phase, quick, and autonomous: each calls craft-skill.match at the per-task scope point, lazy-loads the shared reference only when candidates exist, and routes accept/insert/release per surface (record-only, interactive-insert, allow-gated auto-insert).**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-10-06
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- discuss-phase surfaces candidates once the domain boundary is known, records acceptances in CONTEXT.md `### Craft skills`, and only the explicit chain inserts (and releases) in-session; document-deliverable scope gets the built-in doc skills note instead of a catalog lookup.
- quick runs the pre-filter on the task description, inserts before the executor is spawned with a fresh `AGENT_SKILLS_EXECUTOR` capture, and releases the exact record by `--id` after the executor returns.
- autonomous auto-inserts only when `verdict === 'allow'` AND relevant AND a checkout resolves, emits the exact run-log line, prints a review notice otherwise, never uses sticky, and releases by `--id` in 3d (both interactive and inline paths).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire discuss-phase (record acceptance; insert only on the explicit chain)** - `0c52893` (feat)
2. **Task 2: Wire quick (accept before the executor, release after)** - `36b966b` (feat)
3. **Task 3: Wire autonomous (gate-bounded auto-insert with run-log, release after execute)** - `d1d58ad` (feat)

## Files Created/Modified
- `workflows/discuss-phase.md` - propose_craft_skill step, progressive-disclosure row, write_context hook
- `workflows/discuss-phase/templates/context.md` - conditional `### Craft skills` subsection and document-deliverable `<specifics>` line
- `workflows/discuss-phase/modes/chain.md` - in-session insert before the silent chain dispatch, release after return; pre-existing em-dashes normalized to comply with the repo no-dash convention
- `workflows/quick.md` - Step 2.1 propose + executor-skills re-capture, Step 6.1 release
- `skills/quick/SKILL.md` - objective and security bullets (no literal craft-skill token)
- `workflows/autonomous.md` - step 3b.5 allow-gated auto-insert with run-log, release in 3d, two success-criteria bullets
- `skills/autonomous/SKILL.md` - objective line describing the gated auto-insert (no literal craft-skill token)

## Decisions Made
- discuss-phase records only and never inserts itself; the explicit `--auto`/`--chain` chain and autonomous own the in-session insert. A standalone later execute session relies on the recorded insert command in CONTEXT.md.
- The autonomous gate is written literally as `verdict === 'allow'` in prose because `craft-skill.insert` structurally refuses only `block`, so the `flag` check is the surface's own responsibility.
- Kept the literal `--sticky` token out of autonomous.md (worded "autonomous never uses the sticky flag") so the plan's zero-sticky assertion holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Convention] Normalized pre-existing em-dashes in chain.md**
- **Found during:** Task 1 (Wire discuss-phase)
- **Issue:** The plan's Task 1 automated verify asserts `workflows/discuss-phase/modes/chain.md` contains no em/en-dash, but the file already held eight pre-existing em-dashes that violate the repo CLAUDE.md no-dash convention. The gate could not pass without addressing them.
- **Fix:** Converted the pre-existing em-dashes to compliant punctuation (colon for the title, semicolons for clause separators) with a UTF-8-aware perl pass. Right-arrow glyphs were left untouched (not dashes).
- **Files modified:** workflows/discuss-phase/modes/chain.md
- **Verification:** `grep -nP "\x{2014}|\x{2013}" workflows/discuss-phase/modes/chain.md` returns no matches; the Task 1 automated verify passes.
- **Committed in:** `0c52893` (Task 1 commit)

**2. [Rule 3 - Blocking] Reworded the autonomous "never sticky" note to avoid the literal --sticky token**
- **Found during:** Task 3 (Wire autonomous)
- **Issue:** The plan action text says "(never `--sticky`)" but the plan's own acceptance assertion requires `grep -c -- "--sticky" workflows/autonomous.md` to be 0. Transcribing the action verbatim failed the assertion.
- **Fix:** Reworded to "ephemeral only; autonomous never uses the sticky flag", preserving the intent (the insert command is written with `--approved` only, no sticky flag).
- **Files modified:** workflows/autonomous.md
- **Verification:** `! grep -q -- "--sticky" workflows/autonomous.md` passes; the insert command still carries `--approved`.
- **Committed in:** `d1d58ad` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 convention, 1 blocking)
**Impact on plan:** Both were required to satisfy the plan's own verify gates and the repo no-dash convention. No scope creep; the behavior wired matches the plan exactly.

## Issues Encountered
- discuss-phase.md hit 506 lines after the additions (budget is 505). Resolved by merging the new `write_context` sentence with the existing "Write the file." instruction instead of removing any existing content; final count is 504 lines.

## Verification Results (observed)
- `node tests/craft-skill-insertion.test.cjs`: 21 passed, 0 failed (SKILL.md craft-skill-token guard and no-startup-path guard hold).
- `node tests/craft-skill-no-vendoring.test.cjs`: 8/8 checks passed.
- Task 1 automated verify block: PASS (propose_craft_skill step present, match called, reference referenced, wc 504 <= 505, context.md `### Craft skills`, chain.md insert+release, no dashes, no-vendoring).
- Task 2 automated verify block: PASS (Step 2.1 present, match on `$DESCRIPTION`, release by --id, match-before-recapture-before-release-before-6.25 ordering, SKILL.md has no craft-skill token and has "cataloged external skill", both guard tests exit 0, zero added dashes).
- Task 3 automated verify block: PASS (3b.5 present, literal `verdict === 'allow'`, release by --id, zero `--sticky`, match before execute and release after 3d, SKILL.md no craft-skill token, both guard tests exit 0, `--approved` present, run-log + notice lines present, reference referenced, zero added dashes).
- All three surfaces call `craft-skill.match`; release wired with `--id` on quick, autonomous, and chain.md.
- Not run here (needs a live session): the human-check UAT running a quick task with "seo" in the description to confirm the accept prompt shows publisher/license/trust tier and that Skip leaves config unchanged. Recorded for /bm:verify-work.

## Next Phase Readiness
- CAT-02 wiring is live across the three D-01 surfaces; plan-phase and execute-phase deliberately untouched (D-01).
- Ready for the remaining Phase 17 plans and for the live UAT check.

## Self-Check: PASSED

All 7 modified files plus 17-03-SUMMARY.md exist on disk; all four commits (0c52893, 36b966b, d1d58ad, 261ad72) are present in git history.

---
*Phase: 17-v1-capability-wiring-and-propose-on-fit*
*Completed: 2026-10-06*
