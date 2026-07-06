---
phase: 13-buildomator-plugin
plan: 01
subsystem: infra
tags: [build, codegen, plugin-packaging, hooks, mcp, drift-gate]

# Dependency graph
requires:
  - phase: 12-two-plugin-build-foundation
    provides: generate-and-stamp build (bin/build-bm.cjs) with a --check drift gate and git-tracked-only source enumeration
provides:
  - Deterministic bm transform T = stampBmManifest(+mcpServers rekey) + rewriteCommandRefs + stampHookFallback, single-sourced inside generate()
  - Pure reusable transform helpers (bin/lib/bm-transform.cjs) with tests-first unit coverage
  - dist/bm regenerated so every /gsd: command/artifact ref reads /bm:, all three hook cache-fallback carriers target the bm cache dir, and the MCP server registers under the bm key
  - Widened drift test that compares dist/bm against the deterministic transform of source (a stale dist/bm now fails)
affects: [14-coexistence, 15-branding, release-drift-gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deterministic byte transform single-sourced inside generate() so build and --check share one code path
    - Exact-literal split/join stamping (never a blanket gsd->bm regex) to spare identity tokens
    - Shebang-aware text/binary classification with source-mode preservation

key-files:
  created:
    - bin/lib/bm-transform.cjs
    - tests/bm-transform.test.cjs
  modified:
    - bin/build-bm.cjs
    - tests/build-bm-drift.test.cjs
    - dist/bm/** (regenerated through the wider transform)

key-decisions:
  - "rewriteCommandRefs rewrites the /gsd: token wherever it appears (not only at word boundaries) so plugin-owned artifact path segments rebrand too; safe because every must-survive token lacks the /gsd: substring"
  - "Extensionless shebang scripts are treated as text so bin/gsd-resume-at gets rewritten"
  - "mcpServers is rekeyed gsd -> bm carrying the same server config object"

patterns-established:
  - "Pure exported transform helpers unit-tested without disk I/O, reused by both the build and its drift gate"
  - "Transform lives inside generate() so --check regeneration runs identical logic"

requirements-completed: [BM-02, BM-03]

# Metrics
duration: ~25min
completed: 2026-07-06
---

# Phase 13 Plan 01: Widen the deterministic bm transform Summary

**dist/bm is now a self-consistent Buildomator package: every /gsd: command and plugin-owned path reads /bm:, all three hook cache-fallback carriers target the bm cache dir, the MCP server registers under the bm key, and the drift gate compares against the deterministic transform of source.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-06T21:55:53Z
- **Tasks:** 2
- **Files modified:** 4 source files + 232 regenerated dist/bm files

## Accomplishments
- New pure helper module `bin/lib/bm-transform.cjs` exporting `rewriteCommandRefs` and `stampHookFallback`, built tests-first
- Wired the transform inside `generate()` so `--check` shares the exact code path (cannot silently pass drifted output)
- Rekeyed the manifest `mcpServers` entry gsd -> bm while keeping the server config (and `mcp/server.cjs`) byte-identical
- Closed the carried Phase 12 limitation: all three hook cache-fallback carriers (hooks.json x17, run-bash-hook.cjs launcher, check-plugin-update.sh notifier) now fall back to the bm cache dir
- Widened the drift test to assert dist/bm equals the deterministic transform of source, with zero /gsd: leaks anywhere

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/lib/bm-transform.cjs with tests-first unit coverage** - `85dd90a` (feat, TDD)
2. **Task 2: Wire the transform into generate(), rekey mcpServers, widen the drift test, regenerate dist/bm** - `2fbb60c` (feat)

_Task 1 was a single feat commit: the RED test run confirmed the module was absent, then the module + regenerated dist/bm landed together to keep --check green._

## Files Created/Modified
- `bin/lib/bm-transform.cjs` - Pure `rewriteCommandRefs` (/gsd: -> /bm:) and `stampHookFallback` (slash + quoted path.join shapes) helpers, zero dependencies
- `tests/bm-transform.test.cjs` - Unit coverage: full command coverage (incl. capture/local-patches/edit-phase/extract-learnings), boundary contexts, identity sparing, path-segment rewriting, both fallback shapes, idempotence
- `bin/build-bm.cjs` - Transform wired into `generate()`; `TEXT_EXT` + shebang text detection with source-mode preservation; `FALLBACK_STAMP_FILES` set; `stampBmManifest` mcpServers rekey; re-exports the helpers + `isTextFile`
- `tests/build-bm-drift.test.cjs` - Compares dist/bm against `expectedText(source)`; asserts the three fallback carriers ship stamped; proves server.cjs byte-identity; gates zero /gsd: leaks; plugin.json mcpServers-rekey normalization
- `dist/bm/**` - Regenerated through the wider transform

## Decisions Made
- **Anchored regex refined to a full-token rewrite.** The plan specified a leading-boundary anchored substitution. Investigation found genuine `/gsd:` occurrences that the anchored form spared but the plan's hard must-have ("ZERO leading-slash /gsd: anywhere in dist/bm") required rewritten: an extensionless shebang script (`bin/gsd-resume-at`, genuine command refs), plugin-owned artifact path segments (`gsd:local-patches`, `gsd:dev-preferences`), and a `\n`-adjacent test fixture. `rewriteCommandRefs` now rewrites the `/gsd:` substring wherever it appears. This is safe: every must-survive token (`gsd://` URIs, `gsd-*` filenames, the real Claude patch dir `gsd-local-patches`, the `cache/gsd-plugin/gsd` literal, `gsd_*` tools) lacks the `/gsd:` substring and is untouched, verified by unit tests and `cmp` on `mcp/server.cjs`.
- **Text/binary classification is shebang-aware.** Extension whitelist plus a `#!` first-two-bytes check, so the one extensionless script needing a rewrite is covered without over-reaching into binaries. `isTextFile` is exported so the drift test shares the exact predicate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing dist/bm drift refreshed during regeneration**
- **Found during:** Task 1 (regenerating dist/bm)
- **Issue:** The committed dist/bm at the plan base was stale: source `CLAUDE.md` and `agents/gsd-executor.md` had gained a "Generated Code Hygiene" section that was never rebuilt into dist/bm, so `node bin/build-bm.cjs --check` was already failing before this plan.
- **Fix:** Regenerating dist/bm (a required plan step) refreshed those two generated copies.
- **Files modified:** dist/bm/CLAUDE.md, dist/bm/agents/gsd-executor.md
- **Verification:** `node bin/build-bm.cjs --check` exits 0
- **Committed in:** 85dd90a (Task 1 commit)

**2. [Rule 1 - Bug] Anchored regex + extension filter left /gsd: leaks that violate the plan's must-have**
- **Found during:** Task 2 (post-regeneration census)
- **Issue:** The plan's specified anchored regex spared alnum-preceded `/gsd:` path segments and the extension-only filter skipped the extensionless `bin/gsd-resume-at`, leaving four files with `/gsd:` and failing "zero /gsd: anywhere".
- **Fix:** Broadened `rewriteCommandRefs` to the full `/gsd:` token and made text detection shebang-aware. Confirmed the only real Claude-Code patch dir is the dash form `gsd-local-patches` (untouched), so no runtime path breaks.
- **Files modified:** bin/lib/bm-transform.cjs, tests/bm-transform.test.cjs, bin/build-bm.cjs, tests/build-bm-drift.test.cjs
- **Verification:** `grep -rIl '/gsd:' dist/bm` exits 1 (no output); all three gates pass
- **Committed in:** 2fbb60c (Task 2 commit)

**3. [Rule 1 - Bug] Text write stripped the executable bit from scripts/hooks**
- **Found during:** Task 2 (reviewing the commit's mode changes)
- **Issue:** Switching text files from `copyFileSync` to `writeFileSync` created them 0644, stripping +x from shipped scripts and hooks (e.g. bin/gsd-resume-at, hooks/*.sh). The content-only gates did not catch mode drift.
- **Fix:** `generate()` now `chmod`s each written text file to the source mode; binary files stay on `copyFileSync`.
- **Files modified:** bin/build-bm.cjs, dist/bm/** (modes restored)
- **Verification:** `stat` parity between source and dist/bm for key executables (755 == 755)
- **Committed in:** 2fbb60c (Task 2 commit, amended)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug)
**Impact on plan:** All auto-fixes were necessary to meet the plan's own hard must-haves (zero /gsd: leaks, working dist/bm). No scope creep; no new dependencies.

## Issues Encountered
- The plan referenced `13-PATTERNS.md` for verified helper excerpts, but no such file exists in the phase directory. Recovered the needed excerpts directly from source (`hooks/hooks.json`, `hooks/run-bash-hook.cjs`, `bin/check-plugin-update.sh`, `bin/maintenance/rewrite-command-namespace.cjs`).

## Full Verification Gate
```
node tests/bm-transform.test.cjs        -> PASS
node tests/build-bm-drift.test.cjs      -> PASS
node bin/build-bm.cjs --check           -> PASS (exit 0)
grep -rIl '/gsd:' dist/bm               -> no output (exit 1)
cmp -s mcp/server.cjs dist/bm/mcp/server.cjs -> identical
```
Census counts: hooks.json bm=17/gsd=0; run-bash-hook quoted bm=1/gsd=0 + slash bm=1/gsd=0; notifier bm=1/gsd=0; identity tokens (gsd-tools.cjs, run-bash-hook.cjs, GSD:) preserved; manifest key bm.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BM-02 (command self-reference rewriting) and BM-03 (hook plugin-awareness + MCP identity) are delivered and gated.
- Phase 14 (coexistence: double-fire dedup, dual-writer STATE.md coordination) can build on the distinct `gsd`/`bm` MCP keys.
- Phase 15 (branding prose, `GSD:` stderr prefix) is deliberately untouched; the `GSD:` prefixes and repo/marketplace identifiers survive by design.

---
*Phase: 13-buildomator-plugin*
*Completed: 2026-07-06*
