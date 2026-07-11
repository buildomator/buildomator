---
phase: 14-backward-compatibility-and-coexistence
verified: 2026-07-11T22:19:42Z
status: gaps_found
score: 5/6 must-haves verified (1 partial with documented residual)
has_blocking_gaps: false
overrides_applied: 0
gaps:
  - truth: "pluginIdentity heuristic correctly derives 'gsd' vs 'bm' from any resolved script path (D-02), for both hook dispatch points"
    status: partial
    severity: minor
    reason: "Confirmed live (not hypothetical): pluginIdentity's second clause `/bm/bin/` only covers files under bin/, so hooks/run-bash-hook.cjs installed anywhere under a directory literally named 'bm' that is NOT under the marketplace cache path (cache/gsd-plugin/bm/...) resolves to 'gsd' instead of 'bm'. Verified: pluginIdentity('/x/dist/bm/hooks/run-bash-hook.cjs') === 'gsd' (should be 'bm'). The real marketplace-cache install path (cache/gsd-plugin/bm/<version>/hooks/run-bash-hook.cjs) is unaffected because the first clause matches regardless of bin/ vs hooks/, so the plugin's actual only shipped distribution mechanism (BUILD-03: cache/gsd-plugin/{gsd,bm}) is correct. The bug only bites non-standard installs (e.g. CLAUDE_PLUGIN_ROOT pointed straight at a checked-out dist/bm, which is exactly the install-smoke.yml CI pattern -- but that job never exercises run-bash-hook.cjs identity, so the bug is untested and unnoticed by CI). Already found and documented by the phase's own 14-REVIEW.md (WR-01), unresolved as of HEAD."
    artifacts:
      - path: "bin/lib/coexist.cjs"
        issue: "pluginIdentity's 'bm' detection is inconsistent between the two hook dispatch call sites (bin/ vs hooks/ subdirectory) outside the marketplace-cache path"
    missing:
      - "Anchor identity on the plugin-name path segment (e.g. /(?:cache\\/gsd-plugin\\/bm|\\/bm)\\/(?:bin|hooks)\\// ) or read name from the nearest .claude-plugin/plugin.json, so bin/ and hooks/ call sites agree everywhere, not just under the cache path"
  - truth: "With both plugins active, each hook fires exactly once (no hook double-fire) for every merged hook including SessionStart"
    status: partial
    severity: minor
    reason: "The four gsd-tools.cjs branches (post-tool-use, pre-compact, stop) and the three run-bash-hook.cjs targets (session-state, validate-commit, phase-boundary) fire exactly once under test, verified live. SessionStart is a documented, ACCEPTED exception (14-CONTEXT.md D-03): the election is a marker-based TOCTOU -- on the very first hook of a both-active session, gsd may fire before bm's self-announce marker lands, so both copies can run the SessionStart body once (duplicate stdout context injection + a concurrent, non-lock-guarded autoMigrate() filesystem call). This was a considered design trade-off (avoiding a lockfile race for latency), is bounded to at most one duplicate per session, and is directly asserted by hook-single-fire.test.cjs's residual-bound case -- so it is not a silent gap, but it is a real, literal deviation from the roadmap's absolute 'no hook double-fire' wording. Documented by 14-REVIEW.md WR-03, unresolved as of HEAD."
    artifacts:
      - path: "bin/gsd-tools.cjs"
        issue: "SessionStart branch (lines ~1278-1357) has no guard against a concurrent duplicate run of autoMigrate() or the stdout context injection during the marker-landing race"
    missing:
      - "Optional hardening (not required for the phase to function): guard autoMigrate with its own O_EXCL lock, and/or an idempotency marker for the stdout context injection, per the review's suggested fix"
deferred: []
---

# Phase 14: Backward Compatibility and Coexistence Verification Report

