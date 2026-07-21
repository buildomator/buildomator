---
task: quick-260721-j83-remove-fable-sunset-time-gate
verified: 2026-07-21T14:10:00Z
status: passed
score: 6/6 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Quick Task: Remove Fable Sunset Time-Gate Verification Report

**Task Goal:** Remove the Fable 5 sunset/time-gate entirely so `fable` is an ordinary always-available tier, with the gate symbols gone from both resolvers and both config-schema files, the sunset test deleted, README pruned, and sdk/dist + dist/bm rebuilt.

**Verified:** 2026-07-21
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Gate symbols (`FABLE_SUNSET_DATE`, `applyFableSunset`, `fableAvailable`, `readFableKnob`, `GSD_FABLE_SUNSET_NOW`) absent from `bin/lib` and `sdk/src` | VERIFIED | `grep -rn "FABLE_SUNSET\|applyFableSunset\|fableAvailable\|readFableKnob\|GSD_FABLE_SUNSET_NOW" bin/lib sdk/src` → 0 matches (exit 1) |
| 2 | `fable.mode` / `fable.until` gone from both config-schema files | VERIFIED | `grep -n "fable\.mode\|fable\.until" bin/lib/config-schema.cjs sdk/src/query/config-schema.ts` → 0 matches. Remaining `fable` hits in both files are the unrelated `model_profile_overrides.<runtime>.(fable|opus|sonnet|haiku)` schema entry, correctly kept |
| 3 | Resolving fable tier returns fable/claude-fable-5 regardless of date (CJS) | VERIFIED | `node -e "require('./bin/lib/core.cjs').resolveModelForTier(cwd,'gsd-planner',0)"` → `fable` both with no env var and with `GSD_FABLE_SUNSET_NOW=2030-01-01` |
| 4 | Resolving fable tier returns fable regardless of date (SDK, rebuilt CLI) | VERIFIED | `node sdk/dist/cli.js query init.quick` → `"planner_model": "fable"`; same with `GSD_FABLE_SUNSET_NOW=2030-01-01` set — env var is a no-op |
| 5 | `fable` remains a valid tier (VALID_TIERS, MODEL_PROFILES, model-catalog untouched); fable-tier test passes | VERIFIED | `'fable'` present in `VALID_TIERS` (bin/lib/core.cjs:1427); `sdk/shared/model-catalog.json` unchanged (all runtime `fable` entries intact); `node tests/fable-tier.test.cjs` → 26/26 PASS |
| 6 | Sunset test deleted with no empty file left in source or dist/bm | VERIFIED | `tests/fable-sunset.test.cjs` absent; `dist/bm/tests/fable-sunset.test.cjs` absent |
| 7 | `node bin/build-bm.cjs --check` passes; gate absent from dist/bm code | VERIFIED | Command output: `bm drift check: PASS`; `grep -rn "FABLE_SUNSET\|applyFableSunset\|fableAvailable\|readFableKnob\|GSD_FABLE_SUNSET_NOW" dist/bm --include="*.cjs" --include="*.js" --include="*.ts"` → 0 matches |

