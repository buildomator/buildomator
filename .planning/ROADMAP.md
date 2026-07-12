# Roadmap: GSD Performance Optimization

## Milestones

- [x] **v1.0 MVP** — Phases 1-3 (shipped 2026-04-06)
- [x] **v1.1 Session Continuity** — Phases 4-5 (shipped 2026-04-20; Phase 6 dropped, rehomed to v1.2 backlog)
- [x] **v1.2 Upstream Resilience** — Phases 7-9 (shipped 2026-04-24 — 3 phases, 3 plans, 14 tasks, ~26min executor time)
- [x] **v1.3 Consistency & Code-Integrity Safeguards** — Phases 10-11 (shipped 2026-06-27, released as plugin v4.0.0)
- [ ] **v4.1 Buildomator Rebrand** — Phases 12-15 (in progress, ships as plugin 4.1.0)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) — SHIPPED 2026-04-06</summary>

- [x] Phase 1: Skill and Agent Optimization (3/3 plans) — completed 2026-04-01
- [x] Phase 2: MCP Server (2/2 plans) — completed 2026-04-04
- [x] Phase 3: Plugin Packaging and Memory (5/5 plans) — completed 2026-04-06

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v1.1 Session Continuity (Phases 4-5) — SHIPPED 2026-04-20</summary>

- [x] Phase 4: Checkpoint and Resume (3/3 plans) — completed 2026-04-11 (live `/compact` UAT passed 2026-04-20)
- [x] Phase 5: Backup Trigger and Cleanup (2/2 plans) — completed 2026-04-20
- [~] Phase 6: Upstream Compatibility and Documentation — dropped 2026-04-20; rehomed to v1.2

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>v1.2 Upstream Resilience (Phases 7-9) — SHIPPED 2026-04-24</summary>

- [x] Phase 7: File-Layout Drift Detector (1/1 plans) — completed 2026-04-21 (baseline 109/38/71; first CI workflow on this repo)
- [x] Phase 8: HANDOFF Schema Baseline + Detector (1/1 plans) — completed 2026-04-21 (schema + 2 detectors; handoff-schema CI job live)
- [x] Phase 9: Unified Check + Docs (1/1 plans) — completed 2026-04-21 (umbrella + README tour + CHANGELOG + 9-step post-sync checklist)

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Consistency & Code-Integrity Safeguards (Phases 10-11): SHIPPED 2026-06-27 (plugin v4.0.0)</summary>

**v1.3 Consistency & Code-Integrity Safeguards (Phases 10-11): SHIPPED 2026-06-27**

