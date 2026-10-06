---
phase: 17-v1-capability-wiring-and-propose-on-fit
plan: 04
subsystem: testing
tags: [craft-skill, propose-on-fit, cjs, spawned-cli, trust-gate]

# Dependency graph
requires:
  - phase: 17-01
    provides: "craft-skill match pre-filter in the CJS twin (bin/lib/craft-skill-insert.cjs via bin/gsd-tools.cjs craft-skill)"
provides:
  - "match unit cases proving the pre-filter contract for both v1 seeds, the no-hit case, data-only scope handling, case-insensitivity, the usage error and the flag verdict"
  - "one full SEO propose-on-fit chain proven end-to-end through the spawned CLI: match, accept, ephemeral insert, executor-scoped read, id-scoped release"
affects: [17-05, verifier, propose-on-fit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-dep check(name, fn) harness extended in place; no new requires"
    - "Spawned-CLI assertions via runTool(root, [...]) with an isolated CLAUDE_CONFIG_DIR"

key-files:
  created: []
  modified:
    - "tests/craft-skill-insertion.test.cjs - added match pre-filter unit cases and the SEO end-to-end propose-on-fit chain"

key-decisions:
  - "Chose SEO as the end-to-end domain per CONTEXT.md discretion; the DuckDB seed stays proven through the existing insert cases plus a new match unit case"
  - "match unit cases point at COMMITTED_CATALOG directly; the e2e chain uses copyCatalog(root) so match and insert share one catalog path"

patterns-established:
  - "Pattern 1: propose-on-fit is proven as one check that walks match to release so the nothing-before-accept property is asserted inside the chain"
  - "Pattern 2: executor-scoped visibility is asserted against the real agent-skills reader, with the planner reader as the negative control"

requirements-completed: [CAT-02, CAT-06]

# Metrics
duration: 4min
completed: 2026-10-06
---

# Phase 17 Plan 04: v1 capability wiring and propose-on-fit (CJS insertion spec) Summary

**match pre-filter unit cases plus a full SEO propose-on-fit chain (match, accept, ephemeral insert, executor-scoped read, id-scoped release) proven through the spawned CJS CLI**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-10-06T20:29:27Z
- **Completed:** 2026-10-06T20:32:42Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Seven match unit cases prove the pre-filter contract: both v1 seeds surface with their triggers/verdict/prompt lines, an unrelated scope returns no candidates, scope text with shell metacharacters is echoed verbatim with nothing executed, matching is case-insensitive, a missing scope is a usage error, and a copyleft fixture reports the flag verdict the autonomous gate refuses.
- One end-to-end SEO chain proves the whole propose-on-fit flow through the real CLI: match surfaces seo-audit, an unapproved insert writes nothing (needs_approval), the approved ephemeral insert lands agent_skills.bm-executor and the executor reader returns it while the planner reader does not, and release with --id clears the config entry and stamps released_at.
- A second id-scoped release case proves an unrelated ephemeral record survives a targeted release.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add match unit cases to the CJS insertion spec** - `0c9e492` (test)
2. **Task 2: Add the SEO end-to-end propose-on-fit chain** - `6af145c` (test)

## Files Created/Modified
- `tests/craft-skill-insertion.test.cjs` - Added a `match (propose-on-fit pre-filter)` section (7 cases) and a `propose-on-fit end to end (SEO domain)` section (2 cases); updated the header comment to name the read-only match pre-filter.

## Verification Results (observed)
- `node tests/craft-skill-insertion.test.cjs` -> exit 0, `30 passed, 0 failed, 30 total` (was 21 at baseline; 9 new checks all PASS).
- `node tests/craft-skill-sdk-parity.test.cjs` -> exit 0, `craft-skill-sdk-parity: all checks passed`.
- `grep -c "check('match" tests/craft-skill-insertion.test.cjs` -> 7 (>= 7 required).
- `grep -c "GPL-3.0-only" tests/craft-skill-insertion.test.cjs` -> 2 (>= 1 required; the new flag fixture present).
- `grep -c needs_approval tests/craft-skill-insertion.test.cjs` -> 4 (was 3 pre-task; increased by 1 as the e2e asserts the nothing-before-accept property).

## Decisions Made
- SEO was chosen as the end-to-end domain (CONTEXT.md left the choice to discretion); DuckDB stays covered by the existing insert cases plus a new match unit case so both seeds remain insertable through the gate.
- The match unit cases use `COMMITTED_CATALOG` directly; the end-to-end chain uses `copyCatalog(root)` so its match and insert calls share one catalog path.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ROADMAP criterion 3 (propose-on-fit shown end-to-end for at least one domain) now has an automated proof the verifier runs; criterion 1 (both seeds insertable through the gate) is covered by the SEO chain plus the existing DuckDB insert cases.
- The D-07 (nothing injected until accept) and D-09 (flag verdict refused by the autonomous gate) properties have direct assertions.
- Plan 17-05 remains in the phase.

## Self-Check: PASSED
- FOUND: tests/craft-skill-insertion.test.cjs
- FOUND commit: 0c9e492
- FOUND commit: 6af145c

---
*Phase: 17-v1-capability-wiring-and-propose-on-fit*
*Completed: 2026-10-06*
