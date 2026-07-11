---
phase: 14-backward-compatibility-and-coexistence
plan: 04
subsystem: coexistence
tags: [bm-build, byte-transform, deprecation-nudge, drift-gate, suppression]

requires:
  - phase: 14-03
    provides: "gsd SessionStart /bm: + v5.0 nudge, sentinel-wrapped (BM-NUDGE-START/END) for suppression"
  - phase: 13
    provides: "bin/build-bm.cjs + bin/lib/bm-transform.cjs byte-transform and STAMP_EXCLUDE precedent"
provides:
  - "suppressNudge(text): line-anchored, idempotent strip of the BM-NUDGE sentinel block, single-sourced in bm-transform.cjs"
  - "SUPPRESS_EXCLUDE self-protection set in build-bm.cjs (excludes the transform's own source and the sentinel-bearing test)"
  - "regenerated dist/bm with the nudge block removed from bin/gsd-tools.cjs"
  - "tests/nudge-emission.test.cjs proving gsd emits (incl. under yield) and dist/bm suppresses"
affects: []

tech-stack:
  added: []
  patterns:
    - "line-anchored exact-literal strip (multiline ^ with leading-whitespace tolerance) so a sentinel embedded as a quoted string is never matched"
    - "self-protection via an exclusion set (mirroring STAMP_EXCLUDE) so a broad byte transform cannot corrupt its own defining source"
    - "the --check regenerate-and-diff gate plus a drift-walk transform model that both import the exclusion sets, so build and gate cannot diverge"

key-files:
  created:
    - tests/nudge-emission.test.cjs
  modified:
    - bin/lib/bm-transform.cjs
    - bin/build-bm.cjs
    - tests/build-bm-drift.test.cjs
    - dist/bm/bin/gsd-tools.cjs
    - dist/bm/bin/lib/bm-transform.cjs
    - dist/bm/bin/build-bm.cjs
    - dist/bm/tests/build-bm-drift.test.cjs

key-decisions:
  - "Line-anchor with leading-whitespace tolerance (^[ \\t]*// BM-NUDGE-START ... ^[ \\t]*// BM-NUDGE-END) because the real sentinels are indented 8 spaces inside a switch branch, while the plan's example anchored at column 0; the tolerant anchor matches both the real block and the plan's unit fixture and still spares quoted-string occurrences."
  - "Define the sentinel literals as plain string constants and build the RegExp from them, so bm-transform.cjs can name its own strip target without any line of its source opening with the sentinel comment."
  - "Add SUPPRESS_EXCLUDE (mirroring STAMP_EXCLUDE) rather than relying on line-anchoring alone: defense in depth against self-corruption, and it keeps the sentinel-bearing test's own dist/bm copy intact."

patterns-established:
  - "Every per-file byte transform in generate() must also be mirrored in the build-bm-drift whitelist-walk model (expectedText) and imported from the build, so the two never drift."

requirements-completed: [COMPAT-04]

# Metrics
duration: ~20min
completed: 2026-07-11
---

# Phase 14 Plan 04: Suppress the Deprecation Nudge in the bm Package Summary

**A self-protected, line-anchored suppressNudge transform strips the sentinel-bracketed /bm: rename notice from the generated bm package, single-sourced in bm-transform.cjs and enforced by the --check drift gate, so bm never tells users to switch to bm while gsd keeps emitting it (including under yield).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (plus one Rule 3 blocking fix)
- **Files:** 1 new test, 3 source/test files modified (+ dist/bm mirrors)

## Accomplishments

- Added `suppressNudge(text)` to `bin/lib/bm-transform.cjs`: a line-anchored, idempotent strip of the `// BM-NUDGE-START` .. `// BM-NUDGE-END` block. The sentinels are held as string constants and the RegExp is built from them, so the function can name its own target without any source line opening with the sentinel comment; the multiline anchor (with leading-whitespace tolerance) spares any quoted-string occurrence, including the one inside suppressNudge itself.
- Wired it into `build-bm.cjs generate()` behind a new `SUPPRESS_EXCLUDE` set (mirroring the `STAMP_EXCLUDE` precedent) containing `bin/lib/bm-transform.cjs` (defines the strip, embeds both sentinel literals) and `tests/nudge-emission.test.cjs` (asserts on the `BM-NUDGE` literal). Exported `suppressNudge` and `SUPPRESS_EXCLUDE` for the tests.
- Regenerated `dist/bm`: `dist/bm/bin/gsd-tools.cjs` now contains neither the sentinels nor the rename notice, while `dist/bm/bin/lib/bm-transform.cjs` retains its sentinel literals (excluded) and both stay valid JS.
- New `tests/nudge-emission.test.cjs` spawns the repo SessionStart hook and asserts the `/bm:` + `v5.0` notice on stdout both with no bm marker and under a planted `markBmActive` marker (the yield exemption), asserts the notice is dash-free, and asserts the shipped `dist/bm/bin/gsd-tools.cjs` carries neither the sentinel nor the notice sentence.

## Task Commits

