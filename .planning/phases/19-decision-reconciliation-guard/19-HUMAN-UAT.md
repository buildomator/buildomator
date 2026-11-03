---
status: partial
phase: 19-decision-reconciliation-guard
source: [19-VERIFICATION.md]
started: 2026-11-03T19:29:34Z
updated: 2026-11-03T19:29:34Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Clear capture-time contradiction auto-rewrites (RECON-01)
expected: Record a decision in STATE.md that clearly contradicts a rule in the repo-root CLAUDE.md or PROJECT.md. The contradicted rule is rewritten in place, committed as its own revertible commit, and a notice is shown. No blocking prompt appears.
result: [pending]

### 2. Ambiguous contradiction asks before changing (RECON-02)
expected: Record a decision whose contradiction is ambiguous, then run /reconcile. No doc changes until you pick which rule wins. The pending record carries the conflict until resolved.
result: [pending]

### 3. Session-start sweep surfaces, never silently rewrites (RECON-03)
expected: Start a session while an unreconciled contradicting decision exists. The contradiction is surfaced at startup and you are asked to confirm before any rewrite. Nothing is rewritten silently.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