**Phase Goal:** Existing `/gsd:*` users are unaffected, and users running both plugins
simultaneously experience no hook double-fire, no duplicate MCP writers, and no corrupted
project state; a deprecation nudge points `/gsd:*` users toward `/bm:*`.
**Verified:** 2026-07-11T22:19:42Z
**Status:** gaps_found (2 minor, non-blocking gaps; core mechanism verified working)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A gsd-only session (no bm marker) behaves exactly as today; `shouldYield` never yields (COMPAT-01) | VERIFIED | `bin/lib/coexist.cjs shouldYield` returns `identity==='gsd' && isBmActive(sessionId)`; `tests/coexist.test.cjs` asserts `shouldYield('gsd','no-such-session')===false`; `tests/hook-single-fire.test.cjs` proves the gsd copy writes HANDOFF.json with no marker. Both live-run and pass. |
| 2 | With both plugins active, non-SessionStart merged hooks (post-tool-use, pre-compact, stop via gsd-tools.cjs; session-state, validate-commit, phase-boundary via run-bash-hook.cjs) fire exactly once (COMPAT-02) | VERIFIED | `shouldYield` guard present at all 4 gsd-tools.cjs state-mutating branches (`grep -c shouldYield` = 4) and at the single run-bash-hook.cjs dispatch. `tests/hook-single-fire.test.cjs` live-run: 7/7 PASS, including marker-present yield / no-marker control for both dispatch points and both named bash hooks (session-state, validate-commit). |
| 3 | SessionStart fires exactly once with no double-fire risk | PARTIAL | Documented, accepted, bounded TOCTOU residual (D-03): first SessionStart of a session can double-fire once before bm's marker lands. See Gap #2 above. Not silent — tested and disclosed in 14-CONTEXT.md and 14-REVIEW.md WR-03. |
| 4 | With both active, project state (STATE.md, HANDOFF.json) is not corrupted by concurrent writers (COMPAT-03) | VERIFIED | `checkpoint.cjs writeCheckpoint` HANDOFF.json write is bracketed by `acquireStateLock`/`releaseStateLock` (live-read at checkpoint.cjs:403-408) AND uses `platformWriteSync` (temp+atomic-rename), closing a torn-read gap the plan's literal instruction alone would have missed. `tests/handoff-write-lock.test.cjs` live-run: 4/4 PASS including >=20 interleaved concurrent writers staying valid JSON, and STATE.md/HANDOFF.json using distinct locks. MCP server (`mcp/server.cjs`) delegates all state writes through the same `state.cjs` module (verified: `require(path.join(libDir,'state.cjs'))`), so a second MCP server does not bypass the lock. |
| 5 | pluginIdentity correctly derives 'gsd' vs 'bm' from any resolved script path, consistently across both dispatch points (D-02) | PARTIAL | VERIFIED for the plugin's only shipped install path (marketplace cache: `cache/gsd-plugin/{gsd,bm}/<version>/...`, per BUILD-03) — confirmed by live test. FAILS for a non-cache bm install (e.g. `CLAUDE_PLUGIN_ROOT` pointed directly at a checked-out `dist/bm`): `pluginIdentity('/x/dist/bm/hooks/run-bash-hook.cjs')` returns `'gsd'`, not `'bm'`, because the fallback clause only matches `/bm/bin/`, not `/bm/hooks/`. See Gap #1 above. |
| 6 | The gsd `/gsd:*` SessionStart hook emits a non-blocking deprecation nudge mentioning `/bm:` and v5.0, even when yielding the stateful work; the bm package never emits it (COMPAT-04) | VERIFIED | Live-run: `printf '{"session_id":"NUDGE1","source":"startup"}' \| node bin/gsd-tools.cjs hook session-start` stdout contains `/bm:` and `v5.0`, no em/en-dash, exit 0. `tests/nudge-emission.test.cjs` live-run: 3/3 PASS (emits with no marker, emits under yield, `dist/bm/bin/gsd-tools.cjs` has zero `BM-NUDGE` occurrences). `node bin/build-bm.cjs --check` PASS; `node --check` on both `dist/bm/bin/gsd-tools.cjs` and `dist/bm/bin/lib/bm-transform.cjs` PASS (no self-corruption). |

