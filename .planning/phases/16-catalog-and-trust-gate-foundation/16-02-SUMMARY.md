---
phase: 16-catalog-and-trust-gate-foundation
plan: 02
subsystem: infra
tags: [trust-gate, spdx, license-policy, safety-gate, cjs-sdk-twin, vitest]

# Dependency graph
requires:
  - phase: 16-catalog-and-trust-gate-foundation
    provides: catalog JSON + twin readers with the license policy tables and publisher allowlist the gate consumes
provides:
  - CJS trust gate (bin/lib/skill-trust-gate.cjs) with classifyLicense, checkSafety, assessEntry, renderAssessment
  - SDK trust gate twin (sdk/src/skill-trust-gate.ts) exporting the same functions, finding codes and verdict shapes
  - Two-axis verdict contract (license + safety) that later plans build insertion on
affects: [scoped-insertion, catalog-and-trust-gate-foundation plan 03, plan 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure structural gate: verdict objects over catalog metadata, never-throw, no file read, no free-text input (security.cjs { safe } / { clean, findings[] } precedent)"
    - "Twin gate: one behavior spec implemented verbatim in a CJS module and an SDK module, with a cross-twin parity test over a shared fixture list"
    - "Closed license policy: classifier resolves single and compound SPDX against allow/flag/block tables; unknown operand forces block"

key-files:
  created:
    - bin/lib/skill-trust-gate.cjs
    - sdk/src/skill-trust-gate.ts
    - tests/skill-trust-gate.test.cjs
    - sdk/src/skill-trust-gate.test.ts
  modified: []

key-decisions:
  - "Gate ships in both twins (not CJS-only): workflows call the read side through bm-sdk query today and plans 03/04 will call assess/insert the same way, so an SDK twin avoids an SDK-to-CJS shell-out and keeps twin parity"
  - "scripts_banned at the pin is safe:true with a scripts_banned flag (the ban means do-not-execute the bundled scripts, recorded in the prompt), not a safety finding, per the plan behavior spec"
  - "Compound SPDX resolves conservatively: OR keeps the best operand verdict, AND/WITH keep the worst, and any unknown operand forces block"

patterns-established:
  - "Two-axis structural trust gate returning verdict objects, mirrored across CJS and SDK with a whole-object parity test"

requirements-completed: [CAT-03, CAT-04]

# Metrics
duration: 8min
completed: 2026-10-05
---

# Phase 16 Plan 02: Trust Gate (Safety + License) Summary

**Two-axis trust gate built as pure structural checks over catalog metadata: a license classifier (single and compound SPDX against the policy tables) and a safety axis (publisher allowlist, full-sha pin, https source, bundled-scripts review-or-ban, trust tier, tooling licenses), shipped in both the CJS and SDK twins and proven identical by a cross-twin parity test.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-05T03:04:50Z
- **Completed:** 2026-10-05T03:13:14Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments
- `bin/lib/skill-trust-gate.cjs`: `classifyLicense` (allow MIT/Apache/BSD/ISC, flag copyleft and source-available, block no-license/unknown/non-commercial/proprietary, compound-expression resolution), `checkSafety` (ten finding codes), `assessEntry` (combined verdict plus factual insert-prompt lines), `renderAssessment`. No file reads, no free-text input, never throws.
- `sdk/src/skill-trust-gate.ts`: the SDK twin, mirroring the CJS module function for function and string for string, with typed verdict and finding interfaces over the shared catalog types.
- `tests/skill-trust-gate.test.cjs`: a 40-check harness covering every classifyLicense / checkSafety / assessEntry behavior line, the flags-are-not-blocks and independent-tooling-license cases, the obligations-surfaced prompt line, and the never-throw contract.
- `sdk/src/skill-trust-gate.test.ts`: a vitest parity suite asserting `assessEntry` deep-equals the CJS twin on 16 fixtures (every rejection and flag path), `classifyLicense` deep-equals on 16 SPDX strings, the seo prompt renders identically across twins, and the SDK gate never throws.

## Task Commits

Each task was committed atomically:

1. **Task 1: CJS gate (license + safety axes)** - `40fc44e` (feat)
2. **Task 2: SDK twin of the gate** - `b686ec6` (feat)
3. **Task 3: Gate tests (CJS matrix + cross-twin parity)** - `bdf8165` (test)

_Note: the plan's three tasks are tdd-tagged; following the phase's plan-01 split, the implementation tasks carry their own inline `<verify>` and the full test matrix lands in Task 3._

## Files Created/Modified
- `bin/lib/skill-trust-gate.cjs` - CJS trust gate: SAFETY_FINDINGS map, normalizeSpdx, classifyLicense (single + compound), checkSafety, assessEntry, renderAssessment; requires the plan-01 reader for `PINNED_COMMIT_RE` and the default catalog.
- `sdk/src/skill-trust-gate.ts` - SDK twin with typed interfaces (LicenseAssessment, SafetyFinding, EntryAssessment, etc.) and the same rules, finding codes, prompt line formats and message strings verbatim.
- `tests/skill-trust-gate.test.cjs` - 40-check CJS harness (check/assert, PASS/FAIL report, exit 1 on failure).
- `sdk/src/skill-trust-gate.test.ts` - vitest cross-twin parity over a 16-fixture list and a 16-string SPDX list, plus prompt parity and never-throw.

## Decisions Made
- The gate ships in both twins rather than CJS-only, so workflows (which already run the read side through `bm-sdk query`) and plans 03/04 can call assess/insert without an SDK-to-CJS shell-out, and the parity test keeps the two implementations identical.
- A banned bundled-scripts review recorded at the pin yields `safe: true` plus `scripts_banned: true` (surfaced in the prompt as "BANNED, do not execute"), per the plan behavior spec: the ban means the scripts must not run, it does not by itself block using the skill text.
- Compound SPDX resolves conservatively (OR best, AND/WITH worst, any unknown forces block) so a laundered license cannot slip through a disjunction.

## Deviations from Plan

None. The plan executed as written. The behavior line "renderAssessment ... contains 'tier A'" was honored by asserting the rendered line `Trust tier: A` (the gate emits the spec's `Trust tier: <A|B|C>` format); the "tier A" wording in the behavior prose is shorthand for that line.

## Known Stubs
None. Both gate modules are fully implemented; every finding code and verdict path is exercised by a test.

## Threat Flags
None. This plan adds no new network endpoints, auth paths, file access, or schema at a trust boundary; the gate is a pure function over the existing catalog metadata and reads no files. The threats in the plan's register (T-16-06..T-16-10) are the ones this gate mitigates, not new surface.

## Verification Results (observed)
- `node tests/skill-trust-gate.test.cjs` -> exit 0, "40 passed, 0 failed, 40 total".
- `cd sdk && npx vitest run --project unit src/skill-trust-gate.test.ts` -> exit 0, 34 tests passed.
- `cd sdk && npx tsc --noEmit -p tsconfig.json` -> exit 0; full `npx tsc --noEmit` -> exit 0.
- `grep -c "readFileSync\|existsSync\|SKILL.md" bin/lib/skill-trust-gate.cjs` -> 0; `grep -c "from 'node:fs'" sdk/src/skill-trust-gate.ts` -> 0 (neither gate touches the file system).
- Finding-code grep over the CJS gate -> 18 (>= 9 required); four `export function` gate entry points in the SDK twin.
- No GSD bookkeeping (`CAT-0`, `Phase 16`, wave, skeleton) and no em/en dashes in any of the four files (grep clean).

## Next Phase Readiness
- The two-axis verdict contract (`assessEntry` returning `{ verdict, safety, license, tooling, scripts_banned, publisher, prompt[] }`) is the input contract plans 03/04 build scoped insertion on; the human-approval and runtime-HEAD-vs-pin comparison happen at insert time in those plans, outside the gate.
- Not done here (by design, consistent with plan 01's note): `sdk/dist` rebuild and `dist/bm` regeneration with `--check`. This plan adds `bin/lib` and `sdk/src` source plus tests; the generated-plugin twin rebuild and `--check` PASS are handled by a later plan per the phase RESEARCH gate.

## Self-Check: PASSED

---
*Phase: 16-catalog-and-trust-gate-foundation*
*Completed: 2026-10-05*
