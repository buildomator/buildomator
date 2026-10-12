# Phase 18 Deferred Items

Out-of-scope discoveries logged during plan 18-05 execution. Not fixed here (scope boundary: only issues directly caused by the current task's changes are auto-fixed).

## check-drift.cjs umbrella: two pre-existing detectors red (out of scope)

`node bin/maintenance/check-drift.cjs` exits 1. The phase-18 addition (SKILL.md conformance ratchet) reports PASS inside the umbrella. Two unrelated detectors are red and predate phase 18:

1. **Namespace drift (dry-run): 198 dash-style command refs across 52 files.** Mostly `sdk/dist`, `sdk/src`, `references/`, `.planning/quick`. Phase-18 new files add zero dash-style refs (verified). Fix is `node bin/maintenance/rewrite-command-namespace.cjs` across 52 files, a repo-wide normalization unrelated to this phase.
2. **HANDOFF schema validator: child exited 2.** A `.planning/HANDOFF.json` (5534 bytes) from a prior interrupted session is present; the umbrella's handoff validator exits 2 against it. Unrelated to this phase's work.

## Pre-existing hygiene: the word "canonical" in phase-16 trust-gate code

`bin/lib/skill-trust-gate.cjs` and `sdk/src/skill-trust-gate.ts` use a `findCanonical(...)` helper and a `canon` local (SPDX id classification), introduced in phase 16. The project forbids the word "canonical" anywhere. No lines added during phase 18 use it (verified via the phase-18 diff). Renaming the helper across both twins touches committed phase-16 source and is out of scope for the phase-close plan.

## Uncommitted working-tree changes not authored by this plan

During the 18-05 run, ~47 tracked files outside `.planning/` (namespace `/gsd-x` -> `/gsd:x` normalizations across `sdk/src`, `sdk/dist`, `references/`, `hooks/`, `templates/`, `workflows/`) appeared as uncommitted working-tree modifications. They are not part of plan 18-05 and were never staged into any 18-05 commit (commit d2e6031 contains only `dist/bm`). A redundant `git stash@{0}` holds a duplicate snapshot. These changes and the stash are left untouched so no concurrent work is destroyed; the orchestrator/human should decide their disposition.
