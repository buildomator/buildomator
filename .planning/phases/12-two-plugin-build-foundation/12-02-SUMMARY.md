---
phase: 12-two-plugin-build-foundation
plan: 02
subsystem: infra
tags: [ci, github-actions, drift-detection, install-smoke, releasing, claude-plugin-root, buildomator]

requires:
  - phase: 12-two-plugin-build-foundation (plan 12-01)
    provides: bin/build-bm.cjs (--check mode), committed dist/bm, build:bm/check:bm-drift/validate:bm-plugin npm scripts, dual marketplace entry, extended version-alignment guard
provides:
  - CI drift gate (bm-build-drift) that regenerates dist/bm and fails on any divergence from the committed tree
  - CI install-smoke gate (bm-package-smoke) proving the bm package resolves via its own CLAUDE_PLUGIN_ROOT with a primary-path-wins hook tripwire
  - RELEASING.md dual-package release procedure and the hook-fallback known limitation
affects: [phase-13, phase-14, buildomator-rebrand, releasing]

tech-stack:
  added: []
  patterns:
    - "CI-as-release-gate: drift and path-safety are enforced by workflow jobs, not human checklists"
    - "Primary-path-wins tripwire: plant a poisoned fallback candidate so any non-CLAUDE_PLUGIN_ROOT resolution fails loud"

key-files:
  created: []
  modified:
    - .github/workflows/check-drift.yml
    - .github/workflows/install-smoke.yml
    - RELEASING.md

key-decisions:
  - "bm-build-drift runs on ubuntu-latest with node 22, no npm ci (build-bm and its test are zero-dep Node built-ins)"
  - "bm-package-smoke reuses the debian:trixie container and leaves the existing gsd fresh-debian-install job byte-untouched (D-12)"
  - "dist/bm/hooks/hooks.json keeps the verbatim gsd cache fallback this phase; per-plugin fix deferred to Phase 13/14 (documented as a known limitation)"

patterns-established:
  - "Release gate: a stale or hand-edited dist/bm fails CI and blocks the tag, making regeneration non-optional"
  - "Hook resolution proof: extract the SessionStart command from the packaged hooks.json and run it against a planted tripwire to prove the primary path wins"

requirements-completed: [BUILD-02, BUILD-03]

duration: ~18min (executor) + orchestrator recovery
completed: 2026-07-03
---

# Phase 12: Two-Plugin Build Foundation (Plan 12-02) Summary

**CI now enforces the two-package arrangement: a bm-build-drift job fails on any dist/bm divergence, a bm-package-smoke job proves bm resolves via its own CLAUDE_PLUGIN_ROOT with a fallback tripwire, and RELEASING.md documents the dual-package release.**

## Performance

- **Duration:** ~18 min executor run (interrupted by an API error before the final commit), finished by orchestrator recovery
- **Completed:** 2026-07-03
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added the `bm-build-drift` job to `check-drift.yml`: runs the drift test, `build-bm.cjs --check` (D-06), bm manifest validation, and version-alignment. Every push and PR now regenerates bm and hard-fails on drift outside the stamped identity fields.
- Added the `bm-package-smoke` job to `install-smoke.yml` (BUILD-03): manifest sanity, `gsd-sdk --version` and a real `state.load` query via `CLAUDE_PLUGIN_ROOT=dist/bm`, and a primary-path-wins hook proof that plants a poisoned tripwire in the only gsd cache candidate and asserts it never fires. The existing gsd job is left byte-untouched (D-12).
- Rewrote the RELEASING.md pre-release checklist for the dual-package release (D-05): bump `plugin.json` only, run `build:bm`, commit `dist/bm/` + `marketplace.json`, with `check:bm-drift` and `validate:bm-plugin` as local pre-tag commands. Named both new CI jobs as gates and recorded the hook-fallback known limitation.

## Task Commits

1. **Task 1: Add bm-build-drift job to check-drift.yml** - `0e97a2b` (ci)
2. **Task 2: Add bm-package-smoke job to install-smoke.yml** - `fbaca8b` (ci)
3. **Task 3: Document dual-package release in RELEASING.md** - `698a1b3` (docs)

## Files Created/Modified
- `.github/workflows/check-drift.yml` - appended the `bm-build-drift` job (drift test, `--check`, bm manifest validation, version-alignment); no existing job touched
- `.github/workflows/install-smoke.yml` - appended the `bm-package-smoke` job (CLAUDE_PLUGIN_ROOT resolution + tripwire fallback proof); gsd job unchanged
- `RELEASING.md` - dual-package release steps, both CI jobs named as gates, hook-fallback known limitation with Phase 13/14 deferral

## Decisions Made
- No `npm ci` in the drift job: build-bm and its test are zero-dependency Node built-ins, so only `checkout@v4` (for git, which the integration cases need) and `setup-node@v4` are required.
- The bm smoke job mirrors the gsd container/prereqs exactly rather than sharing steps, keeping the gsd job byte-for-byte untouched per D-12.
- The verbatim gsd-cache fallback in `dist/bm/hooks/hooks.json` stays this phase; the primary-path-wins tripwire makes it safe in practice, and the per-plugin fix is scheduled with Phase 13/14 divergence work.

## Deviations from Plan

None to the plan's intended output. All three tasks were completed as specified.

## Issues Encountered
- **Executor API interruption (recovered):** The `gsd-executor` subagent hit an "API Error: Connection closed mid-response" after committing Tasks 1 and 2. Task 3's RELEASING.md edit was written but uncommitted, and the missing "Known limitation" note plus the explicit bm-job references were never added. The worktree also held ~47 spurious `dist/bm/**` modifications from a regeneration against a transiently dirty source tree. The orchestrator recovered under the safe-resume "close out manually" path: discarded the spurious `dist/bm` changes (the committed dist/bm at the wave base passed `--check`), finished Task 3 (added the known-limitation note and named both CI jobs as gates), verified all Task 3 acceptance criteria, then committed Task 3 and this SUMMARY. The two CI-job commits were reviewed and found complete and sound before recovery.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two-package build foundation is complete and CI-enforced: drift cannot ship, and bm path-safety is smoke-verified with the cache id still `gsd-plugin`.
- Phase 13/14 should pick up the per-plugin hook fallback fix (the one documented known limitation) as the packages begin to diverge beyond identity fields.
- CI verdicts (both workflows green) should be confirmed on GitHub after push; local checks all pass.

## Self-Check: PASSED

---
*Phase: 12-two-plugin-build-foundation*
*Completed: 2026-07-03*
