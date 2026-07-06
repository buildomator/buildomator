---
phase: 13-buildomator-plugin
plan: 02
subsystem: infra
tags: [ci, drift-gate, parity-test, hooks, mcp, plugin-packaging, releasing]

# Dependency graph
requires:
  - phase: 13-buildomator-plugin
    provides: the deterministic bm transform T (identity stamp + /gsd: -> /bm: rewrite + hook cache-fallback stamp) single-sourced in build-bm.cjs generate(), with a --check drift gate and re-exported helpers
provides:
  - Standalone command-inventory parity test (tests/bm-parity.test.cjs) proving skill/file inventory parity, zero /gsd: leaks, and byte-parity via --check
  - bm-build-drift CI job extended with the parity test so a stale or hand-edited dist/bm blocks the tag
  - bm-package-smoke CI job extended with dual-carrier hook-fallback assertions, a bm cache-path tripwire, and a dynamic gsd-vs-bm MCP tools/resources deep-equal
  - RELEASING.md rewritten to describe the current transform and its CI gates (the stale verbatim-gsd hook-fallback limitation removed)
affects: [14-coexistence, 15-branding, release-drift-gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CI-as-release-gate extended, not replaced (add steps to existing bm jobs; leave the gsd job byte-untouched)
    - Dynamic gsd-vs-bm surface comparison (deep-equal of sorted, non-empty arrays) instead of hardcoded tool/resource/count literals
    - Occurrence-count assertions over both runtime hook-fallback carriers as a CI runtime gate

key-files:
  created:
    - tests/bm-parity.test.cjs
  modified:
    - .github/workflows/check-drift.yml
    - .github/workflows/install-smoke.yml
    - RELEASING.md
    - dist/bm/** (regenerated so the shipped copies match)

key-decisions:
  - "Parity proof is a standalone tests/bm-parity.test.cjs (the discretion offered in CONTEXT), keeping the drift test focused on transform correctness and the parity test focused on inventory + zero-leak + --check"
  - "The MCP smoke step compares the two servers dynamically (sorted tool-name and resource-uri arrays, deep-equal and non-empty) with zero hardcoded names, URIs, or counts, so it stays valid as the surface evolves"
  - "The primary-path-wins tripwire now plants a marker at BOTH the legacy gsd and the stamped bm 9.9.9 cache paths, proving the primary CLAUDE_PLUGIN_ROOT wins over each fallback"

patterns-established:
  - "Zero-dep parity test enumerating via git ls-files + the build's own shouldExclude predicate, never a raw fs walk"
  - "Hook-fallback CI assertion counts exact literals in both carriers (hooks.json resolvers and the run-bash-hook launcher) so a regression in either fails the smoke job"

requirements-completed: [BM-01, BM-02, BM-03]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 13 Plan 02: Wire the bm parity proof into CI Summary

**CI is now the acceptance gate for the bm package: a new command-inventory parity test runs in bm-build-drift, bm-package-smoke proves the stamped hook fallbacks (both carriers) and an identical MCP tool/resource surface at runtime via dynamic comparison, and RELEASING.md describes the current transform instead of a fixed limitation.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-07
- **Tasks:** 2
- **Files modified:** 3 source files + 1 new test + regenerated dist/bm

## Accomplishments
- New standalone `tests/bm-parity.test.cjs` proving skill-inventory parity, full-file inventory parity, zero `/gsd:` leaks, and byte-parity via `build-bm.cjs --check`
- `bm-build-drift` (check-drift.yml) runs the parity test after `--check`, so a stale or hand-edited `dist/bm` blocks the release tag
- `bm-package-smoke` (install-smoke.yml) gained a dual-carrier hook-fallback-target assertion, a second (bm) cache-path tripwire, and a dynamic gsd-vs-bm MCP tools/resources deep-equal with no hardcoded surface facts
- RELEASING.md rewritten: the stale verbatim-gsd hook-fallback "known limitation" is gone, replaced by a description of the transform and its two CI gates
- The gsd `fresh-debian-install` smoke job is byte-untouched (all install-smoke diffs land inside the bm job)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/bm-parity.test.cjs (inventory + zero-leak + byte-parity gate)** - `de1fe73` (test, TDD)
2. **Task 2: Extend the bm CI jobs and update RELEASING.md** - `38b492b` (ci)

_Task 1 was a single test commit: the RED run confirmed the two failing cases (the new tracked test file was absent from the committed dist/bm), then regenerating dist/bm brought them green in the same commit so --check stays honest._

## Files Created/Modified
- `tests/bm-parity.test.cjs` - Zero-dep parity gate: skill inventory, full-file inventory (git ls-files + shouldExclude), `/gsd:` zero-leak scan (grep exit-1-means-clean), and a `--check` byte-parity spawn
- `.github/workflows/check-drift.yml` - bm-build-drift runs `node tests/bm-parity.test.cjs` after the `--check` step; no npm ci added; no other job touched
- `.github/workflows/install-smoke.yml` - bm-package-smoke: new hook-fallback-target step over both carriers, tripwire extended to the bm cache path, new dynamic MCP tools/resources parity step; gsd job untouched
- `RELEASING.md` - "How the bm package diverges from gsd" replaces the stale hook-fallback limitation; describes the three transform passes and the bm-build-drift + bm-package-smoke gates
- `dist/bm/**` - Regenerated so the shipped copies of the workflows, RELEASING.md, and the new test match source

## Decisions Made
- **Parity test is a standalone file, not folded into the drift test.** CONTEXT left this to discretion; separating keeps the drift test about transform correctness and the parity test about inventory completeness + zero-leak + the acceptance `--check`.
- **MCP smoke comparison is fully dynamic.** No `gsd_*` tool-name literals, no resource-URI literals, no counts in the assertion. Both packages ship byte-identical `mcp/server.cjs`, so a deep-equal of the two servers' sorted, non-empty tool and resource arrays is the proof and survives surface changes. Locally it reports 8 tools and 4 resources, matching the real server.
- **Dual tripwire.** The existing primary-path-wins step now plants the marker script at both the gsd and the stamped bm `9.9.9` cache paths, so the stamped bm fallback is covered by the same never-fires proof.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `/gsd:` reference introduced into RELEASING.md (describing the `/gsd:` -> `/bm:` rewrite) is correctly rebranded in the dist copy by the build, so the zero-leak scan stays clean.

## Full Verification Gate
```
node tests/bm-transform.test.cjs        -> PASS
node tests/build-bm-drift.test.cjs      -> PASS
node tests/bm-parity.test.cjs           -> PASS
node bin/build-bm.cjs --check           -> PASS (exit 0)
hook-fallback assertion (both carriers) -> PASS (hooks.json bm=17/gsd=0; launcher quoted bm=1/gsd=0, gsd-path=0)
MCP gsd-vs-bm deep-equal                -> PASS (8 tools, 4 resources, identical)
install-smoke gsd job diff              -> empty (byte-untouched)
RELEASING.md 'keeps the hardcoded'      -> 0 matches; 'cache/gsd-plugin/gsd' -> 0 matches
```

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BM-01/BM-02/BM-03 are CI-gated: bm-build-drift proves dist/bm is the exact transform of source with a complete command inventory; bm-package-smoke proves the stamped hook fallbacks and the identical MCP surface at runtime.
- Phase 14 (coexistence) can build on the distinct gsd/bm MCP keys and the now-per-plugin hook cache fallbacks; the parity test's zero-leak scan will need an allowlist carve-out when Phase 14 adds a `/gsd:` deprecation nudge.
- Phase 15 (branding prose) remains untouched.

## Self-Check: PASSED

---
*Phase: 13-buildomator-plugin*
*Completed: 2026-07-07*
