---
phase: 19-decision-reconciliation-guard
plan: 03
subsystem: hooks
tags: [reconcile, sessionstart, hook, skill]
requires: [19-01, 19-02]
provides:
  - hooks/gsd-reconcile-sweep.js SessionStart detector that merges un-ledgered contradiction candidates into the pending record
  - SessionStart registration and coexistence-list entry in hooks.json
  - skills/reconcile on-demand drain-and-apply skill (always asks)
affects: [19-04]
tech-stack:
  added: []
  patterns: [standalone advisory detector, merge-by-hash pending write]
key-files:
  created:
    - hooks/gsd-reconcile-sweep.js
    - skills/reconcile/SKILL.md
  modified:
    - hooks/hooks.json
    - dist/bm
    - tests/drift-baseline.json
key-decisions:
  - "Sweep hook calls reconcilePending per flagged hash, so earlier undrained entries (including capture-time ambiguous ones) are preserved"
  - "Hook resolves the project from the stdin cwd field, falling back to process.cwd(), and exits silently without a .planning dir"
metrics:
  tasks: 2
  completed: 2026-11-03
---

# Phase 19 Plan 03: Session-start reconcile sweep Summary

A SessionStart detector runs the mechanical sweep, merges un-ledgered contradiction candidates into `.planning/reconcile-pending.json`, and tells the agent to ask before any rewrite; a bare-named `reconcile` skill drains the same record on demand.

## Verification observed

- Fixture run (enrolment-clear plus a pre-seeded `otherhash` pending entry): hook exited 0, printed additionalContext naming `.planning/reconcile-pending.json` and `references/decision-reconciliation.md`; pending file held both the new enrolment entry and the preserved `otherhash`.
- After recording the swept decision in the ledger, a second hook run printed 0 bytes.
- `hooks/hooks.json` parses as JSON; `grep -c gsd-reconcile-sweep.js` = 2 (SessionStart entry and coexistence list).
- `node bin/build-bm.cjs --check`: PASS after regenerating dist/bm.
- `tests/reconcile-capture-parity.test.cjs` and `tests/reconcile-sdk-parity.test.cjs`: pass.
- Not verified: the live SessionStart firing inside Claude Code, and an agent actually following the skill (prose).

## Deviations from Plan

**1. [Rule 3 - Blocking] dist/bm and drift baseline regenerated**
- New hook and skill files change the generated bm build and the drift baseline.
- Cost if wrong: stale committed dist/bm would fail the drift gate.

**2. Verify command adjusted**
- The plan's second-run step used an unsupported `--cwd` flag; I marked the ledger current by calling `reconcileRecord` directly instead. Cost if wrong: none, test-only.

## Commits

- 9bc19fb feat(19-03): add session-start reconcile sweep hook
- 5200e58 feat(19-03): register sweep hook and add reconcile skill
- a7d2d52 chore(19-03): regenerate dist/bm

## Self-Check: PASSED
