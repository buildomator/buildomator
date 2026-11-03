---
phase: 19-decision-reconciliation-guard
verified: 2026-11-03T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (mechanical + wiring); agent-driven paths need human confirmation
has_blocking_gaps: false
overrides_applied: 0
gaps:
  - truth: "Pending record carries the safety-gate verdict (WR-01)"
    status: partial
    severity: minor
    reason: "reconcilePending stores only {file, ruleText}; autoRewritable/surfaceReason are dropped, so the drain path cannot see a surface-only verdict. Human confirm is always required on that path, and the capture-time directive carries the full verdict."
    artifacts:
      - path: "bin/lib/reconcile.cjs"
        issue: "candidates map drops autoRewritable/surfaceReason (line ~265)"
      - path: "sdk/src/query/reconcile.ts"
        issue: "same in twin"
    missing:
      - "Carry autoRewritable/surfaceReason into the pending record (both twins) and have SKILL.md step 6 honor it"
human_verification:
  - test: "Record a decision that clearly contradicts a CLAUDE.md rule via execute-plan"
    expected: "Rule rewritten in place, single-file revertible commit naming decision and date, one-line notice, no prompt, ledger outcome reconciled-auto"
    why_human: "Rewrite/commit is agent-driven; no executable test"
  - test: "Record an ambiguous contradiction"
    expected: "No authority doc change, entry in .planning/reconcile-pending.json, notice; later /reconcile or session start asks which rule wins"
    why_human: "Judgment and ask are agent-driven"
  - test: "Start a session with an unreconciled contradicting decision"
    expected: "SessionStart additionalContext appears; agent asks for confirmation before any rewrite"
    why_human: "Requires live Claude Code session"
---

# Phase 19: Decision Reconciliation Guard Verification Report

**Phase Goal:** When a newly recorded STATE.md decision contradicts a CLAUDE.md or PROJECT.md rule, reconcile it (clear, at capture) or surface it (ambiguous, or at session start) instead of silently keeping both.
**Status:** human_needed. **Re-verification:** No.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clear contradiction rewrites rule, own commit, notice, no prompt | VERIFIED (wiring) / human for execution | `stateAddDecision` (state-mutation.ts:888) and `cmdStateAddDecision` (state.cjs:513) attach `reconcile` directive only when modelNeeded. `workflows/execute-plan.md:394-398` drains it: clear+autoRewritable branch rewrites, commits single file, notices, records `reconciled-auto`. `references/decision-reconciliation.md` matrix matches. |
| 2 | Ambiguous contradiction blocks and asks | VERIFIED (wiring) / human | Capture branch writes `reconcile.pending` and defers the ask to a main-session surface (documented one-ask-path, since executor subagents lack AskUserQuestion). `skills/reconcile/SKILL.md` (has AskUserQuestion) drains and asks before changing anything. Deliberate, sound deviation from "blocks" at the capture surface. |
| 3 | Session start surfaces unreconciled decision, never silent rewrite | VERIFIED | `hooks/gsd-reconcile-sweep.js` registered in hooks.json; runs `reconcileSweep`, merges `reconcilePending`, emits additionalContext telling the agent to ask "whatever your confidence". Hook itself edits nothing. |
| 4 | No candidate means no model call; ledger prevents re-raise | VERIFIED | `modelNeeded = candidates.length>0 && ledgerOutcome===null`; directive null otherwise; sweep filters hashes already in ledger; `reconcileRecord` writes ledger and removes pending. Vitest 19/19 pass; both parity tests pass (run by me). |
| 5 | Both twins, dist/bm regenerated, build-bm --check PASS | VERIFIED | `node bin/build-bm.cjs --check` printed "PASS (committed dist/bm matches a fresh build)" on clean tree; dist/bm contains hook and reconcile skill; sdk/dist/cli.js contains reconcile; CI job `reconcile-guard` added. |

Score: 5/5 verified at mechanical/wiring level.

## Requirements Coverage

| ID | Plan | Status | Evidence |
|----|------|--------|----------|
| RECON-01 | 19-03 | SATISFIED (agent path: human) | execute-plan step + directive |
| RECON-02 | 19-03 | SATISFIED (agent path: human) | pending + skill ask |
| RECON-03 | 19-02 | SATISFIED | sweep hook |
| RECON-04 | 19-01 | SATISFIED | mechanical stems retrieval, empty candidates => no directive |
| RECON-05 | 19-01 | SATISFIED | sha256 normalized ledger |
| RECON-06 | 19-01 | SATISFIED with caveat | `assessTargetDoc` allows only repo-root CLAUDE.md/PROJECT.md, rejects @-include and managed blocks; RULE_DOCS never includes ROADMAP/STATE/global. See WR-01. |
| RECON-07 | 19-04 | SATISFIED | build-bm PASS, twins parity |

No orphaned requirements: all 7 mapped to Phase 19 appear in PLAN frontmatter.

## Review Findings Assessment

- WR-01 (pending drops safety verdict): does not undercut a success criterion. Capture-time path receives full verdicts via the directive; the session-start/skill path always requires explicit user confirmation, so nothing is auto-rewritten. It does weaken the RECON-06 gate at the drain path, recorded as a minor gap (backlog).
- WR-02 (SDK add-decision lacks DWIM section creation): pre-existing divergence; affects only STATE.md lacking a Decisions section. Not goal-blocking.
- WR-03 (hooks.json description inaccurate about non-mutation): documentation only; operation is idempotent.

## Anti-Patterns

No TBD/FIXME/XXX introduced in the reconcile engine, hook, or skill (read in full).

## Human Verification Required

1. Clear-contradiction capture: expect in-place rewrite, own commit, notice, no prompt.
2. Ambiguous capture then `/reconcile`: expect no doc change until the user chooses.
3. Session start with unreconciled decision: expect startup surfacing and a confirm ask.

## Gaps Summary

No blocking gaps. One minor gap (WR-01) suggested for backlog. Mechanical guarantees and wiring verified by direct execution of unit, parity, and drift checks; agent-driven behaviors await human confirmation.

_Verifier: Claude (bm-verifier)_
