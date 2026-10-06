---
phase: 17-v1-capability-wiring-and-propose-on-fit
plan: 01
subsystem: api
tags: [craft-skill, trigger-match, sdk-twin, parity, cjs]

# Dependency graph
requires:
  - phase: 16-craft-skill-catalog
    provides: "craft-skill catalog loader, deriveCatalogViews (CRAFT_SKILL_TRIGGER_INDEX), assessEntry trust gate, craft-skill list/assess/insert/release twins"
provides:
  - "Deterministic craft-skill match <scope> subcommand in the CJS twin (gsd-tools.cjs craft-skill match)"
  - "SDK twin craft-skill.match / craft-skill match query handler, typed (MatchCandidate/MatchResult)"
  - "Registry rows and QUERY-HANDLERS note for craft-skill.match"
  - "CJS/SDK parity coverage and SDK unit coverage for match, including a data-only metachar case and a flag-verdict fixture"
affects: [17-03, 17-04, propose-on-fit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only trigger pre-filter: lowercased substring match of scope text against the fixed trigger index, candidates carry the full gate inputs (publisher label, license, obligations, trust tier, verdict, prompt) so no second assess call is needed"

key-files:
  created: []
  modified:
    - bin/lib/craft-skill-insert.cjs
    - sdk/src/query/craft-skill.ts
    - sdk/src/query/command-static-catalog-domain.ts
    - sdk/src/query/QUERY-HANDLERS.md
    - sdk/src/query/craft-skill.test.ts
    - tests/craft-skill-sdk-parity.test.cjs

key-decisions:
  - "Scope handled as data only (lowercase + substring vs trigger set); no regex built from it, no path resolution, no shell, no eval (T-17-01)"
  - "Candidate verdict is surfaced from assessEntry so the autonomous surface can gate on verdict === 'allow' (T-17-02, D-09)"

patterns-established:
  - "match reads only the catalog JSON; no SKILL.md body is opened (same discipline as list/assess, T-17-05)"

requirements-completed: [CAT-02]

# Metrics
duration: 14min
completed: 2026-10-06
---

# Phase 17 Plan 01: craft-skill match pre-filter Summary

**Deterministic `craft-skill match "<scope>"` trigger pre-filter shipped byte-identically in the CJS and SDK twins, each candidate carrying the publisher label, SPDX license, obligation, trust tier, gate verdict and ready-to-render prompt lines so a surface needs no second assess call.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-10-06T22:00:00Z
- **Completed:** 2026-10-06T22:08:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- CJS `matchCraftSkills` + `case 'match'` in `cmdCraftSkill`: substring-compares a lowercased scope against `CRAFT_SKILL_TRIGGER_INDEX`, returns candidates sorted by id with sorted `matched_triggers` and the locked key order; usage strings now list `match`.
- SDK twin `matchCraftSkills` + `craftSkillMatch` handler mirroring the CJS behavior exactly, typed via `MatchCandidate` / `MatchResult`, registered as `craft-skill.match` / `craft-skill match`, documented in QUERY-HANDLERS.md.
- Parity test extended with SEO, DuckDB, no-hit and shell-metachar scopes asserting byte-identical payloads across twins; SDK vitest extended with six new match cases (SEO, data, no-hit, metachar, blank-throws, copyleft flag-verdict) plus a registry assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `match` to the CJS twin** - `b832c5c` (feat)
2. **Task 2: Add `match` to the SDK twin, register, document, unit cases** - `893e9c9` (feat)
3. **Task 3: Extend the CJS/SDK parity test with `match` cases** - `4b71e7b` (test)

## Files Created/Modified
- `bin/lib/craft-skill-insert.cjs` - `matchCraftSkills(opts)`, `case 'match'`, usage strings, export, behavior-only header sentence
- `sdk/src/query/craft-skill.ts` - `MatchCandidate`/`MatchResult` interfaces, `matchCraftSkills`, `craftSkillMatch` handler, header sentence
- `sdk/src/query/command-static-catalog-domain.ts` - import + `craft-skill.match` / `craft-skill match` registry rows
- `sdk/src/query/QUERY-HANDLERS.md` - added `craft-skill.match` to the registry-only list
- `sdk/src/query/craft-skill.test.ts` - `craft-skill match (SDK)` describe block (6 cases) + registry assertion
- `tests/craft-skill-sdk-parity.test.cjs` - `2b. match` section (4 match checks) + header note

## Decisions Made
None beyond the plan's locked decisions. Scope is handled as data only (T-17-01); verdict surfaced for the plan-03 autonomous gate (T-17-02, D-09); match reads only the catalog JSON (T-17-05).

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results (observed)

- `node tests/craft-skill-sdk-parity.test.cjs` (after `npm --prefix sdk run build`): all checks passed, 4 `ok - ...match...` lines observed.
- `cd sdk && npx vitest run --project unit src/query/craft-skill.test.ts`: 23 passed (23), including the 6 new match cases and the new registry case.
- `cd sdk && npx tsc --noEmit -p .`: exit 0.
- `node tests/craft-skill-insertion.test.cjs`: 21 passed, 0 failed. `node tests/craft-skill-catalog.test.cjs`: exit 0.
- Manual spot check: `craft-skill match "Audit my site SEO"` through `bin/gsd-tools.cjs` and `sdk/dist/cli.js query craft-skill.match` produced identical payloads.
- Grep gates: `matchCraftSkills` count 3 in CJS; `craftSkillMatch` count 3 in the domain; `craft-skill.match` present in QUERY-HANDLERS.md; 4 export lines in the SDK twin; no `Phase 1x|plan 0x|wave` bookkeeping in either product file.
- `git diff --cached --name-only | grep -c '^sdk/dist/'` was 0 at commit time (artifacts deferred to plan 05).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `match` is available to plan 03 (the propose-on-fit workflow) in both twins without re-deriving trigger matching inline.
- `sdk/dist` is modified on disk by the build but intentionally NOT committed here; plan 05 owns the artifact rebuild, staging order and the `build-bm --check` gate.

---
*Phase: 17-v1-capability-wiring-and-propose-on-fit*
*Completed: 2026-10-06*
