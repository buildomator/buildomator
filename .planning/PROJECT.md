# GSD Performance Optimization via Claude Code Extension Points

## What This Is

A performance-optimized plugin packaging of GSD (Get Shit Done) for Claude Code, now branded **Buildomator**. Reduces per-turn token overhead by ~92%, exposes project state via MCP tools, and bundles everything into a single-install plugin with cross-session memory. As of v4.1.0 it ships two command surfaces from one source: `/bm:` (Buildomator, the primary prefix) and `/gsd:` (retained through the 4.x line, retires at v5.0).

## Core Value

Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility or creating fork maintenance burden.

## Requirements

### Validated

- ✓ Research confirms fork is unsustainable (~8-16+ hrs/month) — existing
- ✓ Research confirms most GSD features work fine externally — existing
- ✓ Six integration seams identified in Claude Code — existing
- ✓ `context: 'fork'` added to 15 GSD orchestrator skills — v1.0
- ✓ `.claude/agents/*.md` definitions enhanced for all 18 GSD agent types with typed capabilities — v1.0
- ✓ CLAUDE.md reduced from ~2,338 to ~174 words (~92% reduction) — v1.0
- ✓ GSD MCP server exposes project state as 6 queryable MCP resources — v1.0
- ✓ 10 MCP tools registered for workflow mutations — v1.0
- ✓ MCP server auto-starts via plugin manifest for existing and new projects — v1.0
- ✓ Phase outcomes and key decisions written to Claude Code memdir — v1.0
- ✓ Project context auto-recalled across sessions via memdir pipeline — v1.0
- ✓ GSD packaged as Claude Code plugin (60 skills, 21 agents, MCP, hooks) — v1.0
- ✓ Single-step install via `claude plugin install gsd` — v1.0
- ✓ PreCompact hook saves HANDOFF.json checkpoint via shared `generateCheckpoint`/`writeCheckpoint` library — v1.1 Phase 4
- ✓ SessionStart hook detects HANDOFF.json and injects auto-resume system message (startup/compact only, skips clear/resume) — v1.1 Phase 4
- ✓ CLAUDE.md `## Session Continuity` section provides hook-independent backup trigger — v1.1 Phase 5
- ✓ `/gsd:resume-work` clears HANDOFF.json after successful resume via `deleteCheckpoint()` + `checkpoint --clear` CLI — v1.1 Phase 5
- ✓ Hook commands fall back to newest cached plugin version when baked `${CLAUDE_PLUGIN_ROOT}` is pruned — v1.1 quick task 260420-vfb
- ✓ Plugin-side `/gsd-<skill>` references normalized to `/gsd:<skill>` with durable maintenance script for post-sync re-runs — v1.1 quick task 260420-cns

- ✓ File-layout drift detector catches dangling `@~/.claude/...` references before they ship — v1.2 Phase 7
- ✓ Drift detectors (file-layout, schema, namespace) run in CI and hard-fail on detected drift — v1.2 Phases 7+8+9
- ✓ Committed HANDOFF schema baseline; `writeCheckpoint()` output validates in CI — v1.2 Phase 8
- ✓ Post-upstream-sync check compares upstream `pause-work` output vs plugin schema — v1.2 Phase 8
- ✓ Unified `bin/maintenance/check-drift.cjs` umbrella runs all three detectors in one pass — v1.2 Phase 9
- ✓ README `## Session continuity + drift resilience` feature tour — v1.2 Phase 9
- ✓ CHANGELOG.md scaffold tracking plugin vs upstream versions — v1.2 Phase 9
- ✓ PROJECT.md post-sync checklist formalized to 9 steps with drift-check gate — v1.2 Phase 9
- ✓ Skill directories renamed `skills/gsd-<name>/` → `skills/<name>/` — fixed duplicated `/gsd:gsd-<skill>` prefix in tab completion — v1.2 quick task 260424-srn
- ✓ PostToolUse periodic checkpoint bridges Claude Code's microcompact gap — file-mutation tool calls trigger a fresh HANDOFF write (throttled to once per 60s) so resume reflects recent state even when only microcompact (not PreCompact) has run — quick task 260425-mct