**Score:** 5/6 fully VERIFIED, 2 PARTIAL (minor, non-blocking, both already disclosed by the phase's own code review; core coexistence mechanism works correctly for the plugin's actual only shipped install path)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/lib/coexist.cjs` | `pluginIdentity, markBmActive, isBmActive, shouldYield` exported | VERIFIED | All four functions present, exported, unit-tested (20/20 in `tests/coexist.test.cjs`). Session-id validated against `^[A-Za-z0-9_-]+$` before any path composition (traversal-proof, confirmed live). |
| `bin/lib/state.cjs` | `acquireStateLock`/`releaseStateLock` exported for reuse | VERIFIED | `module.exports` block (line 1927-1928) includes both; function bodies unchanged (path-generic). |
| `bin/lib/checkpoint.cjs` | HANDOFF.json write serialized through the lock | VERIFIED | `require('./state.cjs')` at line 28; lock/try/`platformWriteSync`/finally at lines 403-408; guards (a)/(b) preserved above the lock. |
| `bin/gsd-tools.cjs` | Election at the top of each state-mutating hook branch + sentinel-wrapped nudge | VERIFIED | `shouldYield` present at 4 branch sites (grep confirms); `BM-NUDGE-START`/`BM-NUDGE-END` sentinels present, guarded emit between them, placed before the yield (D-06 exemption). |
| `hooks/run-bash-hook.cjs` | Election at the single bash-hook dispatch point | VERIFIED | `require('../bin/lib/coexist.cjs')`; stdin buffered once and forwarded via `spawnSync input`; `shouldYield` guard before the bash spawn. |
| `hooks/hooks.json` | Classification of every entry (elected vs advisory) | VERIFIED | Top-level `description` field enumerates both dispatch points, all 3 named bash hooks, and all 8 read-only advisory JS detectors. |
| `bin/lib/bm-transform.cjs` | `suppressNudge(text)`, self-protected, line-anchored | VERIFIED | Line-anchored regex (`^[ \t]*// BM-NUDGE-START...`) confirmed not to strip its own quoted-string sentinel definitions; idempotent per JSDoc and code inspection. |
| `bin/build-bm.cjs` | `SUPPRESS_EXCLUDE` wired into `generate()` | VERIFIED | `SUPPRESS_EXCLUDE` set present, includes `bin/lib/bm-transform.cjs`; applied in the per-file loop guarded by the exclude. |
| `dist/bm/bin/gsd-tools.cjs` | Nudge block removed | VERIFIED | `grep -c "BM-NUDGE"` = 0; `node --check` passes; `node bin/build-bm.cjs --check` passes (no drift). |
| `tests/coexist.test.cjs` | Identity + marker lifecycle + malformed-id + reaper-safety | VERIFIED | 20/20 checks pass live. |
| `tests/hook-single-fire.test.cjs` | Both-active single fire (both dispatch points) + gsd-only no-op + residual bound | VERIFIED | 7/7 checks pass live. |
| `tests/handoff-write-lock.test.cjs` | Interleaved-write + lock-acquisition assertions | VERIFIED | 4/4 checks pass live. |
| `tests/nudge-emission.test.cjs` | gsd-emits (incl. yield) + bm-suppresses assertions | VERIFIED | 3/3 checks pass live. |
| `.github/workflows/check-drift.yml` | `run:` steps for the four new coexistence tests | VERIFIED | All 4 test filenames present as separate `run:` steps (lines 163-169); existing `build-bm --check` and `bm-parity` steps preserved; YAML parses. |
| `.github/workflows/install-smoke.yml` | Both-plugins single-fire smoke in bm-package-smoke | VERIFIED | Marker-present yield assertion + no-marker control assertion present (lines 196-230); YAML parses. Note: this smoke exercises `bin/gsd-tools.cjs` identity only, not `hooks/run-bash-hook.cjs` — it does not catch Gap #1 (WR-01). |
| `.planning/phases/14-backward-compatibility-and-coexistence/14-VALIDATION.md` | Confirmed per-task map, `nyquist_compliant: true` | VERIFIED | `nyquist_compliant: true` and `wave_0_complete: true` present in frontmatter; per-task map has a row for every task across plans 01-05 with concrete automated commands. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/lib/checkpoint.cjs` | `bin/lib/state.cjs` | `require('./state.cjs')` acquireStateLock/releaseStateLock | WIRED | Live-confirmed at checkpoint.cjs:28, called at 403/407. |
| `bin/gsd-tools.cjs` | `bin/lib/coexist.cjs` | require pluginIdentity/markBmActive/shouldYield | WIRED | Live-confirmed at line 1268; 4 `shouldYield` call sites. |
| `hooks/run-bash-hook.cjs` | `bin/lib/coexist.cjs` | require pluginIdentity/markBmActive/shouldYield | WIRED | Live-confirmed at line 31; election gate at lines 131-133. |
| `bin/build-bm.cjs` | `bin/lib/bm-transform.cjs` | `generate()` calls `suppressNudge` on each non-excluded file | WIRED | Live-confirmed: `SUPPRESS_EXCLUDE` guard + call present in the per-file loop; `dist/bm/bin/gsd-tools.cjs` carries zero `BM-NUDGE` occurrences after a fresh build. |
| `tests/*` | respective source modules | direct `require` + spawnSync of the repo binaries | WIRED | All four coexistence tests import/spawn the real modules under test, not mocks; all pass live. |
| `.github/workflows/check-drift.yml` | `tests/coexist.test.cjs, tests/hook-single-fire.test.cjs, tests/handoff-write-lock.test.cjs, tests/nudge-emission.test.cjs` | `run: node tests/<file>` | WIRED | 4 distinct `run:` steps confirmed present. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live nudge emission | `printf '{"session_id":"NUDGE1","source":"startup"}' \| node bin/gsd-tools.cjs hook session-start` | stdout contains `/bm:` and `v5.0`, no em/en-dash, exit 0 | PASS |
| Live pluginIdentity classification (cache path) | `node -e "..." pluginIdentity('cache/gsd-plugin/bm/4.1.0/hooks/run-bash-hook.cjs')` | `'bm'` | PASS |
| Live pluginIdentity classification (non-cache dist path) | `node -e "..." pluginIdentity('dist/bm/hooks/run-bash-hook.cjs')` | `'gsd'` (expected `'bm'`) | FAIL (see Gap #1) |
| HANDOFF.json write-lock reuse | Read `checkpoint.cjs:403-408` | `acquireStateLock`/`releaseStateLock`/`platformWriteSync` present in a try/finally | PASS |
| bm build drift check | `node bin/build-bm.cjs --check` | "bm drift check: PASS" | PASS |
| bm-generated gsd-tools.cjs is valid JS with no nudge | `node --check dist/bm/bin/gsd-tools.cjs && grep -c BM-NUDGE dist/bm/bin/gsd-tools.cjs` | valid, count 0 | PASS |
| Four coexistence tests, live-run | `node tests/coexist.test.cjs && node tests/hook-single-fire.test.cjs && node tests/handoff-write-lock.test.cjs && node tests/nudge-emission.test.cjs` | 20/20, 7/7, 4/4, 3/3 all PASS | PASS |
| Full repo test suite, live-run | `for t in tests/*.test.cjs; do node "$t"; done` (45 files) | all exit 0, no failures | PASS |
| CI workflow YAML validity | `python3 -c "import yaml; yaml.safe_load(...)"` on both workflow files | both parse | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMPAT-01 | 14-02, 14-03, 14-05 | `/gsd:*` continues to work with zero re-enable throughout 4.x | SATISFIED | `shouldYield` no-op verified live and by test for a gsd-only session; no behavior change when no marker exists. |
| COMPAT-02 | 14-02, 14-03, 14-05 | Both plugins enabled: hooks fire exactly once (no double PostToolUse/validate-commit/session-state) | SATISFIED (with disclosed residual) | All 3 named bash hooks + 3 gsd-tools state-mutating branches proven single-fire live. SessionStart carries an accepted, bounded, tested TOCTOU residual (D-03) — disclosed as Gap #2, not blocking. |
| COMPAT-03 | 14-01, 14-05 | Both plugins enabled: project state consistent, no corruption from a second MCP server / duplicate writers | SATISFIED | HANDOFF.json write now lock+atomic; MCP server delegates writes through the same locked `state.cjs` module (no bypass); >=20-writer interleave test passes live. |
| COMPAT-04 | 14-03, 14-04, 14-05 | `/gsd:*` surfaces a deprecation nudge pointing to `/bm:`, non-blocking | SATISFIED | Live-confirmed nudge emission (incl. under yield) and live-confirmed bm-package suppression; drift-gated so the two cannot diverge. |

No orphaned requirements: all 4 phase-declared IDs (COMPAT-01..04) appear in plan frontmatter and are addressed by at least one plan. `.planning/REQUIREMENTS.md` traceability rows for COMPAT-01..04 still show "Pending" — this is a milestone-level bookkeeping table, not evidence of missing implementation; recommend flipping it to Complete once the milestone author reviews this report.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bin/gsd-tools.cjs` | 348 | `TODO: extract to shared helper` | Info | Pre-existing (introduced by an unrelated upstream sync commit `b1425b1`, far from any phase-14-touched region); not a phase-14 debt marker. |

No TBD/FIXME/XXX markers, no stub returns, no empty handlers, and no hardcoded-empty data patterns found in any of the 11 files phase 14 created or modified.

### Human Verification Required

None. All observable truths for this phase are verifiable via automated tests, live command execution, and direct code reading; no visual, real-time, or external-service behavior is involved.

### Gaps Summary

The core coexistence mechanism (single-fire election, HANDOFF.json write-lock, deprecation
nudge + suppression, CI gating) is solidly implemented and verified working, with all four new
coexistence tests and the full 45-test suite passing live, and the bm build drift gate green.

Two minor, non-blocking gaps remain, both already surfaced by the phase's own `14-REVIEW.md`
code review and unresolved as of the current commit (`3ca0bdd`, the review-report commit itself
being HEAD with no follow-up fix commit):

1. **`pluginIdentity` heuristic bug (WR-01):** confirmed live — `hooks/run-bash-hook.cjs`
   misclassifies as `'gsd'` when deployed under a `bm`-named directory that is not the
   marketplace cache path (the `/bm/bin/` fallback clause does not cover `/bm/hooks/`). Does
   not affect the plugin's actual only shipped install mechanism (marketplace cache,
   `cache/gsd-plugin/{gsd,bm}/<version>/`, per BUILD-03), but is untested by the existing CI
   smoke and would misbehave for any non-standard bm deployment.

2. **SessionStart double-fire residual (WR-03):** an explicit, planned, and tested trade-off
   (D-03) — a marker-based TOCTOU means the very first SessionStart event of a both-active
   session can run in both copies before bm's marker lands, at most once per session. This is
   a literal (if narrow and disclosed) deviation from the roadmap's absolute "no hook
   double-fire" wording.

Both gaps are classified `severity: minor` (not blocking) because: (a) the review that
discovered them independently concluded "No BLOCKER-tier defects were proven," (b) the
project's only real distribution path is unaffected by WR-01, and (c) WR-03 is a disclosed,
bounded, and tested trade-off rather than a silent defect. Recommend routing both to backlog
for follow-up rather than blocking phase progression.

---

_Verified: 2026-07-11T22:19:42Z_
_Verifier: Claude (gsd-verifier)_
