---
phase: 260714-coq
plan: 01
subsystem: runtime-fallback-resolution
tags: [hooks, coexistence, buildomator, marketplace-agnostic, bm-transform]
requires: []
provides:
  - Marketplace-agnostic plugin-root fallback in the runtime-critical carriers
  - Global newest-version-wins ordering across all marketplaces
  - Segment-based pluginIdentity (COMPAT-05 closed)
affects:
  - hooks/hooks.json
  - hooks/run-bash-hook.cjs
  - bin/lib/coexist.cjs
  - bin/check-plugin-update.sh
  - bin/lib/bm-transform.cjs
  - dist/bm
tech-stack:
  added: []
  patterns:
    - Union-then-sort marketplace scan (collect {version,path} across all marketplaces, sort the union descending, then build candidates)
    - Exact-literal FROM/TO pair list in stampHookFallback (one shape per carrier)
key-files:
  created:
    - tests/hook-fallback-resolution.test.cjs
  modified:
    - hooks/hooks.json
    - hooks/run-bash-hook.cjs
    - bin/lib/coexist.cjs
    - bin/check-plugin-update.sh
    - tests/coexist.test.cjs
    - bin/lib/bm-transform.cjs
    - tests/bm-transform.test.cjs
    - tests/build-bm-drift.test.cjs
    - tests/bm-parity.test.cjs
    - .github/workflows/install-smoke.yml
    - .github/workflows/check-drift.yml
    - dist/bm
decisions:
  - Kept the legacy cache/gsd-plugin/gsd slash-form transform pair so the deferred reference-doc literals and the coexist test fixtures keep stamping to bm (census stays green); the runtime carriers no longer use it.
  - Chose one distinct plugin-name literal per carrier (g='gsd', const pkgSegment = 'gsd', PKG_SEGMENT="gsd") so the transform flips each deterministically with no substring collisions.
metrics:
  duration: ~40min
  completed: 2026-07-14
  tasks: 3
  files: 12
---

# Phase 260714-coq Plan 01: Marketplace-agnostic plugin-root fallback (runtime-critical slice) Summary

Made the plugin-root FALLBACK marketplace-agnostic in the four runtime-critical carriers so hooks resolve the plugin under any marketplace directory (existing `gsd-plugin`, new `buildomator`) when `CLAUDE_PLUGIN_ROOT` is pruned, with the globally-highest version winning; also closed the deferred COMPAT-05 pluginIdentity gap.

## What was built

- **hooks/hooks.json** — all 17 inline `node -e` resolvers rewritten from a single hardcoded `cache/gsd-plugin/gsd` probe to a union scan: read `~/.claude/plugins/cache`, for each marketplace read `<mp>/gsd`, collect every `^\d+\.\d+\.\d+$` version as a `[version, path]` tuple, sort the flattened union by semver DESCENDING, then push candidates. `CLAUDE_PLUGIN_ROOT` stays candidate[0]; the stale-path stderr warning and the require-vs-spawnSync split per carrier are preserved. The plugin-name segment is the assignment `g='gsd'` (one per resolver, 17 total).
- **hooks/run-bash-hook.cjs** — `resolveCandidates()` rewritten with the same union-then-sort logic (`cacheRoot` + `pkgSegment = 'gsd'`); header comment updated to describe the marketplace-agnostic global-newest scan.
- **bin/lib/coexist.cjs** — `pluginIdentity()` now keys on the `/bm/` plugin-name segment followed by a version dir, `bin/`, or `hooks/`, regardless of marketplace. Covers `/cache/buildomator/bm/.../hooks/`, `/cache/gsd-plugin/bm/.../bin/`, and an off-cache `dist/bm/...` checkout. Closes COMPAT-05.
- **bin/check-plugin-update.sh** — installed version is now the highest semver merged across every `$HOME/.claude/plugins/cache/*/gsd/*/` marketplace (`CACHE_ROOT` + `PKG_SEGMENT="gsd"`), with the no-install early-exit preserved.
- **bin/lib/bm-transform.cjs** — `stampHookFallback` generalized to iterate a list of exact-literal FROM/TO pairs: the retained legacy `cache/gsd-plugin/gsd` slash form plus the three new carrier shapes (`g='gsd'`, `const pkgSegment = 'gsd'`, `PKG_SEGMENT="gsd"`). Each flips only the fixed plugin-name segment; the marketplace wildcard and identity tokens survive.
- **dist/bm** — regenerated; every carrier flips to the bm plugin segment under a marketplace wildcard (`g='bm'` x17, `pkgSegment = 'bm'`, `PKG_SEGMENT="bm"`), `CLAUDE_PLUGIN_ROOT` still candidate[0], `gsd-tools.cjs` identity token intact.
- **tests/hook-fallback-resolution.test.cjs (new)** — four isolated `fs.mkdtempSync` HOMEs, one marketplace/package combo + one distinct stderr marker each (GSD_LEGACY, GSD_NEWMKT, BM_LEGACY, BM_NEWMKT), asserting that exact marker with `CLAUDE_PLUGIN_ROOT` unset, driving the real SessionStart command extracted from the committed manifests; plus a fifth global-newest-version-wins case (1.0.0 under one marketplace vs 2.0.0 under another, NEW must win).
- **tests/coexist.test.cjs / bm-transform.test.cjs / build-bm-drift.test.cjs / bm-parity.test.cjs** — permanent COMPAT-05 identity cases, new-literal transform fixtures, updated drift counts, and a fail-closed census that flags every gsd-form fallback literal.
- **CI** — install-smoke.yml hook-fallback assertions moved to the new shapes (tripwire kept); check-drift.yml runs the new resolution test on every push and PR.

