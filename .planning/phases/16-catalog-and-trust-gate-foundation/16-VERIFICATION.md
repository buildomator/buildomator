---
phase: 16-catalog-and-trust-gate-foundation
verified: 2026-10-05T06:00:00Z
status: passed
score: 5/5 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Phase 16: Catalog and Trust Gate Foundation Verification Report

**Phase Goal:** Build the catalog format and the two-axis trust gate (safety + license) with
scoped insertion, so an external craft skill can be proposed, gated, and injected into
exactly one agent context (ephemeral by default), reusing `agent_skills` +
`trusted_global_roots`, with zero startup cost and no redistribution.

**Verified:** 2026-10-05T06:00:00Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Catalog schema exists (domain -> entry: source, pin, SPDX, tier, scripts flag), metadata+pins only, SEO + DuckDB present, validated by a test | VERIFIED | `sdk/shared/craft-skill-catalog.json` has exactly the `seo-audit` and `duckdb-query` entries with `pinned_commit` 40-hex shas; `node tests/craft-skill-catalog.test.cjs` -> 37/37 PASS (run live); `node tests/craft-skill-no-vendoring.test.cjs` -> 8/8 PASS (run live, confirms no copied skill tree, no third-party string leakage, single catalog file) |
| 2 | Trust gate rejects no-license/unknown, proprietary, non-allowlisted publisher, unreviewed bundled scripts; flags copyleft/source-available; proven by tests | VERIFIED | `node tests/skill-trust-gate.test.cjs` -> 40/40 PASS (run live); `cd sdk && npx vitest run src/skill-trust-gate.test.ts` -> 34/34 PASS (run live); grep confirms `publisher-not-allowlisted`, `pin-not-commit`, `scripts-unreviewed`, `CC-BY-NC-4.0`, `LicenseRef-Proprietary`, `GPL-3.0-only`, `BUSL-1.1`, `NOASSERTION` finding/category codes present in both twins |
| 3 | Accepted skill injected into only the target agent type (ephemeral removed after task, sticky persists), via `agent_skills` + `trusted_global_roots`, recorded in `.planning`; resolver/agent-skills test proves scoping | VERIFIED | Live end-to-end exercise in a throwaway tmp project: `gsd-tools craft-skill insert seo-audit --agent bm-executor --approved` wrote `agent_skills.bm-executor`, and `agent-skills bm-executor --raw` showed the skill while `agent-skills bm-planner --raw` returned empty; pins.json recorded a 19-key record with `mode: ephemeral`, `released_at: null`; `craft-skill release --agent bm-executor` removed the config entry, stamped `released_at`, and `agent-skills bm-executor` then returned empty. `node tests/craft-skill-insertion.test.cjs` (CJS, 21/21) and `cd sdk && npx vitest run src/query/craft-skill.test.ts` (SDK, 16/16) both pass live, covering sticky survival, `--include-sticky`, pin-mismatch, trusted-global-roots reuse. No hook or `skills/*/SKILL.md` references `craft-skill` (grep clean), so nothing loads it at startup |
| 4 | No third-party skill content vendored (reference-only); a test or drift gate confirms metadata+pins only | VERIFIED | `node tests/craft-skill-no-vendoring.test.cjs` -> 8/8 PASS (run live): single catalog file, no `seo-audit`/`query` directory copied anywhere, no third-party marker strings (`coreyhaines31`, `marketingskills`, `duckdb-skills`, `Stichting DuckDB`) outside the catalog JSON, 400-char cap enforced, no smuggled markdown headings |
| 5 | CJS + SDK twins updated where `agent_skills` is twin-covered; `dist/bm` regenerated; `node bin/build-bm.cjs --check` PASS | VERIFIED | `node bin/build-bm.cjs --check` -> `bm drift check: PASS` (run live); `dist/bm/sdk/shared/craft-skill-catalog.json`, `dist/bm/bin/lib/skill-trust-gate.cjs`, `dist/bm/sdk/dist/query/craft-skill.js` all present; CLI-level twin parity confirmed live: `node sdk/dist/cli.js query craft-skill.list` and `node bin/gsd-tools.cjs craft-skill list` return identical `["duckdb-query","seo-audit"]`, and `craft-skill.assess duckdb-query` prompt arrays are byte-identical across both CLIs; `node dist/bm/bin/gsd-tools.cjs craft-skill list` resolves through the flat-layout path |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sdk/shared/craft-skill-catalog.json` | Catalog: policy tables, publishers, 2 seed entries | VERIFIED | Exists, validates, seeded correctly (live `node -e` check + test suite) |
| `bin/lib/craft-skill-catalog.cjs` | CJS reader with closed-schema validator | VERIFIED | Exists, exports present, loads/validates live |
| `sdk/src/craft-skill-catalog.ts` | SDK twin reader | VERIFIED | Compiles (`tsc --noEmit` exit 0), vitest 5/5 pass |
| `bin/lib/skill-trust-gate.cjs` | CJS two-axis gate | VERIFIED | No fs/SKILL.md access (grep clean), 40/40 tests pass |
| `sdk/src/skill-trust-gate.ts` | SDK twin gate | VERIFIED | Compiles, no `node:fs` import, 34/34 vitest pass |
| `bin/lib/craft-skill-insert.cjs` | CJS write-side (list/assess/insert/release) | VERIFIED | Wired into `gsd-tools.cjs`, live insert/release exercised successfully |
| `sdk/src/query/craft-skill.ts` | SDK write-side handlers | VERIFIED | Registered in `command-static-catalog-domain.ts`, 16/16 vitest pass |
| `tests/craft-skill-catalog.test.cjs` | Schema/seed/no-vendoring/parity tests | VERIFIED | 37/37 PASS (run live) |
| `tests/skill-trust-gate.test.cjs` | Rejection/flag matrix | VERIFIED | 40/40 PASS (run live) |
| `tests/craft-skill-insertion.test.cjs` | End-to-end insertion/scoping/release | VERIFIED | 21/21 PASS (run live) |
| `tests/craft-skill-no-vendoring.test.cjs` | Repo-wide no-vendoring guard | VERIFIED | 8/8 PASS (run live) |
| `dist/bm/sdk/shared/craft-skill-catalog.json` | Regenerated bm distribution | VERIFIED | Present; `--check` PASS confirms byte match |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/lib/skill-trust-gate.cjs` | `bin/lib/craft-skill-catalog.cjs` | `require` for policy/publisher tables | WIRED | `assessEntry` on both seed entries returns `verdict: allow` live |
| `sdk/src/skill-trust-gate.ts` | `sdk/src/craft-skill-catalog.ts` | import of same symbols | WIRED | `tsc --noEmit` passes, vitest exercises both |
| `bin/lib/craft-skill-insert.cjs` | `bin/lib/config.cjs setConfigValue` | config write for `agent_skills.<agent>` | WIRED | Live insert wrote `agent_skills.bm-executor`; `setConfigValue` exported (`grep` confirms 1 added line, 0 removed) |
| `bin/lib/craft-skill-insert.cjs` | `bin/lib/skill-trust-gate.cjs assessEntry` | gate verdict required before write | WIRED | Block verdict refuses before any write (test + plan deviation note); live test confirms gate runs first |
| `sdk/src/query/craft-skill.ts` | `sdk/src/query/config-mutation.ts configSet` | config write | WIRED | `configSet([` grep count >= 2 in file; vitest confirms config write |
| `init.cjs buildAgentSkillsBlock` | `config.agent_skills[agent]` | unchanged reader proves scoping | WIRED | Live `agent-skills bm-executor` vs `bm-planner` shows exact scoping; `git diff --quiet -- bin/lib/init.cjs` holds untouched per plan 03 SUMMARY |
| `dist/bm` | `sdk/dist + sdk/shared + bin/lib` | `build-bm.cjs` regeneration | WIRED | `--check` PASS; live CLI parity through `dist/bm/bin/gsd-tools.cjs` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Catalog validates + seeded | `node tests/craft-skill-catalog.test.cjs` | 37/37 PASS | PASS |
| Gate rejection/flag matrix | `node tests/skill-trust-gate.test.cjs` | 40/40 PASS | PASS |
| SDK gate parity | `cd sdk && npx vitest run src/skill-trust-gate.test.ts` | 34/34 PASS | PASS |
| CJS end-to-end insertion | `node tests/craft-skill-insertion.test.cjs` | 21/21 PASS | PASS |
| SDK end-to-end insertion | `cd sdk && npx vitest run src/query/craft-skill.test.ts` | 16/16 PASS | PASS |
| No-vendoring guard | `node tests/craft-skill-no-vendoring.test.cjs` | 8/8 PASS | PASS |
| Live scoped insert + release | manual `gsd-tools craft-skill insert/release` in tmp project | skill appeared for `bm-executor` only, removed after release | PASS |
| TS compiles | `cd sdk && npx tsc --noEmit -p tsconfig.json` | exit 0 | PASS |
| dist/bm drift gate | `node bin/build-bm.cjs --check` | PASS | PASS |
| CLI twin parity | list + assess ids/prompts identical across `sdk/dist/cli.js` and `bin/gsd-tools.cjs` | identical | PASS |
| Full SDK suite regression | `npm --prefix sdk test` | 132 files / 1968 tests passed | PASS |
| Prose/jargon gates | `node bin/maintenance/check-user-docs-prose.cjs` | PASS, baseline unchanged (155/4/0) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAT-01 | 16-01 | Catalog format: domain/trigger -> pinned entry, metadata+pins only | SATISFIED | Catalog JSON + readers + tests, all passing; REQUIREMENTS.md carries inline "(Delivered: Phase 16 Plan 01.)" |
| CAT-03 | 16-02 | Trust gate: safety (publisher allowlist, scripts review/ban, pinned commit) | SATISFIED | `checkSafety` implements all codes; tests pass; REQUIREMENTS.md "(Delivered: Phase 16 Plan 02.)" |
| CAT-04 | 16-02 | Trust gate: license (allow/flag/block + obligations + tooling license) | SATISFIED | `classifyLicense` implements policy; obligations surfaced in prompt; REQUIREMENTS.md "(Delivered: Phase 16 Plan 02.)" |
| CAT-05 | 16-03, 16-04 | Scoped insertion via `agent_skills` + `trusted_global_roots`, ephemeral default, sticky opt-in | SATISFIED | CJS (plan 03) and SDK (plan 04) both implement and test the full contract; REQUIREMENTS.md only annotates "(Delivered: Phase 16 Plan 03, CJS twin.)" — the SDK twin (plan 04) also delivers CAT-05 but has no separate inline annotation. This is a documentation-annotation gap only; the SDK twin's functional delivery is verified directly (16 passing vitest cases, live parity with the CJS twin) |

