# Milestones

## v4.9 Craft Skill Catalog (Shipped: 2026-10-13)

**Phases completed:** 3 phases, 15 plans, 37 tasks

**Key accomplishments:**

- Curated craft-skill catalog JSON (SEO + DuckDB, metadata and pins only) with CJS and SDK twin readers that validate a closed 18-key schema, reject floating refs and smuggled bodies, and agree on every fixture.
- Two-axis trust gate built as pure structural checks over catalog metadata: a license classifier (single and compound SPDX against the policy tables) and a safety axis (publisher allowlist, full-sha pin, https source, bundled-scripts review-or-ban, trust tier, tooling licenses), shipped in both the CJS and SDK twins and proven identical by a cross-twin parity test.
- A `gsd-tools craft-skill` command family (list, assess, insert, release) that assesses a catalog entry through the trust gate, requires a recorded human approval, verifies the local checkout against the pin, then writes one `agent_skills.<agent>` entry through the existing locked config path plus a reproducibility record under `.planning/craft-skills/pins.json`: ephemeral by default, sticky by opt-in, with the reader left byte-for-byte untouched and scoping proven by running it.
- The phase-close plan: rebuilt the committed `sdk/dist` and regenerated `dist/bm` so `node bin/build-bm.cjs --check` reports PASS on the committed tree, proved both twins' CLIs return the same two seed ids and identical assessment prompts, added a repo-wide no-vendoring guard, wired the four new CJS tests into CI, and documented the catalog, the trust gate and the `craft-skill` command family in the README feature table and the SDK handler notes, with no version bump and no CHANGELOG entry.
- Deterministic `craft-skill match "<scope>"` trigger pre-filter shipped byte-identically in the CJS and SDK twins, each candidate carrying the publisher label, SPDX license, obligation, trust tier, gate verdict and ready-to-render prompt lines so a surface needs no second assess call.
- One lazy-loaded reference specifies the full propose-on-fit procedure (pre-filter, relevance, interactive accept, autonomous auto-insert at verdict === 'allow', release, checkout contract, doc routing) for discuss-phase, quick and autonomous, plus a passive executor note routing document deliverables to Claude Code's built-in doc skills.
- Threaded craft-skill propose-on-fit into discuss-phase, quick, and autonomous: each calls craft-skill.match at the per-task scope point, lazy-loads the shared reference only when candidates exist, and routes accept/insert/release per surface (record-only, interactive-insert, allow-gated auto-insert).
- match pre-filter unit cases plus a full SEO propose-on-fit chain (match, accept, ephemeral insert, executor-scoped read, id-scoped release) proven through the spawned CJS CLI
- Static wiring guard (16 checks) that ratchets the propose-on-fit surfaces, a CI step running it, a README feature row, and regenerated sdk/dist + dist/bm with `bm drift check: PASS`.
- Zero-dep CJS loud-fail gate over the plugin's 86 own skills: a fixed count ceiling of 90 with a warn band from 88, a 380-char description ratchet, and a narrow name/description/allowed-tools hard-fail subset, test-driven by a 24-case sandbox discrimination test.
- The SKILL.md conformance gate now runs as its own CI job, blocks regressing commits locally with no auto-regen, and sits in the check-drift.cjs umbrella; README documents the gate, the fifth idea-only upstream, the opt-in pinned external validate and the opt-in skills.sh consumption path.
- Opt-in, version-pinned `npx skills-ref@0.1.5 validate` added to the trust gate's assess path in both twins, failing closed to a block, with the pure gate kept pure and twin parity proven by a shim that records the exact argv
- dist/bm regenerated to mirror every phase-18 change, the full CAT-07/CAT-08 verification set run green, and the [SUS] skills-ref@0.1.5 provenance accepted by a human for the opt-in, pinned, fail-closed external-validate path.

**Release status:** Released as plugin v4.9.2 on 2026-10-14 (tag v4.9.2, GitHub release published). The catalog phases (16-18) landed additively on master after the v4.9.1 tag (2026-09-24, Opus 5.5 tier); 4.9.2 bumped `plugin.json` and both `marketplace.json` entries, carrying the catalog plus the ship verification-freshness warning and two post-catalog fixes (WR-01 fail-closed, the `/gsd:` namespace settle).

**Known deferred items at close:** 12 (see STATE.md Deferred Items). All carry-over, none introduced by v4.9: Phase 13/14 verification gaps (from v4.1), 4 quick tasks without a SUMMARY.md on disk (2 recorded complete), 5 June todos, and SEED-001. GitHub issue #34 (ship verification not revision-bound) pairs with SEED-001 as a next-milestone candidate.

