# Roadmap: GSD Performance Optimization

## Milestones

- [x] **v1.0 MVP** — Phases 1-3 (shipped 2026-04-06)
- [x] **v1.1 Session Continuity** — Phases 4-5 (shipped 2026-04-20; Phase 6 dropped, rehomed to v1.2 backlog)
- [x] **v1.2 Upstream Resilience** — Phases 7-9 (shipped 2026-04-24 — 3 phases, 3 plans, 14 tasks, ~26min executor time)
- [x] **v1.3 Consistency & Code-Integrity Safeguards** — Phases 10-11 (shipped 2026-06-27, released as plugin v4.0.0)
- [x] **v4.1 Buildomator Rebrand** — Phases 12-15 (shipped 2026-07-14, released as plugin v4.1.0)

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

<details>
<summary>✅ v4.1 Buildomator Rebrand (Phases 12-15): SHIPPED 2026-07-14 (plugin v4.1.0)</summary>

**v4.1 Buildomator Rebrand (Phases 12-15): SHIPPED 2026-07-14 (released as plugin v4.1.0)**

Renames the project to Buildomator and adds a `/bm:` command surface generated as a
second plugin from the same source, while `/gsd:*` keeps working untouched through the
whole 4.x line. One `bin/build-bm.cjs` step produces the committed `dist/bm` package
under a byte-level drift gate; coexistence is guarded against hook double-fire and
concurrent state writes; buildomator.com and the v5.0 (2026-10-01) `/gsd:` retirement
date are wired across the manifests, README, CHANGELOG, and the on-use nudge.

- [x] Phase 12: Two-Plugin Build Foundation (2/2 plans) — completed 2026-07-04
- [x] Phase 13: Buildomator Plugin (4/4 plans) — completed 2026-07-06
- [x] Phase 14: Backward Compatibility and Coexistence (5/5 plans) — completed 2026-07-11
- [x] Phase 15: Buildomator Identity and Communications (5/5 plans) — completed 2026-07-14

Full details: [milestones/v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md)

</details>

## Backlog

Still-deferred, carried forward (surfaces at next `/gsd:new-milestone`):

- **LIFE-02** — staleness threshold detection for HANDOFF.json (resume refuses / warns on stale)
- **LIFE-03** — dedicated `/gsd:checkpoint` skill for manual save (optional; current manual path works via `/gsd:pause-work`)
- **BEHAVIOR-01** — integration tests detect semantic regressions in upstream skills that keep the same name but change behavior (needs integration-test infra)
- **UPST-03** — upstream-PR packaging (blocked on reassessment: is upstream still the right destination given their 1.34→1.38.x trajectory?)
- **UPST-04** — PR-ready diff preparation for upstream submission (blocked on UPST-03)
- **COMPAT-05** RESOLVED 2026-07-14 (quick 260714-coq): `pluginIdentity` in `bin/lib/coexist.cjs` is now segment-based, so `/bm/hooks/` and off-cache or any-marketplace bm installs identify as `bm` correctly. It previously matched only `/bm/bin/`. Permanent tests in `tests/coexist.test.cjs`.
- **COMPAT-06** — SessionStart single-fire has a first-event TOCTOU window (accepted trade-off D-03): both plugin copies can each run SessionStart once before bm's marker lands, so non-idempotent session-start work (context injection, autoMigrate) may double-run on the very first event of a both-active session. Bounded and tested; close the residual window if a marker-free election becomes feasible. Parked from Phase 14 verification (minor, non-blocking).

## Progress

| Milestone | Phases | Shipped |
|-----------|--------|---------|
| v1.0 MVP | 3 | 2026-04-06 |
| v1.1 Session Continuity | 2 (+ 1 dropped) | 2026-04-20 |
| v1.2 Upstream Resilience | 3 | 2026-04-24 |
| v1.3 Consistency & Code-Integrity Safeguards | 2 | 2026-06-27 |
| v4.1 Buildomator Rebrand | 4 | 2026-07-14 |