- ✓ Convention and architectural conformance gate: pattern-mapper Conventions section + code-review convention/verb-vs-body/architectural-split checks, zero new runtime dep (CONV-01..04) — v4.0.0 (Phase 10)
- ✓ Native drift detection: MinHash+LCS structural-dup, phantom/placeholder, and conventions reuse via `verify drift`; ranked `/gsd:scan --drift`; opt-in warn-first audit-milestone integrity gate; committed auditable allowlist + `.vibedriftignore` (DRIFT-02..05) — v4.0.0 (Phase 11)
- ✓ VibeDrift adopted as a second upstream: heuristics ported natively (pinned v0.14.0 baseline), repo watched, never invoked at runtime (DRIFT-01) — v4.0.0 (Phase 11)
- ✓ Weekly plugin self-update watch + CJS/SDK config-schema parity guard — v4.0.0

- ✓ One build step generates both `bm` and `gsd` packages from one source, version single-sourced, byte-level drift gate (BUILD-01..03) — v4.1.0 (Phase 12)
- ✓ `/bm:` plugin live with full command parity and identical agents, hooks, and MCP surface (BM-01..03) — v4.1.0 (Phase 13)
- ✓ `/gsd:*` unaffected; both plugins coexist without hook double-fire or state corruption; on-use `/bm:`+v5.0 deprecation nudge (COMPAT-01..04) — v4.1.0 (Phase 14)
- ✓ Buildomator identity across README/manifests/marketplace, buildomator.com wired, CHANGELOG migration + v5.0 (2026-10-01) retirement story (BRAND-01..03) — v4.1.0 (Phase 15)

### Active

No active milestone. v4.1 shipped and archived; next milestone is defined via `/gsd:new-milestone`.

Deferred (carried to ROADMAP `## Backlog`): LIFE-02, LIFE-03, BEHAVIOR-01, UPST-03/04, COMPAT-05 (pluginIdentity off-cache install), COMPAT-06 (SessionStart first-event TOCTOU). Also deferred: `allowed-tools` on verification skills, tool restriction profiles, empirical token measurement.

### Out of Scope

- Forking Claude Code — research proved unsustainable for solo maintainer
- Modifying Claude Code source — use public extension points only
- Progress UI integration — requires internal API access, low value vs effort
- Coordinator mode integration — feature-gated, wait for public API
- WorkflowTool registration — feature-gated, wait for public API
- Offline mode — real-time context is core value

## Current State

**Shipped:** v4.1 Buildomator Rebrand, released as plugin **v4.1.0** (2026-07-14, GitHub release marked latest). The project is now Buildomator with a `/bm:` command surface added additively: one `bin/build-bm.cjs` step generates the committed `dist/bm` package from the tracked gsd source under a byte-level drift gate (Phase 12), `/bm:` has full command/agent/hook/MCP parity (Phase 13), the two plugins coexist without hook double-fire or state corruption and `/gsd:*` is untouched with an on-use v5.0 nudge (Phase 14), and Buildomator identity plus buildomator.com and the 2026-10-01 `/gsd:` retirement story are wired across README, manifests, marketplace, and CHANGELOG (Phase 15). BUILD/BM/COMPAT/BRAND requirements validated; two minor non-blocking coexistence gaps parked (COMPAT-05, COMPAT-06). Also folded in the PR #23 argument-hint YAML quoting fix (thejesh23). Full v4.1 details: [milestones/v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md).

**Shipped:** v1.3 Consistency & Code-Integrity Safeguards, released as plugin **v4.0.0** (2026-06-27). Phase 10 delivered the convention conformance gate (`bin/lib/conventions.cjs` + `verify conventions` + pattern-mapper/code-review wiring, CONV-01..04). Phase 11 delivered native drift detection (`semantic-dup` + `phantom-scaffolding` + `drift-allowlist` composed via `verify drift`), `/gsd:scan --drift`, the opt-in warn-first audit-milestone integrity gate, and VibeDrift adopted as a second upstream (heuristics ported natively, never invoked at runtime). DRIFT-01..05 validated; both phases nyquist-compliant. v4.0.0 also moved the plugin to its own version line (decoupled from the gsd-core `+2` scheme). Full v1.3 details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

