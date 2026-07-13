# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-06
**Phases:** 3 | **Plans:** 10 | **Tasks:** 27

### What Was Built
- Skill isolation via `context: fork` on 15 orchestrator commands (92% CLAUDE.md reduction)
- MCP server with 6 resources + 10 tools replacing prompt injection for state access
- Plugin packaging: 60 skills, 21 agents, 33 templates, 19 references in plugin layout
- Cross-session memory writer using Claude Code's memdir auto-recall pipeline
- Single-step install via `claude plugin install gsd` with legacy migration helper

### What Worked
- **Coarse phase granularity** (3 phases for entire milestone) kept planning overhead minimal while covering a large scope
- **Research-first approach** — 5 research documents before any coding eliminated false starts
- **Extension points strategy** — all 6 integration seams proved stable and sufficient
- **Self-contained skills** — embedding workflow content directly eliminated runtime file reads and external path dependencies
- **Phase 3 executed all 5 plans in a single session** — tight dependency chain benefited from continuous context

### What Was Inefficient
- **Phase 2/3 progress table not updated** — ROADMAP.md progress table showed 0/2 and 0/5 even though all plans were marked [x] in the plans list
- **Phase 3 VERIFICATION.md skipped during execution** — had to create it retroactively during milestone audit, adding an extra step
- **REQUIREMENTS.md checkboxes stale** — 4 Phase 3 requirements never checked off despite being completed, caught only during audit
- **MCP server rebuilt from scratch in Phase 3** — the Phase 2 server was written outside the git tree (`~/.claude/get-shit-done/mcp/`), so Phase 3 couldn't copy it and had to recreate from spec

### Patterns Established
- `CLAUDE_PLUGIN_ROOT` env var for plugin path resolution with dev-mode fallback
- `hooks/hooks.json` auto-loading (not `manifest.hooks`) to avoid duplicate registration
- Stable `phase-NN-slug.md` naming for idempotent memdir writes
- Self-contained skills with embedded workflow content (no execution_context indirection)
- Migration helpers with audit-first approach (safe by default, --clean requires opt-in)

### Key Lessons
1. **Always commit artifacts to the git tree** — Phase 2's MCP server was written to `~/.claude/get-shit-done/mcp/` outside the repo, forcing Phase 3 to rebuild from spec. Artifacts should live in the repo.
2. **Run verification immediately after execution** — skipping Phase 3 verification created a blocker during milestone audit. The verify step should be non-optional.
3. **Keep traceability table in sync** — automated tools should update checkboxes and progress tables when plans complete, not rely on manual updates.
4. **Research investment pays off** — 1,573 lines of research across 5 documents prevented the fork path entirely, saving an estimated 8-16+ hrs/month of maintenance.

### Cost Observations
- Model mix: ~70% opus (planning, execution), ~30% sonnet (checking, verification)
- Sessions: ~8 across 7 days
- Notable: Phase 1 plans averaged 2-3 min each; Phase 2 averaged 7-10 min; Phase 3 averaged 6-8 min

---

## Milestone: v1.3 — Consistency & Code-Integrity Safeguards

**Shipped:** 2026-06-27 (released as plugin v4.0.0)
**Phases:** 2 (Phases 10-11) | **Plans:** 8

### What Was Built
A convention conformance gate (`conventions.cjs` + `verify conventions`, derived by majority vote with entropy, wired into pattern-mapper and code-review) and native, zero-dependency drift detection (MinHash+LCS structural-dup, phantom/placeholder scaffolding, an auditable allowlist) surfaced via `verify drift`, `/gsd:scan --drift`, and an opt-in audit-milestone integrity gate. VibeDrift was adopted as a second, idea-only upstream (ported natively, watched, never run). The plugin moved to its own version line.

### What Worked
- TDD throughout (RED/GREEN commits) made the verifier's job cheap and caught real bugs.
- The verifier earned its keep: it found a genuine blocking bug (the `**` glob mistranslation that silently leaked the CJS/SDK dual-resolver pairs), auto-healed inline rather than spun into a gap phase.
- Sequential-on-main-tree execution traded parallel-worktree speed for bullet-proof reliability in this runtime; the right call for an 8-plan milestone.
- Nyquist validation caught soft tests (`assert.ok(true)` fallbacks) that "passed" but couldn't fail.

