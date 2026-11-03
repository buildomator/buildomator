---
phase: 19-decision-reconciliation-guard
plan: 04
subsystem: build-ci
tags: [reconcile, ci, build-bm, drift]
requires: [19-01, 19-02, 19-03]
provides:
  - reconcile-guard CI job (SDK build, reconcile unit tests, both parity tests, build-bm --check)
  - RECON-01..07 traceability closed
affects: []
tech-stack:
  added: []
  patterns: [build SDK before any test that drives sdk/dist]
key-files:
  modified:
    - .github/workflows/check-drift.yml
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Added a dedicated reconcile-guard job rather than extending an existing job, so the SDK build precedes the parity tests that drive sdk/dist/cli.js"
metrics:
  tasks: 3
  completed: 2026-11-03
---

# Phase 19 Plan 04: Build, CI wiring and golden verification Summary

CI now builds the SDK and runs the reconcile unit tests, both cross-twin parity tests and `build-bm --check`; the committed sdk/dist and dist/bm were confirmed identical to a fresh build.

## Task results

1. **Rebuild SDK / regenerate dist/bm.** `npm --prefix sdk run build` and `npm run build:bm` both ran and left the tree clean (`git status` empty), so Plan 19-03 had already committed the regenerated sdk/dist and dist/bm. Nothing new to commit. `sdk/dist/cli.js query reconcile candidates --latest --raw` returns JSON (observed).
2. **Clean-tree drift check and CI.** `npm run check:bm-drift` printed "bm drift check: PASS (committed dist/bm matches a fresh build)" on a clean tree. Added job `reconcile-guard` to `.github/workflows/check-drift.yml` (commit dc8a0cf): sdk install and build, `vitest run reconcile`, `vitest run state-mutation.reconcile`, both parity tests, `build-bm --check`, in that order.
3. **Golden verification and traceability.** Ran locally: `vitest run reconcile` 17 passed, `state-mutation.reconcile` 2 passed, `reconcile-sdk-parity` and `reconcile-capture-parity` all checks passed. Traced the three fixtures through `reconcile candidates --latest` and `reconcile sweep` in scratch copies:
   - enrolment-clear: one auto-rewritable candidate and one surface-only candidate ("inside an auto-managed do-not-edit block"), same on both entry points, `modelNeeded: true`.
   - ambiguous: one candidate returned on both entry points, `modelNeeded: true`; routing to the pending record is done by the `reconcile pending` call (covered by the parity test's pending/ledger check), not by the read-only `sweep` command, which wrote no files.
   - no-candidate: empty candidates, `modelNeeded: false`, no files written.
   REQUIREMENTS.md: RECON-01..07 marked Complete in the table and checkboxes.

## Not verified

The capture-time directive attached by `state.add-decision` and the SessionStart hook were not exercised live here; they are covered by the capture parity test and the 19-02/19-03 work. The CI job itself was not run on GitHub.

## Deviations from Plan

- [Rule 3 - Blocking] The plan's verify command used `--cwd <fixture>`, which the CLI does not honor (it read the repo's own STATE.md). I traced the fixtures by copying each into a scratch directory and running from there. Cost if wrong: none, verification only.
- Task 1 produced no commit because the artifacts were already current.

## Known Stubs

None.

## Self-Check: PASSED
