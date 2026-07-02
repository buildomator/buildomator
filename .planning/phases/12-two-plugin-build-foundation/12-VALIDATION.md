---
phase: 12
slug: two-plugin-build-foundation
status: planned
nyquist_compliant: true
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
| **Quick run command** | `node tests/build-bm-drift.test.cjs` |
| **Full suite command** | `for t in tests/*.test.cjs; do node "$t" || break; done` (+ `cd sdk && npx vitest run --project unit` when SDK changes; SDK untouched this phase) |
| **Estimated runtime** | ~2-5s for the CJS drift test (includes a temp-dir rebuild); ~5min full SDK suite (not needed) |

---

## Sampling Rate

- **After every task commit:** `node tests/build-bm-drift.test.cjs` (once it exists; before that, `node tests/version-alignment.test.cjs`)
- **After every plan wave:** Full CJS harness + `node bin/build-bm.cjs --check` + `node bin/maintenance/check-version-alignment.cjs`
- **Before `/gsd:verify-work`:** Build-and-diff clean + both CI workflows (check-drift, install-smoke) green
- **Max feedback latency:** ~5 seconds (CJS tests are fast)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | BUILD-02 | — | N/A | unit + detector | `node tests/version-alignment.test.cjs && node bin/maintenance/check-version-alignment.cjs` | ✅ (extend) | ⬜ pending |
| 12-01-02 | 01 | 1 | BUILD-01 | T-12-01, T-12-02, T-12-03 | no secrets/planning dirs in dist/bm; no recursive self-copy; only name/displayName/description diverge | unit + integration (TDD) | `node tests/build-bm-drift.test.cjs` | ❌ W0 (this task creates it, test-first) | ⬜ pending |
| 12-01-03 | 01 | 1 | BUILD-01, BUILD-02 | T-12-02 | committed payload = tracked source minus EXCLUDE set | integration | `npm run check:bm-drift && npm run validate:bm-plugin && node bin/maintenance/check-version-alignment.cjs && git ls-files --error-unmatch dist/bm/.claude-plugin/plugin.json` | ❌ W0 (needs 12-01-02) | ⬜ pending |
| 12-02-01 | 02 | 2 | BUILD-01, BUILD-02 | T-12-01, T-12-04 | drift outside whitelist blocks every push | CI integration | `grep -q "bm-build-drift" .github/workflows/check-drift.yml && node bin/build-bm.cjs --check && node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` | ❌ W0 (job new; commands from plan 01) | ⬜ pending |
| 12-02-02 | 02 | 2 | BUILD-03 | T-12-03 | bm hooks resolve via primary CLAUDE_PLUGIN_ROOT, tripwire fallback never fires, cache id stays gsd-plugin | smoke (local + CI) | extracted SessionStart hook from dist/bm/hooks/hooks.json run with `CLAUDE_PLUGIN_ROOT=$PWD/dist/bm`, assert exit 0 + no "plugin path stale" stderr (full command in 12-02-PLAN.md Task 2 verify) | ❌ W0 (job new) | ⬜ pending |
| 12-02-03 | 02 | 2 | BUILD-02 | — | N/A | doc grep | `grep -q "build:bm" RELEASING.md && grep -q "check:bm-drift" RELEASING.md` | ✅ (RELEASING.md exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/build-bm-drift.test.cjs` — zero-dep test written FIRST in task 12-01-02 (TDD): stampBmManifest whitelist, shouldExclude predicate, fresh-vs-committed byte diff, secrets-exclusion assertions (BUILD-01)
- [ ] `bin/build-bm.cjs` — the script under test, implemented to green in the same task (BUILD-01/BUILD-02)
- [ ] install-smoke `bm-package-smoke` job with the tripwire-fallback assertion proving bm resolves via its primary `${CLAUDE_PLUGIN_ROOT}` path, NOT the hardcoded gsd cache fallback (BUILD-03) — task 12-02-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `bm` install resolves hooks/skills from its own cache dir (`~/.claude/plugins/cache/gsd-plugin/bm/<version>/`) | BUILD-03 | Requires a live Claude Code plugin install from the marketplace | After dist/bm is committed and pushed: `/plugin install bm@gsd-plugin` in Claude Code, start a session, confirm no gsd-cache path error and no "plugin path stale" stderr. The CI tripwire test covers the resolution logic; this confirms the real installer path. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (drift test is created test-first inside task 12-01-02)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-07-02 (plans 12-01, 12-02)
