---
quick_id: 260629-35t
type: exploration
date: 2026-06-29
status: complete
title: Evidence-based verification (run/screenshot/observe) integrated into GSD, low token overhead
---

# Evidence-Based Verification in GSD — Exploration

## Problem

"Sometimes a bug-and-fix isn't actually fixing it while you think it is."
A fix gets declared done from **code-shaped evidence** (tests pass, file exists,
grep finds the symbol) without ever **observing the real symptom disappear**.

## What GSD already does (grounding)

| Mechanism | Runs the app? | Evidence captured? |
|-----------|---------------|--------------------|
| `gsd-verifier` (agent) | **No — by design.** "Do not start servers", "use grep/file checks, not running the app". Step 7b only curls already-running endpoints + runs single named tests. | No |
| `verify-work` UAT | No — **user** runs it and replies pass/fail. Opportunistic Playwright-MCP screenshots if MCP present. | Screenshots only, only in UI path, only if MCP enabled |
| `gsd-executor` `<verify>` | **Yes** — runs the verify command on auto tasks. plan-checker requires an `<automated>` command. | Pass/fail only; output not retained as proof |
| `verify-phase` behavioral step | Yes — runs the full test suite + CLI fixtures | Test results only |
| `gsd-ui-auditor` | Yes — curls localhost, `npx playwright screenshot` (or MCP), scores 6 pillars | **Screenshots** (the one mature runtime-observation path) |

So the building blocks exist (executor runs commands; ui-auditor captures
screenshots via CLI; verify-phase runs suites) — but they are **scattered, UI-only,
and never tied to "reproduce the original failure, then prove it's gone."**

## The core fix: red→green evidence, not just "tests pass"

The discipline that closes the gap is the same one humans use:

1. **Capture the failing evidence first** (the repro: a command's bad output, a
   non-200 status, a screenshot of the broken screen, a failing assertion).
2. Apply the fix.
3. **Re-run the exact same repro and capture the now-passing evidence.**
4. The verdict cites both artifacts by path. No before/after pair → not "fixed",
   only "changed".

This is "evidence before assertions" applied to bug fixes. It's most valuable in
`gsd-debug` (where bugs are actually fixed) and at phase verification.

## Design — lowest token overhead

The user's hard constraint is **token overhead**. The per-turn tax that matters is
MCP schemas: Playwright-MCP costs ~20k tokens/turn (per `references/context-budget.md`).
So the rules:

1. **Zero per-turn cost.** All evidence capture runs **inside subagents**
   (executor / verifier / debugger), which the orchestrator never loads. Capture
   logic lives in ONE new reference (`references/evidence-verification.md`),
   `@`-included only at agent-spawn time — not in the main loop.
2. **Prefer CLI over always-on MCP.** Use `npx playwright screenshot`, `curl`,
   and the project's own run/CLI to capture — the same fallback `gsd-ui-auditor`
   already uses. Browser MCP stays off except in UI phases (already the
   context-budget guidance). No 20k/turn tax for backend/CLI fixes.
3. **Evidence is files, not context.** Capture to `.planning/evidence/<phase|quick>/<id>.{png,txt,json}`
   and reference by **path** in VERIFICATION.md. Screenshots/logs are **not read
   back into context** unless a check fails or human review is requested. This is
   the decisive low-token move.
4. **Delegate, don't reimplement.** If the project has a run/observe skill
   (`/run`, gstack `browse`/`qa`/`ios-qa`, superpowers `verify`), the evidence
   step calls it. GSD provides the contract + the red→green loop, not a new
   browser stack.
5. **Typed + gated, on by signal.** One config gate `workflow.evidence_verification`
   following the exact `workflow.code_review` pattern. Default `auto`:
   - bug fixes / `gsd-debug` → reproduce-then-confirm (highest value)
   - web UI changes → headless screenshot of the touched route
   - CLI changes → capture stdout + exit code of the documented invocation
   - pure-logic already covered by unit tests → skip (no evidence theater)

### Structured contract (optional, additive)

Extend `must_haves` (or the task `<verify>`) with an optional `evidence` field so
the contract is explicit and machine-runnable:

```yaml
must_haves:
  truths:
    - "Reset-password email link logs the user in"
  evidence:
    - repro: "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/reset?token=expired"
      expect: "is 410, not 500"          # the symptom, stated as an observation
      capture: status                     # status | stdout | screenshot
    - repro: "screenshot /dashboard after login"
      expect: "shows 3 metric cards"
      capture: screenshot
```

No `evidence` field → behaves exactly as today (fully backward compatible).

## Integration seams (ranked by value/effort)

1. **`gsd-debug`** — add the red→green capture loop. Highest leverage: this is
   literally where "thought it was fixed" happens. Cheap: mostly agent-prompt +
   the shared reference.
2. **`gsd-executor` `<verify>`** — let a verify step declare `capture:` so the
   command's output/screenshot is saved as proof, not discarded.
3. **`gsd-verifier` Step 7b** — add an opt-in "evidence mode" that may launch via
   the project run skill and observe (today it refuses to start the app). Gated,
   in-subagent → no per-turn cost.
4. **`verify-work`** — generalize `automated_ui_verification` →
   `automated_evidence_verification` (CLI/API/screenshot, not just Playwright UI).
5. **Reuse `gsd-ui-auditor`'s screenshot block** verbatim for the capture helper.

## Recommended rollout (incremental, non-disruptive to v4.1 Buildomator)

- **Step 1 (small, shippable as a quick task / tiny phase):** the convention —
  `references/evidence-verification.md` + `.planning/evidence/` dir +
  `workflow.evidence_verification` gate + wire the red→green loop into `gsd-debug`
  only. Proves the pattern at minimal scope.
- **Step 2 (a real phase, later milestone):** extend executor `<verify>` `capture:`
  + verifier evidence-mode + the `evidence:` must_haves contract.
- **Step 3:** generalize verify-work + a shared capture helper reusing ui-auditor.

This is milestone-worthy overall, but Step 1 is a clean standalone increment.

## Open questions for discuss/plan

- Default for `workflow.evidence_verification`: `auto` (signal-based) vs off-by-default?
- Evidence retention: gitignore `.planning/evidence/` (likely yes — binaries) or
  keep last-N as proof in history?
- How aggressively to auto-detect "this is a UI/CLI/bug task" vs require a `capture:` hint?
