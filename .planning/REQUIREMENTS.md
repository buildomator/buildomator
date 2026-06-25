# Requirements: GSD Performance Optimization — v1.3 Consistency & Code-Integrity Safeguards

**Defined:** 2026-06-26
**Core Value:** Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility or creating fork maintenance burden.

Cross-session drift is the failure mode this milestone targets: independent agent sessions with no shared memory produce locally-reasonable but globally-inconsistent code. Two tracks — prevention (Phase 10) stops new drift at authoring time; detection (Phase 11) reconciles drift that already happened. Source: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

## v1.3 Requirements

### Convention Conformance (Prevention — Phase 10)

- [ ] **CONV-01**: pattern-mapper writes a Conventions section to PATTERNS.md (identifier casing, file-name casing, export style) derived by majority vote with an entropy signal, so planner and executor get a named contract
- [ ] **CONV-02**: code-review flags a changed file that deviates from the derived convention and passes a conforming one
- [ ] **CONV-03**: code-review runs a verb-vs-body intent check (name says `get`, body mutates)
- [ ] **CONV-04**: code-review runs an architectural-pattern split check (DI vs direct env access, error-handling style), with no new runtime dependency and running in the existing review path

### Drift Detection (Detection — Phase 11)

- [ ] **DRIFT-01**: code-review and audit can invoke an optional VibeDrift gate that probes PATH / `npx` (pinned version), runs `--local-only`, and degrades gracefully when the tool is absent
- [ ] **DRIFT-02**: audit-milestone runs a config-gated pre-1.0 integrity gate (`--fail-on-score N`) with recommended-fix framing
- [ ] **DRIFT-03**: an intentional-duplication allowlist (`.vibedrift`) suppresses the CJS<->SDK dual resolver while keeping suppressions auditable via the report
- [ ] **DRIFT-04**: `/gsd:scan --drift` produces a ranked drift report (lighter than `map-codebase`)
- [ ] **DRIFT-05**: native fallback heuristics (placeholder/phantom detection, MinHash semantic-dup) run when VibeDrift is absent, so the sweep still degrades to GSD-native checks

## Future Requirements

Deferred to a later milestone. Tracked but not in the v1.3 roadmap.

### Lifecycle / Behavior

- **LIFE-02**: staleness threshold detection for HANDOFF.json
- **LIFE-03**: dedicated `/gsd:checkpoint` skill (manual path already works)
- **BEHAVIOR-01**: integration tests for upstream skill behavior drift (needs integration-test infra)
- **UPST-03/04**: upstream PR packaging (blocked on upstream-direction review)

### Tooling (former v1.3 candidates, descoped)

- **TOOL-01**: `allowed-tools` on verification skills for read-only enforcement
- **TOOL-02**: tool restriction profiles (implementation vs verification vs research)
- **TOOL-03**: empirical token measurement before/after

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vendoring VibeDrift into the plugin | 2-day-old v0.x tool; adopt as optional external gate + cherry-pick heuristics so capability survives if the tool does not |
| Hard dependency on VibeDrift | Must run with the tool absent (graceful-degrade); a hard dep breaks multi-CLI and offline use |
| VibeDrift `--deep` on private repos by default | Ships function snippets to its cloud; privacy hard rule — only with explicit user consent |
| Embedding-based semantic duplication | VibeDrift uses MinHash + LCS (structural Type-3); embeddings out of scope for a deterministic, no-LLM sweep |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 10 | Pending |
| CONV-02 | Phase 10 | Pending |
| CONV-03 | Phase 10 | Pending |
| CONV-04 | Phase 10 | Pending |
| DRIFT-01 | Phase 11 | Pending |
| DRIFT-02 | Phase 11 | Pending |
| DRIFT-03 | Phase 11 | Pending |
| DRIFT-04 | Phase 11 | Pending |
| DRIFT-05 | Phase 11 | Pending |

**Coverage:**
- v1.3 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-26*
*Last updated: 2026-06-26 — formalized v1.3 from the /gsd:explore roadmap (Phases 10-11)*
