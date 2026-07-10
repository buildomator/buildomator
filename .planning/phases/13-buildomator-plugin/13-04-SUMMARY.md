---
phase: 13-buildomator-plugin
plan: 04
subsystem: bm-build-transform
tags: [buildomator, census, fail-closed, drift-gate, D-06, D-08, WR-01, WR-04]
requires:
  - "bin/build-bm.cjs generate-and-stamp build with --check drift gate (Phase 12)"
  - "broadened gsd:(?!/) rewrite + exported STAMP_EXCLUDE/COMMAND_REWRITE_EXCLUDE (13-03)"
provides:
  - "fail-closed per-class census detector in bm-parity: positive control proves each gsd-leak class is flagged against raw text, then a real dist/bm scan (skipping STAMP_EXCLUDE) proves zero leaks"
  - "BM_DIST_DIR override on build-bm.cjs for BOTH build output and --check diff target, so integration tests operate on an isolated tree"
  - "race-free bm test suite: bm-transform + build-bm-drift + bm-parity pass when run together, not only in isolation"
affects:
  - "tests/bm-parity.test.cjs (census replaces the blanket /gsd: grep)"
  - "tests/build-bm-drift.test.cjs (entire suite isolated via BM_DIST_DIR)"
  - "bin/build-bm.cjs (main + check honor BM_DIST_DIR)"
  - ".github/workflows/install-smoke.yml (plan-id removed)"
  - "dist/bm (regenerated)"
tech-stack:
  added: []
  patterns:
    - "Fail-closed census: a pure detectViolations(text) matched by direct anchored per-class patterns against RAW text, proven by a positive control that flags each planted class and spares an allow-listed-only input, then run over the real artifact"
    - "BM_DIST_DIR isolates the build MECHANISM tests from the committed artifact so concurrent readers never observe a half-written tree; the committed-artifact gate lives in the parity --check case"
key-files:
  created: []
  modified:
    - "tests/bm-parity.test.cjs"
    - "tests/build-bm-drift.test.cjs"
    - "bin/build-bm.cjs"
    - ".github/workflows/install-smoke.yml"
    - "dist/bm (regenerated)"
decisions:
  - "Match each violation class with a direct anchored pattern against raw text (never pre-strip allow-listed tokens): cache-fallback and agent-ref are substring-supersets of allow-listed tokens, so pre-stripping would destroy the very violation (D-08)"
  - "Case-sensitive namespace-prefix pattern gsd:[a-z] spares uppercase GSD: branding markers, gsd:// URIs, and the regex-escaped gsd:\\/ in mcp/server.cjs, mirroring the case-sensitive rewrite"
  - "Extend BM_DIST_DIR to redirect the build OUTPUT (not just the --check diff target) so the whole drift suite runs isolated; the plan scoped only the tamper case, but the deeper race was every drift runBuild() rewriting the committed tree that bm-parity reads"
metrics:
  duration: "~30 min"
  completed: "2026-07-10"
  tasks: 2
  files_modified: 5
---

# Phase 13 Plan 04: Fail-Closed bm Leak Census + Race-Free Suite Summary

Replaced the ad-hoc zero-leak `/gsd:` grep with a fail-closed census that is proven to FLAG each gsd-leak class (cache-fallback, agent-ref, namespace-prefix, sanitizer-literal) against raw text via a positive control, then run against the real `dist/bm` (skipping STAMP_EXCLUDE, scanning `mcp/server.cjs`) to prove zero leaks; made the drift suite race-free by routing its build+inspect cycle through an isolated `BM_DIST_DIR` tree so it never mutates the committed `dist/bm` that `bm-parity` reads concurrently; and removed the plan-id hygiene leak from `install-smoke.yml`.

## What Was Built

### Task 1: Fail-closed census in bm-parity.test.cjs
- Added a pure `detectViolations(text)` that matches four violation classes with direct, anchored patterns against the RAW (unstripped) text, never pre-removing allow-listed tokens:
  - `cache-fallback`: `includes('cache/gsd-plugin/gsd')` (a literal, so the allow-listed `gsd-plugin` substring cannot hide it).
  - `agent-ref`: `/gsd:gsd-[a-z0-9-]+/` (colon-then-`g`, never collides with `gsd://` or a `gsd-<file>` filename).
  - `namespace-prefix`: `/gsd:[a-z]/` case-sensitive (covers `/gsd:x`, agent refs, and `name: gsd:x`; spares `gsd://`, the regex-escaped `gsd:\/` in `mcp/server.cjs`, `name:'gsd'`, and uppercase `GSD:` branding markers).
  - `sanitizer-literal`: `includes('/gsd[:-]')` (bracketed regex source, unambiguous).