**Shipped:** v1.2 Upstream Resilience — 2026-04-24. Three detectors now run in CI on every push (file-layout, HANDOFF schema, namespace drift), each with a committed ratchet baseline that hard-fails on regression. Unified `check-drift.cjs` orchestrator + post-sync upstream-schema detector close the loop. Plus a skill-directory rename that fixed a duplicated-prefix UX bug in tab completion. Full v1.2 details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

**Previously shipped:** v1.1 Session Continuity (2026-04-20) — checkpoint/resume across `/compact`; details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md). v1.0 MVP (2026-04-06) — plugin packaging + MCP + memory; details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

## Next Milestone

None defined yet. Start with `/gsd:new-milestone` (questioning → research → requirements → roadmap).

**Standing context for whatever comes next:**
- Repo + cache id stay `gsd-plugin` → no `CLAUDE_PLUGIN_ROOT`/hook-path breakage. Full repo/cache rename still deferred (high-risk lever).
- Backward-compat guarantee: `/gsd:*` keeps working through the 4.x line; **v5.0** is the breaking release that retires `/gsd:` (target 2026-10-01) and flips the authored identity fully to Buildomator.
- Single version line: the milestone number tracks the plugin v4.x version (see Key Decisions).

Carried backlog (see ROADMAP `## Backlog`):
- **LIFE-02**: staleness threshold detection for HANDOFF.json
- **LIFE-03**: dedicated `/gsd:checkpoint` skill (optional polish; manual path already works)
- **BEHAVIOR-01**: integration tests for upstream skill behavior drift (needs integration-test infra)
- **UPST-03/04**: upstream PR packaging (blocked on upstream-direction review)
- **COMPAT-05 / COMPAT-06**: two minor non-blocking coexistence residuals parked from Phase 14

## Context