No orphaned requirements: the phase's declared requirement IDs (CAT-01, CAT-03, CAT-04, CAT-05) match ROADMAP.md's "Requirements:" line for Phase 16 exactly, and every ID is claimed by at least one plan's frontmatter.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across all seven new product files returned zero matches. No em-dashes/en-dashes in any new product file. No stub returns (`return null`, hardcoded `[]`/`{}` feeding render paths) found in the gate or insertion modules; `scripts_review: null` on both seed entries is a correct, intentional value (neither skill bundles scripts), not a stub.

### Human Verification Required

None. All five roadmap success criteria were verified through live test execution (not SUMMARY claims) and a direct manual end-to-end exercise of the insert/release/scoping flow in a throwaway project. No visual, real-time, or external-service behavior requires human judgment in this phase.

### Gaps Summary

No gaps. All CJS and SDK test suites were executed live during this verification (not inferred from SUMMARY.md) and passed: 37/37 (catalog), 40/40 CJS + 34/34 SDK (trust gate), 21/21 CJS + 16/16 SDK (insertion), 8/8 (no-vendoring guard), plus the full SDK regression suite (1968/1968) and `node bin/build-bm.cjs --check` (PASS). A live manual insert/release cycle in a disposable tmp project confirmed scoping (target agent only) and ephemeral release behavior independent of the test harnesses. The only notable item is a minor documentation-annotation gap in REQUIREMENTS.md (CAT-05 names only "Plan 03, CJS twin" even though Plan 04 also delivers the SDK twin of the same requirement) — functionally complete, cosmetic only, not a blocker.

---

*Verified: 2026-10-05T06:00:00Z*
*Verifier: Claude (gsd-verifier)*