- Positive control (durable RED proof): each of the four synthetic inputs is asserted flagged as its class; an allow-listed-only input (including a `<!-- GSD:project-start -->` branding marker and the escaped `gsd:\/\/` URI form) yields zero flags.
- Real scan: enumerates every `dist/bm` text file, skips STAMP_EXCLUDE and binary files via `isTextFile`, runs `detectViolations` on the raw bytes, asserts zero aggregate violations. `mcp/server.cjs` is scanned and passes (URI-form `gsd:` only).
- Removed the blanket `execFileSync('grep', ['-rIl', '/gsd:', OUT])` case (the census real-scan is its strictly stronger, STAMP_EXCLUDE-aware replacement) and dropped the now-unused `execFileSync` import.
- Imports switched to `STAMP_EXCLUDE, isTextFile` (added), `shouldExclude` (kept).
- Commit `7d18194`.

### Task 2: BM_DIST_DIR isolation (WR-01) + install-smoke hygiene (WR-04) + regenerate
- `bin/build-bm.cjs`: `check()` reads the diff target from `process.env.BM_DIST_DIR` (default `dist/bm`); `main()` reads the build output dir from the same env var and skips the shared marketplace version sync when overridden. Both doc comments updated.
- `tests/build-bm-drift.test.cjs`: the whole suite now builds into and inspects an isolated `mkdtemp` tree via `BM_DIST_DIR` (routed through `runBuild()`), cleaned up in the footer. The tamper case tampers that isolated tree, never the committed `dist/bm`.
- `.github/workflows/install-smoke.yml`: reworded the `bm-package-smoke` comment to drop `(from plan 12-01)`; `D-10/D-11/D-12` decision refs and the `BUILD-03` requirement id are retained (not plan-id metadata).
- Regenerated `dist/bm`.
- Commit `7b2c891`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended BM_DIST_DIR to redirect the build OUTPUT, not just the --check diff target, and isolated the whole drift suite**
- **Found during:** Task 2 verification of the plan's core success criterion (full suite green when run together).
- **Issue:** The plan scoped WR-01 to the drift tamper case only ("keep generate() writing to a fresh temp; only the diff target becomes overridable"). Fixing just the tamper case still left the suite red under concurrency: `build-bm-drift`'s other integration cases call `runBuild()` (a full build) which `rmSync`s and rewrites the committed `dist/bm`, and `bm-parity` reads that same tree concurrently. Observed two transient failures in `bm-parity`: an `ENOENT` in the census real-scan (reading a file mid-`rmSync`) and a spurious `--check` drift (comparing against a half-written tree).
- **Fix:** `main()` now honors `BM_DIST_DIR` for the build output too (skipping the shared marketplace sync when overridden), and `build-bm-drift` routes every build+inspect through one isolated `mkdtemp` tree. The committed-artifact drift gate remains covered by `bm-parity`'s `--check` case, which reads the committed tree the drift suite no longer touches. This matches the reviewer's WR-01 guidance ("add a --out/env override to build-bm.cjs so the integration case never touches the real committed tree").
- **Files modified:** bin/build-bm.cjs, tests/build-bm-drift.test.cjs (folded into Task 2)
- **Commit:** 7b2c891
- **In scope:** directly required to satisfy this plan's stated success criterion; no product runtime behavior changed (BM_DIST_DIR is only ever set by tests).

## Verification Results

- `node tests/bm-parity.test.cjs` passes: positive control flags all four classes against raw text, allow-listed-only case clean, real `dist/bm` scan (minus STAMP_EXCLUDE, including `server.cjs`) zero violations; the blanket `/gsd:` grep case is gone.
- `node tests/build-bm-drift.test.cjs` passes; the tamper case runs against the isolated `BM_DIST_DIR` tree.
- `node bin/build-bm.cjs --check` exits 0.
- Concurrency stress: 20 rounds of `bm-transform` + `build-bm-drift` + `bm-parity` run together, 0 failures; committed `dist/bm` not mutated by the stress run.
- `grep -rn 'from plan\|12-01\|13-0' install-smoke.yml (source + dist/bm copy)`: clean.

## TDD Gate Compliance

Task 1 was `tdd="true"` but is a test-infrastructure task: the detector (`detectViolations`) lives inside the test file alongside its positive-control assertions, so there is no separate product `feat` commit. The positive control IS the durable fail-closed proof (it would fail RED if the detector were broken or pre-stripped a class). Committed once as `test(13-04)` `7d18194`.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/13-buildomator-plugin/13-04-SUMMARY.md`.
- Commits present: 7d18194 (Task 1), 7b2c891 (Task 2).
- STATE.md / ROADMAP.md were NOT modified (owned by the orchestrator).
