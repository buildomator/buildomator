---
phase: 17
slug: v1-capability-wiring-and-propose-on-fit
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-06
---

# Phase 17 Validation Strategy

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

- **After every task commit:** Run `node tests/craft-skill-sdk-parity.test.cjs` + `node bin/build-bm.cjs --check` (the check is expected to report drift until plan 05 regenerates artifacts; treat drift before plan 05 as informational)
- **After every plan wave:** Run all craft-skill test steps + `npm --prefix sdk test`
- **Before `/bm:verify-work`:** Full craft-skill suite green + `node bin/build-bm.cjs --check` PASS
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01 T1 | 01 | 1 | CAT-02 | T-17-01 | CJS `match <scope>` returns the right candidate ids for SEO and DuckDB scopes, `[]` for an unrelated scope, usage error on blank scope | unit (CJS) | inline node check in the task verify + `node tests/craft-skill-insertion.test.cjs` | ✅ | ⬜ pending |
| 17-01 T2 | 01 | 1 | CAT-02 | T-17-01, T-17-02 | SDK `match` mirrors CJS; data-only scope echoed verbatim; copyleft fixture reports `flag` | unit (SDK) | `cd sdk && npx vitest run --project unit src/query/craft-skill.test.ts` | ✅ | ⬜ pending |
| 17-01 T3 | 01 | 1 | CAT-02 | T-17-01 | `match` output byte-identical across CJS and SDK twins | parity | `node tests/craft-skill-sdk-parity.test.cjs` | ✅ | ⬜ pending |
| 17-02 T1 | 02 | 1 | CAT-02 | T-17-01, T-17-02, T-17-03, T-17-04 | Shared reference carries the quoted-argument rule, DATA boundaries, the literal `verdict === 'allow'` gate, `--id` release, no third-party markers | static guard | grep gates in the task verify + `node tests/craft-skill-no-vendoring.test.cjs` | ✅ | ⬜ pending |
| 17-02 T2 | 02 | 1 | CAT-06 | none | Doc-routing note present inside executor `<project_context>`; CAT-02 original text unchanged | static guard | awk/grep gates in the task verify | ✅ | ⬜ pending |
| 17-03 T1 | 03 | 2 | CAT-02, CAT-06 | T-17-03 | discuss-phase records acceptance, never inserts; chain.md inserts before dispatch and releases after; file stays within budget | static guard | grep + wc gates in the task verify | ✅ | ⬜ pending |
| 17-03 T2 | 03 | 2 | CAT-02 | T-17-03, T-17-04, T-17-06 | quick: match before executor-skills re-capture, release with `--id` after executor; SKILL.md has no `craft-skill` token | static guard + ordering | node ordering check in the task verify + `node tests/craft-skill-insertion.test.cjs` | ✅ | ⬜ pending |
| 17-03 T3 | 03 | 2 | CAT-02 | T-17-02, T-17-03, T-17-04 | autonomous gates on `verdict === 'allow'`, never `--sticky`, match before execute dispatch, release in 3d | static guard + ordering | node ordering check in the task verify | ✅ | ⬜ pending |
| 17-04 T1 | 04 | 2 | CAT-02 | T-17-01, T-17-02 | match unit contract via spawned CLI incl. metacharacter scope and flag fixture | unit (CJS) | `node tests/craft-skill-insertion.test.cjs` | ✅ | ⬜ pending |
| 17-04 T2 | 04 | 2 | CAT-02, CAT-06 | T-17-03, T-17-04 | SEO end-to-end: match, unapproved insert writes nothing, approved insert lands in `agent_skills.bm-executor`, reader sees it, `release --id` clears it and leaves others | integration | `node tests/craft-skill-insertion.test.cjs` | ✅ | ⬜ pending |
| 17-05 T1 | 05 | 3 | CAT-02, CAT-06 | T-17-02, T-17-03, T-17-08 | Wiring guard trips when the allow gate, a pointer, an ordering or the doc note is lost; CI runs it | static guard + mutation | `node tests/craft-skill-propose-on-fit-guard.test.cjs` + mutation one-liner | ✅ | ⬜ pending |
| 17-05 T2 | 05 | 3 | CAT-02, CAT-06 | none | README row present, no version bump | static guard | grep gates in the task verify | ✅ | ⬜ pending |
| 17-05 T3 | 05 | 3 | CAT-02 | T-17-07 | Committed `sdk/dist` and `dist/bm` carry `craftSkillMatch`; drift check PASS; full suite green | build + suite | `node bin/build-bm.cjs --check` + all craft-skill tests + `npm --prefix sdk test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `match` case added to `tests/craft-skill-sdk-parity.test.cjs` (plan 01 Task 3)
- [x] End-to-end match, accept, insert, release proof for one domain (SEO) in `tests/craft-skill-insertion.test.cjs` (plan 04 Task 2)
- [x] Static guard asserting the doc-routing note and the wiring: `tests/craft-skill-propose-on-fit-guard.test.cjs` (plan 05 Task 1)
- [x] CI step for the standalone guard in `.github/workflows/check-drift.yml` (plan 05 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Propose-on-fit surfaces a candidate in a live `discuss-phase` / `quick` / `autonomous` session | CAT-02 | Needs a running Claude Code host to exercise the workflow prose path interactively | In a real session, run a quick task whose description contains "seo" or "duckdb"; confirm the accept prompt renders publisher, SPDX license, obligation summary and trust tier inside data boundaries, that choosing Skip leaves `.planning/config.json` `agent_skills` unchanged, and that after an accept plus task completion the entry is gone and `.planning/craft-skills/pins.json` shows `released_at` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-10-06; executor flips `wave_0_complete` after plan 01 Task 3 and plan 04 land
