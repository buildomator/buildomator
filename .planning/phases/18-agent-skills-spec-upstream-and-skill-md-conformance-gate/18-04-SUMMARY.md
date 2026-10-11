---
phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate
plan: 04
subsystem: testing
tags: [craft-skill, trust-gate, skills-ref, npx, twin-parity, tdd]

# Dependency graph
requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: assessEntry/checkSafety two-axis trust gate in both twins, craft-skill assess handler, sdk/dist build+stage sequence
  - phase: 17-craft-skill-propose-on-fit
    provides: match handler and propose-on-fit surfaces that call assess
provides:
  - SKILLS_REF_PIN, externalValidateArgv, applyExternalValidation in both trust-gate twins
  - two new safety finding codes (external-validate-failed, external-validate-unavailable)
  - opt-in --validate-external <dir> on craft-skill assess in both handlers
  - parity proof that both twins pass the identical pinned argv and reach the identical block verdict
affects: [plan-18-05, craft-skill, trust-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure merge of a captured shell-out result: the gate stays fs/child_process-free, the spawn lives in the command handler, and a pure function folds the run into the verdict"
    - "Fail-closed external validation: spawn error or null status blocks (unavailable), non-zero exit blocks (failed), only exit 0 passes"
    - "Opt-in version-pinned npx shell-out reserved for untrusted external candidates, off the runtime path"

key-files:
  created: []
  modified:
    - bin/lib/skill-trust-gate.cjs
    - sdk/src/skill-trust-gate.ts
    - tests/skill-trust-gate.test.cjs
    - sdk/src/skill-trust-gate.test.ts
    - bin/lib/craft-skill-insert.cjs
    - sdk/src/query/craft-skill.ts
    - tests/craft-skill-sdk-parity.test.cjs
    - sdk/dist

key-decisions:
  - "D-08 honoured: the real skills-ref linter is reserved for external candidates via opt-in pinned npx, never run against our own skills and never on the runtime path"
  - "The gate module stays pure; applyExternalValidation folds an already-captured run, and spawnSync lives only in the assess command handler of each twin"
  - "SDK assess reads the flag through asString (bare --validate-external is ignored); CJS passes the raw flag so a bare flag yields a usage error, matching the plan's literal wiring"

patterns-established:
  - "Pure shell-out merge: capture { status, stdout, stderr, error } in the handler, fold with a pure twin-mirrored function"
  - "npx shim parity harness: a PATH-prepended executable records argv to prove the pinned argv and the no-spawn-without-flag invariant"

requirements-completed: [CAT-08]

# Metrics
duration: ~15min
completed: 2026-10-12
---

# Phase 18 Plan 04: External skills-ref validate shell-out Summary

**Opt-in, version-pinned `npx skills-ref@0.1.5 validate` added to the trust gate's assess path in both twins, failing closed to a block, with the pure gate kept pure and twin parity proven by a shim that records the exact argv**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-12T00:09Z
- **Completed:** 2026-10-12T00:25Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 source/test files plus the regenerated sdk/dist

## Accomplishments
- Both trust-gate twins export `SKILLS_REF_PIN`, `externalValidateArgv`, `applyExternalValidation` and carry two new finding codes, with the gate still free of fs and child_process imports
- `craft-skill assess <id> --validate-external <dir>` runs the pinned npx linter in both twins; a non-zero exit downgrades the verdict to block with an external-validate-failed finding, an unrunnable npx blocks with external-validate-unavailable
- The flag is opt-in only: match, insert, release and propose-on-fit never spawn npx, proven by a parity case
- Parity test extended with an npx shim that records argv; both twins pass the identical `--yes skills-ref@0.1.5 validate <dir>` and reach the identical block verdict

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1 (RED): failing tests for external-validation helpers** - `ad7b3b5` (test)
2. **Task 1 (GREEN): pure external-validation helpers in both twins** - `3195118` (feat)
3. **Task 2 (RED): failing parity cases for the shell-out** - `282d28d` (test)
4. **Task 2 (GREEN): wire --validate-external into both assess handlers, rebuild sdk/dist** - `32ab152` (feat)

**Plan metadata:** (final docs commit below)

## Files Created/Modified
- `bin/lib/skill-trust-gate.cjs` - SKILLS_REF_PIN, externalValidateArgv, applyExternalValidation (pure), two new finding codes, exports; header note about the pure merge
- `sdk/src/skill-trust-gate.ts` - mirrored exports, SafetyFindingCode union members, ExternalValidateRun interface
- `bin/lib/craft-skill-insert.cjs` - --validate-external handling on assessCraftSkill and the assess case only; path check before spawn; argv array, no shell, 120s timeout
- `sdk/src/query/craft-skill.ts` - same wiring; statSync import, GSDError on a missing/non-directory path
- `tests/skill-trust-gate.test.cjs` / `sdk/src/skill-trust-gate.test.ts` - four new cases each covering clean/failed/unavailable and the pinned argv + 12-code count
- `tests/craft-skill-sdk-parity.test.cjs` - npx shim harness plus three validate-external parity cases
- `sdk/dist` - rebuilt and staged (tsc + esbuild) so the parity test and plan 05 build-bm see the change

## Decisions Made
- D-08 hybrid preserved: pinned npx for external candidates only, native subset (plan 01) for our own skills, nothing on the runtime path
- Fail-closed semantics: unavailable (spawn error or null status) and failed (non-zero exit) both block; only exit 0 passes and is recorded in the prompt as `External validate: skills-ref@0.1.5 clean`
- The two twins intentionally differ only in flag parsing style (SDK asString vs CJS raw), matching the plan's literal wiring; all tested behaviors are identical

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The SDK twin already imported spawnSync and resolve; only statSync and the trust-gate helper imports were added.

## Verification (observed)
- `node tests/skill-trust-gate.test.cjs` -> 44 passed, 0 failed (4 new external-validation checks)
- `npm --prefix sdk test -- src/skill-trust-gate.test.ts` -> 38 tests passed
- `node tests/craft-skill-sdk-parity.test.cjs` -> all checks passed, including the three validate-external cases
- `node tests/craft-skill-no-vendoring.test.cjs`, `craft-skill-insertion.test.cjs`, `craft-skill-propose-on-fit-guard.test.cjs` -> all exit 0
- Trust-gate twins: 0 fs/child_process imports (grep)
- `spawnSync('npx'` appears exactly once per handler; `shell: true` appears zero times; package.json unchanged
- `craft-skill assess seo-audit --validate-external /nonexistent/dir` -> exit 1, usage error, no spawn
- No U+2013/U+2014 in any touched file

## Next Phase Readiness
- Plan 05 can regenerate dist/bm and run build-bm --check over the committed tree (sdk/dist is staged), and perform the first live human-verified `npx skills-ref` run behind the blocking checkpoint
- No blockers

---
*Phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate*
*Completed: 2026-10-12*

## Self-Check: PASSED
All claimed files and commit hashes (ad7b3b5, 3195118, 282d28d, 32ab152) verified present.