Addresses **cross-session drift**: independent agent sessions, no shared memory, produce
locally-reasonable but globally-inconsistent code (duplicate logic under different names,
oscillating naming conventions, split architectural patterns, half-finished stubs). Two
complementary tracks: prevention stops new drift, detection reconciles existing drift.
Origin: `/gsd:explore` session 2026-06-26. VibeDrift v0.14.0 empirically evaluated on 4 repos
(see [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for findings: adopt as optional
external gate + cherry-pick its heuristics; do not vendor).

- [x] Phase 10: Convention and Architectural Conformance (completed 2026-06-26)
- [x] Phase 11: Drift Detection and Consistency Gate (completed 2026-06-27)

### Phase 10: Convention and Architectural Conformance

**Goal:** Stop a new file from introducing cross-session convention/architectural drift, using
the conventions the codebase already exhibits (derived by majority vote, not hardcoded).

**Requirements:** CONV-01, CONV-02, CONV-03, CONV-04

**Success criteria:**

1. `gsd-pattern-mapper` writes a Conventions section (identifier casing, file-name casing, export style) to PATTERNS.md, derived by majority vote with an entropy signal.
2. `gsd-code-reviewer` flags a deliberately convention-violating changed file and passes a conforming one.
3. Verb-vs-body intent and architectural-split (DI vs env, error-handling) checks run with no new runtime dependency, in the existing review path.

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — TDD: bin/lib/conventions.cjs (deriveConventions + checkConformance) + tests/conventions.test.cjs (Wave 0 first)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — Wire `verify conventions` JSON subcommand (manifest/alias/router/handler) + CI test job

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-03-PLAN.md — pattern-mapper Conventions section + code-reviewer CONVENTION tier + code-review.md wiring

### Phase 11: Drift Detection and Consistency Gate

**Goal:** Surface existing cross-session drift repo-wide and gate the pre-1.0 release ceremony.
Detection is 100% native (D-01/D-04 retired the "fallback" framing): three native layers (Phase 10
conventions reuse + phantom/placeholder + MinHash+LCS structural-dup) are the primary sweep, and
VibeDrift is treated as a second upstream whose heuristics are ported and watched, never invoked.

**Depends on:** Phase 10 (reuses the convention-extraction logic as native detection layer 1)

**Requirements:** DRIFT-01, DRIFT-02, DRIFT-03, DRIFT-04, DRIFT-05

**Success criteria:**

1. `audit-milestone` runs an optional, config-gated integrity gate that the intentional CJS<->SDK dual resolver does not trip (allowlist verified, suppressions auditable in the report).
2. `/gsd:scan --drift` produces a ranked drift report on gsd-plugin.
3. Native-primary proven: the sweep runs entirely via native checks (zero runtime dep, VibeDrift never invoked).

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — TDD: bin/lib/semantic-dup.cjs (MinHash+LCS structural near-clone) + tests + calibration on gsd-plugin
- [x] 11-02-PLAN.md — TDD: bin/lib/phantom-scaffolding.cjs + bin/lib/drift-allowlist.cjs + committed .gsd/drift-allowlist.json + .vibedriftignore + tests
- [x] 11-03-PLAN.md — VibeDrift second-upstream watch (bin/check-vibedrift-release.sh) + README + cron-install checkpoint (autonomous:false)

**Wave 2** *(blocked on 11-01 + 11-02)*

- [x] 11-04-PLAN.md — Wire `verify drift` subcommand (cmdVerifyDrift + router) + CJS<->SDK parity (manifest/aliases/2 config keys/dist rebuild) + CI drift-detectors job

**Wave 3** *(blocked on 11-04)*

- [x] 11-05-PLAN.md — `/gsd:scan --drift` ranked report branch + audit-milestone §5.6 opt-in warn-first Drift Integrity Gate

</details>

**v4.1 Buildomator Rebrand (Phases 12-15) — IN PROGRESS**

- [x] **Phase 12: Two-Plugin Build Foundation** - One source generates both `bm` and `gsd` packages; release publishes them in lockstep; `gsd-plugin` repo/cache identity verified unaffected (completed 2026-07-04)
- [x] **Phase 13: Buildomator Plugin** - The `/bm:` plugin is live with full command parity and identical agents, hooks, and MCP behavior (completed 2026-07-06)
- [x] **Phase 14: Backward Compatibility and Coexistence** - `/gsd:*` keeps working with no re-enable; both plugins can run together without hook double-fire, duplicate MCP state, or data corruption; deprecation nudge surfaces in `/gsd:*` (completed 2026-07-11)
- [ ] **Phase 15: Buildomator Identity and Communications** - Project presents as Buildomator everywhere; buildomator.com wired into metadata; CHANGELOG documents migration path and retirement timeline

## Phase Details

### Phase 12: Two-Plugin Build Foundation

**Goal**: One build step produces both the `bm` and `gsd` plugin packages from a single source, released in lockstep, with the repo/cache identity and hook paths verified unaffected by the new dual-package arrangement
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):

  1. Running the build step produces two complete plugin directories (one with `name: bm`, one with `name: gsd`), from a single shared source, with no manual per-package editing required
  2. Both `plugin.json` and `marketplace.json` carry the same version number (4.1.0) for both packages after a release run
  3. `CLAUDE_PLUGIN_ROOT` resolves correctly and hook scripts execute without path errors when the repo/cache id remains `gsd-plugin` (verified by smoke test)
  4. The two packages never drift from each other — the build step is the only place where plugin identity (`name`) diverges

**Plans**: 2 plans

Plans:
**Wave 1**

