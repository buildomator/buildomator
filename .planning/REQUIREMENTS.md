# Requirements: Buildomator Rebrand (v4.1)

**Defined:** 2026-06-29
**Core Value:** Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility or creating fork maintenance burden.

## v4.1 Requirements

Milestone v4.1 ships as plugin **4.1.0**. Rebrand to Buildomator and add a `/bm:`
command surface additively, keeping `/gsd:*` fully working through the 4.x line.

### Brand

- [ ] **BRAND-01**: Project presents as "Buildomator" in README, plugin description, and marketplace text, with `/bm:` as the documented command surface
- [ ] **BRAND-02**: buildomator.com is wired into plugin/repo metadata and README links (homepage/docs)
- [ ] **BRAND-03**: CHANGELOG documents the rebrand and the `/gsd:` → `/bm:` migration path and timeline (retirement at v5.0)

### Buildomator Plugin

- [ ] **BM-01**: A Buildomator plugin whose `plugin.json`/`marketplace.json` name is `bm`, so every command surfaces as `/bm:*`
- [ ] **BM-02**: Every GSD command/skill is available under `/bm:` with behavior identical to its `/gsd:` equivalent
- [ ] **BM-03**: The Buildomator plugin's agents, hooks, and MCP server function identically to the gsd plugin's

### Backward Compatibility

- [x] **COMPAT-01**: `/gsd:*` continues to work with zero re-enable for existing users throughout the 4.x line
- [x] **COMPAT-02**: With both `gsd` and `bm` plugins enabled, hooks fire exactly once (no double PostToolUse checkpoint, validate-commit, or session-state)
- [x] **COMPAT-03**: With both plugins enabled, project state is consistent and not corrupted by a second MCP server / duplicate writers
- [x] **COMPAT-04**: `/gsd:*` surfaces a deprecation nudge pointing users to `/bm:`, without blocking the command

### Build & Release

- [x] **BUILD-01**: A build step generates both the `bm` and `gsd` plugin packages from one source (stamping the `name` field) so the two never drift
- [x] **BUILD-02**: The release process publishes both plugins and bumps their versions in lockstep (4.1.0), updating both `plugin.json` and `marketplace.json`
- [x] **BUILD-03**: Repo and install/cache id remain `gsd-plugin`; `CLAUDE_PLUGIN_ROOT` and hook path resolution are verified unaffected by the rebrand

## Future Requirements

Deferred beyond v4.1.

### v5.0 (breaking)

- **RETIRE-01**: Remove `/gsd:*` and the compat `gsd` plugin (the one breaking moment)

## Out of Scope

Explicitly excluded from v4.1.

| Feature | Reason |
|---------|--------|
| Retiring `/gsd:` | Breaking change reserved for v5.0; v4.1 is additive |
| Renaming the repo / install cache id to `buildomator` | High-risk lever (path/CLAUDE_PLUGIN_ROOT/hook resolvers keyed on `gsd-plugin`); deferred to a later optional step |
| Renaming binaries (`gsd-sdk`/`gsd-tools`) | Internal tool names; not user-facing command surface; defer with the repo rename |
| `/bm:` + `/gsd:` aliasing within one plugin | Claude Code gives one plugin one prefix with no aliasing; coexistence requires two plugins (the chosen approach) |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 15 | Pending |
| BRAND-02 | Phase 15 | Pending |
| BRAND-03 | Phase 15 | Pending |
| BM-01 | Phase 13 | Pending |
| BM-02 | Phase 13 | Pending |
| BM-03 | Phase 13 | Pending |
| COMPAT-01 | Phase 14 | Complete |
| COMPAT-02 | Phase 14 | Complete |
| COMPAT-03 | Phase 14 | Complete |
| COMPAT-04 | Phase 14 | Complete |
| BUILD-01 | Phase 12 | Complete |
| BUILD-02 | Phase 12 | Complete |
| BUILD-03 | Phase 12 | Complete |

**Coverage:**
- v4.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 — traceability table filled during roadmap creation (phases 12-15)*
