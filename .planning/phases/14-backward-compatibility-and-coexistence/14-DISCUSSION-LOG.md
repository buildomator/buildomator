# Phase 14: Backward Compatibility and Coexistence - Discussion Log

> **Audit trail only.** Not consumed by planning, research, or execution agents.
> Decisions live in 14-CONTEXT.md; this log preserves how they were reached.

**Date:** 2026-07-11
**Mode:** discuss (interactive)
**Areas discussed:** Primary-plugin policy, Hook single-fire, MCP + shared state, Deprecation nudge

## Area selection

All four proposed gray areas selected: Hook single-fire, MCP + shared state, Deprecation
nudge, Primary-plugin policy. Discussed lead-first with Primary-plugin policy since it
governs hook ownership and nudge direction.

## Primary-plugin policy

- **Q:** When both plugins are enabled, which is authoritative?
  - Options: gsd stays primary in 4.x / bm becomes primary when present / config-driven.
  - **Chosen:** bm becomes primary when present. Rationale: bm is the future surface; when
    active it should own the fire and drive, gsd yields + nudges. gsd-only users (bm absent)
    are unaffected, preserving COMPAT-01.

## Hook single-fire

- **Q:** How is the single-fire enforced given identity is derivable from CLAUDE_PLUGIN_ROOT?
  - Options: deterministic identity election / election + atomic marker / marker-only first-wins.
  - **Chosen:** deterministic identity election. gsd yields when bm active; bm always runs.
    No race.
- **Q (follow-up):** "Sibling dir exists" != "bm enabled". How to avoid gsd yielding to a
  disabled bm?
  - Options: bm self-announces per session / directory existence only / research CC signal first.
  - **Chosen:** bm self-announces per session (marker keyed on session_id). gsd yields only
    if the marker exists, so a cache-present-but-disabled bm never suppresses gsd. Residual:
    at most one gsd fire before the marker lands on the first event (e.g. SessionStart).

## MCP + shared state

- **Q:** Target guarantee for COMPAT-03, given state.cjs already locks STATE.md?
  - Options: extend existing lock to all shared writers / single-writer election / lock as-is test-only.
  - **Chosen:** extend the state.cjs lock + atomic RMW to all shared writers (audit
    HANDOFF.json and phase plans, close gaps), plus a coexistence test interleaving gsd/bm
    writes. No new coordination layer.

## Deprecation nudge

- **Q:** Where does the nudge surface and how often?
  - Options: once per session (SessionStart) / per gsd command throttled / per gsd command every time.
  - **Chosen:** once per session via the gsd SessionStart hook, non-blocking, mentions /bm:
    and v5.0. No per-skill edits.
- **Q (follow-up):** Who sees it, and how is bm's own nudge suppressed?
  - Options: every gsd session / only when bm present / only when bm absent.
  - **Chosen:** every gsd session (max reach). bm package suppresses its own nudge via the
    build transform. Locked nuance: the nudge is exempt from the yield, so gsd still emits
    it even when yielding stateful work to bm.

## Deferred

- Branding prose and comms copy - Phase 15.
- Retiring /gsd: and flipping authored identity to bm - v5.0.
- Four keyword-only todo matches (unrelated to coexistence) reviewed, not folded.
