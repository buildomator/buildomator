---
phase: 17-v1-capability-wiring-and-propose-on-fit
plan: 02
subsystem: infra
tags: [craft-skill, propose-on-fit, agent-skills, documentation, executor]

requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: catalog, trust gate, scoped insert/release, trigger index
  - phase: 17-v1-capability-wiring-and-propose-on-fit
    provides: craft-skill.match read-only pre-filter (plan 01)
provides:
  - Shared lazy-loaded propose-on-fit procedure reference for discuss-phase, quick and autonomous
  - Executor document-deliverable routing note (built-in doc skills, no catalog)
  - REQUIREMENTS.md CAT-02 autonomous-refinement addendum
affects: [discuss-phase, quick, autonomous, plan-phase, execute-phase]

tech-stack:
  added: []
  patterns:
    - "One lazy-loaded reference as single source of truth so three surfaces cannot drift"
    - "Autonomous gate written literally as verdict === 'allow' since insert only refuses block"

key-files:
  created:
    - references/craft-skill-propose-on-fit.md
  modified:
    - agents/bm-executor.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Procedure lives in one reference rather than inlined into three workflow files (zero per-invocation cost when no trigger hits, no drift across surfaces)"
  - "Executor doc-routing is a passive note, not a second propose-on-fit mechanism"

patterns-established:
  - "Pattern: surface-specific Step 3a (interactive accept) vs Step 3b (autonomous auto-insert) branch off a shared pre-filter and relevance pass"

requirements-completed: [CAT-02, CAT-06]

duration: 8min
completed: 2026-10-06
---

# Phase 17 Plan 02: Propose-on-fit Reference and Executor Doc Routing Summary

**One lazy-loaded reference specifies the full propose-on-fit procedure (pre-filter, relevance, interactive accept, autonomous auto-insert at verdict === 'allow', release, checkout contract, doc routing) for discuss-phase, quick and autonomous, plus a passive executor note routing document deliverables to Claude Code's built-in doc skills.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-06T20:12:27Z
- **Completed:** 2026-10-06T20:20:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `references/craft-skill-propose-on-fit.md` (93 lines): the complete, compact procedure every surface points at, with the exact match/insert/release commands, the AskUserQuestion accept prompt with DATA_START/DATA_END boundaries, the autonomous gate and run-log/notice line formats, the Step 4 release, and the checkout contract.
- `agents/bm-executor.md`: a bold-led Document deliverables paragraph in the always-loaded project context routing docx/pdf/pptx to built-in first-party doc skills (no catalog, no gate, no license surface).
- `.planning/REQUIREMENTS.md`: a CAT-02 autonomous-refinement sub-bullet so the milestone audit does not read the autonomous auto-insert policy as a regression; the original "Nothing is injected until the user accepts" text is intact.

## Task Commits

1. **Task 1: Write references/craft-skill-propose-on-fit.md (shared procedure)** - `382f9ca` (docs)
2. **Task 2: Executor doc-routing note + REQUIREMENTS.md CAT-02 autonomous addendum** - `e6c9867` (docs)

## Files Created/Modified
- `references/craft-skill-propose-on-fit.md` - Shared propose-on-fit procedure for discuss-phase, quick, autonomous
- `agents/bm-executor.md` - Passive document-deliverable routing note in `<project_context>`
- `.planning/REQUIREMENTS.md` - CAT-02 autonomous refinement addendum
- `.planning/phases/17-v1-capability-wiring-and-propose-on-fit/deferred-items.md` - Logged out-of-scope dist/bm regeneration

## Decisions Made
- Kept the procedure in one lazy-loaded reference rather than inlining it three times: discuss-phase is near its 500-line budget and autonomous is 783 lines, so inlining would bloat every invocation and let the surfaces drift.
- Wrote the autonomous gate literally as `verdict === 'allow'` because the structural insert only refuses `block`; checking `allow` is the surface's own responsibility.

## Deviations from Plan

None - plan executed exactly as written. Both tasks verified against their `<verify>` and `<acceptance_criteria>` with observed passing output (no-vendoring test 8/8, insertion test exit 0, all required headings and literal strings present, zero forbidden markers/dashes/bookkeeping tokens).

## Assumption Drift (advisory)

None.

## Issues Encountered

- `node bin/build-bm.cjs --check` reports FAIL. The gate was already failing before this plan from plan 01's not-yet-mirrored SDK work (`sdk/dist/*`, `bin/lib/craft-skill-insert.cjs`, `sdk/src/*`, `tests/craft-skill-sdk-parity.test.cjs`, all present as modified files at plan start). This plan's two source edits add `agents/bm-executor.md` (differs) and `references/craft-skill-propose-on-fit.md` (missing from dist/bm). Plan 17-02 deliberately scoped to source files only (no `dist/bm` in `files_modified`, no `--check` in verification), matching the Phase 16 pattern where a later consolidation plan stages `sdk/dist` and regenerates `dist/bm` in one pass. Logged to `deferred-items.md`; regenerating now would sweep in plan 01's unrelated uncommitted work. Out of scope here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The shared reference is ready for the workflow-wiring plans (discuss-phase, quick, autonomous) to point at via a lazy `@`-include.
- A later plan in this phase must regenerate `dist/bm` (and commit the staged `sdk/dist`) so the byte-level drift gate returns to PASS.

---
*Phase: 17-v1-capability-wiring-and-propose-on-fit*
*Completed: 2026-10-06*