## Tasks completed

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Marketplace-agnostic runtime fallbacks + segment-based pluginIdentity | 8368b05 |
| 2 | Flip runtime fallback literals in transform, regenerate dist/bm | 044c2db |
| 3 | Permanent resolution test, updated unit tests and CI | 630f251 |

## Gate-suite results (all PASS)

| Gate | Result |
| ---- | ------ |
| node bin/build-bm.cjs --check | PASS |
| node tests/hook-fallback-resolution.test.cjs | PASS (5/5) |
| node tests/coexist.test.cjs | PASS (25/25) |
| node tests/bm-transform.test.cjs | PASS |
| node tests/build-bm-drift.test.cjs | PASS |
| node tests/bm-parity.test.cjs | PASS |
| node bin/maintenance/check-version-alignment.cjs | PASS |
| node tests/run-bash-hook.test.cjs (related, sanity) | PASS |
| node tests/hook-single-fire.test.cjs (related, sanity) | PASS |

## Deviations from Plan

None affecting scope. Two design refinements made within the plan's stated latitude:

1. **[Design] Distinct plugin-name literal per carrier instead of two shared shapes.** The plan invited generalizing `stampHookFallback` to a list of FROM/TO pairs "if the new carriers introduce more than two distinct literal shapes." They do (hooks.json inline `g='gsd'`, run-bash-hook `const pkgSegment = 'gsd'`, shell `PKG_SEGMENT="gsd"`), so the transform now iterates a 4-entry `FALLBACK_PAIRS` list. Verified no substring collisions across the shipping tree before choosing the literals.

2. **[Design] Retained the legacy `cache/gsd-plugin/gsd` -> `cache/gsd-plugin/bm` pair.** The runtime carriers no longer emit that literal, but ~12 shipping agents/skills/workflows and the coexist test fixtures still do (these are the explicitly deferred markdown sweep). Dropping the pair would have left un-stamped gsd-form literals in dist/bm and tripped the parity census. Keeping it preserves current behavior for the deferred files; it is a no-op on the rewritten carriers.

## Deferred (unchanged from plan)

The marketplace-agnostic sweep of the ~42 markdown reference-doc fallbacks (agents, workflows, skills, references) in the `cache/gsd-plugin/current` and `cache/gsd-plugin/gsd` shapes remains a separate follow-up. These fire only on a reference/template read while `CLAUDE_PLUGIN_ROOT` is pruned (not a live hook loop), and can later use a plugin-agnostic glob with no transform coupling.

## Self-Check: PASSED

- tests/hook-fallback-resolution.test.cjs exists.
- Commits 8368b05, 044c2db, 630f251 all present.
