---
phase: 15-buildomator-identity-and-communications
plan: 03
subsystem: bm-build
tags: [branding, build-bm, drift-test]
requires: []
provides: [fixed-bm-description]
affects: [bin/build-bm.cjs, tests/build-bm-drift.test.cjs]
tech-stack:
  added: []
  patterns: [authoritative-fixed-identity-string]
key-files:
  created: []
  modified:
    - bin/build-bm.cjs
    - tests/build-bm-drift.test.cjs
decisions:
  - "bm plugin description is a fixed authoritative string, not derived from the gsd description"
metrics:
  duration: "~4m"
  completed: 2026-07-12
requirements: [BRAND-01]
---

# Phase 15 Plan 03: Fixed bm Description Summary

Decoupled the generated bm plugin.json description from the gsd source description by replacing the derived-and-prefixed string in `stampBmManifest` with a fixed authoritative Buildomator string, and updated the drift unit test to assert it.

## What Was Built

- **`stampBmManifest` fixed description** (`bin/build-bm.cjs`): The old derivation `'Buildomator -- ' + description.replace(/^Get Shit Done -- /, '')` was removed. It now sets `description` to the fixed string `"Buildomator -- structured workflow plugin for Claude Code with planning, execution, verification, and MCP-backed project state"`. Because the input description is no longer read, once plan 15-02 flips the gsd description to Buildomator-worded, the bm description can no longer double to `"Buildomator -- Buildomator -- ..."` nor leak a `(legacy /gsd:)` clause. name/displayName/version/mcpServers rekey behavior is unchanged.
- **Drift test assertion** (`tests/build-bm-drift.test.cjs`): The `stampBmManifest` description check now asserts the exact fixed string. The `SRC_MANIFEST` mock and all other checks are untouched.

## Verification

- Task 1 behavior gate (inline node -e): for a source description already containing `Buildomator -- ` and `(legacy /gsd:)`, the result contains no `Buildomator -- Buildomator`, no `legacy /gsd:`, and keeps the `Buildomator -- ` prefix. Passed.
- `node -c bin/build-bm.cjs` parses; no em-dashes in the emitted string.
- `node tests/build-bm-drift.test.cjs` exits 0 (all checks pass).

## TDD Notes

Task 1 was `tdd="true"`. RED was confirmed first: the pre-change code failed the behavior gate (threw `doubled`). After the fix the gate passed (GREEN). Because the plan structures the impl (Task 1, `fix`) and the test update (Task 2, `test`) as separate atomic tasks, the commits are ordered impl-then-test rather than test-then-impl; the inline behavior gate served as the RED/GREEN check for Task 1.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `ba2ab4a` fix(15-03): use fixed bm description in stampBmManifest
- `91530f9` test(15-03): assert fixed bm description in drift test

## Threat Surface

Addresses T-15-07 (doubled/legacy-clause bm description reaching users) and T-15-08 (bm identity silently derived from gsd wording): the derivation is removed and the bm description is now authoritative and independent. No new security surface introduced.

## Notes for Wave 2

This is the [BLOCKING] code-adjacent edit that must precede the dist/bm regen in plan 15-04. The committed dist/bm tree is NOT regenerated here (the drift test builds into a temp dir against a mock manifest), so plan 15-04 still owns the committed-tree regen and its gates.

## Self-Check: PASSED

- `bin/build-bm.cjs` modified, committed `ba2ab4a` — verified in git log
- `tests/build-bm-drift.test.cjs` modified, committed `91530f9` — verified in git log
- `15-03-SUMMARY.md` present on disk and committed
