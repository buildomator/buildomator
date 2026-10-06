---
phase: 17
slug: v1-capability-wiring-and-propose-on-fit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-06
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 17-RESEARCH.md "Validation Architecture" and "Security Domain".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Zero-dep Node `node:assert` harness for CJS twin tests (e.g. `tests/craft-skill-sdk-parity.test.cjs`); Vitest for the SDK (`sdk` project `unit`) |
| **Config file** | `.github/workflows/check-drift.yml` runs the CJS craft-skill tests; `sdk/vitest` config for SDK specs |
| **Quick run command** | `node tests/craft-skill-sdk-parity.test.cjs` |
| **Full suite command** | craft-skill test steps in `check-drift.yml` + `npm --prefix sdk test` + `node bin/build-bm.cjs --check` |
| **Estimated runtime** | ~30 seconds (quick); ~2 min (full with build check) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/craft-skill-sdk-parity.test.cjs` + `node bin/build-bm.cjs --check`
- **After every plan wave:** Run all craft-skill test steps + `npm --prefix sdk test`
- **Before `/bm:verify-work`:** Full craft-skill suite green + `node bin/build-bm.cjs --check` PASS
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner. Each row below is an observable behavior from
> 17-RESEARCH.md that at least one task must carry an `<automated>` verify for.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CAT-02 | — | `match <scope>` returns correct candidate ids for SEO and DuckDB scopes, `[]` for unrelated scope | unit (both twins) | `node tests/craft-skill-sdk-parity.test.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAT-02 | — | `match` output byte-identical across CJS and SDK twins | parity | `node tests/craft-skill-sdk-parity.test.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAT-02 | — | End-to-end one domain: match → accept → `insert --approved` → entry in `agent_skills.bm-executor` → `release` clears it | integration | new/extended insertion test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAT-02 | T-17 trust gate | Nothing injected until accept (insert without `--approved` returns `needs_approval:true`, writes nothing) | unit | `tests/craft-skill-insertion.test.cjs` (assert in e2e) | ✅ partial | ⬜ pending |
| TBD | TBD | TBD | CAT-02 | D-09 auto-insert bound | Autonomous path does not auto-insert a flag-verdict entry (gates on `verdict==='allow'`) | unit + prose guard | `assessEntry` verdict assert + workflow-prose guard | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAT-06 | — | Doc-routing note present in executor guidance / shared reference | static guard | grep-style guard test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `match` case added to `tests/craft-skill-sdk-parity.test.cjs` (covers CAT-02 twin parity)
- [ ] End-to-end match → accept → insert → release proof for one domain (new test or extend `tests/craft-skill-insertion.test.cjs`)
- [ ] Optional static guard asserting the doc-routing note exists
- [ ] If a standalone match test file is created, add a step to `.github/workflows/check-drift.yml`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Propose-on-fit surfaces a candidate in a live `discuss-phase` / `quick` / `autonomous` session | CAT-02 | Needs a running Claude Code host to exercise the workflow prose path interactively | In a real session, run a quick-task whose scope hits an SEO or DuckDB trigger; confirm the accept prompt renders publisher, SPDX license, obligation summary, and trust tier, and that nothing is injected before accept |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