Shipped v1.0 with 3 phases, 10 plans, 27 tasks over 7 days (2026-04-01 → 2026-04-06).
Shipped v1.1 with 2 phases, 5 plans, plus 4 structurally related quick tasks over 9 days (2026-04-11 → 2026-04-20).
Shipped v1.2 with 3 phases, 3 plans, 14 tasks, plus 3 structurally related quick tasks over 5 days (2026-04-20 → 2026-04-24).
Shipped v4.1 with 4 phases, 16 plans, 26 tasks (2026-07-04 → 2026-07-14); released as plugin v4.1.0. Added the generated `dist/bm` Buildomator package alongside the gsd source.
Tech stack: Node.js CJS (bin/lib), MCP server (stdio JSON-RPC), Claude Code plugin system.
~14k LOC in bin/*.cjs, ~573 LOC MCP server, 81 self-contained skill files (~21k LOC).
Published as [jnuyens/buildomator](https://github.com/jnuyens/buildomator) on GitHub.
Based on the [GSD](https://github.com/open-gsd/gsd-core) base tree by TÂCHES (Lex Christopherson), now community-maintained at open-gsd; selectively cherry-picked from the gsd-core 1.x line. As of v4.0.0 the plugin tracks its own version line.

## Constraints

- **No fork**: Use only public extension points
- **Solo maintainer**: Must be maintainable by one person
- **Multi-CLI compat**: GSD also works with other AI CLIs — improvements should be additive, not breaking
- **Update resilience**: Must survive Claude Code monthly updates
- **Measurable**: Token savings must be quantified before and after

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No fork | 8-16+ hrs/month maintenance, security risk, solo dev | ✓ Good |
| Extension points only | HIGH stability, no upstream coupling | ✓ Good |
| MCP server over prompt injection | Structured tools > token-heavy context | ✓ Good — 6 resources + 10 tools via @modelcontextprotocol/sdk |
| CLAUDE_PLUGIN_ROOT env var | Plugin path resolution with dev-mode fallback | ✓ Good — clean separation of installed vs development paths |
| Self-contained skills | Embedded workflow content, no execution_context indirection | ✓ Good — zero external file reads at skill load time |
| Lightweight MCP transport | Custom stdio JSON-RPC instead of full SDK in plugin | ✓ Good — reduces dependency footprint |
| memdir project-type memories | Lean phase memories with Why:/How to apply: structure | ✓ Good — auto-recalled by Claude Code's existing pipeline |
| Plugin hooks via hooks/hooks.json | Auto-loaded by plugin loader, not manifest.hooks | ✓ Good — avoids duplicate registration |
| VibeDrift as a second upstream (native port, never run) | Keep drift detection 100% native/zero-dep while still learning from VibeDrift heuristics | ✓ Good — DRIFT-01; ops-only release watch, nothing on the runtime path (v4.0.0) |
| Plugin on its own version line (v4.0.0) | A second upstream plus features with no upstream equivalent make a gsd-core-coupled major misleading | ✓ Good — major now signals plugin milestones; gsd-core line noted per release for provenance |
| Single version line: milestones track the plugin v4.x version (2026-06-29) | The parallel "internal v1.x" milestone line vs the real 4.x plugin version forced tracking two numbers; nothing in GSD code required it (milestone version is free-form `vX.Y`) | ✓ Good — milestone number = plugin minor (this one = v4.1 → 4.1.0); v1.0–v1.3 archives unchanged |
| Additive rebrand via a second generated plugin (v4.1) | Claude Code gives one plugin exactly one command prefix with no aliasing, so keeping `/gsd:*` alive while adding `/bm:` required shipping `bm` as a second plugin generated from the same source; retiring `/gsd:` is deferred to the v5.0 breaking major | ✓ Good — zero-disruption for existing users; `dist/bm` stays in lockstep via `bin/build-bm.cjs` + byte-level drift gate |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
5. Update `plugins/gsd/` in [davepoon/buildwithclaude](https://github.com/davepoon/buildwithclaude) — bump version, sync agents and skills, update README

**After each upstream GSD sync** (via `/gsd:quick`):
1. Sync `bin/lib/*.cjs` (preserve local patches in core.cjs), `bin/gsd-tools.cjs` (preserve local patches), `get-shit-done/workflows/` → `workflows/` (full copy — these are the bodies referenced by `@${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md` from skills), `references/`, `templates/`, `contexts/`
2. Bump version in: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
3. **Update README.md**: bump "Based on" version line, update skill/agent counts, add/update feature descriptions for new upstream capabilities
4. Update this file's Context section (`Based on [GSD x.y.z]`)
5. **Update `CHANGELOG.md`**: add a new section at the top for the new plugin version, noting the upstream base version in trailing parens (`## [x.y.z] - YYYY-MM-DD  (based on upstream GSD a.b.c)`), with `### Added` / `### Changed` / `### Fixed` subsections summarising what the sync brings
6. Smoke-test: `node -e "require('./bin/lib/core.cjs')"` + verify local patches (resolveGsdRoot, resolveGsdDataDir, resolveGsdAsset)
7. Run `node bin/maintenance/rewrite-command-namespace.cjs` to normalize any new dash-style command refs the upstream sync introduced (`/gsd-<skill>` → `/gsd:<skill>`)
8. Run `node bin/maintenance/check-drift.cjs` — **must exit 0** before declaring the sync complete. If any detector fails, either fix the drift or (if the increase is intentional and reviewed) regenerate the relevant baseline with that detector's `--write-baseline` flag
9. **Run `UPSTREAM_VERSION=v1.x.y node bin/maintenance/check-upstream-schema.cjs`** (use the just-synced version) — must exit 0 before declaring the sync complete. If upstream added fields, decide whether to absorb them into `schema/handoff-v1.json` as optional or bump to a `handoff-v2.json` alongside

---
*Last updated: 2026-07-14 after the v4.1 Buildomator Rebrand milestone shipped as plugin v4.1.0 (Phases 12-15: two-plugin build foundation, the `/bm:` plugin, backward-compat coexistence, and Buildomator identity; BUILD/BM/COMPAT/BRAND validated, COMPAT-05/06 parked). Prior: 2026-07-04 — Phase 12 complete. Prior: 2026-06-29 — started milestone v4.1; adopted a single version line so milestones track the plugin v4.x version. Prior: 2026-06-27 after the v1.3 milestone shipped as plugin v4.0.0 (Phase 10 convention conformance gate + Phase 11 native drift detection, VibeDrift second upstream; plugin moved to its own version line). Prior: 2026-05-11 synced upstream GSD 1.41.2 (plugin v2.42.4). Bundled SDK v1.50.0-canary.0.*
