---
phase: 16-catalog-and-trust-gate-foundation
plan: 04
subsystem: infra
tags: [scoped-insertion, craft-skill, pin-record, agent-skills, trust-gate, sdk, twin]

# Dependency graph
requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: catalog JSON + twin readers (plan 01), the trust-gate verdict contract (plan 02), and the CJS write-side record contract (plan 03) this SDK twin mirrors
provides:
  - SDK write side of scoped insertion as four query handlers (craft-skill.list, .assess, .insert, .release) in dotted and spaced forms
  - insertCraftSkill / releaseCraftSkills functions reachable from bm-sdk query without shelling out to gsd-tools
  - Pin records under <planning>/craft-skills/pins.json with the 19-key set and ordering identical to the CJS twin
affects: [phase 17 workflow wiring, catalog-and-trust-gate-foundation plan 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SDK twin of the CJS write side: same gate-verdict-first contract, flags, record key order and refusal strings, so a parity test can compare records across twins"
    - "Reader guards (resolveWithinBase / loadTrustedGlobalRoots) copied verbatim from skills.ts rather than shared, because skills.ts must stay byte-identical for its own parity contract"
    - "Config write routed through the existing configSet handler by JSON-encoding the array value, so the locked atomic write and key validation are reused unchanged"

key-files:
  created:
    - sdk/src/query/craft-skill.ts
    - sdk/src/query/craft-skill.test.ts
  modified:
    - sdk/src/query/command-static-catalog-domain.ts

key-decisions:
  - "Refusals throw GSDError(Validation) rather than a security classification: the SDK error enum has no Security tier, and the message substrings (craft-skill insert refused, pin-mismatch, skill-name-mismatch, plugin-form, trusted_global_roots) carry the contract the tests and callers key on"
  - "releaseCraftSkills re-reads config fresh per selected record before each configSet, so releasing two different-id records on the same agent in one call cannot clobber each other (the CJS twin computes both from one stale in-memory snapshot); the record shape and selection rules are unchanged"
  - "The project-path safety check uses the reader's resolveWithinBase rather than the CJS security.cjs validatePath, keeping the SDK twin dependency-free of the CJS security module while enforcing the same escape guard"

requirements-completed: [CAT-05]

# Metrics
duration: 6min
completed: 2026-10-05
---

# Phase 16 Plan 04: Scoped Insertion (SDK Write Side) Summary

**The SDK twin of scoped insertion: four `bm-sdk query craft-skill.*` handlers (list, assess, insert, release) that assess a catalog entry through the trust gate, require a recorded human approval, verify the local checkout against the pin, then write one `agent_skills.<agent>` entry through the existing locked `configSet` path plus a reproducibility record under `<planning>/craft-skills/pins.json` whose 19-key set and ordering match the CJS twin byte for byte, with the `agentSkills` reader left untouched and scoping proven by running it.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments
- `sdk/src/query/craft-skill.ts`: the insertion module. `insertCraftSkill` validates args, loads the catalog view, runs `assessEntry`, refuses a `block` verdict before any write, requires `approved` (or a remembered approval at the same id+pin), resolves the location with the reader's own path rules, checks the SKILL.md frontmatter name against the catalog, verifies the local git HEAD against `pinned_commit`, then writes a 19-key pin record (atomic tmp + rename) and the config entry through `configSet`. `releaseCraftSkills` removes ephemeral entries, stamps `released_at`, and leaves sticky records unless `includeSticky` targets one by id. `listCraftSkills` and `assessCraftSkill` round out the family. `resolveWithinBase` and `loadTrustedGlobalRoots` are copied verbatim from `skills.ts` so a stored entry is never one the reader refuses.
- `sdk/src/query/command-static-catalog-domain.ts`: imports the four handlers and registers eight entries (dotted and spaced forms) after the intel block, so each command resolves through `createRegistry()`.
- `sdk/src/query/craft-skill.test.ts`: 16 vitest cases covering needs-approval (no writes), the approved ephemeral insert with the 19-key record order, scoping through the real `agentSkills` reader (target agent only, the gsd-/bm- alias pair, other agent types, the empty agent), release, approval memory across re-insert, sticky survival and `includeSticky` removal, the block verdict, the four path/pin refusals, pin verification against a matching git HEAD, trusted-global-roots acceptance, and the registry.

## Task Commits

Each task was committed atomically:

1. **Task 1: SDK craft-skill handlers with pin records** - `10be4da` (feat)
2. **Task 2: Register the handlers in the static domain catalog** - `26348e7` (feat)
3. **Task 3: vitest spec for SDK insertion, scoping and record parity** - `37aca7a` (test)

## Files Created/Modified
- `sdk/src/query/craft-skill.ts` (created) - SDK write side: `craftSkillList/Assess/Insert/Release` handlers, `insertCraftSkill`/`releaseCraftSkills`/`listCraftSkills`/`assessCraftSkill`, and `parseFlags`/`readPins`/`writePins`/`readFrontmatterName`/`sha256File`/`verifyLocalPin`/`resolveLocation`/`findApproval` helpers plus `PINS_RELATIVE_PATH` and the `PinRecord` interface.
- `sdk/src/query/craft-skill.test.ts` (created) - 16-case vitest spec.
- `sdk/src/query/command-static-catalog-domain.ts` (modified) - import line + eight registry entries (`git diff --numstat` shows 9 added, 0 removed).

## Decisions Made
- Refusals throw `GSDError(ErrorClassification.Validation)`. The SDK error enum has no Security tier (unlike the CJS `ERROR_REASON.SECURITY_SCAN_FAILED`), and what the contract and tests key on is the message substring (`craft-skill insert refused:`, `pin-mismatch`, `skill-name-mismatch`, `plugin-form`, `trusted_global_roots`), which is preserved verbatim.
- `releaseCraftSkills` re-reads config fresh per selected record before each `configSet` call. The CJS twin computes every record's filtered array from one in-memory snapshot taken before the loop, which would clobber when two different-id records on the same agent are released together; the SDK re-read avoids that while keeping the record shape, selection rules, and return contract identical.
- The project-path safety check reuses the reader's `resolveWithinBase` instead of the CJS `security.cjs#validatePath`, so the SDK twin carries no dependency on the CJS security module while enforcing the same symlink/escape guard. The reason string differs in wording only; the refusal still contains `craft-skill insert refused:`.

## Deviations from Plan

None. The plan executed as written. One type-cast was needed during Task 1 (`detectRuntime(config as { runtime?: unknown })`) because `GSDConfig`'s index signature does not structurally match the parameter type; this is an inline implementation detail, not a behavior change.

## Assumption Drift (advisory)
None material. The SDK `configSet` takes its own lock per call, so the SDK insert does the pins write (atomic tmp + rename) and the config write as two separate operations rather than the CJS twin's single `withPlanningLock`; the plan's Task 1 action specified exactly this (tmp-file + `renameSync` for pins, `configSet` for config), so it is the intended contract, not a drift.

## Known Stubs
None. All four handlers are implemented and exercised by a test.

## Threat Flags
None. This plan adds four local query handlers and a gitignored `.planning` audit record. It introduces no network endpoint and no new config key; it reuses the strict `trusted_global_roots` default and the existing locked `configSet` writer. The threats in the plan's register (T-16-18..T-16-23) are the ones this SDK twin mitigates, not new surface.

## Verification Results (observed)
- `cd sdk && npx tsc --noEmit -p tsconfig.json` -> exit 0.
- `npx vitest run --project unit src/query/craft-skill.test.ts` -> 16 passed.
- `npx vitest run --project unit src/query/craft-skill.test.ts src/query/skills.test.ts src/query/commands-list.test.ts src/query/command-topology.test.ts` -> exit 0, 47 passed.
- `git diff --quiet sdk/src/query/skills.ts` -> exit 0 (reader untouched).
- Task 1 acceptance: 4 exported handlers, `configSet([` count 2, `assessEntry(` count 2.
- Task 2 acceptance: `grep -c craft-skill` on the domain catalog is 9; registry topology/seam tests pass.
- Task 3 acceptance: 16 `it` cases; `needs_approval`, `pin-mismatch`, `skill-name-mismatch`, `plugin-form`, `trusted_global_roots`, `includeSticky`, `released_at`, `'bm-planner'`, `createRegistry` and the 19-key order array each present.
- No GSD bookkeeping (`CAT-0`, `Phase 16`) and no em/en dashes in the two created product files or the test (grep clean).

## Next Phase Readiness
- `bm-sdk query craft-skill.insert|release|assess|list` is available for Phase 17 workflow wiring with the same record shape as the CJS command.
- Not done here (by design, consistent with plans 01-03): no `sdk/dist` rebuild or `dist/bm` regeneration with `--check`. This plan adds `sdk/src` and a vitest spec; the generated-plugin rebuild and `--check` PASS remain a later-plan gate (plan 05) per the phase RESEARCH note.
- CAT-05 was already recorded complete by plan 03 (CJS twin); this plan delivers the SDK half of the same requirement.

## Self-Check: PASSED

All created files exist on disk (`sdk/src/query/craft-skill.ts`, `sdk/src/query/craft-skill.test.ts`, the SUMMARY); all three task commits (`10be4da`, `26348e7`, `37aca7a`) are present in git history.

---
*Phase: 16-catalog-and-trust-gate-foundation*
*Completed: 2026-10-05*