---

## v4.1 Buildomator Rebrand (Shipped: 2026-07-13)

**Phases completed:** 4 phases, 16 plans, 26 tasks

**Key accomplishments:**

- One `node bin/build-bm.cjs` command generates the committed dist/bm Buildomator package from the tracked gsd source, stamping only name/displayName/description, single-sourcing the version across all four manifest sites, with a byte-level --check drift gate.
- CI now enforces the two-package arrangement: a bm-build-drift job fails on any dist/bm divergence, a bm-package-smoke job proves bm resolves via its own CLAUDE_PLUGIN_ROOT with a fallback tripwire, and RELEASING.md documents the dual-package release.
- dist/bm is now a self-consistent Buildomator package: every /gsd: command and plugin-owned path reads /bm:, all three hook cache-fallback carriers target the bm cache dir, the MCP server registers under the bm key, and the drift gate compares against the deterministic transform of source.
- CI is now the acceptance gate for the bm package: a new command-inventory parity test runs in bm-build-drift, bm-package-smoke proves the stamped hook fallbacks (both carriers) and an identical MCP tool/resource surface at runtime via dynamic comparison, and RELEASING.md describes the current transform instead of a fixed limitation.
- HANDOFF.json writes now serialize through the same O_EXCL lock as STATE.md and land via atomic temp+rename, so two coexisting plugin writers can no longer truncate the file to invalid JSON.
- Coexistence election wired into both shared hook dispatch points so a both-active session collapses to one effective fire across every merged hook, plus a sentinel-wrapped gsd SessionStart /bm: + v5.0 deprecation nudge.
- A self-protected, line-anchored suppressNudge transform strips the sentinel-bracketed /bm: rename notice from the generated bm package, single-sourced in bm-transform.cjs and enforced by the --check drift gate, so bm never tells users to switch to bm while gsd keeps emitting it (including under yield).
- The four coexistence tests now run as a bm-coexistence CI job on every push, and install-smoke proves package-level single-fire (the gsd copy yields its HANDOFF.json write when a bm-active marker is present, with a no-marker control).
- README.md rebranded to Buildomator: new header logo, Buildomator H1/intro, /bm: command examples throughout, a "Migrating from gsd" section naming the 2026-10-01 v5.0 retirement, buildomator.com links, and the Plugin version line bumped to 4.1.0.

**Released:** plugin v4.1.0 (tag `v4.1.0`, GitHub release marked latest, 2026-07-14). Includes the argument-hint YAML quoting fix from PR #23 (thejesh23, closes #22).

**Known deferred items at close:** 43 (see STATE.md Deferred Items). Non-blocking: Phase 14 has 2 minor documented residuals (pluginIdentity edge case for non-cache bm installs; accepted SessionStart TOCTOU), Phase 13 has one live `/bm:*` install check that needs a real Claude Code host, plus 35 carry-over quick tasks, 5 todos, and 1 seed from earlier milestones.

---

## v1.3 Consistency and Code-Integrity Safeguards (Shipped: 2026-06-27)

**Phases completed:** 2 phases, 8 plans, 7 tasks

**Key accomplishments:**

