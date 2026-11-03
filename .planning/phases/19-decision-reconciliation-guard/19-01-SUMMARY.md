---
phase: 19-decision-reconciliation-guard
plan: 01
subsystem: sdk-query
tags: [reconcile, decisions, ledger, safety-gate, twin-parity]
requires: []
provides:
  - reconcile.candidates / record / sweep / pending query commands (SDK and CJS twins)
  - content-hash ledger (.planning/reconcile-ledger.json) and merge-preserving pending record (.planning/reconcile-pending.json)
  - assessTargetDoc safety gate (repo-root CLAUDE.md and PROJECT.md only)
  - references/decision-reconciliation.md agent-procedure contract
  - workflow.decision_reconciliation config key
affects: [19-02, 19-03, 19-04]
tech-stack:
  added: []
  patterns: [twin engines with byte-identical JSON, no model call in mechanical core]
key-files:
  created:
    - sdk/src/query/reconcile.ts
    - sdk/src/query/reconcile.test.ts
    - bin/lib/reconcile.cjs
    - references/decision-reconciliation.md
    - tests/reconcile-sdk-parity.test.cjs
    - tests/fixtures/reconcile/ (3 fixtures)
  modified:
    - sdk/src/query/check-decision-coverage.ts
    - sdk/src/query/command-static-catalog-foundation.ts
    - sdk/src/query/command-manifest.non-family.ts
    - sdk/src/query/command-aliases.generated.ts
    - bin/lib/command-aliases.generated.cjs
    - sdk/src/query/config-schema.ts
    - bin/lib/config-schema.cjs
    - bin/gsd-tools.cjs
key-decisions:
  - "Candidate retrieval: 5-char stems of content words, at least 2 shared and overlap ratio of 0.4 against the smaller stem set"
  - "reconcile.pending takes a decision hash and reads decision and candidates itself, so no decision text is ever passed on a command line"
  - "Pending entries carry no timestamp so both twins write byte-identical files"
metrics:
  tasks: 3
  completed: 2026-11-03
---

# Phase 19 Plan 01: Reconcile engine Summary

Mechanical core of the Decision Reconciliation Guard in both twins: STATE.md decision-log reader, no-model candidate retrieval, content-hash ledger, merge-preserving pending record, and a target-doc safety gate, plus the agent-procedure reference.

## Verification observed

- `cd sdk && npx tsc --noEmit`: clean.
- `npx vitest run reconcile`: 17/17 passed (fixture counts, ledger idempotency, re-judge on edited text, record drains pending, pending merge, direct assessTargetDoc cases for ROADMAP.md, STATE.md, global CLAUDE.md, @-include, do-not-edit block, plus plain CLAUDE.md/PROJECT.md allowed).
- `node tests/reconcile-sdk-parity.test.cjs` after `npm run build`: 9/9 ok (candidates and sweep identical across all three fixtures, ledger and pending on-disk parity).
- `node bin/gsd-tools.cjs reconcile candidates --latest --cwd tests/fixtures/reconcile/no-candidate --raw`: `candidates: []`, `modelNeeded: false`.
- Also run: command-definition vitest (4/4), config-schema-sdk-parity, `check-command-aliases-fresh.mjs`, `build-bm.cjs --check` (PASS after regenerating dist/bm).
- Not verified: the semantic judgment and the firing points (out of scope here). The parity test's safety-gate case exercises only the CJS twin; the SDK twin's gate is covered by vitest.

## Deviations from Plan

**1. [Rule 3 - Blocking] Fixtures need a `.planning/` dir for `--cwd`**
- Found during: Task 2 verify
- Issue: gsd-tools resolves the worktree root when `<cwd>/.planning` is absent, so `--cwd tests/fixtures/reconcile/no-candidate` silently read the real repo.
- Fix: each fixture got `.planning/config.json` (force-added; `.planning/` is gitignored). STATE.md and CLAUDE.md stay flat as planned.
- Cost if wrong: fixtures would read the host repo and tests would be non-deterministic.
- Commit: 8475682

**2. [Rule 1 - Bug] Candidate retrieval too noisy on real data**
- Found during: Task 2 verify (real repo returned 14 candidates for one decision)
- Fix: added an overlap-ratio threshold (0.4 of the smaller stem set) in both twins.
- Cost if wrong: threshold may miss paraphrased contradictions; it is a single constant to tune.
- Commit: 8475682

**3. [Rule 3 - Blocking] Alias files edited by hand**
- Found during: Task 2
- Issue: `sdk/scripts/gen-command-aliases.ts` no longer emits the non-family section present in the committed generated files, so it cannot regenerate them.
- Fix: inserted the four reconcile entries in generator order (sorted) in both files; `check-command-aliases-fresh.mjs` passes.
- Cost if wrong: next real regeneration of the non-family block could drop or reorder entries.

**4. [Rule 3 - Blocking] sdk/dist and dist/bm are tracked**
- Rebuilt sdk/dist and regenerated dist/bm so the parity test and the bm drift gate pass. Commits ed38eb1, 608be34.

## Assumption Drift (advisory)

- Found during: Task 2. Planned: only repo-root CLAUDE.md and PROJECT.md are rule docs. Actual: this project's PROJECT.md lives at `.planning/PROJECT.md`, so it is scanned but always reported surface-only (`not a repo-root CLAUDE.md or PROJECT.md`). Cost if wrong: the guard never auto-rewrites PROJECT.md here; widening the allowlist is a one-line change in assessTargetDoc but was left to the plan's safety decision.

## Commits

- 6138e65 feat(19-01): SDK reconcile engine, config key, golden fixtures
- 8475682 feat(19-01): CJS reconcile twin, router case, alias entries
- ed38eb1 feat(19-01): agent-procedure reference, unit and parity tests
- 608be34 chore(19-01): regenerate dist/bm

## Self-Check: PASSED
