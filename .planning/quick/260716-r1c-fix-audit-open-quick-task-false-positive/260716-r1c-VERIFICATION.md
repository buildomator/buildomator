---
phase: quick-260716-r1c
verified: 2026-07-16T17:49:53Z
status: passed
score: 5/5 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Quick 260716-r1c: Fix audit-open Quick-Task False-Positive Verification Report

**Task Goal:** audit-open must stop flagging COMPLETED quick tasks (those with a `<id>-SUMMARY.md`, even without a status field) as "missing", and the CJS (bin/lib/audit.cjs) and SDK (sdk/src/query/audit-open.ts) scanners must classify IDENTICALLY.
**Verified:** 2026-07-16T17:49:53Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | audit-open (CJS and SDK) no longer flags a completed quick task whose SUMMARY is named `<quick_id>-SUMMARY.md` | VERIFIED | Read both `scanQuickTasks` implementations (bin/lib/audit.cjs:83-164, sdk/src/query/audit-open.ts:73-140). Both do a readdir-based discovery preferring `${dirName}-SUMMARY.md`, then any `*-SUMMARY.md`, then bare `SUMMARY.md`. End-to-end run on the real repo confirms `260714-coq-...` and `260716-0ao-...` (both use the prefixed filename, both have no `status:` field, verified directly by reading their SUMMARY frontmatter) are absent from both CLIs' `quick_tasks` output. |
| 2 | A readable SUMMARY with no status field counts as complete and is not flagged | VERIFIED | Both files gate with `if (status !== 'missing' && status !== 'unreadable' && !INCOMPLETE_QUICK_STATUSES.has(status)) continue;` — an absent status resolves to `'unknown'`, which is not in `INCOMPLETE_QUICK_STATUSES`, so it is skipped (not flagged). `node tests/audit-open-quick-tasks.test.cjs` case A and case D both assert this and pass. `sdk/src/query/audit-open.test.ts` cases A and D pass under vitest. |
| 3 | A quick dir with no SUMMARY at all is still flagged with status missing | VERIFIED | `status` defaults to `'missing'` and is only overwritten when a summary file is found and read; the `missing`/`unreadable` branch is exempted from the skip. CJS test case B and SDK test case B both pass. Real-repo run shows 3 genuinely missing-SUMMARY dirs still flagged with `status: "missing"` (`260411-12i`, `260529-geq`, `260609-kb0`). |
| 4 | A SUMMARY with status incomplete/gaps/gaps_found/partial/blocked (any case) is still flagged with that status | VERIFIED | `INCOMPLETE_QUICK_STATUSES = new Set(['incomplete', 'gaps', 'gaps_found', 'partial', 'blocked'])`, status is lowercased at read time in both files. CJS/SDK test case C (`status: incomplete`) and case C uppercase (`status: BLOCKED` -> flagged as `'blocked'`) both pass. |
| 5 | `bin/gsd-tools.cjs audit-open --json` and `node sdk/dist/cli.js query audit-open --json` produce identical quick_tasks arrays on the same project | VERIFIED | Ran both CLIs live against this repo. `quick_tasks` count = 3 on both sides; `diff` of the two `items.quick_tasks` JSON arrays is byte-identical (exit 0). SDK golden parity test `'SDK and CJS classify quick tasks identically on an A-D fixture project'` and `'SDK JSON matches gsd-tools.cjs except volatile scanned_at'` both pass under vitest. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sdk/src/query/audit-open.ts` | scanQuickTasks with prefixed-SUMMARY discovery and incomplete-status-set rule | VERIFIED | Contains `INCOMPLETE_QUICK_STATUSES` (line 18) and the `-SUMMARY.md` readdir discovery (lines 91-106), matching CJS logic field-for-field. |
| `bin/lib/audit.cjs` | scanQuickTasks with incomplete-status-set rule matching the SDK | VERIFIED | Contains `INCOMPLETE_QUICK_STATUSES` (line 354, hoisted next to `TERMINAL_UAT_STATUSES`) and prefixed-SUMMARY discovery (lines 108-123). |
| `tests/audit-open-quick-tasks.test.cjs` | zero-dep node:assert unit coverage for the CJS scanner (4 fixture cases) | VERIFIED | 111 lines, 6 checks covering cases A-D plus uppercase variant and exact-set assertion. Ran live: 6/6 PASS. |
| `sdk/src/query/audit-open.test.ts` | vitest unit coverage for the SDK scanner (same 4 fixture cases) | VERIFIED | 89 lines, 6 `it` blocks mirroring the CJS cases. Ran live under vitest: 6/6 PASS. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `sdk/src/golden/read-only-parity.integration.test.ts` | `bin/lib/audit.cjs` and `sdk/src/query/audit-open.ts` | `captureGsdToolsOutput` vs `registry.dispatch` on a fixture project dir | VERIFIED | Second `it` in the `audit-open golden parity` describe block builds an A-D fixture (including the exact original bug shape: prefixed SUMMARY with no status) and asserts deep equality after stripping `scanned_at`/`has_scan_errors`. Ran live: PASS. Not vacuous — confirmed by reading the fixture-building code (lines 58-83), which writes real files to a temp dir per case. |
| `bin/build-bm.cjs --check` | `dist/bm/bin/lib/audit.cjs` | regenerated bm mirror stays drift-free | VERIFIED | Ran live: `bm drift check: PASS (committed dist/bm matches a fresh build).` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CJS unit test suite | `node tests/audit-open-quick-tasks.test.cjs` | `audit-open quick tasks: 6/6 checks passed` | PASS |
| SDK unit test file | `cd sdk && npx vitest run src/query/audit-open.test.ts` | `6 tests` passed | PASS |
| SDK/CJS golden parity (audit-open only) | `cd sdk && npx vitest run src/golden/read-only-parity.integration.test.ts` (audit-open describe block) | Both `audit-open golden parity` tests PASS (repo-root parity and A-D fixture parity) | PASS |
| build-bm drift check | `node bin/build-bm.cjs --check` | `PASS (committed dist/bm matches a fresh build)` | PASS |
| End-to-end CJS CLI | `node bin/gsd-tools.cjs audit-open --json` | `quick_tasks` count 3, no `260716-0ao`/`260714-coq`, all status `missing` | PASS |
| End-to-end SDK CLI | `node sdk/dist/cli.js query audit-open --json` | `quick_tasks` count 3, identical array to CJS (byte-for-byte diff, exit 0) | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in the two modified product files or the two new test files | — | none |

Note: both `bin/lib/audit.cjs` and `sdk/src/query/audit-open.ts` contain em-dashes on lines unrelated to this task's diff (pre-existing report-formatting strings and doc comments). Verified via `git show f5f8e0c` that no new em-dash-containing line was added by this task's commits, so the CLAUDE.md em-dash rule was respected for the actual edits.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-260716-R1C | 260716-r1c-PLAN.md | Fix audit-open quick-task false positives, CJS/SDK parity | SATISFIED | All 5 must-have truths verified above; live end-to-end run confirms parity and correct classification on this repo's real data. |

## Full-Suite Context (informational, not a gap)

Running the full `read-only-parity.integration.test.ts` file (not filtered to audit-open) shows 4 unrelated pre-existing failures: `phase-plan-index`, `stats.json`, `state.json` (all due to a `milestone_name` mismatch: `"milestone"` vs `"Buildomator Rebrand"`), and `state.load` (missing legacy `get-shit-done/bin/lib/core.cjs` in this checkout layout, an environment issue). None of these touch `audit-open`, quick-task scanning, or any file this task modified (`files_modified` in the plan lists only `sdk/src/query/audit-open.ts`, `bin/lib/audit.cjs`, `sdk/src/query/audit-open.test.ts`, `sdk/src/golden/read-only-parity.integration.test.ts`, `tests/audit-open-quick-tasks.test.cjs`). Confirmed both `audit-open` tests inside that same suite file pass. This is pre-existing environmental/repo-state drift, not a regression introduced by this quick task, so it is not counted as a gap here.

### Human Verification Required

None. All must-haves are mechanically verifiable via grep/read/run, and all were run live in this session.

### Gaps Summary

No gaps found. All 5 must-have truths verified against actual running code and live command output, not SUMMARY.md claims. The CJS and SDK scanners were read side-by-side and confirmed to implement identical classification logic (same `INCOMPLETE_QUICK_STATUSES` set, same discovery preference order, same gate condition). Both CLIs were run live against the real repo and produce byte-identical `quick_tasks` arrays that no longer list the two previously false-flagged completed tasks. Both new test files were run live and pass. The golden parity fixture test was confirmed non-vacuous by reading its fixture-building code.

---

_Verified: 2026-07-16T17:49:53Z_
_Verifier: Claude (gsd-verifier)_
