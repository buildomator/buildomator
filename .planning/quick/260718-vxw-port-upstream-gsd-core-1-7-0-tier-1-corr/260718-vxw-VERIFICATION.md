---
phase: quick-260718-vxw
verified: 2026-07-18T23:11:06Z
status: passed
score: 8/8 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Quick 260718-vxw: Port upstream gsd-core 1.7.0 Tier-1 correctness fixes Verification Report

**Task Goal:** Port three upstream gsd-core 1.7.0 correctness fixes into BOTH CJS and SDK resolvers with golden/parity in lock-step, and regenerate the bm plugin (surface empty-manifest guard CJS-only, config-set coercion both twins, stray-summary completion-count pairing wired through every consumer in both twins).
**Verified:** 2026-07-18T23:11:06Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | applySurface with an empty/null/unresolvable manifest does not delete existing gsd-* agent files; a populated manifest still prunes | VERIFIED | `bin/lib/surface.cjs:213` early-returns when `!manifest \|\| manifest.size === 0`; `_syncGsdDir` (line 245) returns before the removal loop when `stagedFiles.size === 0`. `node tests/surface-empty-manifest-agents.test.cjs` → 3/3 passing (empty staged dir untouched, empty-Map manifest untouched, populated staged set still prunes superseded gsd-* and leaves non-gsd files alone) |
| 2 | config-set 'Infinity'/'-Infinity' persists the literal string, never coerced to a null-producing Infinity | VERIFIED | `bin/lib/config.cjs:428` and `sdk/src/query/config-mutation.ts:222` both use `value !== '' && Number.isFinite(Number(value))`. `node tests/config-set-coercion.test.cjs` → 4/4 passing, incl. `'Infinity'`/`'-Infinity'` staying strings and a control numeric value still coercing |
| 3 | config-set project_code '007' persists as the string '007' in both resolvers with byte-identical output | VERIFIED | `STRING_CONFIG_KEYS` set (`project_code`, `phase_naming`, `response_language`, `claude_md_path`) is identical in both `bin/lib/config.cjs:38` and `sdk/src/query/config-mutation.ts:37`; carve-out applied in `cmdConfigSet`/`configSet` before/instead-of the coercion chain, not inside key-context-free `parseConfigValue`. Golden test `config-set (mutation)` passes in `test:integration` |
| 4 | A stray non-plan summary is excluded from summaryCount in both twins (3 plans/2 real summaries/1 stray → 2/3, incomplete) | VERIFIED | `countMatchedSummaries(planFiles, summaryFiles)` exported from both `bin/lib/plan-scan.cjs:104` and `sdk/src/query/plan-scan.ts:64`, built on layout-agnostic `planSummaryBaseId`. `node tests/plan-scan-matched-summaries.test.cjs` → 6/6 passing (3+3+1-stray → summaryCount 3/completed; 1-plan+stray-only → summaryCount 0/not-completed; bare PLAN/SUMMARY pairing; nested stray exclusion; init-progress path) |
| 5 | roadmap update-plan-progress does not tick the phase checkbox off a stray summary, in both twins | VERIFIED | `bin/lib/roadmap.cjs:365` and `sdk/src/query/roadmap-update-plan-progress.ts:65` both compute `summaryCount` via `countMatchedSummaries(phaseInfo.plans/info.plans, phaseInfo.summaries/info.summaries)`. Golden test `roadmap.update-plan-progress matches gsd-tools.cjs on fixture` passes in `test:integration` |
| 6 | init-manager/init phase-list (CJS), initProgress/initManager (SDK), and roadmap.analyze do not report complete off a stray summary; all route through the paired count | VERIFIED | `bin/lib/init.cjs:1142,1427` both call `scanPhasePlans(...)` (paired) instead of raw `listPhaseSummaryFiles(...).length` (grep for that raw pattern returns nothing). `sdk/src/query/init-complex.ts:45,377,557` and `sdk/src/query/roadmap.ts:25,566` both import and call `scanPhasePlans` from `./plan-scan.js`; `grep -c rootSummaries` on both files returns 0 (duplicate raw scanners deleted) |
| 7 | bin/lib and sdk/src comments describe behavior only; no upstream PR numbers or porting notes in product code | VERIFIED | `grep -rn "2018\|1581\|1988"` across all touched product files + new tests returns no matches; `grep -rn -i upstream` across the same set returns no matches. Provenance lives only in the SUMMARY frontmatter/prose |
| 8 | sdk/dist and dist/bm are regenerated and in sync so the bm plugin ships all three fixes | VERIFIED | `npm --prefix sdk run build` succeeds with zero working-tree diff (dist already matched); `node bin/build-bm.cjs --check` reports "bm drift check: PASS (committed dist/bm matches a fresh build)" |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/lib/surface.cjs` | empty-staged-set guard | VERIFIED | `applySurface` early-return + `_syncGsdDir` early-return, both commented in behavior terms only |
| `tests/surface-empty-manifest-agents.test.cjs` | regression test, min 50 lines | VERIFIED | 119 lines, 3/3 checks pass |
| `bin/lib/config.cjs` | Number.isFinite + string-key carve-out | VERIFIED | contains `Number.isFinite`, `STRING_CONFIG_KEYS` carve-out in `cmdConfigSet` |
| `sdk/src/query/config-mutation.ts` | Number.isFinite in parseConfigValue + carve-out in configSet | VERIFIED | contains `Number.isFinite`; carve-out is in `configSet` (line 301), not in `parseConfigValue` |
| `bin/lib/plan-scan.cjs` | countMatchedSummaries wired into scanPhasePlans | VERIFIED | exported, used at line 161 |
| `sdk/src/query/plan-scan.ts` | identical pairing helper, exported | VERIFIED | exported, used at line 108, consumed by init-complex.ts/roadmap.ts/roadmap-update-plan-progress.ts |
| `tests/plan-scan-matched-summaries.test.cjs` | CJS fixture proof, min 50 lines | VERIFIED | 138 lines, 6/6 checks pass, includes the init.cjs completion path |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/lib/roadmap.cjs` (cmdUpdatePlanProgress) | `bin/lib/plan-scan.cjs` | `countMatchedSummaries` | WIRED | line 365: `countMatchedSummaries(phaseInfo.plans, phaseInfo.summaries)` |
| `sdk/src/query/roadmap-update-plan-progress.ts` | `sdk/src/query/plan-scan.ts` | `countMatchedSummaries` | WIRED | line 65: same pairing call, golden parity green |
| `bin/lib/init.cjs` (cmdInitManager + phase-list) | `bin/lib/plan-scan.cjs` | `scanPhasePlans` | WIRED | lines 1142, 1427 both call `scanPhasePlans(...)`; raw `listPhaseSummaryFiles(fullDir).length` pattern absent |
| `sdk/src/query/init-complex.ts` | `sdk/src/query/plan-scan.ts` | `scanPhasePlans` import | WIRED | line 45 import, used at 377 (initProgress) and 557 (initManager); duplicate `listPhasePlanAndSummaryCounts` scanner removed (`rootSummaries` grep = 0) |
| `sdk/src/query/roadmap.ts` | `sdk/src/query/plan-scan.ts` | `scanPhasePlans` import | WIRED | line 25 import, used at 566 inside `countPhasePlansAndSummaries`; duplicate raw scanner removed (`rootSummaries` grep = 0) |
| `sdk/src/golden/golden-integration-covered.ts` | config-set | golden parity | WIRED | `config-set (mutation)` golden test passes post-fix |
| must_haves build gates | `dist/bm` | build + --check | WIRED | `npm --prefix sdk run build` clean, `node bin/build-bm.cjs --check` → PASS |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Surface empty-manifest regression | `node tests/surface-empty-manifest-agents.test.cjs` | 3/3 passed | PASS |
| Config-set coercion regression | `node tests/config-set-coercion.test.cjs` | 4/4 passed | PASS |
| Plan-scan pairing regression | `node tests/plan-scan-matched-summaries.test.cjs` | 6/6 passed | PASS |
| SDK unit suite | `npm --prefix sdk test` | 1833 tests / 129 files passed | PASS |
| bm drift gate | `node bin/build-bm.cjs --check` | "PASS (committed dist/bm matches a fresh build)" | PASS |
| SDK build | `npm --prefix sdk run build` | succeeds, zero working-tree diff | PASS |
| Duplicate raw scanners removed | `grep -c rootSummaries sdk/src/query/init-complex.ts sdk/src/query/roadmap.ts` | 0, 0 | PASS |
| init.cjs raw completion path gone | `grep -n "listPhaseSummaryFiles(fullDir).length" bin/lib/init.cjs` | no match (exit 1) | PASS |
| Hygiene grep (PR numbers) | `grep -rn "2018\|1581\|1988\|upstream" <touched files>` | no matches | PASS |
| audit.cjs untouched | `git diff 1298162..da101c6 --stat -- bin/lib/audit.cjs` | empty | PASS |

