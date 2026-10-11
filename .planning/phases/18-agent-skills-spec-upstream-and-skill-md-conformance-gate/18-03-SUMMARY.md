---
phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate
plan: 03
subsystem: infra
tags: [ci, pre-commit, drift-detection, agent-skills, skill-conformance, documentation]

# Dependency graph
requires:
  - phase: 18-01
    provides: check-skill-conformance.cjs gate and its exit-code contract
  - phase: 18-02
    provides: bin/check-agentskills-release.sh watch script and the fifth-upstream register
  - phase: 18-04
    provides: craft-skill assess --validate-external opt-in pinned skills-ref shell-out
provides:
  - skill-conformance CI job running the gate, its discrimination test and the watch wedge-guard harness
  - no-auto-regen conformance block in the pre-commit hook
  - SKILL.md conformance detector entry in the check-drift.cjs umbrella
  - README documentation of the gate, the fifth upstream, the opt-in external validate and the opt-in skills.sh path
affects: [upstream-sync, release-notes, future-skill-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loud-fail ratchet wired three ways: CI job, pre-commit block (no auto-regen), local drift umbrella"
    - "Idea-only upstream documented under the existing watch-don't-vendor posture"
key-files:
  created: []
  modified:
    - .github/workflows/check-drift.yml
    - bin/maintenance/pre-commit-drift-baseline.sh
    - bin/maintenance/check-drift.cjs
    - README.md

key-decisions:
  - "The conformance gate joins the check-drift.cjs umbrella (offline and deterministic, the umbrella's admission rule); the jargon and prose ratchets stay out as prose ratchets, not drift detectors"
  - "The pre-commit conformance block mirrors the prose block with no auto-regen; --write-baseline appears only inside echoed hint text so a regression always exits 1 with the full gate output"

patterns-established:
  - "No-auto-regen ratchet block: run the gate silently, on non-zero print ERROR + full output + manual --write-baseline hint + exit 1"
  - "Fifth idea-only upstream entry mirrors the VibeDrift posture: read the spec, write our own checker, watch the package, never vendor or run at startup"

requirements-completed: [CAT-08, CAT-07]

# Metrics
duration: ~8min
completed: 2026-10-12
---

# Phase 18 Plan 03: Conformance Gate Wiring and README Documentation Summary

**The SKILL.md conformance gate now runs as its own CI job, blocks regressing commits locally with no auto-regen, and sits in the check-drift.cjs umbrella; README documents the gate, the fifth idea-only upstream, the opt-in pinned external validate and the opt-in skills.sh consumption path.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-10-12
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added a `skill-conformance` CI job between `user-docs-prose` and `bm-build-drift` with three steps: the gate, its discrimination test, and the offline Agent Skills watch wedge-guard harness.
- Added a no-auto-regen conformance block to the pre-commit hook that mirrors the prose block, prints the full gate output and the manual `--write-baseline` hint on regression, and exits 1.
- Registered the conformance ratchet as the fifth `check-drift.cjs` detector (offline and deterministic).
- Documented the gate, the fifth upstream, the opt-in `--validate-external` pinned linter and the opt-in `npx skills add` path in README, with the strict trusted-roots default left unchanged. Both the prose and jargon ratchets stay green.

## Task Commits

Each task was committed atomically:

1. **Task 1: CI job, pre-commit block and check-drift.cjs detector entry** - `5a66220` (feat)
2. **Task 2: README documentation of the gate, fifth upstream, external validate and skills.sh path** - `306264b` (docs)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `.github/workflows/check-drift.yml` - new `skill-conformance` job (gate + discrimination test + watch harness)
- `bin/maintenance/pre-commit-drift-baseline.sh` - no-auto-regen conformance block before the final `exit 0`
- `bin/maintenance/check-drift.cjs` - detector entry for the conformance ratchet plus header-comment update
- `README.md` - feature-table row, maintenance-scripts bullet (and refreshed check-drift.cjs bullet), fifth upstream entry

## Decisions Made
- The conformance gate is admitted to the `check-drift.cjs` umbrella because it is offline and deterministic (the umbrella's admission rule). The jargon and prose gates stay out because they are prose ratchets, not drift detectors.
- The pre-commit block carries no auto-regen path: `--write-baseline` appears only inside echoed hint text, so any regression exits 1 with the full gate output (threat T-18-09).
- The opening of the upstream-projects section now reads "five upstream projects" and counts the ports as three (VibeDrift, ASD-STE100, Agent Skills spec).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `node bin/maintenance/check-drift.cjs` exits 1 on this workstation, but for two pre-existing reasons unrelated to this plan: the HANDOFF schema validator exits 2 because the `ajv`/`ajv-formats` dev dependencies are not installed in this checkout, and the namespace detector reports 198 dash-style refs in committed `sdk/dist`/`sdk/src` files. Both predate plan 18-03 and are out of scope (logged in `deferred-items.md`). The SKILL.md conformance detector this plan added reports `[PASS]` inside the umbrella, and the umbrella's non-zero exit is caused only by those two pre-existing detectors.

## Verification Observed
- `bash -n bin/maintenance/pre-commit-drift-baseline.sh`: syntax OK.
- `bash bin/maintenance/pre-commit-drift-baseline.sh` on the clean tree: exit 0.
- `skill-conformance:` job count: 1; gate run step: 1; discrimination-test step: 1; job order `user-docs-prose` < `skill-conformance` < `bm-build-drift`: OK.
- `SKILL_CONF_SCRIPT` refs in the hook: 4; `check-skill-conformance.cjs` refs in check-drift.cjs: 2.
- No dash or box-drawing characters in the added hook block (node check exit 0).
- `node tests/skill-conformance.test.cjs` and `node tests/agentskills-watch.test.cjs`: both exit 0.
- `node bin/maintenance/check-user-docs-prose.cjs` and `check-user-docs-jargon.cjs --dry`: both exit 0 after the README edits.
- README greps: `check-agentskills-release.sh` 2, `skills-ref@0.1.5` 2, `npx skills add` 1, `five upstream projects` 1, `four upstream projects` 0, `check-skill-conformance.cjs` 3, `^**5. Agent Skills spec` 1, `trusted_global_roots` 2.
- Diff cleanliness node pipeline (no U+2013/U+2014, no c-a-n-o-n-i-c-a-l, no `.planning/` path in added README lines): exit 0.

## Next Phase Readiness
- The conformance gate is a loud-fail ratchet in CI, the pre-commit hook and the local umbrella; ROADMAP success criterion 2 is met.
- README documents the fifth upstream and the opt-in paths without loosening the strict default.
- Follow-up (not a blocker): run `npm install --include=dev` to clear the pre-existing ajv-missing umbrella failure, and consider a namespace-drift sweep of `sdk/dist`/`sdk/src`.

## Self-Check: PASSED
- All four modified files present.
- Both task commits present (`5a66220`, `306264b`).

---
*Phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate*
*Completed: 2026-10-12*
