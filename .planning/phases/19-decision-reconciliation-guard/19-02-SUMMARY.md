---
phase: 19-decision-reconciliation-guard
plan: 02
subsystem: sdk-query
tags: [reconcile, add-decision, capture-time, twin-parity]
requires: [19-01]
provides:
  - state.add-decision attaches a `reconcile` directive (candidates, decisionHash, directive) in both twins
  - execute-plan.md step acting on the directive with no executor-side ask
  - cross-twin add-decision parity test
affects: [19-03, 19-04]
tech-stack:
  added: []
  patterns: [shared reconcileDirectiveForLatest helper in each twin, directive only when modelNeeded]
key-files:
  created:
    - sdk/src/query/state-mutation.reconcile.test.ts
    - tests/reconcile-capture-parity.test.cjs
  modified:
    - sdk/src/query/reconcile.ts
    - sdk/src/query/state-mutation.ts
    - bin/lib/reconcile.cjs
    - bin/lib/state.cjs
    - workflows/execute-plan.md
key-decisions:
  - "Directive built by reconcileDirectiveForLatest in each reconcile twin and returned only when candidates exist and the ledger has no outcome, so fresh-topic decisions add no field"
  - "Capture-time ambiguous conflicts go to reconcile.pending, never AskUserQuestion, because bm-executor has no such tool"
metrics:
  tasks: 3
  completed: 2026-11-03
---

# Phase 19 Plan 02: Capture-time reconcile directive Summary

Both `state.add-decision` twins now attach a `reconcile` directive when the latest decision matches a rule and the ledger has no outcome, and execute-plan.md tells the agent to rewrite and commit a clear contradiction or write an ambiguous one to the pending record, never asking.

## Verification observed

- `cd sdk && npx tsc --noEmit`: clean.
- `npx vitest run state-mutation.reconcile`: 2/2 passed (no-candidate has no reconcile field; matching decision has candidates, 16-hex hash, directive naming references/decision-reconciliation.md). With the Plan 01 tests, `vitest run reconcile`: 19/19.
- `npm run build` then `node tests/reconcile-capture-parity.test.cjs`: both cases ok (CJS and SDK outputs deepStrictEqual for enrolment-clear and no-candidate).
- `node tests/reconcile-sdk-parity.test.cjs`: all checks passed.
- `node bin/build-bm.cjs --check`: PASS.
- `grep -c decision-reconciliation workflows/execute-plan.md` = 1; pending-record grep = 1.
- Not verified: the agent actually following the workflow step (prose, not executable).

## Deviations from Plan

**1. [Rule 3 - Blocking] sdk/dist and dist/bm are tracked**
- Rebuilt both so the parity test and bm drift gate pass.
- Cost if wrong: stale committed builds would fail CI drift gates.

**2. Test setup detail**
- Fixtures keep a flat STATE.md; tests copy it into `.planning/STATE.md` in a temp dir because add-decision resolves the planning path.
- Cost if wrong: none, test-only.

## Assumption Drift (advisory)

- Found during: Task 1. Planned: retrieval "for the just-added entry". Actual: the helper uses the latest decision in the log, which is the one just appended. Cost if wrong: a concurrent writer appending between write and read would reconcile the wrong entry; low risk.

## Commits

- feat(19-02): attach reconcile directive in add-decision twins
- feat(19-02): act on capture-time reconcile directive in execute-plan
- test(19-02): add cross-twin add-decision reconcile parity test
- chore(19-02): rebuild sdk/dist
- chore(19-02): regenerate dist/bm

## Self-Check: PASSED
