---
phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate
plan: 02
subsystem: upstream-watch
tags: [upstream, cron, watch, agent-skills, security]
requires:
  - "bin/maintenance/check-skill-conformance.cjs (native own-skill gate, Plan 18-01)"
provides:
  - "bin/check-agentskills-release.sh (Agent Skills spec cron notifier)"
  - "tests/agentskills-watch.test.cjs (wedge-guard harness)"
  - "PROJECT.md fifth idea-only upstream register entries"
affects:
  - ".planning/PROJECT.md"
tech-stack:
  added: []
  patterns:
    - "VibeDrift-style release watch: npm version authoritative, GitHub best-effort, never vendored or run at runtime"
    - "Env-override tool paths (NPM/CURL/SSH/GH) so an offline harness can shim every network call"
key-files:
  created:
    - "bin/check-agentskills-release.sh"
    - "tests/agentskills-watch.test.cjs"
  modified:
    - ".planning/PROJECT.md"
decisions:
  - "D-06: npm skills-ref version is the authoritative watch signal; GitHub commits/main sha is best-effort (the spec repo cuts no releases or tags, so a releases/tags probe always 404s)"
  - "D-07: the fifth idea-only upstream is registered in PROJECT.md (the live register), not a separate watch-list doc"
metrics:
  duration: ~5min
  completed: 2026-10-11
---

# Phase 18 Plan 02: Agent Skills Spec Upstream Watch Summary

Put the Agent Skills spec on the upstream watch as the fifth idea-only upstream: a VibeDrift-style cron notifier keyed on `npm view skills-ref version` with a best-effort GitHub `commits/main` sha, an offline harness proving it never wedges cron, and the PROJECT.md register entries. The watch never vendors or invokes `skills-ref`; the plugin's own skills keep using the native subset in `bin/maintenance/check-skill-conformance.cjs`.

## What Was Built

- **Task 1 (`bin/check-agentskills-release.sh`, commit f58bd84):** Executable bash watch, `set -euo pipefail`, cloned from `check-vibedrift-release.sh`. Resolves npm via PATH then Homebrew/node candidates (exit 0 if absent), reads `npm view skills-ref version` as the authoritative signal and `npm view skills version` as an informational second line, probes `gh api repos/agentskills/agentskills/commits/main --jq .sha` best-effort (never releases/tags), seeds state on first run, compares version and sha, mails the maintainer over ssh, and updates the two state files only after a successful send. Every network/tool call is guarded (`|| exit 0` for gating signals, `|| true` for best-effort), so cron never wedges (T-18-02). Env overrides (NPM/CURL/SSH/GH/RECIPIENT/MAIL_HOST) exist for the harness and carry no secrets. No em/en dashes or box-drawing characters.
- **Task 2 (`tests/agentskills-watch.test.cjs`, commit 433e546):** Zero-dep check/assert harness that shims npm/curl/gh/ssh into a tmpdir and runs the script fully offline. Eight checks: npm-absent, network-down, first-run seed, unchanged, new-version-with-GitHub-404, sha-moved-same-version, failed-send-keeps-state, and script dash hygiene. The three wedge conditions each assert `status === 0`; the harness contacts no network.
- **Task 3 (`.planning/PROJECT.md`, commit 2b4dc14):** Added one validated-features line and one decisions-table row directly after the VibeDrift entries, naming `bin/check-agentskills-release.sh`, the native own-skill subset, and the opt-in version-pinned `skills-ref@0.1.5` check for external catalog candidates. VibeDrift lines unchanged.

## Verification Results

All run and observed, not inferred:

- `node tests/agentskills-watch.test.cjs` -> `8/8 checks passed`, exit 0.
- `bash -n bin/check-agentskills-release.sh` -> exit 0; file is executable (mode 100755).
- `grep -c "set -euo pipefail"` = 1; `grep -c "view skills-ref version"` = 1; `grep -c "releases/tags"` = 0; `grep -c "commits/main"` = 1; `grep -c "|| exit 0"` = 4; NPM/CURL/SSH/GH overrides = 1 each.
- `grep -c "npx\|npm install\|npm i "` = 0 (T-18-SC: no install path in the script).
- `NPM=/nonexistent/npm HOME=<tmp> bash bin/check-agentskills-release.sh` -> exit 0 (npm-absent wedge guard).
- Dash/box/word-hygiene node one-liners on both files -> exit 0.
- PROJECT.md: `check-agentskills-release.sh` appears 2x, `fifth idea-only upstream` 2x, `skills-ref@0.1.5` 1x; no VibeDrift lines removed; no new dashes in the added text.

## Deviations from Plan

None - plan executed exactly as written. (One acceptance check was based on an incorrect planner assumption; see Assumption Drift below.)

## Assumption Drift (advisory)

- **Found during:** Task 3.
- **Planned:** The plan prose and one acceptance criterion assumed `.planning/upstream-deferred.md` does not exist (`ls .planning/upstream-deferred.md` should fail), with PROJECT.md as the only register.
- **Actual:** `.planning/upstream-deferred.md` already exists (tracked, committed 2026-07-23 in d2f87ce) and is unrelated to this plan. I neither created nor modified it; the register still lives in PROJECT.md per D-07, satisfying the task's real requirement ("do not create it").
- **Why:** The file predates this phase; the planner's "it does not exist" note was stale. Non-blocking: no action taken, nothing on the runtime path changed.

## Self-Check: PASSED

- Files: bin/check-agentskills-release.sh, tests/agentskills-watch.test.cjs, .planning/PROJECT.md all FOUND.
- Commits: f58bd84, 433e546, 2b4dc14 all FOUND in git log.
