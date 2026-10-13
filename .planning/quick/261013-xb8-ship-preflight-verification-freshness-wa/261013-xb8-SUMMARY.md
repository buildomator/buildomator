---
phase: quick-261013-xb8
plan: 01
subsystem: ship-workflow
tags: [ship, preflight, verification, de-dash, bm-twin]
requires: []
provides: ["ship preflight sub-check 2b verification freshness warning"]
affects: [workflows/ship.md, dist/bm/workflows/ship.md]
tech-stack:
  added: []
  patterns: ["read-only git-query preflight warning, never blocks"]
key-files:
  created: []
  modified:
    - workflows/ship.md
    - dist/bm/workflows/ship.md
decisions:
  - "2b is read-only and warn-only: git log/rev-parse/rev-list queries, no write, no exit, no re-verification"
  - "rev-list guarded on non-empty VERIFIED_AT that differs from HEAD, so a missing or current report prints nothing"
metrics:
  duration: ~6min
  completed: 2026-10-14
---

# Phase quick-261013-xb8 Plan 01: Ship Preflight Verification Freshness Summary

Added a read-only sub-check 2b to the ship preflight that warns when the phase VERIFICATION.md was last committed before the current HEAD, and removed all seven em-dashes from workflows/ship.md; regenerated dist/bm and landed both files in one commit.

## What Was Built

- **Preflight sub-check 2b "Verification still current?"** inserted between items 2 and 3 of `<step name="preflight_checks">` in workflows/ship.md. It resolves the VERIFICATION.md report via `ls ${PHASE_DIR}/*-VERIFICATION.md`, takes its last-commit SHA with `git log -1 --format=%H -- "$REPORT"`, compares to `git rev-parse HEAD`, and on mismatch computes `AHEAD=$(git rev-list --count "$VERIFIED_AT"..HEAD)`. The prose warns with the ahead-count, points at `git log --oneline $VERIFIED_AT..HEAD`, and states explicitly it is a warning only (no block, no exit, no re-verification). Existing numbering 1/2/3/4/5 left untouched.
- **De-dashed ship.md**: all seven U+2014 occurrences (former lines 54, 61, 104, 278, 299, 304, 310) replaced with commas/colons. Whole-file scan confirms zero U+2014 and zero U+2013.
- **success_criteria** line extended to mention "verification freshness" (dash-free).
- **dist/bm twin regenerated** via `node bin/build-bm.cjs`; the bm copy carries the identical 2b check with namespace references rendered as /bm:.

## Verification (observed)

- `perl -CSD` dash count on workflows/ship.md: **0** (no U+2014, no U+2013). Same for dist/bm/workflows/ship.md: 0.
- `grep -cF 'git rev-list --count "$VERIFIED_AT"..HEAD'`: **1** in workflows/ship.md, **1** in dist/bm/workflows/ship.md.
- `grep -q 'Verification still current'` on workflows/ship.md: present.
- `node bin/build-bm.cjs --check`: printed `bm drift check: PASS (committed dist/bm matches a fresh build).`, **EXIT 0** on the committed tree.
- `git show --stat HEAD`: exactly two files changed, workflows/ship.md and dist/bm/workflows/ship.md; nothing under sdk/, bin/lib/, templates/, agents/, and no plugin.json or marketplace.json.
- gsd-bugs-housekeeping.rtf: still untracked and unmodified.

Note on the plan's `<automated>` one-liner: its leading `grep -c '... "$VERIFIED_AT"..HEAD'` uses a basic regex where `..` matches any two characters and returned a count of 0, which short-circuits the `&&` chain. The content is nonetheless correct, confirmed with `grep -cF` (fixed-string) = 1 per file, and build-bm --check verified exit 0 standalone.

## Deviations from Plan

None, plan executed as written. The design was fixed and followed exactly: no new SDK/CJS handler, no manifest entry, no template field, no verifier change, no version bump.

## Commit

- `a593fb7` fix(quick-261013-xb8): warn when ship verification predates HEAD, de-dash ship.md

## Self-Check: PASSED
- workflows/ship.md modified and committed: FOUND
- dist/bm/workflows/ship.md modified and committed: FOUND
- Commit a593fb7: FOUND (no Co-Authored-By trailer, no dashes in message)
