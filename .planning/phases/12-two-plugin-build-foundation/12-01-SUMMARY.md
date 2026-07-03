---
phase: 12-two-plugin-build-foundation
plan: 01
subsystem: infra
tags: [plugin-packaging, build-step, marketplace, drift-guard, version-lockstep, claude-code-plugin]

# Dependency graph
requires:
  - phase: (none)
    provides: authored gsd plugin manifest + version-alignment guard (4.0.2) reused here
provides:
  - "bin/build-bm.cjs: one-command generate-and-stamp build that copies the tracked gsd source into dist/bm and stamps only name/displayName/description"
  - "committed dist/bm package (1500 files, byte-identical to source except the stamped manifest)"
  - "second bm entry in the single marketplace.json (source ./dist/bm, displayName Buildomator)"
  - "--check regenerate-and-diff drift mode for CI"
  - "version-alignment guard extended to every marketplace entry plus dist/bm (collectVersionMismatches)"
  - "build:bm / check:bm-drift / validate:bm-plugin npm scripts"
affects: [phase-13-buildomator-plugin, phase-14-coexistence, phase-15-branding, ci-check-drift, ci-install-smoke, releasing]

# Tech tracking
tech-stack:
  added: []  # Node built-ins only (fs, os, path, child_process); no third-party packages
  patterns:
    - "Generate-and-stamp: copy tracked source, mutate only a tiny identity whitelist"
    - "git ls-files as the deterministic source list (tracked-only; untracked local files can never enter the published package)"
    - "Regenerate-and-diff --check mode as a byte-level drift gate"
    - "Pure exported helpers (stampBmManifest, shouldExclude, collectVersionMismatches) unit-tested without disk I/O"