1. **Task 1: self-protected suppressNudge transform + wired build + regenerated dist/bm** - `166b403` (feat)
2. **Task 2: nudge-emission test (gsd emits incl. yield; bm suppresses)** - `8be9648` (test)
3. **Rule 3 fix: mirror suppressNudge in the drift-walk transform model** - `7d99c7a` (test)

## Files Created/Modified

- `tests/nudge-emission.test.cjs` (new) - zero-dep harness; spawns `bin/gsd-tools.cjs hook session-start` with a session_id on stdin (once bare, once after `coexist.markBmActive`), asserts the notice survives both and is dash-clean, and source-asserts the dist/bm copy is notice-free. Cleans up planted markers.
- `bin/lib/bm-transform.cjs` - `suppressNudge` + the sentinel constants and the line-anchored `NUDGE_BLOCK_RE`; exported alongside the existing helpers.
- `bin/build-bm.cjs` - `SUPPRESS_EXCLUDE` set, the `if (!SUPPRESS_EXCLUDE.has(rel)) text = suppressNudge(text)` pass in `generate()`, and the extended require + module.exports.
- `tests/build-bm-drift.test.cjs` - the whitelist-walk `expectedText` model now imports and applies `suppressNudge`/`SUPPRESS_EXCLUDE` (see Deviations).
- `dist/bm/**` - regenerated byte-mirror for every changed source file; `node bin/build-bm.cjs --check` passes.

## Decisions Made

- The plan's illustrative anchor pinned the sentinel at column 0, but the shipped block is indented 8 spaces inside the `case 'hook'` switch. A strict column-0 anchor would have silently no-op'd, leaving the nudge in dist/bm. Used `^[ \t]*` leading-whitespace tolerance so the anchor matches the real indented block AND the plan's column-0 unit fixture, while still requiring the sentinel to open the line's content (so a quoted-string sentinel is spared).
- Kept `SUPPRESS_EXCLUDE` as the primary self-protection (not just line-anchoring): the transform's own source and the sentinel-bearing test are excluded from the pass, so their dist/bm copies keep the literals and cannot be corrupted even if the anchor were ever weakened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] build-bm-drift whitelist-walk model omitted the new transform pass**
- **Found during:** Post-Task-2 regression sweep of the test suite.
- **Issue:** `tests/build-bm-drift.test.cjs` independently re-derives the expected per-file transform (`expectedText`) and asserts it byte-equals dist/bm. It applied only `rewriteCommandRefs` and `stampHookFallback`, so once `suppressNudge` landed it flagged `bin/gsd-tools.cjs` as drifted (`transform: bin/gsd-tools.cjs`). This is the intended failure of a model that had gone out of lockstep with the build, not a bug in suppressNudge.
- **Fix:** Import `suppressNudge` and `SUPPRESS_EXCLUDE` from the build and add the same `UNLESS-excluded` guard to `expectedText`, so the drift model and `generate()` stay single-sourced.
- **Files modified:** tests/build-bm-drift.test.cjs (+ dist/bm mirror)
- **Verification:** `node tests/build-bm-drift.test.cjs` passes; full suite 45/45.
- **Committed in:** 7d99c7a

---

**Total deviations:** 1 auto-fixed (1 blocking model-sync). No scope creep.

## Threat Model Coverage

- T-14-08 (tampering, dist/bm re-adds/drops the nudge): mitigated. Suppression is single-sourced in `bm-transform.cjs` and applied by `generate()`; `node bin/build-bm.cjs --check` fails any hand-edited dist/bm; nudge-emission + bm-parity gate it.
- T-14-09 (over-strip breaks bm gsd-tools.cjs, or the transform corrupts its own source): mitigated. Line-anchored exact-literal strip + `SUPPRESS_EXCLUDE` (excludes bm-transform.cjs and the sentinel test); idempotent; `node --check` asserts both `dist/bm/bin/gsd-tools.cjs` and `dist/bm/bin/lib/bm-transform.cjs` are valid JS.
- T-14-SC (package-manager installs): not applicable. Node built-ins only; no installs.

## Known Stubs

None. suppressNudge is live in the build, dist/bm is regenerated, and the drift gate enforces it.

## Verification

- `node bin/build-bm.cjs --check` - PASS (committed dist/bm matches a fresh build).
- `node tests/nudge-emission.test.cjs` - PASS.
- `node tests/bm-parity.test.cjs` - PASS (byte-parity intact).
- `node --check dist/bm/bin/gsd-tools.cjs` and `node --check dist/bm/bin/lib/bm-transform.cjs` - PASS (no self-corruption).
- `grep -c BM-NUDGE dist/bm/bin/gsd-tools.cjs` - 0.
- Full test suite: 45/45 pass.

## Self-Check: PASSED

- FOUND: tests/nudge-emission.test.cjs
- FOUND: bin/lib/bm-transform.cjs (suppressNudge)
- FOUND: bin/build-bm.cjs (SUPPRESS_EXCLUDE)
- FOUND: dist/bm/bin/gsd-tools.cjs (nudge removed)
- FOUND: commit 166b403 (Task 1 transform)
- FOUND: commit 8be9648 (Task 2 test)
- FOUND: commit 7d99c7a (Rule 3 drift-model fix)

---
*Phase: 14-backward-compatibility-and-coexistence*
*Completed: 2026-07-11*
