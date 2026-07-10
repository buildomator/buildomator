---
phase: 13-buildomator-plugin
plan: 03
subsystem: bm-build-transform
tags: [buildomator, rebrand, transform, drift-gate, D-08, CR-01, CR-02]
requires:
  - "bin/build-bm.cjs generate-and-stamp build with --check drift gate (Phase 12)"
  - "bin/lib/bm-transform.cjs pure string helpers (13-01/13-02)"
provides:
  - "gsd:(?!/) namespace rewrite: slash commands, agent refs, frontmatter names flip to bm:"
  - "SDK headless-sanitizer literal /gsd[:-] -> /bm[:-] pass"
  - "STAMP_EXCLUDE + COMMAND_REWRITE_EXCLUDE exported exclusion sets"
  - "regenerated dist/bm where agent refs resolve to bm:gsd-<agent>"
affects:
  - "dist/bm (136 files re-transformed)"
  - "tests/build-bm-drift.test.cjs, tests/bm-parity.test.cjs (mirror the exclusions)"
tech-stack:
  added: []
  patterns:
    - "Single-sourced exclusion sets exported from build-bm.cjs, imported by both drift and parity tests so expectedText never diverges from generate()"
    - "Two independent string passes in rewriteCommandRefs (lookahead regex + exact-literal split/join), each idempotent"
key-files:
  created: []
  modified:
    - "bin/lib/bm-transform.cjs"
    - "bin/build-bm.cjs"
    - "tests/bm-transform.test.cjs"
    - "tests/build-bm-drift.test.cjs"
    - "tests/bm-parity.test.cjs"
    - "dist/bm (regenerated)"
decisions:
  - "Exclude mcp/server.cjs from the command rewrite entirely (not a regex special-case) so the escaped gsd:\\/\\/ URI form stays byte-identical (D-05)"
  - "Exclude CHANGELOG.md from both stamp and rewrite so shipped release history is preserved verbatim, not revisionist-rewritten (IN-01)"
  - "Scope both drift and parity /gsd: leak scans to skip COMMAND_REWRITE_EXCLUDE files, which retain /gsd: by design"
metrics:
  duration: "~25 min"
  completed: "2026-07-10"
  tasks: 2
  files_modified: 6
---

# Phase 13 Plan 03: Broadened bm Namespace Rewrite Summary

Broadened the bm transform from the leading-slash-anchored `/\/gsd:/g` to `gsd:(?!/)` so the 69 `subagent_type`/`type` agent references (`gsd:gsd-<agent>`) and agent/skill frontmatter `name:` fields flip to `bm:`, made a bm-only install spawn its own agents (BM-03), applied the hook cache-fallback stamp to every runtime carrier (CR-01), added the `/gsd[:-]` SDK headless-sanitizer literal pass (CR-02), and regenerated `dist/bm` with `mcp/server.cjs` and `CHANGELOG.md` preserved byte-identical.

## What Was Built

### Task 1 (TDD): Broadened namespace rewrite + sanitizer literal
- `COMMAND_REF_RE` widened from `/\/gsd:/g` to `/gsd:(?!\/)/g`, replacing matches with `bm:` (no leading slash in the match). This flips slash commands, `gsd:gsd-<agent>` agent refs, and `name: gsd:<x>` frontmatter while the negative lookahead spares `gsd://` MCP URIs.
- Added an independent exact-literal pass `/gsd[:-]` -> `/bm[:-]` via split/join for the SDK headless-prompt sanitizer (plain copy-through, no SDK rebuild). `gsd[` is not `gsd:`, so the two passes never interfere.
- Removed the now-obsolete `abcgsd:foo` sparing test case (a bare `gsd:` with no trailing slash flips under D-08).
- Rewrote the doc comment to describe the broadened scope and the `mcp/server.cjs` build-layer exclusion for the escaped `gsd:\/\/` form.
- RED commit `c773f08` (5 new cases failing), GREEN commit `17566af`.

