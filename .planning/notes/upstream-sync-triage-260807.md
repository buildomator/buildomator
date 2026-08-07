# Upstream sync-triage (gsd-core 1.7.0 -> 1.9.1 + 2026-08-06 wave)

Opened 2026-08-07. Assessed the batch the user selected (security + completion + worktree + root). Each item deep-dived against our tree (upstream PR diff vs our equivalent). Inbound port only; outbound fork-PRs to upstream stay blocked.

## Verdicts

| Item | Verdict | Notes |
|---|---|---|
| #2667 run-with-timeout Windows .cmd spawn (CVE-2024-27980) | NOT-APPLICABLE | We have no `runWithTimeout` spawn path; fallow runs via bash `timeout` (shell), and the two Node Windows-shim spawns already use `shell: win32`. Optional failure-kind diagnostics is doc-only, not security. |
| #2843 findProjectRoot stops at git boundaries | APPLICABLE (both twins) | Real bug: `core.cjs:165` + `helpers.ts:581` trust any `.git` between start and an ancestor `.planning/`, so a nested child repo resolves to the WRONG ancestor. Matters for nested `source/.planning` repos + worktrees. |
| #2786 skip sentinel (999.x) phase ids in stage-2 heading scan | APPLICABLE (both twins) | Live bug: stage-2 roadmap next-phase scan (`phase.cjs:1326`, `phase-lifecycle.ts:1248`) has no 999 guard (stage-1 does), so `next_phase` can advance into a `### Phase 999.x (BACKLOG)` heading. |
| #2825 code-fixer honors use_worktrees | APPLICABLE (half) | `gsd-code-fixer.md` hand-rolls a worktree unconditionally, never reads `workflow.use_worktrees`. Port the opt-out gate. SKIP the `rm -rf`/reparse half - we use `git worktree remove --force`, no `rm -rf` to guard. |
| #1995 + #3021 widen worktree branch namespace | APPLICABLE (one combined edit) | Our 3 guards (`worktree-safety.cjs:321`, `quick.md:648`, `execute-phase.md:554`) only match `worktree-agent-*`; widen to `^((worktree-)?agent-|worktree-wf_)[A-Za-z0-9._/-]+$` so we don't hard-fail if Claude Code renames to `agent-<id>` or uses the Workflow backend. Forward-compat additive; no behavior change today. |
| #3033 zero-plan split-parent phase complete when checkbox checked | ALREADY-COVERED | Our init twins already promote a zero-plan roadmap-checked phase (`init.cjs` keyed on `planCount===0`; `init-complex.ts` more permissive). No port. |
| #2788 mark-complete false-success / Gaps Found recovery | NOT-APPLICABLE (mostly) | Exact fix depends on an ADR-2143 `updateTraceabilityCell`/`write_set` refactor we never took (ours is older simple-regex). Defect-2 needs the refactor (skip). Defect-1 (accept `Gaps Found` in the traceability regex) is a small both-twins tweak ONLY if our revert/gaps path actually strands rows at `Gaps Found` - verify first; likely moot. |

## Recommended port set (applicable)
1. **#2843** findProjectRoot nested-.git guard - both twins (`core.cjs`, `helpers.ts`) + sdk test. Real correctness.
2. **#2786** 999-sentinel skip in stage-2 heading scan - both twins (`phase.cjs`, `phase-lifecycle.ts`) + test.
3. **#2825** code-fixer `use_worktrees` gate - `agents/gsd-code-fixer.md` (+ dist/bm). Gate half only.
4. **#1995+#3021** worktree-branch regex widen - 3 sites + message text + a NEW `tests/worktree-safety.test.cjs` accept/reject table (we have zero coverage there).
All -> rebuild sdk/dist, regen dist/bm, `build-bm --check`. Both twins are hand-synced (not generated); the bm drift gate is colon-only so it will NOT catch a one-twin miss - the sdk unit tests are the real guard.

## Bonus findings (our own latent issues, surfaced during triage - not upstream ports)
- SDK `init-complex.ts:588` lacks the `planCount===0` guard the CJS `init.cjs` has, so a ticked checkbox could promote a with-plans phase whose only summary is paused (contradicts the #25 status-aware intent). Worth reconciling separately.
- Dropped items (#2667, #3033, #2788) recorded above with rationale so a future sync does not re-triage them.

Context: [[project_upstream_switch_2026_05]], [[reference_model_resolver_single_source]] (two hand-synced twins).

## Outcome (2026-08-07)
All 4 applicable items ported and shipped in **v4.5.4** (commits 04baf33..1dd2932; release 0f86031). Dropped items (#2667, #3033, #2788) recorded above with rationale. Bonus finding (SDK init-complex.ts:588 planCount-guard divergence) remains OPEN as a separate optional reconcile.
