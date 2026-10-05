---
phase: 16-catalog-and-trust-gate-foundation
plan: 05
subsystem: infra
tags: [phase-close, build, drift-gate, no-vendoring, ci, docs, cjs-sdk-twin]

# Dependency graph
requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: catalog JSON + twin readers (plan 01), the trust-gate verdict contract (plan 02), the CJS write side (plan 03) and the SDK write side (plan 04) that this plan rebuilds, tests, wires into CI and documents
provides:
  - Rebuilt sdk/dist (656 tracked files, now carrying craft-skill-catalog.js, skill-trust-gate.js and query/craft-skill.js) committed to the repo
  - Regenerated dist/bm distribution carrying the catalog, both gate modules, the insertion module and the SDK query twin, proven byte-exact by node bin/build-bm.cjs --check
  - Repo-wide no-vendoring guard (tests/craft-skill-no-vendoring.test.cjs) that survives future catalog edits
  - Four new CJS tests wired into CI (check-drift.yml)
  - README feature-table row and QUERY-HANDLERS.md registry note describing the catalog, the gate and the craft-skill command family
affects: [phase 17 workflow wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staging the newly-built sdk/dist before node bin/build-bm.cjs so the git-ls-files source list picks up the untracked query twin, then staging the regenerated dist/bm"
    - "Repo-level no-vendoring guard complements the per-entry catalog schema test: single catalog file, no third-party marker outside the catalog, no copied skill tree directory, string cap, no smuggled markdown heading"

key-files:
  created:
    - tests/craft-skill-no-vendoring.test.cjs
  modified:
    - .github/workflows/check-drift.yml
    - README.md
    - sdk/src/query/QUERY-HANDLERS.md
    - sdk/dist
    - dist/bm

key-decisions:
  - "The whole phase ships as one feat commit per the plan's Task 3 design (not per-task commits): plans 01-04 already committed their source atomically, so plan 05 commits only the regenerated artifacts, the guard test, CI wiring and docs together"
  - "sdk/dist had to be git-staged before regenerating dist/bm, because build-bm enumerates source through git ls-files and the freshly-built query twin (sdk/dist/query/craft-skill.js) was untracked; without staging it was absent from dist/bm"
  - "dist/bm was regenerated a second time after the Task 2 doc/CI/test edits, since README.md, .github/ and sdk/src are all inside the dist/bm payload and the first regeneration predated those edits"

requirements-completed: [CAT-01, CAT-03, CAT-04, CAT-05]

# Metrics
duration: 12min
completed: 2026-10-05
---

# Phase 16 Plan 05: Phase Close (Rebuild, Parity Gate, CI, No-Vendoring Guard, Docs) Summary

**The phase-close plan: rebuilt the committed `sdk/dist` and regenerated `dist/bm` so `node bin/build-bm.cjs --check` reports PASS on the committed tree, proved both twins' CLIs return the same two seed ids and identical assessment prompts, added a repo-wide no-vendoring guard, wired the four new CJS tests into CI, and documented the catalog, the trust gate and the `craft-skill` command family in the README feature table and the SDK handler notes, with no version bump and no CHANGELOG entry.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files created:** 1 (plus regenerated sdk/dist and dist/bm trees)
- **Files modified:** 3 source files

## Accomplishments
- Rebuilt `sdk/dist` from the new plan 01-04 sources (`npm --prefix sdk run build`, tsc + esbuild, exit 0). The build produced the new `sdk/dist/craft-skill-catalog.*`, `sdk/dist/skill-trust-gate.*` and `sdk/dist/query/craft-skill.*` files.
- Regenerated `dist/bm` (`node bin/build-bm.cjs`) carrying `dist/bm/sdk/shared/craft-skill-catalog.json`, `dist/bm/bin/lib/craft-skill-catalog.cjs`, `dist/bm/bin/lib/skill-trust-gate.cjs`, `dist/bm/bin/lib/craft-skill-insert.cjs` and `dist/bm/sdk/dist/query/craft-skill.js`, and proved `node bin/build-bm.cjs --check` PASS on the committed tree.
- Proved twin CLI parity: `node sdk/dist/cli.js query craft-skill.list` and `node bin/gsd-tools.cjs craft-skill list` both return the two seed ids (`duckdb-query`, `seo-audit`); the `assess duckdb-query` prompt arrays are identical across both CLIs; `node dist/bm/bin/gsd-tools.cjs craft-skill list` resolves the catalog through the flat-layout candidate path and returns the same two ids.
- Wrote `tests/craft-skill-no-vendoring.test.cjs` (8 checks): one catalog file under sdk/shared, no third-party marker outside the catalog in sdk/shared/bin/lib/skills/references, no copied seo-audit/query directory, every entry validates and is under the 400-char cap, no catalog line over 400 chars, and no string value starting with '#'.
- Wired four CI steps into `.github/workflows/check-drift.yml` after the trusted-roots step (catalog, trust-gate, insertion, no-vendoring), additions only.
- Documented the feature: a README "Added features beyond upstream" row and a QUERY-HANDLERS.md registry-only note naming `craft-skill.list/assess/insert/release` like `agent-skills`.

## Task Commits

Per the plan's Task 3 design, the entire phase ships as one commit (plans 01-04 already committed their source atomically):

1. **Task 1 (rebuild artifacts, prove parity) + Task 2 (guard, CI, docs) + Task 3 (phase commit)** - `feat(craft-skills): catalog, two-axis trust gate and scoped insertion (CJS + SDK)`

## Files Created/Modified
- `tests/craft-skill-no-vendoring.test.cjs` (created) - repo-wide no-vendoring guard, zero-dep ok()/exit(1) harness, 8 checks.
- `.github/workflows/check-drift.yml` (modified) - four new steps (8 insertions, additions only) running the catalog, trust-gate, insertion and no-vendoring tests after the trusted-roots step.
- `README.md` (modified) - one feature-table row under "Added features beyond upstream" describing the craft-skill catalog and trust gate.
- `sdk/src/query/QUERY-HANDLERS.md` (modified) - a registry-only bullet for the craft-skill family.
- `sdk/dist` (regenerated + staged) - the committed SDK build now carries the catalog reader, the trust gate and the query twin.
- `dist/bm` (regenerated + staged) - the bm distribution regenerated twice (after Task 1 and again after the Task 2 doc/CI/test edits) so it matches the final source tree.

## Decisions Made
- The whole phase ships as one `feat` commit, following the plan's Task 3 action. Plans 01-04 committed their source atomically; plan 05 commits only the regenerated `sdk/dist`/`dist/bm`, the guard test, the CI wiring and the docs rows together.
- `sdk/dist` was `git add`-ed before running `node bin/build-bm.cjs`, because the build enumerates source through `git ls-files`; the freshly-built `sdk/dist/query/craft-skill.js` was untracked and therefore absent from the first dist/bm regeneration until staged.
- `dist/bm` was regenerated a second time after the Task 2 edits, since `README.md`, `.github/` and `sdk/src` are all inside the dist/bm payload and the first regeneration predated those edits.

## Deviations from Plan

None. The plan executed as written. The two-step staging of `sdk/dist` before regenerating `dist/bm` is exactly what the Task 1 action prescribed ("Stage `sdk/dist` and `dist/bm`"); the build's git-index source list makes staging a precondition, not a deviation.

## TDD Gate Compliance

Task 2 is tagged `tdd="true"` but its `<behavior>` is a set of repo-level guard assertions over a property that plans 01-04 already established (reference-not-redistribute). There is no new product code for the guard to drive: the guard codifies an existing invariant. The test was written and run against the current tree and passed 8/8 on first run (the invariant already holds), so there is no failing-then-passing RED->GREEN pair to record. The guard's value is forward-looking: it fails if a future catalog edit vendors a skill body or copies a skill tree.

## Known Stubs
None. The guard test is fully implemented and exercised; the artifacts are rebuilt and committed.

## Threat Flags
None. This plan introduces no new network endpoint, auth path or schema at a trust boundary. It rebuilds generated artifacts, adds a guard test, wires CI and edits docs. The plan's threat register (T-16-24..T-16-27) is mitigated here: the drift gate (T-16-24) is PASS, the no-vendoring guard (T-16-25) runs in CI, the four CI steps (T-16-26) are asserted present, and twin parity (T-16-27) is proven at the CLI level.

## Verification Results (observed)
- `npm --prefix sdk run build` -> exit 0 (tsc + esbuild, `dist/cli.js 1.6mb`).
- `node bin/build-bm.cjs` -> `built .../dist/bm (version 4.9.1)`; all five expected craft-skill files present in dist/bm after staging sdk/dist.
- `node bin/build-bm.cjs --check` -> `bm drift check: PASS (committed dist/bm matches a fresh build).` exit 0 (run after Task 1 and again after the Task 2 edits + regeneration).
- Twin CLI parity one-liner -> `twin cli parity ok; ids=["duckdb-query","seo-audit"]` exit 0.
- `node dist/bm/bin/gsd-tools.cjs craft-skill list` -> `dist/bm ids=["duckdb-query","seo-audit"]`.
- `node tests/bm-parity.test.cjs` -> `All bm-parity tests passed` (its `--check` case green after regeneration).
- `node tests/craft-skill-no-vendoring.test.cjs` -> `8/8 checks passed`, exit 0; `grep -nP '\x{2014}|\x{2013}'` on the file prints nothing.
- CI grep count for the four new test paths in check-drift.yml = 4; `git diff .github/workflows/check-drift.yml` shows 8 insertions, no deletions; YAML reads back cleanly.
- `grep -q "Craft-skill catalog" README.md` and `grep -q "craft-skill.insert" sdk/src/query/QUERY-HANDLERS.md` both match; README additions carry no em/en dash.
- `node tests/user-docs-prose.test.cjs` -> exit 0; `node tests/user-docs-jargon.test.cjs` -> exit 0.
- Full CJS gate (catalog, trust-gate, insertion, no-vendoring, agent-skills-plugin-form, trusted-global-roots, config-schema-sdk-parity, fable-tier, model-catalog-resolver-flat-layout, build-bm-drift, bm-parity, version-alignment) -> all exit 0.
- `npm --prefix sdk test` -> `Test Files 132 passed (132)`, `Tests 1968 passed (1968)`.
- `git diff --cached --stat -- CHANGELOG.md .claude-plugin/plugin.json .claude-plugin/marketplace.json dist/bm/.claude-plugin/plugin.json` -> empty (no version bump, no CHANGELOG entry).

## Next Phase Readiness
- Phase 16 ships complete: the catalog, the two-axis trust gate and scoped insertion exist in both twins, the generated `dist/bm` matches source (`--check` PASS), the no-vendoring guard runs in CI, and the feature is documented.
- Phase 17 can wire `craft-skill` propose-on-fit and release-at-task-end into workflows against the committed `gsd-tools craft-skill` / `bm-sdk query craft-skill.*` contract.
- Release is cut separately on the 4.9.x line (no version bump here, per the plan).

## Self-Check: PASSED

- `tests/craft-skill-no-vendoring.test.cjs` exists on disk; the SUMMARY exists.
- Phase commit `173de13` is present in git history with the exact subject `feat(craft-skills): catalog, two-axis trust gate and scoped insertion (CJS + SDK)`.
- `node bin/build-bm.cjs --check` still PASS after the commit; `git status --porcelain` shows 0 unstaged product changes; `git show --stat HEAD` carries no CHANGELOG or plugin.json delta.

---
*Phase: 16-catalog-and-trust-gate-foundation*
*Completed: 2026-10-05*
