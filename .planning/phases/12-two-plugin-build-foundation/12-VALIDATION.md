---
phase: 12
slug: two-plugin-build-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Zero-dep Node test harness (`tests/*.test.cjs`, run directly with `node`) + SDK vitest for `sdk/` |
| **Config file** | none for CJS harness; `sdk/vitest.config.*` for SDK |
| **Quick run command** | `node tests/<new>.test.cjs` (the drift test for this phase) |
| **Full suite command** | `for t in tests/*.test.cjs; do node "$t" || break; done` (+ `cd sdk && npx vitest run --project unit` when SDK changes) |
| **Estimated runtime** | ~2s for the CJS drift test; ~5min full SDK suite (SDK untouched this phase) |

---

## Sampling Rate

- **After every task commit:** Run the phase drift test (`node tests/build-bm-drift.test.cjs` or as named by the planner)
- **After every plan wave:** Run the full CJS harness + `node bin/build-bm.cjs --check`
- **Before `/gsd:verify-work`:** Build-and-diff clean + install-smoke green
- **Max feedback latency:** ~5 seconds (CJS tests are fast)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | BUILD-01 | — | N/A | unit | `{command}` | ❌ W0 | ⬜ pending |

*Planner fills this map from the plan tasks. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/build-bm-drift.test.cjs` (or planner-named) — zero-dep test asserting a fresh `bin/build-bm.cjs` build byte-matches committed `dist/bm/` (BUILD-01, BUILD-04)
- [ ] install-smoke extension asserting `bm` resolves via its primary `${CLAUDE_PLUGIN_ROOT}` path, NOT the hardcoded gsd cache fallback (BUILD-03)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `bm` install resolves hooks/skills from its own cache dir | BUILD-03 | Requires a live Claude Code plugin install | Install the bm plugin from the marketplace, run a bm hook, confirm no gsd-cache path error |

*Planner may promote some of these to automated install-smoke assertions.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
