# GSD Performance Optimization via Claude Code Extension Points

## What This Is

A performance-optimized plugin packaging of GSD (Get Shit Done) for Claude Code. Reduces per-turn token overhead by ~92%, exposes project state via MCP tools, and bundles everything into a single-install plugin with cross-session memory.

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

### Active (v1.3 — Consistency & Code-Integrity Safeguards)

Prevention (Phase 10):
- [ ] **CONV-01** — pattern-mapper writes a derived Conventions section to PATTERNS.md (majority-vote + entropy)
- [ ] **CONV-02** — code-review flags changed files that deviate from the derived convention
- [ ] **CONV-03** — code-review runs a verb-vs-body intent check
- [ ] **CONV-04** — code-review runs an architectural-pattern split check (DI vs env, error handling)

Detection (Phase 11):
- [ ] **DRIFT-01** — optional VibeDrift gate (pinned, `--local-only`, graceful-degrade when absent)
- [ ] **DRIFT-02** — config-gated pre-1.0 integrity gate in audit-milestone (`--fail-on-score`)
- [ ] **DRIFT-03** — intentional-duplication allowlist suppresses the CJS<->SDK dual resolver, auditably
- [ ] **DRIFT-04** — `/gsd:scan --drift` produces a ranked drift report
- [ ] **DRIFT-05** — native fallback heuristics run when VibeDrift is absent

Deferred (not in v1.3): `allowed-tools` on verification skills, tool restriction profiles, empirical token measurement.

### Out of Scope

- Forking Claude Code — research proved unsustainable for solo maintainer
- Modifying Claude Code source — use public extension points only
- Progress UI integration — requires internal API access, low value vs effort
- Coordinator mode integration — feature-gated, wait for public API
- WorkflowTool registration — feature-gated, wait for public API
- Offline mode — real-time context is core value

## Current State

**Shipped:** v1.2 Upstream Resilience — 2026-04-24. Three detectors now run in CI on every push (file-layout, HANDOFF schema, namespace drift), each with a committed ratchet baseline that hard-fails on regression. Unified `check-drift.cjs` orchestrator + post-sync upstream-schema detector close the loop. Plus a skill-directory rename that fixed a duplicated-prefix UX bug in tab completion. Full v1.2 details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

**Previously shipped:** v1.1 Session Continuity (2026-04-20) — checkpoint/resume across `/compact`; details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md). v1.0 MVP (2026-04-06) — plugin packaging + MCP + memory; details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

## Current Milestone: v1.3 Consistency & Code-Integrity Safeguards

**Goal:** Catch cross-session drift — duplicate logic under different names, oscillating naming conventions, split architectural patterns, and half-finished stubs — through prevention at authoring time and detection repo-wide.

**Target features:**
- Convention/architectural conformance in plan -> execute -> review (Phase 10): pattern-mapper emits a derived Conventions section; code-review gains conformance, verb-vs-body, and architectural-split dimensions.
- Repo-wide drift detection (Phase 11): a consistency sweep plus an optional, config-gated VibeDrift gate with an intentional-duplication allowlist and a GSD-native fallback.

**Scoped:** 2026-06-26 via `/gsd:explore`; requirements formalized via `/gsd:new-milestone`. Roadmap: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md). Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

Carried backlog (still deferred, not in v1.3):
- **LIFE-02** — staleness threshold detection for HANDOFF.json
- **LIFE-03** — dedicated `/gsd:checkpoint` skill (optional polish; manual path already works)
- **BEHAVIOR-01** — integration tests for upstream skill behavior drift (needs integration-test infra)
- **UPST-03/04** — upstream PR packaging (blocked on upstream-direction review)

## Context

Shipped v1.0 with 3 phases, 10 plans, 27 tasks over 7 days (2026-04-01 → 2026-04-06).
Shipped v1.1 with 2 phases, 5 plans, plus 4 structurally related quick tasks over 9 days (2026-04-11 → 2026-04-20).
Shipped v1.2 with 3 phases, 3 plans, 14 tasks, plus 3 structurally related quick tasks over 5 days (2026-04-20 → 2026-04-24).
Tech stack: Node.js CJS (bin/lib), MCP server (stdio JSON-RPC), Claude Code plugin system.
~14k LOC in bin/*.cjs, ~573 LOC MCP server, 81 self-contained skill files (~21k LOC).
Published as [jnuyens/gsd-plugin](https://github.com/jnuyens/gsd-plugin) on GitHub.
Based on [GSD 1.41.2](https://github.com/gsd-build/get-shit-done) by TACHES (Lex Christopherson).

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
*Last updated: 2026-06-26 — formalized milestone v1.3 Consistency & Code-Integrity Safeguards (requirements CONV-01..04, DRIFT-01..05 mapped to Phases 10-11; roadmap was scoped earlier the same day via /gsd:explore). Prior: 2026-05-11 synced upstream GSD 1.41.2 (plugin v2.42.4) — state-mutation data-loss fixes, verifier hardening (TBD/FIXME/XXX rejection + direct probe execution), executor stall detection, phase remove --force renumbering fix, Codex/Gemini/Windows install hardening, detect-custom-files scanning skills/. Bundled SDK still v1.50.0-canary.0.*
