---
phase: quick-260716-0ao
plan: 01
subsystem: session-start-hook
tags: [bm, migration, session-start, coexistence, fail-soft]
requires:
  - bin/lib/coexist.cjs (pluginIdentity, shouldYield)
  - bin/build-bm.cjs (dist/bm regeneration)
provides:
  - bin/lib/bm-autoenable.cjs (autoEnableBm helper)
  - one-time bm auto-enable on gsd SessionStart
affects:
  - bin/gsd-tools.cjs (session-start hook)
  - dist/bm (regenerated, inert copy)
tech-stack:
  added: []
  patterns: [injectable-paths, atomic-temp-then-rename, one-time-marker, fail-soft-try-catch]
key-files:
  created:
    - bin/lib/bm-autoenable.cjs
    - tests/bm-autoenable.test.cjs
    - dist/bm/bin/lib/bm-autoenable.cjs
    - dist/bm/tests/bm-autoenable.test.cjs
  modified:
    - bin/gsd-tools.cjs
    - dist/bm/bin/gsd-tools.cjs
decisions:
  - "Marker means 'gsd has observed bm enabled at least once'; written on enable AND already-enabled paths, not on not-cached, so a later deliberate disable stands."
  - "require('os') locally inside the new block: os was neither imported nor used at the top of gsd-tools.cjs (plan assumption was incorrect)."
metrics:
  duration: ~9min
  completed: 2026-07-16
---

# Phase quick-260716-0ao Plan 01: One-time bm auto-enable from the gsd SessionStart hook Summary

One-time auto-enable of the Buildomator (bm) plugin from the gsd SessionStart hook via a fail-soft injectable helper, gated by a durable one-time marker that records "gsd has observed bm enabled" so a later deliberate disable is never overridden.

## What Was Built

**Task 1 (TDD): `bin/lib/bm-autoenable.cjs` + `tests/bm-autoenable.test.cjs`.**
`autoEnableBm({ cacheRoot, settingsPath, markerPath })` with injectable paths, wrapped entirely in try/catch and never throwing. Logic order: marker gate first (marker exists then no-op), cache scan for marketplaces holding a bm package, guarded settings read, already-enabled branch (writes marker, no settings change), enable branch (atomic temp-file-then-rename, marker written last). Marketplace preference: buildomator, then gsd-plugin, then remaining names sorted. Seven-case zero-dep spec using `node:assert` and per-test temp dirs.

**Task 2: wiring + dist/bm regeneration.**
A dedicated `if (hookIdentity === 'gsd') { try { ... } catch {} }` block in the session-start path, placed after the `shouldYield` break and alongside the sibling autoMigrate block. It computes cacheRoot, settingsPath, and a marker path outside the versioned cache (CLAUDE_PLUGIN_DATA override, else the homedir path), calls the helper, and writes a single reload notice to stderr when it acts. `dist/bm` regenerated: the block ships verbatim and is genuinely inert under bm identity.

## Correctness Points Preserved

- Marker written on the enable path AND the already-enabled path, but NOT on the not-cached path; marker gate checked first (Test 7 proves a manual-enable-then-disable is not re-enabled).
- Whole helper body in try/catch, never throws; missing or malformed settings.json is a swallowed no-op (Test 4).
- Atomic settings write: temp file in the same dir as settings.json, then rename; marker written only after the rename succeeds.
- Marker at a homedir path (or CLAUDE_PLUGIN_DATA), never under the versioned cache.
- New wiring is its own explicit gsd guard, not reliant on the earlier nudge-only guard; notice to stderr, never stdout.
- Helper testable with injected paths; tests use temp dirs, never the real ~/.claude.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `os` was not imported in bin/gsd-tools.cjs**
- **Found during:** Task 2
- **Issue:** The plan stated "os and path are already required at the top of gsd-tools.cjs (they are) so no new imports are needed." Verification showed `os` is neither required nor used anywhere in the file; the new block needs `os.homedir()`.
- **Fix:** Added `const os = require('os');` locally inside the new gsd-guarded try block, mirroring how the sibling autoMigrate block requires its module locally. Keeps the change self-contained and the block fully inert in dist/bm.
- **Files modified:** bin/gsd-tools.cjs (and the regenerated dist/bm/bin/gsd-tools.cjs)
- **Commit:** bfada96

### Note (not a deviation)

The build's command-ref transform rewrites `gsd:` to `bm:` in text, so the dist/bm helper's doc comment reads "smooth the /bm: to /bm: migration". This is the standard deterministic transform behavior on an inert doc comment; `node bin/build-bm.cjs --check` is green.

## Gate Results

| Gate | Result |
|------|--------|
| node tests/bm-autoenable.test.cjs | PASS (7/7) |
| node tests/coexist.test.cjs | PASS |
| node tests/nudge-emission.test.cjs | PASS |
| node bin/build-bm.cjs --check | PASS (no drift) |
| node bin/maintenance/check-version-alignment.cjs | PASS (4.1.0 aligned) |
| node -c bin/gsd-tools.cjs | parse OK |
| explicit gsd-guard regex (plan Task 2 verify) | PASS |

## TDD Gate Compliance

RED gate `test(...)` commit 1f24603 (failing spec, module missing), GREEN gate `feat(...)` commit 6ca90a5 (helper, 7/7 pass). No refactor needed.

## Commits

- 1f24603 test(quick-260716-0ao): add failing spec for bm auto-enable helper
- 6ca90a5 feat(quick-260716-0ao): add one-time bm auto-enable helper
- bfada96 feat(quick-260716-0ao): wire bm auto-enable into the gsd session-start hook

## Known Stubs

None.

## Self-Check: PASSED

All four created files exist on disk; all three commits (1f24603, 6ca90a5, bfada96) are present in git history.
