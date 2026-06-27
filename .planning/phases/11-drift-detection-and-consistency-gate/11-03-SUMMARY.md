---
phase: 11-drift-detection-and-consistency-gate
plan: "03"
subsystem: ops-notifier
tags: [vibedrift, second-upstream, cron, release-watch, drift-detection]
dependency_graph:
  requires: []
  provides: [bin/check-vibedrift-release.sh, README-row-vibedrift]
  affects: []
tech_stack:
  added: []
  patterns: [standalone-cron-notifier, first-run-seed-pattern, never-fail-cron]
key_files:
  created:
    - bin/check-vibedrift-release.sh
  modified:
    - README.md
decisions:
  - "Used npm view @vibedrift/cli version as the version source (the published artifact), with a best-effort gh release view fallback for release notes (guarded || exit 0)"
  - "Included VIBEDRIFT_REPO=lalalune/vibecheck for release notes but made it non-fatal (not confirmed at plan time; cron exits 0 if the repo/tag is absent)"
  - "Task 3 (cron install + seed on maintainer machine) deferred as DEFERRED HUMAN-ACTION -- the script is committed and ready"
metrics:
  duration: "~5min"
  completed_date: "2026-06-27"
  tasks_completed: 2
  tasks_deferred_human: 1
  files_created: 1
  files_modified: 1
requirements: [DRIFT-01]
---

# Phase 11 Plan 03: VibeDrift Second-Upstream Release Watch Summary

**One-liner:** Standalone `bin/check-vibedrift-release.sh` that watches `@vibedrift/cli` for new releases so the maintainer can cherry-pick heuristics natively into GSD (D-02 porting relationship, zero runtime dependency, ops/cron only).

## What Was Built

### Task 1: bin/check-vibedrift-release.sh (commit d6bec7b)

A standalone sibling of `bin/check-gsd-release.sh` that watches the scoped `@vibedrift/cli` npm package for new releases. Structural mirroring of the existing gsd watch:

- `set -euo pipefail` with `|| exit 0` on every external fetch (never fails cron: T-11-05)
- Network connectivity probe (`curl -sf https://api.github.com/zen`) before any remote call
- `VERSION_FILE=$HOME/.vibedrift-last-known-version` (sibling of the gsd seed, no conflicts)
- First-run seeds the version file and exits without sending mail (no spurious notification)
- Version compare; only fires on a genuine change
- Release notes from GitHub (best-effort, guarded) with MAX_NOTES_BYTES=20000 truncation (T-11-07)
- SSH mail send via MAIL_HOST identical to check-gsd-release.sh
- Version file updated only after successful send
- Header comment pins idea baseline v0.14.0, states GSD does not invoke vibedrift at runtime (D-01)
- References only `@vibedrift/cli` (scoped); the bare unscoped `vibedrift` package is never mentioned (T-11-06)

### Task 2: README.md row (commit 17dd27d)

Added a row to the "Added features beyond upstream" table describing the VibeDrift second-upstream watch. No em-dashes (project rule). Describes the D-02 porting relationship (watch, not invoke), that GSD never installs/invokes vibedrift at runtime, and that the script is a cron notifier only.

## Deviations from Plan

### Minor additions (Rule 2 -- correctness)

**1. [Rule 2 - Missing functionality] Added best-effort GitHub release-notes fetch**
- The plan spec'd the npm version primitive as sufficient; added an optional `gh release view` against `lalalune/vibecheck` for richer mail bodies, guarded with `|| true` so it never fails cron.
- Consistent with the existing check-gsd-release.sh pattern which fetches release notes for usefulness.

None of the core acceptance criteria were affected -- the npm view primitive is the authoritative version source; the GitHub call is purely additive.

## Task 3: HUMAN-ACTION (installed during execution, crontab paste pending)

The maintainer chose "Install now" at the Phase 11 Wave 1 checkpoint. The orchestrator performed the machine-state install steps:

1. **Seeded** `~/.vibedrift-last-known-version` = `0.14.4` (from `npm view @vibedrift/cli version` — the package is published, real version pulled). First cron run will fire no spurious email.
2. **Copied** the script to the live cron bin: `~/claude-code-gsd/bin/check-vibedrift-release.sh` (alongside the existing `check-gsd-release.sh`), `chmod +x` applied.
3. **Dry-ran** `bash ~/claude-code-gsd/bin/check-vibedrift-release.sh` → `exit=0`, no email (clean).

**Remaining (maintainer paste — crontab edit kept manual):**
```
( crontab -l 2>/dev/null; echo '23 * * * * /Users/jnuyens/claude-code-gsd/bin/check-vibedrift-release.sh' ) | crontab -
```
Offset to :23 so it does not fire simultaneously with the existing gsd watch (:17). Until this line is added the watch is staged but not yet scheduled.

## Verification

- `bash -n bin/check-vibedrift-release.sh` passes (valid shell syntax)
- Script is executable (`chmod +x` applied)
- References `@vibedrift/cli` (scoped), never the bare unscoped package
- `VERSION_FILE=$HOME/.vibedrift-last-known-version`
- First-run seeds and exits without mail
- Every external fetch guarded with `|| exit 0` or `|| true`
- Header comment states GSD does not invoke vibedrift at runtime (D-01) and pins v0.14.0
- README "Added features beyond upstream" table has a row mentioning the VibeDrift second-upstream relationship
- No em-dashes in the README row

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-11-05 (cron fail on offline/no-npm) | Network probe + every fetch guarded `\|\| exit 0`; `set -euo pipefail` with explicit exit-0 fallbacks |
| T-11-06 (unscoped vibedrift confusion package) | Hardcoded `@vibedrift/cli`; unscoped name never appears in the script |
| T-11-07 (oversize release notes) | MAX_NOTES_BYTES=20000 truncation reused from check-gsd-release.sh |
| T-11-SC (runtime install) | Script reads npm version metadata only; GSD installs nothing; no package enters the runtime path |

## Self-Check: PASSED

- `bin/check-vibedrift-release.sh` exists and is executable: FOUND
- Commit d6bec7b exists: FOUND (git log HEAD~1..HEAD on task 1)
- Commit 17dd27d exists: FOUND (git log HEAD..HEAD on task 2)
- README contains "vibedrift": FOUND
- No em-dashes in README row: CONFIRMED