key-files:
  created:
    - bin/build-bm.cjs
    - tests/build-bm-drift.test.cjs
    - dist/bm/** (1500 committed generated files)
  modified:
    - .claude-plugin/marketplace.json
    - bin/maintenance/check-version-alignment.cjs
    - tests/version-alignment.test.cjs
    - package.json
    - bin/maintenance/check-file-layout.cjs
    - bin/maintenance/rewrite-command-namespace.cjs

key-decisions:
  - "Version single-sourced from .claude-plugin/plugin.json (4.0.4), not package.json (stale 2.45.0)"
  - "mcpServers key stays gsd in the bm manifest (D-02 byte-identical policy); only name/displayName/description diverge"
  - "hooks/hooks.json copied verbatim including its gsd cache fallback (D-02 / RESEARCH A1); per-plugin fix deferred to Phase 13/14"
  - "dist/ excluded from check-file-layout and rewrite-command-namespace scans: the generated tree is a byte copy of already-scanned source"

patterns-established:
  - "Generate-and-stamp build with a --check regenerate-and-diff drift gate"
  - "Single marketplace.json listing two plugins from one repo (gsd at ./, bm at ./dist/bm)"

requirements-completed: [BUILD-01, BUILD-02]

# Metrics
duration: ~40min
completed: 2026-07-03
---

# Phase 12 Plan 01: Two-Plugin Build Foundation Summary

**One `node bin/build-bm.cjs` command generates the committed dist/bm Buildomator package from the tracked gsd source, stamping only name/displayName/description, single-sourcing the version across all four manifest sites, with a byte-level --check drift gate.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-03T20:44Z
- **Completed:** 2026-07-03T21:24Z
- **Tasks:** 3
- **Files modified:** 6 authored + 1500 generated (dist/bm)

## Accomplishments
- Repo's first build/generate step: `bin/build-bm.cjs` copies the git-tracked source into `dist/bm/` and stamps only the identity/branding whitelist (name gsd->bm, displayName/description -> Buildomator), version carried through from `plugin.json`.
- `--check` regenerate-and-diff mode builds into a temp dir and byte-compares against the committed `dist/bm/`, exiting 1 and naming any drifting path (used as the CI drift gate).
- Single `marketplace.json` now lists both plugins: `gsd` (source `./`) and `bm` (source `./dist/bm`, displayName Buildomator); the gsd entry and the marketplace `name` (`gsd-plugin`) are unchanged.
- Version-alignment guard extended (`collectVersionMismatches`) to flag ANY marketplace entry or the `dist/bm` manifest that diverges from `plugin.json`, so all four version sites stay in lockstep.
- `dist/bm` (1500 files) committed so the marketplace `source: "./dist/bm"` resolves at the installed git ref; the tree carries no `.planning`/`.git`/`node_modules`/`scratchpad` and no nested `dist`.

## Task Commits

1. **Task 1: bm marketplace entry + version-alignment guard extension** - `6b832c8` (feat)
2. **Task 2 (TDD RED): failing build-bm drift test** - `d615ef8` (test)
3. **Task 2 (TDD GREEN): build-bm.cjs implementation** - `946d57f` (feat)
4. **Task 3: npm scripts + committed dist/bm + dist/ drift-scan exclusion** - `24a645b` (feat)

_TDD task 2 has the required test -> feat gate sequence._

## Files Created/Modified
- `bin/build-bm.cjs` - generate-and-stamp build with `--check`; exports `stampBmManifest`, `shouldExclude`
- `tests/build-bm-drift.test.cjs` - unit (stamp/exclude) + integration (build, whitelist walk, --check) drift tests
- `.claude-plugin/marketplace.json` - added the second `bm` plugin entry
- `bin/maintenance/check-version-alignment.cjs` - added `collectVersionMismatches`; reads dist/bm manifest (null-tolerant)
- `tests/version-alignment.test.cjs` - multi-site parity cases for the new helper
- `package.json` - `build:bm`, `check:bm-drift`, `validate:bm-plugin` scripts
- `bin/maintenance/check-file-layout.cjs` - excluded `dist/` (Rule 3 deviation)
- `bin/maintenance/rewrite-command-namespace.cjs` - excluded `dist/` (Rule 3 deviation)
- `dist/bm/**` - committed generated Buildomator package (1500 files)

## Decisions Made
- Version single-sourced from `.claude-plugin/plugin.json` (4.0.4); `package.json` version (2.45.0) is stale/internal and intentionally left alone (RESEARCH A3).
- `mcpServers` stays `gsd` in the bm manifest and `hooks/hooks.json` is copied verbatim (D-02 byte-identical policy); the per-plugin hook cache-fallback fix is deferred to Phase 13/14 (RESEARCH A1) and will be tripwire-tested by plan 12-02's install-smoke.
- `dist/bm` contains no nested `marketplace.json` (the root file owns both entries; RESEARCH A2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded dist/ from the file-layout drift detector**
- **Found during:** Task 3 (committing dist/bm; the pre-commit file-layout hook aborted the commit)
- **Issue:** Committing `dist/bm` added `dist/bm/sdk/...` copies whose upstream docstrings contain literal placeholder refs (`references/foo.md`), which the detector counted as 2 new "genuinely missing" refs, regressing the baseline 135 -> 137. The detector already excludes `sdk/` for exactly this reason but did not exclude the generated `dist/` copy of it.
- **Fix:** Added `/^dist\//` to the detector's `skipDirs` with a rationale comment.
- **Files modified:** bin/maintenance/check-file-layout.cjs
- **Verification:** `node bin/maintenance/check-file-layout.cjs` PASS (back to baseline 135/0); pre-commit hook allowed the Task 3 commit.
- **Committed in:** `24a645b`

**2. [Rule 3 - Blocking] Excluded dist/ from the namespace-drift rewriter**
- **Found during:** Task 3 (running the check-drift umbrella after committing dist/bm)
- **Issue:** The generated `dist/bm` copies of workflow docs inflated the namespace-drift dry-run count; worse, running the rewriter in write mode would have mutated the generated tree and broken `build-bm --check`. The rewriter lacked a `dist/` skip.
- **Fix:** Added `/^dist\//` to the rewriter's `skipDirs` (parallel to the file-layout fix, with rationale comment).
- **Files modified:** bin/maintenance/rewrite-command-namespace.cjs
- **Verification:** `node bin/maintenance/check-drift.cjs` reports Namespace drift PASS after the change.
- **Committed in:** `24a645b`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both are the same small, necessary consistency fix (the two existing maintenance scanners must ignore the new generated `dist/` output, exactly as they already ignore `sdk/`). No scope creep; no change to build or manifest behavior. Both edits were copied into `dist/bm` by a rebuild so the committed tree stays byte-consistent and `--check` passes.

## Issues Encountered
- **HANDOFF schema check exits 2 in this worktree (env-only, pre-existing):** the umbrella `check-drift.cjs` reports the handoff-schema detector failing because this worktree has no `node_modules/` (ajv/ajv-formats not installed). This is unrelated to the two-plugin build, Rule 3 excludes package installs, and CI installs devDependencies so it passes there. Logged to `.planning/phases/12-two-plugin-build-foundation/deferred-items.md`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dual-package generation now exists, so both plugins can be tested together (Phase 14) and the `/bm:` command-doc parity work (Phase 13) has a package to target.
- Deferred to plan 12-02 / later phases: the CI wiring (`bm-build-drift` job in check-drift.yml, a bm-path job in install-smoke.yml), the prepublish hook + RELEASING.md dual-package steps, and the per-plugin hook cache-fallback fix (RESEARCH A1).
- At the 4.1.0 release bump, all four version sites move together via the build's single-source + the extended alignment guard.

---
*Phase: 12-two-plugin-build-foundation*
*Completed: 2026-07-03*
