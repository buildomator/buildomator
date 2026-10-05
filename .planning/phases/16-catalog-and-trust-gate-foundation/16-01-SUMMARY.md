---
phase: 16-catalog-and-trust-gate-foundation
plan: 01
subsystem: infra
tags: [craft-skill-catalog, model-catalog-twin, spdx, trust-gate, cjs-sdk-twin, vitest]

# Dependency graph
requires:
  - phase: 13-buildomator-plugin
    provides: agent_skills injection path and the model-catalog twin-reader precedent this catalog copies
provides:
  - Curated craft-skill catalog JSON under sdk/shared (metadata + pins only, SEO + DuckDB seed entries)
  - License policy tables (allow/flagCopyleft/flagSourceAvailable/block + SPDX obligations) in the catalog
  - Publisher allowlist in the catalog
  - CJS and SDK twin readers with a closed-schema validator (loadCraftSkillCatalog, validateCraftSkillCatalog, deriveCatalogViews, resolveCatalogPath)
  - Derived views: CRAFT_SKILLS_BY_ID, CRAFT_SKILL_TRIGGER_INDEX, PUBLISHER_ALLOWLIST
affects: [trust-gate, scoped-insertion, catalog-and-trust-gate-foundation plan 02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Twin-source + twin-reader: one JSON under sdk/shared read identically by a CJS reader and an SDK reader (model-catalog precedent)"
    - "Closed-schema validator: exact key set, 40-hex pin regex, 400-char string cap, forbidden-key list; readers fail closed on an invalid file"
    - "Byte-identical error strings across the two twins so a parity test can compare errors arrays directly"

key-files:
  created:
    - sdk/shared/craft-skill-catalog.json
    - bin/lib/craft-skill-catalog.cjs
    - sdk/src/craft-skill-catalog.ts
    - tests/craft-skill-catalog.test.cjs
    - sdk/src/craft-skill-catalog.test.ts
  modified: []

key-decisions:
  - "Catalog env override (GSD_CRAFT_SKILL_CATALOG) takes precedence over the auto-detected layout paths in both twins, so a test or deployment can deliberately point the reader at a specific file"
  - "Reference-not-redistribute enforced structurally: closed key set + 400-char cap + forbidden-key list + a no-copied-skill-tree test, not a convention"

patterns-established:
  - "Twin-source + twin-reader for a new curated catalog (CJS candidate-path resolver, SDK URL-relative read, shared env override)"
  - "Never-throw validator returning { valid, errors }; the loader wraps invalid results into one fail-closed Error"

requirements-completed: [CAT-01]

# Metrics
duration: 10min
completed: 2026-10-05
---

# Phase 16 Plan 01: Catalog and Trust Gate Foundation Summary

**Curated craft-skill catalog JSON (SEO + DuckDB, metadata and pins only) with CJS and SDK twin readers that validate a closed 18-key schema, reject floating refs and smuggled bodies, and agree on every fixture.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-05T04:55:00Z
- **Completed:** 2026-10-05T05:00:00Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments
- Single catalog JSON under `sdk/shared/` holding the SEO (`coreyhaines31/marketingskills`, MIT) and DuckDB (`duckdb/duckdb-skills`, MIT) entries, the license policy tables (allow/flag/block + SPDX obligations), and the publisher allowlist, with no skill bodies.
- CJS reader (`bin/lib/craft-skill-catalog.cjs`) with a closed-schema validator: exact 18-key set, 40-hex pin regex, 400-char string cap, forbidden-key list; fails closed by throwing on an invalid file.
- SDK twin reader (`sdk/src/craft-skill-catalog.ts`) with typed interfaces, the same constants, the same functions, and byte-identical error strings.
- Two test suites (37-check CJS harness + 5-test SDK vitest) proving the catalog validates, is seeded correctly, holds metadata-plus-pins only, and that both readers return deep-equal verdicts on every fixture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Catalog JSON + CJS reader** - `d1987da` (feat)
2. **(Deviation fix) Env-override precedence in the CJS resolver** - `e066134` (fix)
3. **Task 2: SDK twin reader** - `f9f5fae` (feat)
4. **Task 3: Catalog tests (schema, seed, no-vendoring, twin parity)** - `474c84c` (test)

_Note: the plan's three tasks are tdd-tagged; tests live in Task 3 per the plan's own task split, with each earlier task carrying its own inline `<verify>`._

## Files Created/Modified
- `sdk/shared/craft-skill-catalog.json` - The CAT-01 artifact: version, licensePolicy (allow/flagCopyleft/flagSourceAvailable/block + obligations), publishers, and two seed skill entries (metadata + pins only).
- `bin/lib/craft-skill-catalog.cjs` - CJS reader: closed-schema validator, candidate-path resolver with env override, loader that fails closed, derived views; named module.exports.
- `sdk/src/craft-skill-catalog.ts` - SDK twin: typed interfaces plus the same constants, functions, error strings, and derived views.
- `tests/craft-skill-catalog.test.cjs` - 37-check harness: schema, seed entries, no-vendoring, six negative fixtures, env-override fail-closed, license policy.
- `sdk/src/craft-skill-catalog.test.ts` - vitest: seed assertions, per-fixture validate parity and derived-view parity against the CJS twin via createRequire, fail-closed load.

## Decisions Made
- The catalog env override `GSD_CRAFT_SKILL_CATALOG` is honored ahead of the auto-detected layout paths (see Deviations). This keeps the two twins consistent and makes the documented env-override behavior observable.
- Reference-not-redistribute is enforced by structure (closed key set, 400-char cap, forbidden-key list) plus a no-copied-skill-tree test, so "no third-party skill bodies vendored" is a checkable property.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CJS resolver env-override precedence corrected to match the SDK twin and the documented behavior**
- **Found during:** Task 3 (writing the env-override test)
- **Issue:** The plan's Task 1 text put `GSD_CRAFT_SKILL_CATALOG` in the last resolver slot (after the layout candidates), copying the model-catalog ordering. But the plan's own Task 1 behavior bullet and Task 3 env-override test require `loadCraftSkillCatalog()` to throw on an invalid override file even while the real catalog exists on disk. With the override last, the real catalog (candidate 1) always resolved first and the override was never reached, so the documented behavior and the test could not both hold. The SDK twin (Task 2) already specified env-before-default precedence, so the two twins would also have disagreed.
- **Fix:** Reordered the CJS `resolveCatalogPath` candidates to: explicit `overridePath`, then `GSD_CRAFT_SKILL_CATALOG`, then the three layout paths. This mirrors the SDK twin exactly. Normal operation (env unset) is unchanged: the env entry is null and filtered out, so the layout paths resolve.
- **Files modified:** bin/lib/craft-skill-catalog.cjs
- **Verification:** `node -e "require('./bin/lib/craft-skill-catalog.cjs')"` exits 0; the CJS env-override checks and the SDK fail-closed test both pass.
- **Committed in:** e066134

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix reconciles an internal contradiction in the plan (override-last vs the documented override-forces-invalid behavior) and makes the two twins consistent. No scope creep.

## Issues Encountered
- The word "instructions" appears in a skill `summary` value, so the no-vendoring text scan checks for forbidden names only in JSON key position (`"instructions":`) rather than as a bare substring, avoiding a false positive on prose.

## Verification Results (observed)
- `node tests/craft-skill-catalog.test.cjs` -> exit 0, 37/37 PASS, 0 FAIL.
- `cd sdk && npx vitest run --project unit src/craft-skill-catalog.test.ts` -> exit 0, 5 passed.
- `cd sdk && npx tsc --noEmit -p tsconfig.json` -> exit 0.
- No GSD bookkeeping, em/en dashes, or CLAUDE.md banned vocabulary in the three product files (grep clean).

## Known Stubs
None. The catalog is fully seeded with two live-verified entries; `scripts_review` is `null` by design (neither seed bundles scripts) and `tooling` is populated where applicable.

## Next Phase Readiness
- The catalog contract, license policy tables, and publisher allowlist are in place for plan 02 (the safety + license trust-gate twins), which will read the same JSON.
- No `dist/bm` regeneration needed here: this plan touches `bin/lib` and `sdk/src` but the build/regeneration gate applies when the generated plugin surface changes; plan 02 or a later plan handles the twin rebuild + `--check` per the phase RESEARCH gotcha.

## Self-Check: PASSED

All five created files exist on disk; all five commits (`d1987da`, `e066134`, `f9f5fae`, `474c84c`, `90f56b8`) are present in git history.

---
*Phase: 16-catalog-and-trust-gate-foundation*
*Completed: 2026-10-05*
