---
phase: 16-catalog-and-trust-gate-foundation
plan: 03
subsystem: infra
tags: [scoped-insertion, craft-skill, pin-record, agent-skills, trust-gate, cjs, cli]

# Dependency graph
requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: catalog JSON + twin readers (plan 01) and the trust-gate verdict contract (plan 02) the write side consumes
provides:
  - CJS write side of scoped insertion as a gsd-tools craft-skill command family (list, assess, insert, release)
  - Reproducibility pin records under .planning/craft-skills/pins.json (ephemeral default, sticky opt-in, approval memory)
  - Local-checkout pin verification (git HEAD vs pinned_commit) with a SKILL.md sha256 fallback for non-git copies
  - setConfigValue exported from config.cjs for programmatic agent_skills.<agent> writes
affects: [catalog-and-trust-gate-foundation plan 04, phase 17 workflow wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write side mirrors the untouched reader's location rules so a stored agent_skills entry is never one the reader later refuses"
    - "Approval recorded once per id+pinned_commit in the pin log and remembered across release/re-insert"
    - "Two sequential planning-lock writes (pins then config) rather than one nested lock, since setConfigValue takes its own lock"

key-files:
  created:
    - bin/lib/craft-skill-insert.cjs
    - tests/craft-skill-insertion.test.cjs
  modified:
    - bin/lib/config.cjs
    - bin/gsd-tools.cjs

key-decisions:
  - "The block-verdict test is exercised through a blocked license, not an unknown publisher: the catalog validator and the gate read the same publishers map, so publisher-not-allowlisted is structurally unreachable through a validated catalog"
  - "agent-skills is consumed through its --raw text path in the scoping test; without --raw the shared output() helper JSON-encodes an empty string to the two-char literal, which is the reader's existing contract, not something this plan should change"
  - "No new config key: mode and provenance live in the pin record; the config entry is the existing dynamic agent_skills.<agent-type> key, so both config-schema twins stay byte-identical"

requirements-completed: [CAT-05]

# Metrics
duration: 9min
completed: 2026-10-05
---

# Phase 16 Plan 03: Scoped Insertion (CJS Write Side) Summary

**A `gsd-tools craft-skill` command family (list, assess, insert, release) that assesses a catalog entry through the trust gate, requires a recorded human approval, verifies the local checkout against the pin, then writes one `agent_skills.<agent>` entry through the existing locked config path plus a reproducibility record under `.planning/craft-skills/pins.json`: ephemeral by default, sticky by opt-in, with the reader left byte-for-byte untouched and scoping proven by running it.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-05T03:18:01Z
- **Completed:** 2026-10-05T03:27:00Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments
- `bin/lib/craft-skill-insert.cjs`: the insertion module. `insertCraftSkill` validates args, loads the catalog view, runs `assessEntry`, refuses a `block` verdict before any write, requires `--approved` (or a remembered approval at the same id+pin), resolves the location with the reader's own path rules, checks the SKILL.md frontmatter name against the catalog, verifies the local git HEAD against `pinned_commit`, then appends a 19-key pin record under a planning lock and writes the config entry. `releaseCraftSkills` removes ephemeral entries, stamps `released_at`, and leaves sticky records unless `--include-sticky` targets one by id. `listCraftSkills` and `assessCraftSkill` round out the family. Helpers `parseFlags`, `readPins`, `verifyLocalPin`, `resolveLocation` and `PINS_RELATIVE_PATH` are exported for the test.
- `bin/lib/config.cjs`: one additive line adding `setConfigValue` to `module.exports` so the insertion module can write `agent_skills.<agent>` through the existing locked, dot-path config writer.
- `bin/gsd-tools.cjs`: requires the module as `craftSkill`, dispatches `case 'craft-skill'` next to `agent-skills`, and lists the command in the top-level usage between `config-set` and `current-timestamp`.
- `tests/craft-skill-insertion.test.cjs`: 21 checks run end-to-end through the spawned CLI covering list/assess, needs-approval (no writes), approved ephemeral insert (config entry + 19-key pin record in order), scoping to the target agent type only (and the gsd-/bm- alias pair, other agent types, and the empty agent), the not-at-startup structural guard (no hook, SKILL.md, or startup path references the catalog), release, approval memory across re-insert, sticky survival and `--include-sticky` removal, duplicate-insert de-dup, block and flag verdicts, the four path/pin rejections, pin verification, the non-git sha256 fallback, trusted-global-roots reuse, and the untouched config-schema twins.

## Task Commits

Each task was committed atomically:

1. **Task 1: Insertion module + setConfigValue export** - `ce027aa` (feat)
2. **Task 2: Wire the craft-skill command into gsd-tools** - `0b6f899` (feat)
3. **Task 3: End-to-end insertion test through spawned gsd-tools** - `b87f8a9` (test)

## Files Created/Modified
- `bin/lib/craft-skill-insert.cjs` (created) - the CJS write side: `cmdCraftSkill` dispatcher, `insertCraftSkill`, `releaseCraftSkills`, `listCraftSkills`, `assessCraftSkill`, and the `readPins`/`writePins`/`parseFlags`/`verifyLocalPin`/`resolveLocation` helpers.
- `tests/craft-skill-insertion.test.cjs` (created) - 21-check CLI harness.
- `bin/lib/config.cjs` (modified) - exported `setConfigValue` (one added line; `git diff --numstat` shows 1 added, 0 removed).
- `bin/gsd-tools.cjs` (modified) - require, dispatch case, and usage entry for `craft-skill`.

## Decisions Made
- The block-verdict case is driven by a blocked license rather than an unknown publisher. The catalog validator (`validateCraftSkillCatalog`) already requires every entry's publisher to exist in the `publishers` map, and the gate's publisher-allowlist check reads that same map, so the two can never disagree: an unknown publisher fails to parse before the gate runs. A blocked license is the reachable route to `verdict: 'block'` and exercises the same refuse-before-write path.
- The scoping test reads `agent-skills` through the `--raw` text path, which is how workflows embed the block. For a populated agent the reader writes the block directly (so `--raw` is irrelevant); for an unconfigured or empty agent type `--raw` yields an empty string, where the default path would JSON-encode the empty string. This is the reader's existing contract and was not changed.
- No new config key was introduced. Mode (ephemeral/sticky), provenance, pin verification and approval all live in the pin record; the config write uses the existing dynamic `agent_skills.<agent-type>` key, so `bin/lib/config-schema.cjs` and `sdk/src/query/config-schema.ts` are untouched (asserted by the test via `git diff --quiet`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Block-verdict test fixture uses a blocked license instead of an unknown publisher**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 behavior line specified the block case as "catalog fixture with publisher 'nobody'". The catalog validator (`validateCraftSkillCatalog`, plan 01) rejects any entry whose publisher is absent from the `publishers` map, and `loadCraftSkillCatalog` throws fail-closed on an invalid catalog. So a `publisher: 'nobody'` fixture never reaches the gate: it throws a validation error at load with a message that does not contain "craft-skill insert refused", failing the behavior's own assertion. The gate's publisher-allowlist finding reads the same `publishers` map the validator checks, so the two axes cannot disagree and publisher-not-allowlisted is unreachable through a validated catalog.
- **Fix:** The block-verdict check mutates the fixture's license to `UNLICENSED` (in the catalog's block list, a non-empty string so it passes validation). This yields `verdict: 'block'` and drives the same refuse-before-any-write path the plan intends (exit non-zero, "craft-skill insert refused", no config, no pins). A code comment records why the publisher axis is not the route.
- **Files modified:** tests/craft-skill-insertion.test.cjs
- **Verification:** `node tests/craft-skill-insertion.test.cjs` -> 21 passed, 0 failed.
- **Committed in:** b87f8a9

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix resolves an impossibility in the plan's block-case fixture by taking the reachable block route; the asserted outcome (refuse before any write) is unchanged. No scope change.

## Assumption Drift (advisory)

**1. Empty agent type through `agent-skills` yields an empty string only on the `--raw` path**
- **Found during:** Task 3 (scoping check)
- **Planned:** The plan's Task 3 behavior assumed `runAgentSkills(root, '').stdout === ''` on a plain invocation.
- **Actual:** Without `--raw`, `cmdAgentSkills` routes an empty/absent agent type through the shared `output('', raw, '')` helper, which JSON-encodes the empty string to a two-character literal. The empty-string result holds on the reader's `--raw` text path, which is how workflows embed the block. The test queries with `--raw`; the reader is unchanged.
- **Why:** The reader's existing output contract, not a behavior this plan introduces or should alter.

## Known Stubs
None. The command family is fully implemented. Triggering `release` at task end is Phase 17 workflow wiring (out of scope here, per the plan objective); this plan ships the command and its contract.

## Threat Flags
None. This plan adds a local CLI command and a gitignored `.planning` audit record. It introduces no network endpoint and no new config key; it reuses the existing strict `trusted_global_roots` default and the existing locked config writer. The threats in the plan's register (T-16-11..T-16-17) are the ones this write side mitigates, not new surface.

## Verification Results (observed)
- `node tests/craft-skill-insertion.test.cjs` -> exit 0, "21 passed, 0 failed, 21 total".
- `node tests/agent-skills-plugin-form.test.cjs` -> exit 0 (reader parity, untouched).
- `node tests/trusted-global-roots.test.cjs` -> exit 0 (strict default, untouched).
- `node tests/config-schema-sdk-parity.test.cjs` -> exit 0 (both schema twins unchanged).
- `node tests/craft-skill-catalog.test.cjs` -> exit 0, 37/37; `node tests/skill-trust-gate.test.cjs` -> exit 0, 40/40 (adjacent suites still green after the config.cjs export).
- `git diff --quiet -- bin/lib/init.cjs bin/lib/config-schema.cjs sdk/src/query/config-schema.ts` -> exit 0 (reader and schemas untouched).
- `node bin/gsd-tools.cjs craft-skill list` returns both seed entries; `craft-skill assess duckdb-query --raw` renders `Verdict: allow`; `--help` lists `craft-skill`; `craft-skill bogus` exits non-zero with a usage message naming list/assess/insert/release.
- Task 1 verify (`parseFlags` shape + `setConfigValue` exported) exits 0; `grep -c "setConfigValue," bin/lib/config.cjs` is 1 and `git diff --numstat bin/lib/config.cjs` shows `1 0`.
- No GSD bookkeeping (`CAT-0`, `Phase 16`, wave) and no em/en dashes in the new product files or the test (grep clean).

## Next Phase Readiness
- The `craft-skill insert|release|assess|list` contract is in place for Phase 17 workflow wiring (propose-on-fit and release-at-task-end) and for plan 04.
- Not done here (by design, consistent with plans 01 and 02): no `sdk/dist` rebuild or `dist/bm` regeneration with `--check`. This plan adds `bin/lib` CJS and a test; it writes no `sdk/src` twin (the write side runs from the CJS CLI only, which the PATTERNS map flagged as a planner call, not an automatic twin). The generated-plugin rebuild + `--check` PASS remains a later-plan gate per the phase RESEARCH note.

## Self-Check: PASSED

All created files exist on disk (`bin/lib/craft-skill-insert.cjs`, `tests/craft-skill-insertion.test.cjs`); all three task commits (`ce027aa`, `0b6f899`, `b87f8a9`) are present in git history.

---
*Phase: 16-catalog-and-trust-gate-foundation*
*Completed: 2026-10-05*
