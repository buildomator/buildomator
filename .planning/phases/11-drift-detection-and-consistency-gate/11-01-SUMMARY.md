---
phase: 11-drift-detection-and-consistency-gate
plan: "01"
subsystem: bin/lib
tags: [semantic-dup, minhash, lcs, drift-detection, tdd]
dependency_graph:
  requires: []
  provides: [bin/lib/semantic-dup.cjs, tests/semantic-dup.test.cjs]
  affects: [plan-11-02, plan-11-03, plan-11-04]
tech_stack:
  added: []
  patterns:
    - native MinHash+LCS structural near-clone detection (ported from @vibedrift/cli@0.14.4)
    - seeded FNV-1a permutation table (PERM_SEEDS) for deterministic MinHash
    - brace-balanced regex over conventions.blankSpans() for function extraction
    - rolling Int32Array LCS rows (memory-light, Pitfall 4 avoidance)
key_files:
  created:
    - bin/lib/semantic-dup.cjs
    - tests/semantic-dup.test.cjs
  modified: []
decisions:
  - "MIN_BODY_TOKENS=15 and FLAG_THRESHOLD=0.7 are calibration-confirmed — no adjustment needed on gsd-plugin repo (signal-rich, not dominated by boilerplate)"
  - "26.6% of raw pairs are CJS/SDK dual-resolver (vs ~38% estimate); regex extractor is more precise than tree-sitter so extracts fewer tiny functions"
  - "No threshold change committed — calibration Task 3 ran clean; thresholds already tuned"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-27"
  tasks_completed: 3
  files_changed: 2
---

# Phase 11 Plan 01: MinHash+LCS Structural Near-Clone Detector Summary

Native MinHash+LCS structural near-clone detector with ported constants, TDD-green, calibrated on gsd-plugin repo (79 pairs, 617ms, signal-rich top-N).

## Objective Achieved

Built `bin/lib/semantic-dup.cjs` — DRIFT-05 layer 3 of the Phase 11 native sweep. The module is pure CJS, zero runtime deps, never-throws, deterministic, and honors all Phase 10 path-safety/DoS contracts.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Write failing tests (RED) | TDD RED | b6ff1c2 | tests/semantic-dup.test.cjs |
| 2 | Implement semantic-dup.cjs (GREEN) | TDD GREEN | 768158b | bin/lib/semantic-dup.cjs |
| 3 | Calibrate on gsd-plugin repo | auto | (no change — no commit) | n/a |

## TDD Gate Compliance

- RED gate (test commit): b6ff1c2 — `test(11-01): add failing tests for semantic-dup detector`
- GREEN gate (feat commit): 768158b — `feat(11-01): implement MinHash+LCS structural near-clone detector`
- REFACTOR gate: not needed (thresholds required no change)

## Calibration Results (Task 3)

Ran detector on gsd-plugin repo (442 files, ~107k lines):

- **79 total pairs** detected in **617ms**
- **CJS/SDK dual-resolver pairs: 21 (26.6%)** — slightly less than the research estimate of ~38% because the regex extractor (without tree-sitter) extracts fewer short helper functions that are below the MIN_BODY_TOKENS floor. These 21 pairs will be suppressed by the plan 11-02 allowlist.
- **Non-dual-resolver pairs: 58** — the top findings are genuinely signal-rich:
  - `sanitizePaths` copied verbatim between `bin/lib/conventions.cjs` and `bin/lib/drift.cjs` (real drift, 1.000 similarity)
  - `escapeRegex` near-cloned as `escapePowerShellSingleQuoted`/`escapePosixDoubleQuoted`/`escapeSingleQuotedShellLiteral` in shell-command-projection.cjs (structural clones, 1.000)
  - `extractCanonicalPlanId` duplicated in `core.cjs` and `phase.cjs` (real drift, 1.000)
  - `_phaseDirEntries`/`_phaseDirNames` structural clones in init.cjs/roadmap.cjs (1.000)
  - Test harness `check()` helper duplicated across test files (expected/intentional pattern)
  - `walk` function duplicated across test files (expected)
- **Threshold decision: no change.** MIN_BODY_TOKENS=15 and FLAG_THRESHOLD=0.7 produce a signal-rich ranking — NOT dominated by boilerplate. First run validates Assumption A2 (calibration task confirms the parameters port cleanly).

## Verification Gates Passed

- `node tests/semantic-dup.test.cjs` exits 0 (18/18 checks green)
- Exports: `detect`, `buildShingles`, `minHashSignature`, `findLshCandidatePairs`, `lcsSimilarity`, `findDuplicatePairs` — all present and functions
- Never-throw: `detect(null)` → `{ skipped:true, pairs:[], suppressed:[] }`
- Zero new runtime deps: only `node:fs`, `node:path`, `./conventions.cjs`
- No `Math.random` in code (only in comments noting the absence)
- Calibration one-liner runs clean: 79 pairs, 617ms, no exception

## Deviations from Plan

None — plan executed exactly as written.

The only notable observation: CJS/SDK dual-resolver pair count was 26.6% (not ~38% as estimated in RESEARCH Pitfall 2). This is not a deviation — the research estimate was based on tree-sitter extraction; our regex extractor is slightly more precise about excluding very short helpers below MIN_BODY_TOKENS. The dual-resolver pairs ARE present in the output and will be suppressed by plan 11-02's allowlist.

## Key Decisions

1. **MIN_BODY_TOKENS=15, FLAG_THRESHOLD=0.7 confirmed** — calibration on the real repo confirms these values produce a signal-rich ranking. No adjustment needed.
2. **Function extraction approach** — brace-balanced regex over `conventions.blankSpans()` is sufficient for advisory-tier detection. The test harness `check()` pattern appearing as a finding is expected (it IS a structural near-clone across test files, intentional).
3. **Glob matching implementation** — simple `*`/`**` to regex conversion (not a full glob engine) per RESEARCH §Alternatives Considered. Sufficient to match the CJS/SDK pair-allowlist patterns.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced. The module reads arbitrary repo source files but reuses `conventions.sanitizePaths` + `MAX_SCAN_BYTES` (T-11-01, T-11-02, T-11-03) per the plan's threat register. No new threat surface beyond what the plan's threat model already covers.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| bin/lib/semantic-dup.cjs | FOUND |
| tests/semantic-dup.test.cjs | FOUND |
| 11-01-SUMMARY.md | FOUND |
| commit b6ff1c2 (RED) | FOUND |
| commit 768158b (GREEN) | FOUND |
