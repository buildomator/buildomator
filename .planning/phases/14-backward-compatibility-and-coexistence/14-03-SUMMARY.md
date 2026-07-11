---
phase: 14-backward-compatibility-and-coexistence
plan: 03
subsystem: coexistence
tags: [hooks, coexistence, single-fire, deprecation-nudge, run-bash-hook, checkpoint]

requires:
  - phase: 14-02
    provides: "bin/lib/coexist.cjs pluginIdentity/markBmActive/isBmActive/shouldYield"
  - phase: 13
    provides: "bm build path stamp (cache/gsd-plugin/gsd -> bm) that pluginIdentity keys on"
provides:
  - "Live single-fire election wired into both shared hook dispatch points (gsd-tools.cjs case 'hook' + run-bash-hook.cjs)"
  - "run-bash-hook.cjs buffers stdin once and forwards the exact bytes to the bash child (validate-commit exit-2 block preserved through the bm copy)"
  - "hooks.json election classification for every entry (elected via one of two dispatches, or read-only advisory JS detector)"
  - "gsd SessionStart /bm: + v5.0 deprecation nudge, sentinel-wrapped for Plan 04 suppression"
affects: [14-04]

tech-stack:
  added: []
  patterns:
    - "single-sourced election at two shared dispatch points so a hook added through either is elected automatically"
    - "buffer-stdin-once-then-forward: fd 0 drained a single time, session_id parsed for the election, exact bytes replayed to the bash child via spawnSync input"
    - "exact-literal sentinel comments (BM-NUDGE-START/END) bracketing a suppressible code block for a downstream byte transform"

key-files:
  created:
    - tests/hook-single-fire.test.cjs
  modified:
    - bin/gsd-tools.cjs
    - hooks/run-bash-hook.cjs
    - hooks/hooks.json
    - bin/lib/checkpoint.cjs

key-decisions:
  - "Read hook stdin once at the top of case 'hook' and share it plus the shouldYield decision with every branch, because fd 0 can only be drained once."
  - "Guard each of the four state-mutating branches with its own shouldYield call (not a single shared boolean) so the election is self-documenting per branch and grep-visible."
  - "The stop branch mutates no shared state but is still elected for uniformity, so 'every merged hook is elected' stays literally true at the single dispatch point."
  - "run-bash-hook forwards stdin via spawnSync input (stdio[0] switched from inherit to pipe) so validate-commit still parses tool_input.command and returns its exit 2."

patterns-established:
  - "Election-at-dispatch: wire the run-vs-yield check once per shared launcher rather than per hook, so future hooks inherit it."
  - "Nudge exemption: emit the deprecation notice before the yield so a both-active gsd session still shows it while handing off the stateful work."

requirements-completed: [COMPAT-01, COMPAT-02, COMPAT-04]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 14 Plan 03: Live Single-Fire Election + Deprecation Nudge Summary

**Coexistence election wired into both shared hook dispatch points so a both-active session collapses to one effective fire across every merged hook, plus a sentinel-wrapped gsd SessionStart /bm: + v5.0 deprecation nudge.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-11T21:10:00Z (approx)
- **Completed:** 2026-07-11T21:45:34Z
- **Tasks:** 3 (plus one Rule 1 pre-req fix)
- **Files modified:** 4 source + 1 new test (+ dist/bm mirrors)

## Accomplishments

- Wired `coexist.shouldYield` into `bin/gsd-tools.cjs case 'hook'`: stdin is read once, the bm copy self-announces via `markBmActive`, and each of the four state-mutating branches (session-start, post-tool-use, pre-compact, stop) yields when the bm marker is present. A gsd-only session has no marker, so behavior is unchanged (COMPAT-01).
- Wired the same election into `hooks/run-bash-hook.cjs`, the single launcher for the three bash hooks (session-state, validate-commit, phase-boundary), making "fires exactly once" literal for them. The stdin buffer is forwarded to the bash child so validate-commit still receives `tool_input.command` and its exit-2 block is single-sourced through the bm copy (COMPAT-02).
- Classified every `hooks.json` entry in the top-level description: elected via one of the two dispatch points, or a read-only advisory JS detector that is idempotent and safe to double-run.
- Added the gsd SessionStart `/bm:` + `v5.0` deprecation nudge, emitted before the yield (D-06 exemption) and wrapped in exact-literal `BM-NUDGE-START` / `BM-NUDGE-END` sentinels for Plan 04 suppression (COMPAT-04).
- New `tests/hook-single-fire.test.cjs` proves gsd-only no-op, both-active single fire for both dispatch points, and the bounded SessionStart residual.

## Task Commits

1. **Pre-req fix (Rule 1): checkpoint safeReadFile import** - `e5c2947` (fix)
2. **Task 1: single-fire test (RED)** - `ac4d308` (test)
3. **Task 2: wire election into both dispatch points + classify hooks.json** - `2419e6f` (feat)
4. **Task 3: gsd SessionStart deprecation nudge** - `f9eded4` (feat)

## Files Created/Modified

