# Requirements: GSD Performance Optimization (Buildomator)

**Defined:** 2026-11-03
**Core Value:** Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility or creating fork maintenance burden.

## v5.1 Requirements

Milestone v5.1: Decision Reconciliation Guard. Spec:
docs/superpowers/specs/2026-11-03-decision-reconciliation-guard-design.md

### Reconciliation

- [x] **RECON-01**: A decision recorded at capture time that clearly contradicts a rule in the project CLAUDE.md or PROJECT.md triggers an in-place rewrite of that rule to match the decision, committed as its own revertible commit, with a notice and no blocking prompt.
- [x] **RECON-02**: A recorded decision whose contradiction with a rule is ambiguous blocks and asks the user which rule wins before anything changes.
- [x] **RECON-03**: At session start, a sweep re-checks decisions recorded since the last reconciliation against the rule docs and surfaces any contradiction for the user to confirm before applying, never a silent rewrite.
- [x] **RECON-04**: Candidate retrieval is mechanical and runs no model; the semantic contradiction judgment runs only when at least one candidate rule exists.
- [x] **RECON-05**: A content-hash ledger records per-decision reconciliation outcomes, so a resolved or dismissed conflict is not raised again and a session with no new decisions does no model work.
- [x] **RECON-06**: The guard never auto-rewrites ROADMAP.md, STATE.md, the global `~/.claude/CLAUDE.md`, or a rule inside an auto-managed block or `@`-include; such conflicts are surfaced for the user instead.
- [x] **RECON-07**: The guard ships across both the CJS and SDK twins, with `dist/bm` regenerated and `build-bm --check` passing on a clean tree.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| File-structure drift reconciliation | Already covered by `drift.cjs` and the VibeDrift-derived gates; a different kind of divergence. |
| Catching contradictions between arbitrary free-form chat turns | Trigger is the structured decision-record path plus the session-start sweep, not every message. |
| Rewriting ROADMAP.md or STATE.md | History and the decision log stay as record; only live rule docs are reconciled. |
| Editing the user's global `~/.claude/CLAUDE.md` | A project decision never silently rewrites cross-project rules; it flags them. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RECON-01 | Phase 19 | Complete |
| RECON-02 | Phase 19 | Complete |
| RECON-03 | Phase 19 | Complete |
| RECON-04 | Phase 19 | Complete |
| RECON-05 | Phase 19 | Complete |
| RECON-06 | Phase 19 | Complete |
| RECON-07 | Phase 19 | Complete |

**Coverage:**
- v5.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-11-03*
*Last updated: 2026-11-03 after defining milestone v5.1*