**Score:** 7/7 truths verified (must_haves frontmatter listed 6 grouped truths; all sub-checks pass)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/lib/core.cjs` | CJS resolver with gate removed, `requestedTier` renamed to `tier` | VERIFIED | `requestedTier` no longer present; `const tier = (...)` feeds runtime resolution directly (lines ~1400-1440 read directly) |
| `sdk/src/query/config-query.ts` | SDK resolver mirroring CJS, gate removed | VERIFIED | Both call sites (`alias = ...`, `tier = typeof phaseTier === 'string' ? phaseTier : alias`) confirmed by direct read, no `applyFableSunset` remaining; unused `readFileSync` import correctly dropped (only `existsSync` imported from `node:fs`) |
| `bin/lib/config-schema.cjs` | `fable.mode`/`fable.until` removed | VERIFIED | grep 0 matches; parity test passes |
| `sdk/src/query/config-schema.ts` | `fable.mode`/`fable.until` removed, parity with CJS | VERIFIED | grep 0 matches; `node tests/config-schema-sdk-parity.test.cjs` → all 3 checks pass including "dynamic key patterns accept the same sample keys (incl. fable tier)" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `sdk/src/query/config-query.ts` | `sdk/dist/cli.js` | `npm --prefix sdk run build` | WIRED | `npx tsc --noEmit` (run from `sdk/`) exits 0; live `node sdk/dist/cli.js query init.quick` reflects source change (`fable`, not stale `opus`) |
| source tree | `dist/bm` | `npm run build:bm` / `check:bm-drift` | WIRED | `node bin/build-bm.cjs --check` → PASS (committed dist/bm matches a fresh build); dist/bm code grep for gate symbols → 0 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CJS live resolution, no env | `node -e "...resolveModelForTier(cwd,'gsd-planner',0)"` | `fable` | PASS |
| CJS live resolution, env pinned to future date | `GSD_FABLE_SUNSET_NOW=2030-01-01 node -e "..."` | `fable` (unchanged) | PASS |
| SDK live resolution, no env | `node sdk/dist/cli.js query init.quick` | `"planner_model": "fable"` | PASS |
| SDK live resolution, env pinned to future date | `GSD_FABLE_SUNSET_NOW=2030-01-01 node sdk/dist/cli.js query init.quick` | `"planner_model": "fable"` (unchanged) | PASS |
| fable-tier regression suite | `node tests/fable-tier.test.cjs` | 26/26 PASS | PASS |
| config-schema-sdk-parity suite | `node tests/config-schema-sdk-parity.test.cjs` | all 3 checks pass | PASS |
| bm drift check | `node bin/build-bm.cjs --check` | PASS | PASS |
| SDK typecheck | `cd sdk && npx tsc --noEmit` | exit 0 | PASS |
| SDK unit suite | `npm --prefix sdk run test` | 1833/1833 passed (129 files) | PASS |
| Full CJS test suite (all `tests/*.test.cjs`, run once) | loop over 50 files with `node <file>` | 48/50 PASS; failures = `context-monitor-hook-event.test.cjs`, `version-command.test.cjs` | PASS (pre-existing, see below) |
| SDK integration suite (re-run once, compared to executor's captured baseline/post files) | diff of FAIL-line test names in `/tmp/fable-int-baseline.txt` vs `/tmp/fable-int-post.txt` | Identical failing test names (14 failed / 72 passed / 13 skipped in both); `comm -13` diff empty | PASS (pre-existing, see below) |

### Pre-Existing Failure Baseline Confirmation

- **CJS suite (2 failures):** `context-monitor-hook-event.test.cjs` and `version-command.test.cjs` — reproduced independently by running the full `tests/*.test.cjs` loop. Neither file is in this task's `files_modified` list (bin/lib/core.cjs, sdk/src/query/config-query.ts, bin/lib/config-schema.cjs, sdk/src/query/config-schema.ts, tests/fable-sunset.test.cjs, README.md, sdk/dist/cli.js, dist/bm). Confirmed pre-existing and untouched by this task.
- **SDK integration suite (14 failures):** compared the executor's own `/tmp/fable-int-baseline.txt` (captured before edits) against `/tmp/fable-int-post.txt` (captured after edits) — both files still present in `/tmp`. Extracted the FAIL-line test names from each and diffed: identical set, zero new failures (`comm -13` empty). Root cause visible in the failure output is a missing legacy `get-shit-done/bin/lib/core.cjs` asset for golden-parity fixtures — unrelated to the fable gate removal.

Both failure sets match the task's stated known-baseline exactly; no new failures attributable to this change.

### Hygiene Checks

| Check | Result |
|-------|--------|
| No GSD bookkeeping (issue/PR numbers, "removed because...", task/wave notes) in touched product files | PASS — grepped `bin/lib/core.cjs`, `sdk/src/query/config-query.ts`, both config-schema files for `issue #`, `PR #`, `task`, `wave`, `Phase`, `removed because`, `j83`; all matches are pre-existing, unrelated comments (e.g. `#3023` phase-type slot design note, workflow-phase tracking helpers) — none related to this removal |
| No version bump | PASS — `.claude-plugin/plugin.json` / `marketplace.json` untouched by commits `ba4eb6e`/`32485db` |
| No new CHANGELOG entry | PASS — `git diff` for CHANGELOG.md across the two task commits is empty |
| README sunset prose removed | VERIFIED — `grep -ci 'sunset\|auto-fall\|fable.mode\|fable.until\|withdrawn' README.md` → 0; row at line 184 now reads "A first-class `fable` model tier that the quality profile assigns to the heaviest agents..." |
| Working tree clean (task-relevant) | PASS — `git status --short` shows only an unrelated untracked file (`gsd-bugs-housekeeping.rtf`), not part of this task |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| J83-FABLE-SUNSET-REMOVE | Remove Fable sunset/time-gate from both resolvers, both schemas, delete sunset test, prune README, rebuild dist | SATISFIED | All truths above verified directly against the codebase |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers introduced; no stub returns; both resolvers fully wired end-to-end with live output confirmed.

### Human Verification Required

None. All checks were verifiable programmatically via direct code reads, grep, and live `node` execution.

### Gaps Summary

No gaps. All must-haves from the PLAN frontmatter were independently re-verified (not trusted from SUMMARY.md): grep gates return 0, live resolution proven with real `node` output for both CJS and the rebuilt SDK CLI (env var confirmed no-op in both), `fable` remains a valid tier with the fable-tier test at 26/26, the sunset test is deleted from both source and dist/bm with no empty file, `build-bm.cjs --check` passes, and dist/bm is clean of gate symbols. The CJS and SDK integration/unit failures observed are reproduced pre-existing baselines, unchanged by this task and in files this task did not modify.

---

_Verified: 2026-07-21_
_Verifier: Claude (gsd-verifier)_