### What Was Inefficient
- Several flagship-feature gaps shipped in Phase 11 and had to be caught later by code review (`.vibedriftignore` loaded-but-unused, dead `METHOD_RE`, a consumer-workflow key mismatch). Tighter executor self-review would have caught these in-phase.
- The CJS/SDK dual resolver keeps producing parity drift (config schema, aliases); each is a separate fix until a parity guard exists. Added the config-schema parity test this release.

### Patterns Established
- "Native port + second-upstream watch" as an alternative to vendoring a dependency.
- Auditable-allowlist + ignore-file as the standard way to suppress intentional duplication in drift scans.
- Major version as a deliberate divergence signal, decoupled from upstream tracking.

### Key Lessons
- A config file the user populates (`.vibedriftignore`) that silently does nothing is the worst failure mode for a trust feature; wire the input through end-to-end and test it.
- When two resolvers must agree (CJS/SDK), a parity test is worth more than fixing each drift instance.

### Cost Observations
- Model mix: orchestrator on opus, executors/verifiers/auditors on sonnet.
- Notable: the milestone close turned into a substantial release (flagship-gap fixes + a new cron feature + full docs + Nyquist validation) folded in at the user's request.

---

## Milestone: v4.1 — Buildomator Rebrand

**Shipped:** 2026-07-14 (plugin v4.1.0)
**Phases:** 4 (12-15) | **Plans:** 16 | **Tasks:** 26

### What Was Built
Renamed the project to Buildomator and added a `/bm:` command surface as a second plugin generated from the same source, while `/gsd:*` keeps working untouched through the 4.x line. `bin/build-bm.cjs` produces the committed `dist/bm` package under a byte-level `--check` drift gate; coexistence is guarded against hook double-fire (a shared election in `bin/lib/coexist.cjs`) and concurrent state writes (HANDOFF.json routed through the O_EXCL lock); buildomator.com and the v5.0 (2026-10-01) `/gsd:` retirement date are wired across manifests, README, CHANGELOG, and the on-use nudge.

### What Worked
- The generate-and-stamp build with a byte-exact drift gate made the two-plugin arrangement verifiable in CI rather than by inspection.
- Deciding the additive strategy up front (second generated plugin, defer the breaking `/gsd:` retirement to v5.0) kept the whole milestone zero-disruption for existing users.
- The Phase 15 human-verify checkpoint earned its place: it caught a gate-clean-but-nonsensical `## Migrating from /bm:` heading the transform produced, which no automated check flagged.

### What Was Inefficient
- The "byte-copy + string-substitute" rebrand has a shared blind spot (transform, drift gate, and parity test are all colon-scoped), so semantic breakage in generated prose only surfaces via a human read. Documented as transform fragility.
- Release lag: intermediate plugin versions (4.0.2-4.0.4) were tagged but never got GitHub release entries, and origin sat ~125 commits behind local until this close.

### Patterns Established
- A generated sibling package (`dist/bm`) kept in lockstep with source by a build step plus a byte-level drift CI gate.
- Milestone number tracks the plugin v4.x version (single version line), not a parallel internal v1.x line.

### Key Lessons
- When a transform can produce gate-clean but wrong output, keep one human-read checkpoint in the plan; don't rely solely on token-level gates.
- Fix a generated artifact at its source and regenerate; never hand-edit `dist/bm`.

### Cost Observations
- Model mix: orchestrator on opus, executors/verifiers/auditors on sonnet.
- Notable: milestone close folded in an external PR (#23 argument-hint fix) and a full public release (push + tag + GitHub release) at the user's request.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 3 | First milestone — research-first, coarse phases, plugin packaging |
| v4.1 | ~several | 4 | Generated sibling package (dist/bm) in lockstep via byte-level drift gate; additive rebrand, breaking retirement deferred to v5.0 |

### Top Lessons (Verified Across Milestones)

1. Research before building eliminates costly false starts
2. Commit all artifacts to the git tree — external paths break downstream phases
3. Verification should be non-optional at phase completion