### Full Integration Suite — Independent Pre-Existing-Failure Sanity Check

SUMMARY claims 13-14 pre-existing golden/e2e failures unrelated to this work. Independently verified via `npm --prefix sdk run test:integration` on the actual post-fix tree (`CLAUDE_PLUGIN_ROOT` set):

```
Test Files  3 failed | 3 passed | 1 skipped (7)
     Tests  13 failed | 82 passed | 4 skipped (99)
```

The 13 failures break down as: `read-only-parity.integration.test.ts` (3: `phase-plan-index`, `stats.json`, `state.json` — all differ only on `milestone_name` field or archived-phase directory lookup), `golden.integration.test.ts` (9: `roadmap.analyze` — `milestones` array structural diff; `validate.health` — STATE.md phase-reference wording; `init.execute-phase`/`init.plan-phase`/`init.quick`/`init.resume`/`init.verify-work` — all `agents_installed`/`missing_agents` surface-detection divergence; `verify.phase-completeness` — CJS "Phase not found" vs SDK finds it), `e2e.integration.test.ts` (1: missing `sdk/test-fixtures/sample-plan.md` fixture).

Cross-checked each failure's root cause against this task's actual diff (`git diff 1298162..da101c6`):
- `roadmap.analyze`'s `milestones` field diff: no diff found in `sdk/src/query/roadmap.ts` touching milestone parsing (only `countPhasePlansAndSummaries` was changed, confirmed unrelated).
- `verify.phase-completeness` / `phase-plan-index` "Phase not found" divergence: neither `bin/lib/verify.cjs`, `bin/lib/checkpoint.cjs`'s local `scanPhasePlans`, nor `sdk/src/query/verify.ts`/`phase.ts` were touched by this task's 4 commits (confirmed via `git diff 1298162..da101c6 --stat` — zero hits); the archived-milestone phase-directory lookup divergence pre-exists structurally.
- `init.*` family failures: all diffs are `agents_installed`/`missing_agents` (surface/agent detection, not plan/summary counts) plus `*_model: ''` (env-dependent model resolution) — none touch `plan_count`/`summary_count`/`status` fields, which is exactly what this task's Task 4 changes.
- The one golden test that DIRECTLY exercises this task's pairing logic — `roadmap.update-plan-progress matches gsd-tools.cjs on fixture` — **passes**.
- `config-set (mutation)` golden test — **passes**.