- Zero-dep CJS module deriving file-name/identifier casing + export/import style by majority vote with normalized Shannon entropy, plus per-file CONVENTION-tier conformance, verb-vs-body intent, and catch-handling checks that never block.
- Task 1 — handler + router branch (commit 81eaba7):
- Task 1 — gsd-pattern-mapper Step 5.5 (commit 169e00d):
- 1. [Rule 1 - Bug] Block comment doc contained `
- One-liner:
- Task 1: `cmdVerifyDrift` + router case

---

## v1.0 MVP (Shipped: 2026-04-06)

**Phases completed:** 3 phases, 10 plans, 27 tasks

**Key accomplishments:**

- Added `context: fork` to all 15 GSD orchestrator commands so skill prompts execute in isolated sub-agent contexts instead of polluting the parent conversation
- All 18 GSD agent definitions enhanced with typed capability frontmatter (maxTurns, effort, permissionMode) for agent spawning via Claude Code's AgentJsonSchema
- Reduced CLAUDE.md from ~2,338 to ~174 words (~92% reduction) by adding --minimal flag to generate-claude-md that replaces project/stack/conventions/architecture sections with on-demand placeholders
- MCP server with stdio transport exposing 6 read-only GSD resources via @modelcontextprotocol/sdk, auto-discovered by Claude Code through .mcp.json
- GSD plugin manifest with MCP metadata, packaged runtime path resolution via CLAUDE_PLUGIN_ROOT/CLAUDE_PLUGIN_DATA, and repo-owned validation
- 60 self-contained skills, 21 agents, 33 templates, 19 references migrated to plugin layout with zero legacy path dependencies
- GSD hooks packaged in hooks/hooks.json and MCP server at mcp/server.cjs with legacy .mcp.json dependency removed
- Phase-completion memory writer using Claude Code memdir with lean project-type memories and auto-recall
- Plugin distribution contract, README with single-step install, legacy migration helper, and clean runtime audit

---

## v1.1 Session Continuity (Shipped: 2026-04-20)

**Phases completed:** 2 phases (Phase 4 + Phase 5), 5 plans + 4 structurally related quick tasks, over 9 days (2026-04-11 → 2026-04-20). Phase 6 dropped mid-milestone per the 2026-04-20 audit rescope; 7 requirements rehomed to v1.2 backlog.

**Key accomplishments:**

- End-to-end session continuity across `/compact` — PreCompact hook writes HANDOFF.json (19-field schema); SessionStart hook detects it and auto-invokes `/gsd:resume-work`. Live round-trip verified 2026-04-20. Zero user intervention required.
- Hook-independent fallback path via `## Session Continuity` section in CLAUDE.md — provides a second trigger channel for CLIs without hook support or when the hook is overridden. Same skill executes; same end state.
- Full handoff lifecycle — creation, detection, **and cleanup**. `/gsd:resume-work` step 6 invokes `checkpoint --clear` after successful resume, closing the stale-HANDOFF-triggers-phantom-resume failure mode.
- Disciplined mid-milestone rescope — AUDIT-v1.1.md found upstream-compat scope compromised by upstream drift; Option C trimmed aggressively and shipped. Decision trail preserved for clean v1.2 context.
- Hook resolver falls back to newest cached plugin version when baked `${CLAUDE_PLUGIN_ROOT}` is pruned — opportunistic fix for long-running sessions surviving plugin upgrades (quick task 260420-vfb).
- Plugin-wide `/gsd-<skill>` → `/gsd:<skill>` namespace normalization (273 replacements across 100 files) with durable maintenance script at `bin/maintenance/rewrite-command-namespace.cjs` for post-sync re-runs (quick task 260420-cns).

Full v1.1 details: [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md) · [requirements archive](./milestones/v1.1-REQUIREMENTS.md) · [audit](./AUDIT-v1.1.md)

---

## v1.2 Upstream Resilience (Shipped: 2026-04-24)

**Phases completed:** 3 phases (Phase 7 + Phase 8 + Phase 9), 3 plans + 14 tasks + 3 structurally related quick tasks, over 5 days (2026-04-20 → 2026-04-24). Zero phase/requirement deferrals — all 9 requirements satisfied by the phase that claimed them at kickoff.

**Key accomplishments:**

- Three-detector drift-catch in CI — file-layout, HANDOFF schema, and namespace drift each fail the build if regressed. Ratchet baselines let the plugin ship with known debt (e.g., 71 Category-B file-layout refs) while preventing further regressions.
- `schema/handoff-v1.json` — committed JSON Schema draft-07 describing the 19-field HANDOFF contract (17 required upstream-compat fields + 2 optional plugin extensions). Research R-1 confirmed upstream schema is stable and plugin is a strict superset.
- `bin/maintenance/check-drift.cjs` umbrella orchestrator — unifies file-layout + schema + namespace drift checks into one entry point for local dev + post-sync use. CI stays per-category for fast-feedback granularity.
- `bin/maintenance/check-upstream-schema.cjs` post-sync detector — compares upstream `/gsd:pause-work` declared field list against our schema; catches upstream drift before it bites users.
- First CI on the repo — `.github/workflows/check-drift.yml` with `file-layout` + `handoff-schema` jobs running in parallel.
- `CHANGELOG.md` scaffold — Keep-a-Changelog format with plugin-vs-upstream version distinction in section headers.
- README reorganized to put new-user flow (install → use → update → maintenance) first; upstream-user migration content consolidated in a trailing umbrella section (quick task 260421-rnu).
- Skill directories renamed `skills/gsd-<name>/` → `skills/<name>/` (81 renames) — fixed a duplicated-prefix UX bug where tab completion inserted `/gsd:gsd-<skill>` instead of `/gsd:<skill>`. Also aligns plugin layout with upstream's `commands/gsd/<name>.md` structure (quick task 260424-srn).

Full v1.2 details: [milestones/v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md) · [requirements archive](./milestones/v1.2-REQUIREMENTS.md) · [audit](./AUDIT-v1.2.md)

---