### Task 2: Broad hook stamp + exclusion sets + regenerated dist/bm
- Replaced the 3-file `FALLBACK_STAMP_FILES` allowlist with an exported `STAMP_EXCLUDE` set. `stampHookFallback` now runs on every text file except the 8 files that legitimately embed the gsd-form cache literal, so every runtime carrier resolves to `cache/gsd-plugin/bm` (CR-01, D-08 extends D-04).
- Added an exported `COMMAND_REWRITE_EXCLUDE` set with a documented reason per member: `mcp/server.cjs` (D-05 byte-identity, escaped URIs), `CHANGELOG.md` (IN-01 shipped history), `tests/bm-parity.test.cjs` (census positive-control fixtures).
- `tests/build-bm-drift.test.cjs` imports both shared sets and mirrors `generate()` exactly in `expectedText`.
- Regenerated `dist/bm`: 133 `bm:gsd-<agent>` refs, frontmatter names and the SDK sanitizer literal flipped; `mcp/server.cjs` and `CHANGELOG.md` byte-identical.
- Commit `d715657`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped the two /gsd: leak scans to the intentional exclusions**
- **Found during:** Task 2 verification (and re-run of the pre-existing `tests/bm-parity.test.cjs`).
- **Issue:** Both `tests/build-bm-drift.test.cjs` ("no /gsd: leaks") and `tests/bm-parity.test.cjs` ("no /gsd: command token leaks") ran a blanket `/gsd:` scan over all of `dist/bm`. Task 2's intentional `COMMAND_REWRITE_EXCLUDE` decision (CHANGELOG.md shipped history per IN-01, the parity positive-control fixtures) means those files retain `/gsd:` by design, so the blanket scans reported false leaks. The parity scan's own comment already anticipated this: "If a genuine cross-plugin reference is ever intentional, it would need an explicit allowlist carved out here."
- **Fix:** Both scans now skip files in the shared `COMMAND_REWRITE_EXCLUDE` set (imported from `build-bm.cjs`, single source of truth). Regenerated the byte-copy of the modified `bm-parity.test.cjs` fixture in `dist/bm`.
- **Files modified:** tests/build-bm-drift.test.cjs (folded into Task 2), tests/bm-parity.test.cjs, dist/bm/tests/bm-parity.test.cjs
- **Commit:** d715657 (drift) and 140835a (parity)
- **In scope:** directly caused by this plan's exclusion decisions (Scope Boundary satisfied). This is NOT the fail-closed census hardening deferred to 13-04; it is the minimal allowlist carve-out the intentional exclusions require to keep the gate green.

## Verification Results

- `node tests/bm-transform.test.cjs` passes (D-08 scope, idempotent, escaped/URI cases).
- `node bin/build-bm.cjs --check` exits 0.
- `node tests/build-bm-drift.test.cjs` passes with the shared exclusion imports.
- `node tests/bm-parity.test.cjs` passes.
- `cmp mcp/server.cjs dist/bm/mcp/server.cjs` exits 0 (byte-identical, gsd:// URIs preserved).
- `cmp CHANGELOG.md dist/bm/CHANGELOG.md` exits 0 (history preserved verbatim).
- `cache/gsd-plugin/gsd` in dist/bm minus STAMP_EXCLUDE: empty.
- `gsd:gsd-` in dist/bm minus STAMP_EXCLUDE: none (agent refs flipped); `bm:gsd-` present (133 refs).
- `/gsd[:-]` remaining in dist/bm: none; `/bm[:-]` present in all three SDK carriers.

## TDD Gate Compliance

Task 1 followed RED -> GREEN: `test(13-03)` commit `c773f08` (5 cases failing against the `/gsd:`-only implementation), then `feat(13-03)` commit `17566af` (all green). No refactor commit needed.

## Notes for Next Plan (13-04)

The fail-closed census with a positive control, the test-race, and hygiene fixes remain for plan 13-04. The `COMMAND_REWRITE_EXCLUDE` and `STAMP_EXCLUDE` sets are now exported from `bin/build-bm.cjs` and can be imported by the census so it skips the same files (the plan already anticipated "the 13-04 census skips STAMP_EXCLUDE files").
