---
phase: quick-260716-r1c
plan: 01
status: complete
subsystem: audit-open
tags: [audit-open, quick-tasks, cjs-sdk-parity, milestone-close]
requirements: [QUICK-260716-R1C]
requires:
  - bin/lib/audit.cjs scanQuickTasks
  - sdk/src/query/audit-open.ts scanQuickTasks
provides:
  - Quick-task classification shared identically by the CJS and SDK audit-open scanners
affects:
  - /gsd:complete-milestone pre-close open-artifact gate
key-files:
  created:
    - tests/audit-open-quick-tasks.test.cjs
    - sdk/src/query/audit-open.test.ts
  modified:
    - bin/lib/audit.cjs
    - sdk/src/query/audit-open.ts
    - sdk/src/golden/read-only-parity.integration.test.ts
decisions:
  - Define INCOMPLETE_QUICK_STATUSES once per file with identical contents rather than sharing a module across the CJS/SDK boundary; the golden parity test is the lockstep guard.
metrics:
  duration: ~25min
  tasks: 2
  files: 5
  completed: 2026-07-16
---

# Quick 260716-r1c: Fix audit-open Quick-Task False-Positive Summary

Both the CJS and SDK `audit-open` scanners now classify quick tasks identically: a task is flagged only when its SUMMARY is missing, unreadable, or carries a status in `{incomplete, gaps, gaps_found, partial, blocked}`; a readable SUMMARY with no status field (or status `complete`) counts as done. The SDK scanner also gained the prefixed `<id>-SUMMARY.md` discovery it was missing.

## What Changed

### Task 1: Fix both scanQuickTasks, rebuild sdk/dist, regenerate dist/bm (commit f5f8e0c)

- `sdk/src/query/audit-open.ts`: replaced the bare `join(taskDir, 'SUMMARY.md')` lookup with the same readdir-based discovery the CJS scanner already had (accept `SUMMARY.md` or `*-SUMMARY.md`, prefer `<dirName>-SUMMARY.md`, then any `-SUMMARY.md`, then bare; `try/catch` falls through to `status: missing`). This fixed the SDK never matching the mandated `<quick_id>-SUMMARY.md` name, which had made every quick task read as `missing`.
- Both files: added a module-level `INCOMPLETE_QUICK_STATUSES = new Set(['incomplete', 'gaps', 'gaps_found', 'partial', 'blocked'])` with identical contents, and replaced the over-strict `if (status === 'complete') continue;` gate with `if (status !== 'missing' && status !== 'unreadable' && !INCOMPLETE_QUICK_STATUSES.has(status)) continue;`. Status is lowercased at read time in both files, so the check is case-insensitive.
- Updated the stale CJS doc comment ("Incomplete if SUMMARY.md missing or status !== 'complete'") to describe the new rule.
- Rebuilt `sdk/dist` and regenerated `dist/bm`; `build-bm --check` green.

### Task 2: Tests on both sides plus a cross-boundary parity assertion (commit 021c855)

- `tests/audit-open-quick-tasks.test.cjs`: zero-dep `node:assert`-style unit test over cases A-D (prefixed SUMMARY with no status; no SUMMARY; incomplete + uppercase BLOCKED; bare SUMMARY with no status).
- `sdk/src/query/audit-open.test.ts`: vitest unit test mirroring the same cases.
- `sdk/src/golden/read-only-parity.integration.test.ts`: added a second `it` in the existing audit-open describe that builds the same A-D fixture project (including the original bug shape: a prefixed `<dir>-SUMMARY.md` with no status field) and asserts `captureGsdToolsOutput` deep-equals `registry.dispatch` after stripping `scanned_at`/`has_scan_errors`. The existing repo-root parity `it` was left intact (only the `strip` helper was hoisted so both cases share it).
- Regenerated `dist/bm` so the new and edited test files are mirrored (build-bm sources from `git ls-files`, so the new files were staged before regeneration).

## Gate Results

| Gate | Result |
|------|--------|
| CJS unit test (`node tests/audit-open-quick-tasks.test.cjs`) | PASS (6/6) |
| SDK vitest unit (`vitest run src/query/audit-open.test.ts`) | PASS (6/6) |
| SDK parity (`vitest run ...read-only-parity... -t audit-open`) | PASS (2/2) |
| `node bin/build-bm.cjs --check` | PASS |
| `node bin/maintenance/check-version-alignment.cjs` | PASS (4.1.1 aligned) |
| End-to-end CJS vs SDK | PASS |

### End-to-end before/after (this repo)

| Scanner | Before | After | Lists 260716-0ao / 260714-coq? |
|---------|--------|-------|-------------------------------|
| SDK (`node sdk/dist/cli.js query audit-open --json`) | 37 (every quick dir read as `missing`) | 2 | No |
| CJS (`node bin/gsd-tools.cjs audit-open --json`) | included the 2 false positives | 2 | No |

After the fix both scanners report `quick_tasks = 2` (counts match), and the two remaining entries are genuine `missing`-SUMMARY dirs (`260411-12i` and this task's own dir, which has no SUMMARY at scan time). The two previously false-flagged completed tasks (`260716-0ao` auto-enable-bm, `260714-coq` centralize-marketplace) are no longer listed.

## Deviations from Plan

None on the product code. The plan was executed as written.

Process note (not a code deviation): `sdk/node_modules` is absent in the worktree, so the build toolchain was run via a temporary symlink to the primary checkout's `sdk/node_modules` (gitignored, never staged, removed after building). This did not affect any product file.

## Deferred Issues

The full `read-only-parity.integration.test.ts` run reports 5 failures in the `state.json` / `state.load` describe blocks (`get-shit-done/bin/lib/core.cjs not found`). These are pre-existing and environmental: the legacy `get-shit-done/` dir is absent in both the worktree and the primary checkout when `CLAUDE_PLUGIN_ROOT` is unset (the vitest default), and this task did not touch `state-project-load.ts`. Logged in `deferred-items.md`. All audit-open assertions from this task pass.

## Self-Check: PASSED

- Commits f5f8e0c and 021c855 present in `git log`.
- All created/modified files exist on disk.