- [x] 12-01-PLAN.md — bin/build-bm.cjs generate-and-stamp + --check drift mode, bm marketplace entry, version-alignment extension, committed dist/bm (BUILD-01, BUILD-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — CI gates: check-drift bm regenerate-and-diff job, install-smoke bm CLAUDE_PLUGIN_ROOT tripwire job, RELEASING.md dual-package release steps (BUILD-02, BUILD-03)

### Phase 13: Buildomator Plugin

**Goal**: A fully functional `/bm:` plugin exists, with every GSD command available under the `bm` prefix, and agents, hooks, and MCP server behaving identically to the `gsd` plugin
**Depends on**: Phase 12 (build infrastructure must produce the `bm` package)
**Requirements**: BM-01, BM-02, BM-03
**Success Criteria** (what must be TRUE):

  1. Installing the `bm` plugin surfaces all commands as `/bm:*` in Claude Code (e.g., `/bm:new-project`, `/bm:execute-phase`, `/bm:quick`)
  2. Running a `/bm:` command against a project produces the same result as the equivalent `/gsd:` command (same skill content, same plan/state mutations)
  3. The `bm` plugin's agents respond correctly, its hooks fire, and its MCP server exposes the same resources and tools as the `gsd` plugin

**Plans**: 4 plans (2 shipped + 2 gap-closure from code review)
**UI hint**: yes

Plans:
**Wave 1**

- [x] 13-01-PLAN.md - bin/lib/bm-transform.cjs helpers + unit tests, transform wired into generate() (command rewrite + hook-fallback stamp + mcpServers rekey), widened drift test, regenerated dist/bm (BM-02, BM-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md - tests/bm-parity.test.cjs acceptance gate, bm-build-drift parity step, bm-package-smoke hook-fallback + MCP tools/resources parity steps, RELEASING.md update (BM-01, BM-02, BM-03)

**Gap closure** *(from 13-REVIEW.md CR-01/CR-02/WR-01/WR-04 + D-08 namespace scope)*

- [x] 13-03-PLAN.md - broaden the namespace rewrite to gsd:(?!/) (69 agent refs + frontmatter names + slash commands), CR-01 broad hook-fallback stamp with shared STAMP_EXCLUDE, CR-02 sanitizer literal, mcp/server.cjs excluded from rewrite for D-05 byte-identity, regenerated dist/bm (BM-02, BM-03)
- [x] 13-04-PLAN.md - fail-closed census in bm-parity.test.cjs (positive control + real dist/bm scan), WR-01 BM_DIST_DIR test-race isolation, WR-04 install-smoke hygiene, regenerated dist/bm (BM-01, BM-02, BM-03)

### Phase 14: Backward Compatibility and Coexistence

**Goal**: Existing `/gsd:*` users are unaffected, and users running both plugins simultaneously experience no hook double-fire, no duplicate MCP writers, and no corrupted project state; a deprecation nudge points `/gsd:*` users toward `/bm:*`
**Depends on**: Phase 12, Phase 13 (both plugins must exist to test coexistence)
**Requirements**: COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-04
**Success Criteria** (what must be TRUE):

  1. An existing user with only the `gsd` plugin enabled sees no change in `/gsd:*` behavior after upgrading to 4.1.0 (zero re-enable, zero config change)
  2. With both `gsd` and `bm` plugins enabled, the PostToolUse checkpoint, validate-commit, and session-state hooks each fire exactly once per event (verified by log/hook output)
  3. With both plugins enabled, project state files (HANDOFF.json, STATE.md, phase plans) remain consistent and uncorrupted after interleaved `/gsd:*` and `/bm:*` commands
  4. Running any `/gsd:` command displays a non-blocking deprecation nudge that mentions `/bm:` and the v5.0 retirement timeline

**Plans**: 5 plans

Plans:
**Wave 1**

- [x] 14-01-PLAN.md - COMPAT-03: export the state.cjs lock helpers, route the HANDOFF.json write through them, interleaved-write coexistence test
- [x] 14-02-PLAN.md - COMPAT-01/02: bin/lib/coexist.cjs identity election + per-session bm-active marker (+ ensureGsdTempDir export), unit test

**Wave 2** *(blocked on 14-02)*

- [x] 14-03-PLAN.md - COMPAT-01/02/04: wire the election into the four state-mutating hook branches + emit the sentinel-wrapped SessionStart nudge, single-fire test

**Wave 3** *(blocked on 14-03)*

- [x] 14-04-PLAN.md - COMPAT-04: suppressNudge build transform + regenerate dist/bm + nudge-emission test (gsd emits, bm suppresses)

**Wave 4** *(blocked on 14-01..14-04)*

- [x] 14-05-PLAN.md - COMPAT-01..04: gate the four coexistence tests in check-drift.yml + both-plugins single-fire smoke in install-smoke.yml + finalize 14-VALIDATION.md

### Phase 15: Buildomator Identity and Communications

**Goal**: The project presents as Buildomator everywhere a user or potential user encounters it, with buildomator.com wired into metadata and a clear migration story in CHANGELOG and README
**Depends on**: Phase 12 (branding lands in the generated packages)
**Requirements**: BRAND-01, BRAND-02, BRAND-03
**Success Criteria** (what must be TRUE):

  1. The README, plugin description, and marketplace text name the project "Buildomator" and document `/bm:` as the primary command surface
  2. The homepage/docs links in `plugin.json`, `marketplace.json`, and README resolve to buildomator.com
  3. CHANGELOG contains an entry for v4.1.0 that explains the rebrand, describes the additive `/bm:` + retained `/gsd:` strategy, and states the v5.0 retirement date for `/gsd:`

**Plans**: 5 plans

Plans:
**Wave 1**

- [x] 15-01-PLAN.md - README rebrand: Buildomator logo, H1/intro, /bm: examples, Migrating from /gsd: section, buildomator.com links, version 4.1.0 (BRAND-01, BRAND-02)
- [x] 15-02-PLAN.md - plugin.json + both marketplace entries rebranded and linked to buildomator.com, CHANGELOG [4.1.0] migration entry, nudge date aligned to 2026-10-01, version 4.1.0 (BRAND-01, BRAND-02, BRAND-03)
- [x] 15-03-PLAN.md - BLOCKING: fix stampBmManifest to a fixed bm description + update build-bm-drift test (prevents doubled/leaked bm description under D-09) (BRAND-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 15-04-PLAN.md - regenerate dist/bm + full automated gate suite (drift/parity/version-alignment/schema) + date and buildomator.com consistency assertions (BRAND-01, BRAND-02, BRAND-03)

**Wave 3** *(blocked on 15-04)*

- [ ] 15-05-PLAN.md - human-verify checkpoint: read the generated bm migration prose + manifest description and the rebranded README render (BRAND-01, BRAND-03)


## Backlog

Still-deferred, carried forward (surfaces at next `/gsd:new-milestone`):

- **LIFE-02** — staleness threshold detection for HANDOFF.json (resume refuses / warns on stale)
- **LIFE-03** — dedicated `/gsd:checkpoint` skill for manual save (optional; current manual path works via `/gsd:pause-work`)
- **BEHAVIOR-01** — integration tests detect semantic regressions in upstream skills that keep the same name but change behavior (needs integration-test infra)
- **UPST-03** — upstream-PR packaging (blocked on reassessment: is upstream still the right destination given their 1.34→1.38.x trajectory?)
- **UPST-04** — PR-ready diff preparation for upstream submission (blocked on UPST-03)
- **COMPAT-05** — `pluginIdentity` in `bin/lib/coexist.cjs` only matches `/bm/bin/` in its fallback clause, so an off-cache bm deployment under `/bm/hooks/` misidentifies as `gsd` and its bash hooks wrongly yield. Shipped marketplace-cache install path resolves correctly (why CI passes); fix the heuristic to cover `/bm/hooks/` and add a smoke that exercises non-standard deployment paths. Parked from Phase 14 verification (minor, non-blocking).
- **COMPAT-06** — SessionStart single-fire has a first-event TOCTOU window (accepted trade-off D-03): both plugin copies can each run SessionStart once before bm's marker lands, so non-idempotent session-start work (context injection, autoMigrate) may double-run on the very first event of a both-active session. Bounded and tested; close the residual window if a marker-free election becomes feasible. Parked from Phase 14 verification (minor, non-blocking).

## Progress

| Milestone | Phases | Shipped |
|-----------|--------|---------|
| v1.0 MVP | 3 | 2026-04-06 |
| v1.1 Session Continuity | 2 (+ 1 dropped) | 2026-04-20 |
| v1.2 Upstream Resilience | 3 | 2026-04-24 |
| v1.3 Consistency & Code-Integrity Safeguards | 2 | 2026-06-27 |
| v4.1 Buildomator Rebrand | 4 | — |

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Two-Plugin Build Foundation | 2/2 | Complete    | 2026-07-04 |
| 13. Buildomator Plugin | 4/4 | Complete   | 2026-07-10 |
| 14. Backward Compatibility and Coexistence | 5/5 | Complete    | 2026-07-11 |
| 15. Buildomator Identity and Communications | 3/5 | In Progress|  |