Additionally spot-checked a clean 1298162 worktree (pre-task) build of the same two golden suites; it produced 19 failures (more, not fewer, than post-fix — largely due to worktree-specific path/env artifacts: `/private/tmp` vs `/tmp` symlink resolution, stale git-commit counts, and model-resolution returning `''` when `CLAUDE_PLUGIN_ROOT` points at a temp worktree). While that specific count isn't directly comparable due to environment noise, it corroborates that these are pre-existing, repo-state/environment-dependent golden-snapshot instabilities, not new breakage introduced by the plan/summary pairing logic. No new failure in the post-fix set traces to `countMatchedSummaries`, `scanPhasePlans`, the config coercion change, or the surface guard.

**Conclusion: zero new failures attributable to this task's changes.** All 13 are pre-existing, environment/repo-state-dependent divergences (archived-milestone parsing, agents-install detection, model-resolution env dependency, clock skew, missing e2e fixture) — logged here per the task instructions rather than fixed, as scoped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| QUICK-260718-VXW | 260718-vxw-PLAN.md | Port 3 upstream Tier-1 correctness fixes into both resolvers with golden parity | SATISFIED | All 8 must-haves verified above |

### Anti-Patterns Found

None. Grep for `TBD`/`FIXME`/`XXX`/`placeholder`/`upstream`/PR numbers across all files touched by this task's 4 commits returns zero newly-introduced matches (pre-existing unrelated matches in `bin/lib/init.cjs` and `sdk/src/query/config-mutation.ts`/`sdk/src/query/roadmap.ts`/`bin/lib/roadmap.cjs` confirmed via `git diff 1298162..da101c6` to predate this task and be untouched by it).

### Group C (do-not-touch) sites — confirmed unchanged by this task

- `bin/lib/checkpoint.cjs:139`, `bin/lib/phase.cjs:373`, `sdk/src/query/phase.ts:289` id-pairing logic — no diff in `git diff 1298162..da101c6`
- `bin/lib/audit.cjs` — no diff in `git diff 1298162..da101c6`
- `bin/lib/checkpoint.cjs` and `bin/lib/state.cjs` DO show diffs in the 1298162..da101c6 range, but those come from three unrelated, pre-existing commits (`b76d291`, `a15f313`, `e5c2947` — phase-14 HANDOFF.json write-locking work) that sit in history between the two SHAs, not from this task's 4 commits (`a89b3e3`, `43e5913`, `9fcfffc`, `da101c6`); confirmed via `git log --oneline 1298162..da101c6 -- bin/lib/checkpoint.cjs bin/lib/state.cjs`.

### Human Verification Required

None. All must-haves are verified programmatically via source inspection, regression tests, golden parity, and build gates.

### Gaps Summary

No gaps. All 3 Tier-1 fixes are ported, wired through every documented completion consumer in both CJS and SDK resolvers, covered by passing regression tests, sdk/dist and dist/bm are rebuilt and in sync, and the 13 pre-existing integration-suite failures were independently confirmed to be unrelated to this task's diff.

---

*Verified: 2026-07-18T23:11:06Z*
*Verifier: Claude (gsd-verifier)*