- `tests/hook-single-fire.test.cjs` (new) - spawns both dispatch points with/without a bm marker; asserts gsd-only write/run, marker-present yield (no HANDOFF write; bash hook not run; validate-commit not blocking), and the shouldYield residual truth-table. Guards the bash cases on `bash` availability.
- `bin/gsd-tools.cjs` - election setup at the top of `case 'hook'` (single stdin read, identity, markBmActive-when-bm), a `shouldYield` guard per state-mutating branch, and the sentinel-wrapped nudge in session-start.
- `hooks/run-bash-hook.cjs` - requires coexist; buffers stdin once, self-announces when bm, yields when the gsd copy sees the marker, and forwards the buffered bytes to the bash child.
- `hooks/hooks.json` - top-level description now documents the two-dispatch election and classifies every entry.
- `bin/lib/checkpoint.cjs` - import fix (see Deviations).
- `dist/bm/**` - regenerated byte-mirror for every changed source file; `node bin/build-bm.cjs --check` passes.

## Decisions Made

- Share one stdin read and one election setup across all four gsd-tools branches (fd 0 drains once), but call `shouldYield` per branch so each guard is explicit and grep-visible.
- Elect the read-only `stop` branch for uniformity even though it mutates no shared state, keeping the "every merged hook elected at the single dispatch point" invariant literally true.
- Forward stdin to the bash child via the `spawnSync` `input` option (stdin switched from `inherit` to a pipe) so the election can read session_id without starving hooks that consume stdin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] checkpoint.cjs imported a non-exported symbol, silently disabling auto-checkpoint**
- **Found during:** Task 1 (building the single-fire test's HANDOFF-write signal)
- **Issue:** `bin/lib/checkpoint.cjs` destructured `safeReadFile` from `./core.cjs`, but `core.cjs` does not export it. `safeReadFile` was therefore `undefined`, so `generateCheckpoint` threw on every STATE.md read, fell back to a trivial `phase:null/task:null` skeleton, and the trivial-skeleton guard then skipped every `auto-postool` / `auto-compact` write. The periodic HANDOFF.json checkpoint (the microcompact-gap bridge) never wrote in a real project. This also made the plan's intended test signal (HANDOFF write vs no-write) impossible until fixed.
- **Fix:** Import `platformReadSync` aliased as `safeReadFile` from `./shell-command-projection.cjs`, matching the idiom already used in verify.cjs, frontmatter.cjs, and profile-output.cjs.
- **Files modified:** bin/lib/checkpoint.cjs (+ dist/bm mirror)
- **Verification:** `generateCheckpoint` now returns the real phase/task from STATE.md; `tests/checkpoint-write-guards.test.cjs` and `tests/session-start-skip-trivial-handoff.test.cjs` still pass; full suite 44/44.
- **Committed in:** e5c2947

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix was a prerequisite for a meaningful COMPAT-01/02 test and repairs a genuine latent bug (auto-checkpoint was silently dead). Minimal one-line import change matching existing patterns. No scope creep.

## Issues Encountered

- The bm byte-mirror rewrites `/gsd:` to `/bm:` inside the nudge text, producing a nonsensical "renamed to /bm:" line in `dist/bm`. This is expected and harmless: Plan 04's `suppressNudge` transform strips the whole `BM-NUDGE-START..END` block from the bm package, which is exactly why the sentinels exist. `bm-parity` and the drift check both pass.

## Threat Model Coverage

- T-14-06 (self-DoS, hook double-fire): mitigated. Both shared dispatch points enforce the single-sourced election; every hooks.json entry is classified; "exactly once" is literal for the three named bash hooks.
- T-14-12 (tampering, run-bash-hook eats stdin): mitigated. Stdin is buffered once and the exact bytes are forwarded to the bash child via `spawnSync` `input`; validate-commit's exit-2 block is preserved through the bm copy.
- T-14-07 (self-DoS, nudge blocks the command): mitigated. Nudge is stdout-only and never exits non-zero; acceptance asserts exit 0.
- T-14-01 (tampering, session_id -> marker path): mitigated upstream in coexist (Plan 02); both dispatch points only pass session_id through.

## Known Stubs

None. The election is live at both dispatch points and the nudge is emitted. Plan 04's `suppressNudge` byte transform (stripping the sentinel block from the bm package) is explicitly downstream scope, not a stub of this plan.

## Next Phase Readiness

- COMPAT-01, COMPAT-02, COMPAT-04 satisfied and covered by `tests/hook-single-fire.test.cjs`.
- The `BM-NUDGE-START` / `BM-NUDGE-END` sentinels are in place for Plan 04's suppression transform.
- No blockers.

## Self-Check: PASSED

- FOUND: tests/hook-single-fire.test.cjs
- FOUND: bin/gsd-tools.cjs (modified)
- FOUND: hooks/run-bash-hook.cjs (modified)
- FOUND: hooks/hooks.json (modified)
- FOUND: bin/lib/checkpoint.cjs (modified)
- FOUND: .planning/phases/14-backward-compatibility-and-coexistence/14-03-SUMMARY.md
- FOUND: commit e5c2947 (checkpoint fix)
- FOUND: commit ac4d308 (Task 1 test)
- FOUND: commit 2419e6f (Task 2 election)
- FOUND: commit f9eded4 (Task 3 nudge)

---
*Phase: 14-backward-compatibility-and-coexistence*
*Completed: 2026-07-11*
