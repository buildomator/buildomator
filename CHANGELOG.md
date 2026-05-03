# Changelog

All notable changes to this plugin are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Plugin version in section brackets; upstream GSD base version in trailing parentheses. See [README § Versioning](./README.md#versioning) for the `plugin_major = upstream_major + 1` scheme.

History before 2.38.2 lives in git + the per-milestone archive (see `.planning/milestones/v1.0-ROADMAP.md` and `.planning/milestones/v1.1-ROADMAP.md`).

## [Unreleased]

## [2.40.0] - 2026-05-03  (based on upstream GSD 1.40.0)

Upstream minor sync — picks up upstream GSD 1.40.0 (released 2026-05-02). Plugin-only patches in `bin/lib/core.cjs` (CLAUDE_PLUGIN_ROOT path resolution helpers — `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset`) and `bin/gsd-tools.cjs` (`migrate` / `write-phase-memory` / `checkpoint` / `hook` command branches) preserved via 3-way merge.

### Added
- **Upstream v1.40.0 source tree** — full tree-copy of changed files in `bin/`, `bin/lib/`, `references/`, `templates/`, `agents/`, `workflows/`.
- **`bin/check-latest-version.cjs`** — new upstream helper for latest-version detection.
- **`bin/verify-reapply-patches.cjs`** — new upstream helper that verifies plugin patches survived a sync (now bundled — useful tooling for future syncs).
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.40.0>.

### Changed
- **Version bump** — plugin `2.39.1 → 2.40.0` per `plugin_major = upstream_major + 1` versioning (README § Versioning). Minor bump mirrors upstream's `1.39.1 → 1.40.0` increment.
- **Workflow bodies updated** — 17 workflows refreshed: add-todo, audit-milestone, check-todos, code-review, code-review-fix, discovery-phase, execute-phase, execute-plan, help, list-workspaces, new-workspace, plan-phase, profile-user, progress, reapply-patches, resume-project, transition, update.
- **References refreshed** — context-budget.md, continuation-format.md, model-profiles.md.
- **Templates refreshed** — README.md, discovery.md, state.md.
- **Agent body** — `agents/gsd-code-fixer.md` updated.

### Removed
- **`workflows/research-phase.md`** — upstream removed `research-phase` workflow in 1.40.0 (consolidated into other phases). Plugin follows.

### Added
- **Rate-limit fallback hint** — new `Stop` hook tails the session transcript and, when it detects a rate-limit message ("You've hit your limit", "usage limit", "rate limit"), prints a bordered hint pointing at the no-token recovery path (`/exit` then `gsd-resume-at HH:MM` from a plain terminal). Best-effort detection because Claude Code renders its rate-limit message before any plugin code runs; the Stop event fires after, giving users a one-paste recovery the next time they look at the terminal. Same example also added to `skills/resume-at/SKILL.md` (No-token fallback callout) and `bin/gsd-resume-at` (head comment + runtime `--help`).

## [2.39.1] - 2026-05-01  (based on upstream GSD 1.39.1)

Upstream hotfix sync — picks up upstream GSD 1.39.1 (released 2026-05-01) on top of yesterday's v1.39.0 sync. Hotfix scope: `bin/gsd-tools.cjs` (1 line — adds `'skills'` to `GSD_MANAGED_DIRS` in `detect-custom-files`, PR #2942), `bin/lib/config-schema.cjs` + `bin/lib/config.cjs` (~20 lines — `SCHEMA_DEFAULTS` for `context_window`, PR #2944), `references/git-integration.md` (worktree hook policy, PR #2924), and roughly a dozen `workflows/*.md` files. Plugin-only patches in `bin/lib/core.cjs` (CLAUDE_PLUGIN_ROOT path resolution helpers — `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset`) and `bin/gsd-tools.cjs` (`migrate` / `write-phase-memory` / `checkpoint` / `hook` command branches) preserved verbatim. Upstream did not modify `bin/lib/core.cjs` between 1.39.0 → 1.39.1, so the plugin's patched copy was kept as-is.

### Added
- **Upstream v1.39.1 hotfix bundle** — full tree-copy of changed files. Notable upstream additions surfaced via the sync:
  - **`config-get` returns schema default for `context_window`** when the field is absent from the merged config (upstream #2944, via new `SCHEMA_DEFAULTS` table in `bin/lib/config-schema.cjs` + matching lookup in `bin/lib/config.cjs`).
  - **`detect-custom-files` adds `skills/` to `GSD_MANAGED_DIRS`** so plugin-managed skill content is properly tracked (upstream #2942).
  - **`--minimal` install profile across all runtimes + Claude local manifest fix** (upstream #2940).
  - **`code-review --fix` dispatch** wired in the workflow body (upstream #2947).
  - **`sketch --wrap-up` flag dispatch** (upstream #2949).
  - **`spike --wrap-up` flag dispatch** (upstream #2948).
  - **Deterministic Step 5 verification gate for `/gsd:reapply-patches`** (upstream #2969).
  - **npm-style `gsd-sdk` shim on Windows under `--sdk install`** (upstream #2962).
  - **`agent-skills` emits raw `<agent_skills>` block** instead of JSON-wrapped string (upstream #2917). Affects planner/executor input parsing — verified post-sync that plugin's `gsd-sdk query agent-skills <type>` consumers still parse correctly.
  - **`claude+global` post-install instructs restart and skill fallback** (upstream #2957).
  - **`help.md` aligned with post-#2824 skill consolidation** (upstream #2954).
  - **Stale deleted-command refs cleaned up in workflow files** (upstream #2950).
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.39.1>.

### Changed
- **Version bump** — plugin `2.39.0 → 2.39.1` per `plugin_major = upstream_major + 1` versioning (README § Versioning). Patch bump mirrors upstream's hotfix increment.
- **README counts** — unchanged (82 slash commands, 85 workflow bodies, 33 agent definitions). The hotfix modified existing files in tree-copy scope without adding/removing any.

### Fixed
- **Per-agent branch HEAD asserted before worktree commits** (upstream #2924) — prevents accidental commits to the wrong branch when worktrees drift. The accompanying `references/git-integration.md` change reverses the previous "use `--no-verify` in parallel agents" guidance: hooks now run normally on the introducing commit; opt-out is via the explicit `workflow.worktree_skip_hooks=true` config flag.

## [2.39.0] - 2026-05-01  (based on upstream GSD 1.39.0)

Upstream sync release — picks up upstream GSD 1.39.0 source-tree changes (workflows, references, templates, contexts, bin/lib utilities, bin/gsd-tools.cjs) while preserving plugin-only patches in `bin/lib/core.cjs` (CLAUDE_PLUGIN_ROOT path resolution helpers — `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset`) and `bin/gsd-tools.cjs` (`migrate` command, `hook` handlers for session-start / pre-compact / post-tool-use, `checkpoint` command, `write-phase-memory` command, plugin-root-aware paths).

### Added
- **Upstream v1.39.0 source-tree changes** — full tree-copy of `workflows/` (78 → 85 top-level workflow bodies), `references/`, `templates/`, `contexts/`, `bin/lib/*.cjs`, and `bin/gsd-tools.cjs`. Notable upstream additions surfaced via the sync:
  - **`--minimal` install profile** — ~94% cold-start token reduction for local LLMs (32K–128K context), writes only main-loop core skills (upstream #2762).
  - **`/gsd:edit-phase`** — modify any roadmap phase field in place without renumbering (upstream #2617).
  - **Post-merge build & test gate** — execute-phase auto-detects build/test commands across Xcode, Make, Just, Cargo, Go, Python, npm; iOS projects run `xcodebuild` automatically (upstream #2720).
  - **Per-runtime review models** — `review.models.<cli>` config + extended `RUNTIME_PROFILE_MAP` covering `gemini`, `qwen`, `opencode`, `copilot` (upstream #2612, #2748).
  - **Workstream config inheritance** — root `.planning/config.json` deep-merged into each workstream config; explicit `null` overrides parent (upstream #2714).
  - **Skill-surface consolidation** — upstream collapsed 86 → 59 skill entries via four new grouped skills (`capture`, `phase`, `config`, `workspace`) and six parents absorbing sub-operations as flags. The plugin still ships 82 `skills/<name>/SKILL.md` files because `skills/` is not in the tree-copy scope (the plugin owns the slash-command surface; upstream's `commands/gsd/*` consolidation is informational here).
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.39.0>.

### Changed
- **Version bump** — plugin `2.38.8 → 2.39.0` per `plugin_major = upstream_major + 1` versioning (README § Versioning).
- **README counts** — workflow bodies `78 → 85`, agent definitions `21 → 33` (post-sync `agents/` count corrected). Slash commands stays at 82 (`skills/` not in tree-copy scope).

### Fixed
- **`MODEL_ALIAS_MAP.opus` no longer needs a plugin patch** — upstream caught up (`MODEL_ALIAS_MAP` and `RUNTIME_PROFILE_MAP.claude.opus` updated to `claude-opus-4-7` in upstream #2733). Our patch was previously the only way the plugin pinned the right model ID; now it's parity with upstream and the patch is structurally identical.

## [2.38.8] - 2026-04-27  (based on upstream GSD 1.38.3)

Plugin-only feature release — adds scheduled-resume support and surfaces plugin-only features more prominently in the README.

### Added
- **`/gsd:resume-at <time>` skill** — schedule a future Claude Code session to auto-run `/gsd:resume-work` (or any GSD command via `--cmd`) at a specific time. Accepts `HH:MM` (today/tomorrow), ISO 8601, or `+<duration>` (`+30m`, `+2h`, `+1d`). Thin wrapper over Claude Code's built-in `/schedule` / `CronCreate` primitive — durability is owned by the host CLI; the skill translates GSD-flavored input. Default scheduled command is `/gsd:resume-work` so HANDOFF.json restores context automatically when the future session opens. Use case: hitting a usage cap, pausing for the day, or queuing a phase to run during off-peak quota windows (quick task `260427-rat`).
- **README "Added features beyond upstream" section** — surfaces plugin-only features above the fold in a single scannable table: scheduled resume, auto-resume across `/compact`, mid-session checkpoints, plugin-version churn fallback, drift detection, 92% token reduction, plugin-local workflow bodies, standardized continuation prompts, and cross-session memory. Replaces buried context in the deep-dive comparison tables for fresh visitors.

### Changed
- **README slash-command count**: 81 → 82 (added `resume-at`).

## [2.38.7] - 2026-04-25  (based on upstream GSD 1.38.3)

Plugin-only patch — closes a real read-heavy-session checkpoint gap surfaced by a usage-cap incident, plus a fuller README comparison vs upstream.

### Fixed
- **PostToolUse periodic checkpoint now covers read-heavy research sessions.** Yesterday's matcher (`Bash|Edit|Write|MultiEdit|NotebookEdit`) only fired on file-mutating tool calls. A real research-phase session in another project hit a usage cap with the last checkpoint written 18 minutes earlier — those 18 minutes were almost entirely `Read`, `Grep`, `Glob`, `WebFetch` calls. None in the matcher → PostToolUse never fired → no checkpoint. Matcher broadened to `Bash|Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Glob|WebFetch|WebSearch`. Combined with the existing 60s mtime throttle, write rate stays bounded (≤1/min regardless of how often the hook fires). Smoke-tested under burst load (5 rapid reads → 1 write). Token cost: zero — verified in CC source that PostToolUse hook output is never injected into model context (quick task `260425-rgw`, commit `7497cc6`).

### Changed
- **README "What changed from upstream GSD"** expanded from a single 6-row table to four grouped tables — Install + runtime architecture, Session continuity, Drift resilience, Plugin-environment robustness. Surfaces the v1.1, v1.2, and v2.38.x improvements that previously weren't documented as user-facing differences.

## [2.38.6] - 2026-04-25  (based on upstream GSD 1.38.3)

Plugin-only patch — closes the largest deferred drift category from v1.2 Phase 7.

### Fixed
- **Workflow `@`-includes now resolve.** Skills delegate to operational logic via `@`-include of workflow body files. Previously these used the legacy non-plugin install path (`@~/.claude/get-shit-done/workflows/<name>.md`), which doesn't exist for plugin users — visible to users as a "Falling back to legacy workflow file" graceful-degradation message and silently lost workflow content. v1.2's file-layout detector quantified the impact at 71 dangling refs (Category B) and explicitly deferred the fix as structural. This release ships the fix in two moves:
  - **Plugin-local `workflows/` dir** — 78 workflow markdown files copied from upstream `get-shit-done/workflows/` into the plugin tree, namespace-rewritten to colon-form commands.
  - **Path rewrite to `${CLAUDE_PLUGIN_ROOT}` form** — 270 `@`-include rewrites across 99 files: `@~/.claude/get-shit-done/<sub>` → `@${CLAUDE_PLUGIN_ROOT}/<sub>` for `workflows/`, `references/`, `templates/`, `contexts/`. Claude Code's plugin loader substitutes `${CLAUDE_PLUGIN_ROOT}` in skill/agent content (verified via `_research/claude-code-internals/utils/plugins/pluginOptionsStorage.ts`); at runtime the variable expands to the version-stamped install path so the include resolves to the real plugin file.

  Net: **genuinely-missing dangling refs go from 71 → 0**. Skills now load their workflow bodies as intended (quick task `260425-wfd`).

### Changed
- **`bin/maintenance/check-file-layout.cjs`** detector extended with a third reference pattern for `@${CLAUDE_PLUGIN_ROOT}/<sub>` so the new plugin-local form is validated and future drift in it is caught.
- **`tests/drift-baseline.json`** regenerated: was `109 / 38 / 71` (total / repairable / missing); now `122 / 122 / 0`. Total goes UP because the detector now catches the new resolvable refs; missing goes to ZERO.
- **`.planning/PROJECT.md` "After each upstream GSD sync" checklist** step 1 now includes copying `get-shit-done/workflows/` into `workflows/` so future syncs keep workflow bodies in lockstep with upstream.
- **`README.md` "What GSD Plugin provides"** lists the new `78 workflow bodies` entry.

## [2.38.5] - 2026-04-25  (based on upstream GSD 1.38.3)

Plugin-only patch — two follow-ups to v1.2's session-continuity work, plus an audit-doc fix.

### Added
- **PostToolUse periodic checkpoint** — bridges Claude Code's *microcompact* gap. CC has two compaction paths (verified in `_research/claude-code-internals/services/compact/`): full `compactConversation` (fires PreCompact → plugin checkpoints) and `microcompactMessages` (per-turn lossy GC of stale tool outputs; **does NOT fire PreCompact**, no event hookable). New `post-tool-use` handler in `bin/gsd-tools.cjs` writes a fresh `HANDOFF.json` after any file-mutating tool call (matcher: `Bash|Edit|Write|MultiEdit|NotebookEdit`), throttled by HANDOFF.json mtime to at most once per 60s. New `source: "auto-postool"` value in the schema enum. Net: `HANDOFF.json` is at most ~60s stale during an active session regardless of which compaction path ran (quick task `260425-mct`).
- **`/clear` continuation hints surfaced at end-of-flow boundaries** — six terminal skills (`execute-phase`, `complete-milestone`, `verify-work`, `quick`, `plan-phase`, `ship`) now emit a `## ▶ Next Up` continuation block following `references/continuation-format.md` when the workflow concludes. Each block includes the standard `` `/clear` then [next-command] `` pattern plus a parenthetical explaining that `/clear` is safe (resume-work restores from HANDOFF.json since v1.1's session continuity work). Closes the dormant-template gap — `references/continuation-format.md` was rich but unused (quick task `260425-clr`).

### Changed
- **`bin/lib/checkpoint.cjs`** — `generateCheckpoint` accepts `auto-postool` as a third source value; status mapping treats both `auto-compact` and `auto-postool` as `auto-checkpoint`. Doc comment updated.
- **`schema/handoff-v1.json`** — `source` enum extended from `["auto-compact", "manual-pause"]` to `["auto-compact", "manual-pause", "auto-postool"]` with a `$comment` describing each value.
- **`hooks/hooks.json`** — PostToolUse matcher: `Bash` → `Bash|Edit|Write|MultiEdit|NotebookEdit`.
- **`references/continuation-format.md`** — top-of-file safety footer documents that `/clear` is safe since v1.1's session-continuity work; gives the standard "/clear is safe" parenthetical wording as a single source of truth.

### Fixed
- **`.planning/AUDIT-v1.2.md` self-collision** — the v1.2 milestone audit's own "Plan self-collision" lesson contained a literal dash-form `/gsd-<real-skill-name>` example, tripping the namespace drift detector. Rephrased to a generic placeholder.

## [2.38.4] - 2026-04-24  (based on upstream GSD 1.38.3)

v1.2 Upstream Resilience shipment. Full context in [milestones/v1.2-ROADMAP.md](.planning/milestones/v1.2-ROADMAP.md).

### Added
- **Unified drift check orchestrator** — `bin/maintenance/check-drift.cjs` runs the file-layout, HANDOFF schema, and namespace drift detectors in sequence and reports a consolidated verdict. Intended for local dev loops and post-upstream-sync verification. Offline-deterministic (upstream-schema detector kept separate per v1.2 Phase 9 design). Closes DRIFT-03 (v1.2 Phase 9).
- **README feature tour** for session continuity and drift resilience — new `## Session continuity + drift resilience` section. Two-paragraph prose describing the `/compact` round-trip (PreCompact hook → HANDOFF.json → SessionStart auto-resume → handoff cleanup) and the three-detector CI gate with ratchet baselines plus the post-sync upstream-schema detector. Closes DOCS-01 (v1.2 Phase 9).
- **`CHANGELOG.md`** — this file. Keep-a-Changelog format with plugin-vs-upstream version distinction in section headers. Closes DOCS-02 (v1.2 Phase 9).

### Changed
- **`.planning/PROJECT.md` post-sync checklist** — formalized nine-step sequence including a dedicated CHANGELOG update step, the unified `check-drift.cjs` gate ("must exit 0 before declaring sync complete"), and the separate `check-upstream-schema.cjs` step for upstream schema drift. Closes MAINT-01 (v1.2 Phase 9).
- **README reorganized for new-user-first flow** — install / quick start / updating / maintenance scripts now run contiguously at the top; upstream-user migration content consolidated into a trailing `## For users of upstream GSD` umbrella; versioning section demoted from top to meta. No content deletions (quick task 260421-rnu).

### Fixed
- **Skill command-ID duplication** — renamed all 81 skill directories from `skills/gsd-<name>/` → `skills/<name>/`. Previously Claude Code derived command IDs from the directory basename and prepended the plugin name (`gsd`), producing `/gsd:gsd-<name>` while the tab-completion menu displayed `/gsd:<name>` (from the frontmatter `name:` field). Dir rename unifies display and inserted forms. Also aligns plugin layout with upstream's `commands/gsd/<name>.md` structure — future syncs map 1:1 without a basename-rewriting step (quick task 260424-srn).

## [2.38.3] - 2026-04-21  (based on upstream GSD 1.38.3)

### Added
- **File-layout drift detector** (`bin/maintenance/check-file-layout.cjs`) — scans plugin content for dangling `@~/.claude/get-shit-done/*` references, classifies as repairable (has plugin counterpart) vs genuinely missing, compares counts against `tests/drift-baseline.json` ratchet, exits 0/1/2 per maintenance convention. Runs in CI on every push and pull request (first job of `.github/workflows/check-drift.yml`). Closes DRIFT-01 and the file-layout portion of DRIFT-02 (Phase 7).
- **Committed HANDOFF schema baseline** (`schema/handoff-v1.json`) — JSON Schema draft-07 describing the 19-field HANDOFF.json contract (17 required upstream-compat fields + 2 optional plugin-only fields). Fixture at `schema/fixtures/handoff-sample.json`. Closes SCHEMA-01 (Phase 8).
- **HANDOFF schema validator** (`bin/maintenance/check-handoff-schema.cjs`) — runs `writeCheckpoint()` in an isolated tmp dir and validates the generated HANDOFF.json against the committed schema via ajv. Cleans up tmp dir in a `finally{}` block (never touches real `.planning/HANDOFF.json`). Runs in CI as the second job of `.github/workflows/check-drift.yml`. Closes SCHEMA-02 (Phase 8).
- **Upstream schema drift detector** (`bin/maintenance/check-upstream-schema.cjs`) — downloads or uses a cached upstream GSD release tarball, extracts the declared `/gsd:pause-work` field list from `workflows/pause-work.md`, and diffs against the committed schema. Not in CI (network-dependent; post-sync-only). Set `UPSTREAM_VERSION=v1.x.y` to target a specific release. Closes SCHEMA-03 (Phase 8).
- **Frontier mode for `/gsd:sketch` and `/gsd:spike`** — running either command with no argument (or `frontier`) now analyzes the existing sketch/spike landscape and proposes consistency/frontier targets instead of requiring an explicit idea (from upstream 1.38.3).
- **Extended tool access** for sketches and spikes — both skills now include `WebSearch`, `WebFetch`, and context7 `resolve-library-id` / `query-docs` in allowed-tools, grounding experiments in real API surfaces (from upstream 1.38.3).
- **Second CI job** in `.github/workflows/check-drift.yml` — handoff-schema runs in parallel to file-layout on a separate ubuntu-latest runner with `cache: npm` + `npm ci`. Either regression fails the workflow independently (Phase 8).
- **`ajv` + `ajv-formats` as devDependencies** — first node dev deps on the project. `node_modules/` added to `.gitignore`. `package-lock.json` committed (Phase 8).

### Fixed
- **`bin/maintenance/rewrite-command-namespace.cjs` skip pattern** — generalized from literal `v1.0-` prefix to `v\d+\.` regex so versioned milestone archives (`v1.1-phases/`, future `v1.2-phases/`, …) are preserved as-is on re-runs.

## [2.38.2] - 2026-04-20  (based on upstream GSD 1.38.1)

v1.1 Session Continuity shipment. Full context in [milestones/v1.1-ROADMAP.md](.planning/milestones/v1.1-ROADMAP.md).

### Added
- **Session continuity across `/compact`** — PreCompact hook writes `.planning/HANDOFF.json` with current phase, plan, task, and status; SessionStart hook detects the handoff on next session and auto-invokes `/gsd:resume-work` with zero user intervention. Verified end-to-end via live `/compact` UAT on 2026-04-20. Closes CKPT-01/02/03 + RESM-01/02/03 (v1.1 Phase 4).
- **CLAUDE.md `## Session Continuity` section** — hook-independent fallback trigger. Works for CLIs without hook support or when the hook is overridden. Closes BKUP-01/02 (v1.1 Phase 5).
- **Handoff lifecycle cleanup** — `deleteCheckpoint()` helper in `bin/lib/checkpoint.cjs` + `checkpoint --clear` CLI flag. `/gsd:resume-work` removes the handoff after successful resume, preventing phantom resume attempts. Closes LIFE-01 (v1.1 Phase 5).
- **Hook-command version fallback** — `hooks/hooks.json` resolves the newest cached plugin version when the baked `${CLAUDE_PLUGIN_ROOT}` path is pruned mid-session (e.g. after an upgrade). Keeps long sessions working across plugin updates (v1.1 quick task 260420-vfb).
- **Namespace normalization** — 273 `/gsd-<skill>` dash-style refs rewritten to `/gsd:<skill>` across 100 files, plus a durable maintenance script for post-sync re-runs. Closes the "Unknown command: /gsd-foo" failure mode inherited from upstream's un-namespaced command form (v1.1 quick task 260420-cns).
