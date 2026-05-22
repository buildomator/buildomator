# Changelog

All notable changes to this plugin are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Plugin version in section brackets; upstream GSD base version in trailing parentheses. See [README § Versioning](./README.md#versioning) for the `plugin_major = upstream_major + 1` scheme.

History before 2.38.2 lives in git + the per-milestone archive (see `.planning/milestones/v1.0-ROADMAP.md` and `.planning/milestones/v1.1-ROADMAP.md`).

## [Unreleased]

## [2.43.6] - 2026-05-22  (based on upstream GSD 1.42.3, hosted at open-gsd/get-shit-done-redux)

Upstream pointer change. The original `gsd-build/get-shit-done` repo was locked on 2026-05-22 after the founder rug-pulled the associated `$GSD` Solana token and deleted his social accounts (see [intellectia.ai](https://intellectia.ai/news/crypto/gsd-token-allegedly-rugpulled-after-founder-exit) and [ourcryptotalk](https://ourcryptotalk.com/news/bags-hackathon-winner-gsd-cloud-rug-pull) for independent coverage). Within hours, GSD collaborator [trek-e](https://github.com/trek-e) (Tom Boucher) launched a bit-perfect community continuation at [open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux): same MIT-licensed code, all 394 branches and 229 tags mirrored, all 77 open issues and 17 open PRs imported with cross-references. The plugin treats `open-gsd/get-shit-done-redux` as upstream from this release forward.

No source code changed at the cutover. The redux is bit-perfect with the pre-rug tree; only URLs and npm package names move. The plugin still ships the same base-tree as v2.43.5 (upstream GSD 1.42.3) and the same `#PLUGIN-DEPS-ON-CASE-INSENSITIVE` patch. trek-e independently landed a more thorough version of that patch in redux as PR [#88](https://github.com/open-gsd/get-shit-done-redux/pull/88) (with collision-detection guard, canonical-casing assertions, and atomic SDK+CJS update); the plugin patch will retire naturally on the first redux-based sync.

### Changed
- **`README.md`**, top-of-file. Updated "Based on" line to point at the redux release tag, added a new "Upstream change (May 2026)" call-out documenting the rug-pull and migration with links to the two press articles and the redux's [migration announcement](https://github.com/open-gsd/get-shit-done-redux/discussions/109). Drift-resilience and "For users of upstream GSD" sections rewritten to reference the redux. Credits section updated to mention both the original (TACHES) and the new maintainer (trek-e + contributors).
- **`workflows/forensics.md`, `workflows/update.md`, `workflows/help.md`, `workflows/new-project.md`, `workflows/new-milestone.md`, `workflows/quick.md`**. User-facing references to `gsd-build/get-shit-done` and the `get-shit-done-cc` npm package retargeted to `open-gsd/get-shit-done-redux` and `get-shit-done-redux`. `/gsd:forensics` issue-filing path now targets the redux for bug reports. `/gsd:update` recipe references the new npm package.
- **Pre-install uninstall guidance.** Now lists both pre-rug (`get-shit-done-cc`, `@gsd-build/sdk`) and post-rug (`get-shit-done-redux`, `@gsd-redux/sdk`) global packages so users with either install can clear conflicts.

### Added
- **Short-form case-insensitive test** (`sdk/src/query/phase.test.ts`, 30 cases up from 29 in v2.43.5): a `05D` phase with `05D-02` declaring `depends_on: [01]` (bare short-form) referencing the uppercase-suffix plan `05D-01`. Exercises the `shortFormToId` lookup tier that the original v2.43.5 test (canonical-prefix form `05c-01`) did not cover. trek-e's upstream review on PR #3786 flagged this gap; the plugin now covers both.
- **`bin/lib/phase.cjs`** comment block explicitly documenting that the CJS path supports a subset of the SDK's lookup forms (full plan ID + canonical prefix only, no short-form). Closes a parity question raised in trek-e's upstream review.

### Deferred to first redux-based sync
- **`bin/maintenance/check-upstream-schema.cjs`** still references `gsd-build/get-shit-done` for the upstream tarball download. The redux's release tarball naming (`get-shit-done-redux-<version>/`) differs from gsd-build's (`get-shit-done-<version>/`). Since gsd-build's frozen v1.42.3 tarball is still downloadable and the plugin remains on v1.42.3, this script keeps working without changes until the first redux-based sync. Tracked in [[project_upstream_switch_2026_05]] memory.
- **`sdk/package.json` / `sdk/README.md`** still self-identify as `@gsd-build/sdk`. These are bundled build artifacts not exposed via npm to plugin users; they will rename on the first redux-based sync.

## [2.43.5] - 2026-05-21  (based on upstream GSD 1.42.3)

Robustness fix in plan-id resolution. The `phase.plan-index` query now resolves `depends_on` references case-insensitively, so a plan with frontmatter `depends_on: [05c-01]` matches a sibling plan whose filename is `05C-01-PLAN.md` (and vice versa). Previously the lookup was strict-case via `Map.has()` on the raw plan ID, which silently dropped the edge, collapsed the dependent into wave 1, and surfaced a misleading "declared wave: N but depends_on DAG places it in wave 1" warning. Real-world repro: plans authored by the `gsd-planner` agent occasionally lowercase letter-suffix phases (e.g. `05c` while files are `05C`), and the dropped edge would only surface once execution ordering produced a downstream failure.

### Fixed
- **`sdk/src/query/phase.ts`** and **`bin/lib/phase.cjs`** (parallel CJS) plan-id lookup maps (`planMap`, `canonicalToId`, `shortFormToId`) now key on the lowercased plan ID, and `dep` is lowercased at lookup time. Resolved deps preserve the canonical-cased plan ID stored as the map value, so output wave assignments and warning messages still use the on-disk casing. The collision surface is negligible: the plan-id namespace is `NN`, `NN-NN`, or `NN-NN-slug` with an optional letter suffix on the phase segment, and a single phase directory cannot host two plans whose IDs differ only in case (POSIX filesystems treat them as distinct files, but the second file would still collide on canonical-prefix indexing).

### Added
- **Test coverage**, new `phase.test.ts` case (30 total, up from 29): a `05C` phase with an uppercase-suffix plan `05C-01-PLAN.md` and a sibling `05C-02-PLAN.md` whose `depends_on: [05c-01]` uses lowercase canonical-prefix form. Asserts wave 1 contains `05C-01`, wave 2 contains `05C-02`, and `warnings` is empty (no unresolved-reference warning, no wave-mismatch warning).

### Plugin patches added
- **`sdk/src/query/phase.ts` + `bin/lib/phase.cjs`** (`#PLUGIN-DEPS-ON-CASE-INSENSITIVE`) tracked in the plugin-patches inventory. Proposed to upstream `gsd-build/get-shit-done` in a separate PR (see commit message for link). If upstream accepts, the markers can be retired during a future sync cycle.

## [2.43.4] - 2026-05-19  (based on upstream GSD 1.42.3)

Discoverability fix. Adds a SessionStart hook that nudges users with stale caches to run `/plugin marketplace update`. Triggered by the fourth re-report of the v2.40.2-fixed MCP framing bug from a user on v2.38.x ([#7](https://github.com/jnuyens/gsd-plugin/issues/7)): the bug has been gone for 12 days, but the marketplace does not auto-update by default and four reporters in a row didn't run the update recipe even though the README documents it.

### Added
- **`hooks/gsd-staleness-reminder.js`** (`SessionStart`) reads the plugin's `CHANGELOG.md`, parses the topmost `## [X.Y.Z] - YYYY-MM-DD` entry, computes the age in days, and if older than the staleness threshold (default 14 days, override via `GSD_STALENESS_DAYS` env var) emits a structured `additionalContext` advisory naming the installed version, age, threshold, and the exact 3-command refresh recipe (`/plugin marketplace update`, `/plugin install gsd@gsd-plugin`, `/reload-plugins`). Silent when the cache is fresh, when `CHANGELOG.md` is unreadable, or when no valid release-date entry is found (defensive failure mode is silence, not noise).
- **Test coverage**, four new sub-cases in `tests/hooks-smoke.test.cjs` (20 total, up from 16): silent when fresh, warns when 30 days stale, silent when CHANGELOG missing, honors `GSD_STALENESS_DAYS=7` override at 10 days.

### Background
- Issues [#1](https://github.com/jnuyens/gsd-plugin/issues/1), [#2](https://github.com/jnuyens/gsd-plugin/issues/2), [#3](https://github.com/jnuyens/gsd-plugin/issues/3), and [#7](https://github.com/jnuyens/gsd-plugin/issues/7) all reported the same MCP framing bug. All four reporters were on v2.38.x; the fix has been on master since v2.40.2 (2026-05-07). The v2.38.x README's "Updating" section already documents the correct recipe, so docs are not the gap; the gap is friction between "user starts a session" and "user thinks to update". A SessionStart advisory closes that gap without requiring user opt-in.
- This is the third user-protection hook in the SessionStart chain after v2.43.1's `gsd-shadowing-sdk-detector.js` (shadowing global SDK in PATH) and the long-standing `gsd-session-state.sh` (project state reminder). The chain is now 4 entries: dispatcher, session-state, shadowing-detector, staleness-reminder.

### Recommended user response
When the advisory fires, run the 3-command refresh recipe. The advisory will then disappear until the next 14-day window. If a user wants the threshold tighter or looser, they can set `GSD_STALENESS_DAYS` in their environment.

## [2.43.3] - 2026-05-17  (based on upstream GSD 1.42.3)

Upstream hotfix sync from v1.42.2 to v1.42.3 (35 commits, primarily phase-removal logic hardening and a `plan-phase` closed-phase guard). All 4 in-tree plugin patches and the 3 SDK source patch markers survive automatically this cycle because upstream did not touch the patched files; only `bin/lib/core.cjs` required surgical re-apply of the `#PLUGIN-AGENTS-DIR` blocks. The bundled SDK was rebuilt because 8 other `sdk/src/` modules changed.

### Changed
- **Version bump**, plugin `2.43.2` to `2.43.3`.
- Refreshed wholesale from upstream: `agents/` (5 files), `bin/lib/` (8 files), `sdk/src/` (8 files including 1 new test), `workflows/` (4 files).
- Rebundled `sdk/dist/cli.js` via `tsc + esbuild`; bundle is 1.66 MB and carries 3 `CLAUDE_PLUGIN_ROOT` matches.

### Fixed (selected upstream highlights)
- **Phase removal logic hardening** (v1.42.3, [#3599](https://github.com/gsd-build/get-shit-done/pull/3599), [#3600](https://github.com/gsd-build/get-shit-done/pull/3600), [#3601](https://github.com/gsd-build/get-shit-done/pull/3601), [#3602](https://github.com/gsd-build/get-shit-done/pull/3602)) prefixed-phase headings now treated as section boundaries, peer-depth decimal phase preservation on integer phase removal, slugged plan-ref renumbering on phase removal, and project-code-prefixed phase dir counting in the milestone filter.
- **`plan-phase` gated on closed phases** (v1.42.3, [#3569](https://github.com/gsd-build/get-shit-done/pull/3569)) `init.plan-phase` surfaces `phase_status`; `/gsd:plan-phase` errors out on closed phases instead of silently re-planning.
- **W007 warning ignores archived phases** (v1.42.3, [#3560](https://github.com/gsd-build/get-shit-done/pull/3560)) repos using a milestone-archive layout no longer get false-positive "Phase N in ROADMAP but no directory" warnings for archived phases.
- **Codex install hardening** (v1.42.3, [#3610](https://github.com/gsd-build/get-shit-done/pull/3610)) fresh Codex installs no longer block when leftover bundled hooks are present in the project tree.
- **Installer migration env override** (v1.42.3) `GSD_INSTALLER_MIGRATION_DIR` honored when resolving the migrations directory.

### Added
- **Antigravity first-class runtime** (v1.42.3, [#3608](https://github.com/gsd-build/get-shit-done/pull/3608)) `update.md` models Antigravity (Google's IDE) as a first-class runtime alongside Claude Code, Cursor, Codex, and the existing runtime list.

### Plugin patches preserved verbatim
- **`bin/lib/core.cjs`** (`#PLUGIN-AGENTS-DIR`) upstream modified `core.cjs` this cycle; the 2x `[PLUGIN PATCH]` blocks (`resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset` helper exports plus the patched `getAgentsDir` body) were re-applied surgically after the wholesale copy.
- **`bin/lib/model-catalog.cjs`** (`#PLUGIN-MODEL-CATALOG-PATH`) upstream did NOT modify this file v1.42.2..v1.42.3; the flat-layout candidate-prepend patch survives automatically.
- **`bin/gsd-tools.cjs`** upstream did NOT modify this file v1.42.2..v1.42.3; 4 dispatch cases (`write-phase-memory`, `checkpoint`, `hook`, `migrate`) survive automatically.
- **`hooks/gsd-context-monitor.js`** (`#PLUGIN-HOOK-CONTEXT-MONITOR`) upstream `hooks/` entirely unchanged v1.42.2..v1.42.3; patch survives automatically.
- **`sdk/src/query/state-project-load.ts` + `sdk/src/query-gsd-tools-path.ts` + `sdk/src/sdk-package-compatibility.ts::legacyAssetProbes`** (SDK source patches) none of the 3 patched files appear in the upstream sdk/src/ diff this cycle; patches survive automatically. Bundle still carries 3 `CLAUDE_PLUGIN_ROOT` matches.

### Plugin-owned (untouched by sync)
- `bin/gsd-sdk` + `bin/gsd-sdk.cmd` (`#PLUGIN-WRAPPER-ENV-EXPORT`) byte-identical (sha256 verified pre/post sync).
- `hooks/gsd-shadowing-sdk-detector.js` (added in v2.43.1) byte-identical (sha256 verified pre/post sync).
- `commands/` remains absent (per plugin policy).

### Tests
- Regression trifecta passes against the synced tree: `tests/mcp-stdio-framing.test.cjs` (8 tools), `tests/workspace-json-integration.test.cjs` (22 checks), `tests/hooks-smoke.test.cjs` (16/16 including the v2.43.1 shadowing-sdk-detector cases).

See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.42.3>

## [2.43.2] - 2026-05-17  (based on upstream GSD 1.42.2)

Docs hotfix on v2.43.1. Replaces the misleading README claim that a pre-v2.42.0 global `gsd-sdk` install "keeps working" with explicit pre-install uninstall instructions. The shadowing global at `/opt/homebrew/bin/gsd-sdk` (or `/usr/local/bin/gsd-sdk`) does NOT honor `CLAUDE_PLUGIN_ROOT` and causes `agents_installed: false` in `/gsd:new-project` and similar workflows, so users with a legacy install must remove it before the plugin can resolve its bundled agents. v2.43.1's runtime SessionStart detector now has a matching README entry to send users to.

### Changed
- **README** Replaced "No prerequisites" wording that downplayed pre-v2.42.0 shadowing globals as "no breakage". Added a new "Pre-install: remove any pre-v2.42.0 global SDK install" subsection with the `which gsd-sdk` diagnostic, the two `npm uninstall -g` commands (`@gsd-build/sdk` and `get-shit-done-cc`), expected post-uninstall outputs, and a forward reference to the v2.43.1 SessionStart detector for users who skip the step.

## [2.43.1] - 2026-05-15  (based on upstream GSD 1.42.2)

Hotfix on v2.43.0. Adds a SessionStart hook that detects a shadowing `gsd-sdk` binary on `$PATH` (typically a leftover `npm install -g get-shit-done-cc` or `@gsd-build/sdk` from the pre-v2.42.0 prerequisite era) and emits a one-time advisory recommending the user uninstall it. The shadowing global takes PATH precedence over the plugin's bundled wrapper, does not honor `CLAUDE_PLUGIN_ROOT`, and causes spurious `agents_installed: false` reports in `/gsd:new-project` and similar workflows.

### Added
- **`hooks/gsd-shadowing-sdk-detector.js`** (`SessionStart`) cross-platform PATH walker. Resolves symlinks before comparing against the plugin's bundled wrapper at `${CLAUDE_PLUGIN_ROOT}/bin/gsd-sdk`. Silent when no shadowing is detected. Emits a structured `additionalContext` payload pointing at the offending binary and giving the exact `npm uninstall` recipe.
- **Test coverage**, three new sub-cases in `tests/hooks-smoke.test.cjs` (16 total, previously 13): silent when only the plugin wrapper is in PATH, silent when no `gsd-sdk` is in PATH, warns when a non-plugin `gsd-sdk` is first in PATH. Validates JSON envelope shape and the presence of the `npm uninstall` guidance.

### Background
- The plugin v2.42.0 bundled `sdk/dist/cli.js` so the standalone `get-shit-done-cc` / `@gsd-build/sdk` npm package became unnecessary. Pre-v2.42.0 users who installed it via `npm -g` are still affected on every session.
- The v2.42.5 `#PLUGIN-WRAPPER-ENV-EXPORT` patch exports `CLAUDE_PLUGIN_ROOT` and `GSD_AGENTS_DIR` from the plugin's wrapper, but only fires when the wrapper itself is invoked. With a shadowing global in `$PATH`, the wrapper is bypassed and the patch is silent. v2.43.1 closes the loop with first-line user-visible diagnosis.

### Recommended user action
If the SessionStart advisory fires, run `npm uninstall -g @gsd-build/sdk` (and `npm uninstall -g get-shit-done-cc` if also installed). `which gsd-sdk` should then resolve to a path under `.claude/plugins/cache/gsd-plugin/`.

## [2.43.0] - 2026-05-15  (based on upstream GSD 1.42.2)

Upstream patch sync, picks up GSD 1.42.0 + 1.42.1 + 1.42.2 (published 2026-05-15). The plugin skipped intermediate v1.42.0 (RC pattern) and v1.42.1 via the daily-sync cadence change; this single bump consolidates all three patch releases plus the post-merge work that landed at v1.42.2. SDK source patch surface evolved (upstream consolidated CLAUDE_PLUGIN_ROOT probes into `sdk-package-compatibility.ts::legacyAssetProbes`), surgically re-applied. Bundled SDK rebundled, 1.66 MB, contains 3 CLAUDE_PLUGIN_ROOT matches (one per patched module + the consolidated probe).

### Changed
- **Version bump**, plugin `2.42.6 to 2.43.0`.
- **`agents/`** refreshed wholesale (28 of 33 files updated, 5 new from upstream).
- **`bin/lib/*`** refreshed wholesale (61 upstream `.cjs` files plus a new `installer-migrations/` subdir with 3 baseline scripts).
- **`bin/gsd-tools.cjs`** refreshed; 4 plugin dispatch cases (`write-phase-memory`, `checkpoint`, `hook`, `migrate`) re-inserted before the `default:` block.
- **`hooks/gsd-context-monitor.js` + `hooks/gsd-workflow-guard.js`** refreshed.
- **`sdk/src/*`** refreshed wholesale (~70 TypeScript modules including new `sdk-package-compatibility.ts` seam).
- **`workflows/` + `templates/` + `references/`** refreshed from upstream `get-shit-done/{workflows,templates,references}/`.
- **`sdk/dist/cli.js`** rebundled via `npm run build` (`tsc + esbuild`); 1.66 MB single-file ESM bundle with `createRequire` shim.

### Added (selected upstream highlights)
- **STATE.md Document Module via generator** (v1.42.2, [#3531](https://github.com/gsd-build/get-shit-done/pull/3531)) Phase 1 of #3524, the CJS to SDK hard-seam ADR. Generated STATE.md surface enforces consistent shape across runtimes.
- **`init.phase-op` / `init.plan-phase` expose `expected_phase_dir`** (v1.42.1, [#3287](https://github.com/gsd-build/get-shit-done/pull/3287)) projects with `project_code` set no longer accumulate two-headed naming conventions (`01-foundation/` mixed with `XR-02.1-spike/`).
- **Statusline `context_position` config** (v1.42.x, [#2937](https://github.com/gsd-build/get-shit-done/pull/2937)) opt-in narrow-terminal layout for context utilization indicator.
- **`gsd-sdk query commit --respect-staged`** (v1.42.x, [#3522](https://github.com/gsd-build/get-shit-done/pull/3522)) opt-in flag so SDK-driven commits no longer silently overwrite staged files.

### Fixed (selected upstream highlights)
- **ROADMAP regex consolidation** (v1.42.2, [#3538](https://github.com/gsd-build/get-shit-done/pull/3538)) every phase-number ROADMAP regex now routes through `phaseMarkdownRegexSource`; fixes spurious "phase in ROADMAP but no directory" warnings on milestone-archive layouts.
- **`buildStateFrontmatter` counts nested plans** (v1.42.1, [#3261](https://github.com/gsd-build/get-shit-done/pull/3261)) repos using the nested `plans/<N>-PLAN-<NN>-<slug>.md` layout no longer get `progress.*` counters silently overwritten downward on every state mutation.
- **Self-healing migration of legacy top-level `branching_strategy`** (v1.42.x, [#3523](https://github.com/gsd-build/get-shit-done/pull/3523)) CJS `loadConfig` no longer emits false-positive warnings for legacy config schemas.
- **`phase.complete` refreshes all STATE.md fields** (v1.42.x, [#3517](https://github.com/gsd-build/get-shit-done/pull/3517)) phase completion now derives `completed_phases` from ROADMAP and rewrites the full body+frontmatter, fixing STATE drift after `phase complete`.
- **`reapply-patches` `gsd-update` filter arm** (v1.42.x, [#3516](https://github.com/gsd-build/get-shit-done/pull/3516)) missing arm in two-way merge filter was silently skipping update-flow patches.
- **`quick.md` cleanup-loop CWD safety** (v1.42.x, [#3521](https://github.com/gsd-build/get-shit-done/pull/3521)) bare `git` commands in the quick-task cleanup loop now pin CWD to project root before executing.

### Plugin patches preserved verbatim
- **`bin/lib/core.cjs`** (`#PLUGIN-AGENTS-DIR`) `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset` helper exports + the `getAgentsDir()` plugin-flat preference. Upstream `core.cjs` diff was substantial (~500 lines); patch surgically re-inserted at lines 21 and 1284 (HEAD), `[PLUGIN PATCH]` markers intact.
- **`bin/lib/model-catalog.cjs`** (`#PLUGIN-MODEL-CATALOG-PATH`) flat-layout candidate prepended to upstream's 3-candidate resolver list. Upstream resolver shape unchanged this cycle; folded in as candidate #0 same as v2.42.4.
- **`bin/gsd-tools.cjs`** 4 dispatch cases (`write-phase-memory`, `checkpoint`, `hook`, `migrate`). Hook subtypes (`session-start`, `pre-compact`, `post-tool-use`, `stop`) preserved; re-inserted as a block before the `default:` clause.
- **`hooks/gsd-context-monitor.js`** (`#PLUGIN-HOOK-CONTEXT-MONITOR`) drops the `get-shit-done` segment from `__dirname` traversal + honors `GSD_TOOLS_PATH` env override. Re-applied at line 138, marker intact.
- **`sdk/src/query/state-project-load.ts` + `sdk/src/query-gsd-tools-path.ts`** (SDK source patches) upstream v1.42.2 consolidated the CLAUDE_PLUGIN_ROOT probe logic into `sdk-package-compatibility::legacyAssetProbes`. Patch evolved: the functional probe lives in the consolidated helper (prepending a plugin-flat candidate), while `[PLUGIN PATCH]` markers + module-load `CLAUDE_PLUGIN_ROOT` references stay in both target files so the bundled SDK carries one match per patched module (gate expects >=2; bundle now carries 3).

### Plugin-owned (untouched by sync)
- `bin/gsd-sdk` + `bin/gsd-sdk.cmd` (`#PLUGIN-WRAPPER-ENV-EXPORT`) byte-identical (sha256 verified pre/post sync).
- `bin/maintenance/`, `bin/validate-plugin.cjs`, `hooks/gsd-prompt-guard.js`, `hooks/gsd-read-guard.js`, `hooks/gsd-read-injection-scanner.js`, `hooks/gsd-validate-commit.sh`, `hooks/gsd-phase-boundary.sh`, `hooks/gsd-session-state.sh`, `hooks/lib/` upstream did not change these between v1.41.2 and v1.42.2, so they remain in place.
- `commands/` remains absent (per plugin policy, see memory entry "No bundled commands/").

### Excluded from this pass
- `hooks/gsd-statusline.js`, `hooks/gsd-update-banner.js` upstream-only, plugin does not ship.
- `gsd-check-update.js` deferred indefinitely (decision from v2.42.6 retained).

### Tests
- Regression trifecta passes against the synced tree: `tests/mcp-stdio-framing.test.cjs` (8 tools), `tests/workspace-json-integration.test.cjs` (22 checks), `tests/hooks-smoke.test.cjs` (13/13).

See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.42.2>

## [2.42.6] - 2026-05-13  (based on upstream GSD 1.41.2)

Pull 8 upstream hook scripts (security and correctness defense-in-depth) into the plugin's `hooks/` tree. First ship is soft-warn: all guards either no-op silently or emit advisory `additionalContext` without blocking the tool call. The conventional-commits validator is the lone exception (blocks on bad commit messages) and is opt-in via `.planning/config.json` `{"hooks":{"community":true}}`. The plugin's existing 5 dispatcher entries (SessionStart auto-resume, PreToolUse Edit|Write, PostToolUse periodic checkpoint, PreCompact, Stop rate-limit nudge) are preserved unchanged: hybrid hook architecture per design.

### Added
- **`hooks/gsd-prompt-guard.js`** (PreToolUse Write|Edit). Scans content destined for `.planning/` files for prompt-injection patterns and invisible Unicode. Advisory only. Always on.
- **`hooks/gsd-workflow-guard.js`** (PreToolUse Write|Edit). Warns when files are edited outside a GSD command context. Opt-in via `.planning/config.json` `{"hooks":{"workflow_guard":true}}` (default off).
- **`hooks/gsd-read-guard.js`** (PreToolUse Write|Edit). Read-before-edit advisory for sub-runtimes. Auto-no-ops in Claude Code (which natively enforces read-before-edit), so this hook is dormant by default for plugin users. Included as defense for cross-runtime configurations.
- **`hooks/gsd-read-injection-scanner.js`** (PostToolUse Read). Scans file content returned by the Read tool for injection patterns plus summarisation-survival patterns. Severity-tagged (LOW/HIGH) advisory. Always on.
- **`hooks/gsd-validate-commit.sh`** (PreToolUse Bash). Enforces Conventional Commits format on `git commit -m '...'` invocations. Blocks (exit 2) with typed code (`CONVENTIONAL_COMMITS_VIOLATION` / `COMMIT_SUBJECT_TOO_LONG`) on violation. Opt-in via `.planning/config.json` `{"hooks":{"community":true}}`.
- **`hooks/gsd-phase-boundary.sh`** (PostToolUse Write|Edit|MultiEdit). Emits `additionalContext` reminder when `.planning/` files are modified, suggesting STATE.md should be reviewed. Opt-in via `hooks.community: true`.
- **`hooks/gsd-context-monitor.js`** (PostToolUse broad matcher). Reads statusline-bridge metrics from `/tmp/claude-ctx-${session_id}.json` and injects context-usage warnings (<=35% remaining: WARNING, <=25% remaining: CRITICAL). On CRITICAL with active GSD project, spawns `gsd-tools.cjs state record-session` as a fire-and-forget breadcrumb for `/gsd:resume-work`. Always on unless `.planning/config.json` `{"hooks":{"context_warnings":false}}`.
- **`hooks/gsd-session-state.sh`** (SessionStart). Injects STATE.md head as `additionalContext` on session start. Opt-in via `hooks.community: true`.
- **`hooks/lib/git-cmd.js`**, token-walk git subcommand classifier (required by `gsd-validate-commit.sh`, handles env-prefix, `-C path`, full-path git invocations).

### Plugin patch
- `#PLUGIN-HOOK-CONTEXT-MONITOR` (`hooks/gsd-context-monitor.js`). Upstream resolves `gsd-tools.cjs` via `path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs')` (assumes the upstream `<runtime-config>/get-shit-done/` layout). Plugin layout is flat (`hooks/` and `bin/` are siblings), so the patch drops the `'get-shit-done'` segment and additionally honors `GSD_TOOLS_PATH` env override for testing.
- Added to `feedback_plugin_patches_inventory.md` alongside the existing `#PLUGIN-AGENTS-DIR`, `#PLUGIN-MODEL-CATALOG-PATH`, and `#PLUGIN-WRAPPER-ENV-EXPORT` patches.

### Architecture (hybrid hooks)
- Cross-cutting events (SessionStart auto-resume + migration check, PreCompact checkpoint, PostToolUse periodic checkpoint, Stop rate-limit nudge) continue routing through `bin/gsd-tools.cjs hook <type>`. These share helper imports and would duplicate state if split.
- Tool-specific guards run as individual scripts. Each script is single-responsibility, self-contained, and uses the same plugin-path-stale Node resolver as the dispatcher (so a mid-session plugin upgrade doesn't break in-flight hooks).
- Both `SessionStart` and `PreToolUse Edit|Write` events now have multiple registered hooks (existing dispatcher + new individual scripts). All run independently per Claude Code's hook contract.

### Excluded from this pass
- **`gsd-check-update.js`** (upstream), not pulled in. Its `detectConfigDir()` looks for `get-shit-done/VERSION` which does not exist in the plugin's flat layout, and it duplicates the `/plugin marketplace update` flow that's already the plugin's canonical update mechanism. Decision deferred indefinitely.
- `gsd-statusline.js`, `gsd-update-banner.js`. UI surfaces, separate concern. Can be evaluated for a future release once the statusline contract aligns.

### Tests
- New: `tests/hooks-smoke.test.cjs`, spawn-based smoke test for all 8 hooks. Verifies each script parses, handles a representative event payload without crashing, and produces the expected JSON envelope (or silence) for advisory-on vs. advisory-off cases. Layout patch on `gsd-context-monitor.js` verified by inline grep.
- Regression fence: `tests/mcp-stdio-framing.test.cjs` and `tests/workspace-json-integration.test.cjs` still pass unchanged.

## [2.42.5] - 2026-05-11

Hotfix — restores the *"GSD agents not installed"* false-positive suppression that was supposed to land in v2.40.1 and got partially undone by subsequent upstream syncs. Reported via `/gsd:new-project` from a fresh project tree: the SDK warned to run `npx get-shit-done-cc@latest --global` even though the plugin already ships all 33 agents.

### Fixed
- **`bin/gsd-sdk` + `bin/gsd-sdk.cmd`** (`#PLUGIN-WRAPPER-ENV-EXPORT`) — both wrappers now `export CLAUDE_PLUGIN_ROOT` and `GSD_AGENTS_DIR` (when unset) before exec'ing `node`. Root cause: the bundled SDK's `resolveAgentsDir()` in `sdk/src/query/helpers.ts` checks `GSD_AGENTS_DIR` or runtime-config-dir paths — never `CLAUDE_PLUGIN_ROOT`. And Claude Code does NOT set `CLAUDE_PLUGIN_ROOT` in Bash tool environments (only in skill/agent dispatch envs). So the SDK couldn't locate the bundled `<plugin_root>/agents/` from a Bash subprocess. The wrappers already self-derived the plugin root to find `sdk/dist/cli.js`; they just weren't propagating it. Caller-set values for either env var are still respected (the patch only exports when the variable is unset).
- This is the workflow-layer companion to the v2.40.1 `bin/lib/core.cjs::getAgentsDir()` patch. Two layers of defense now cover the plugin-flat-layout case for any caller that goes through the wrapper.

### Verified
- `gsd-sdk query init.new-project` returns `agents_installed: true` from any cwd, with no env vars set
- Caller-set `GSD_AGENTS_DIR` is respected (not overridden)
- MCP regression test (issue #3) passes
- workspace.json integration test (issue #5/PR #6) 22/22 passes

### Notes
- Earlier in this session we verified that Claude Code's Bash tool environment lacks `CLAUDE_PLUGIN_ROOT`. That property is the load-bearing reason this patch is necessary. If Claude Code starts setting `CLAUDE_PLUGIN_ROOT` for Bash tool calls in a future version, this patch becomes redundant but stays harmless.
- Adds `#PLUGIN-WRAPPER-ENV-EXPORT` to the plugin patches inventory.

## [2.42.4] - 2026-05-11  (based on upstream GSD 1.41.2)

Upstream patch sync — picks up GSD 1.41.2 (released 2026-05-10). Plugin patches in `bin/lib/core.cjs` and `bin/gsd-tools.cjs` untouched upstream this cycle (regression-grep verified intact). The `#PLUGIN-MODEL-CATALOG-PATH` patch shape evolved — upstream replaced the single-path require with a 3-candidate resolver; folded the plugin's flat-layout path into upstream's candidate list as the new first entry.

### Changed
- **Version bump** — plugin `2.42.3 → 2.42.4`.
- **`bin/lib/{config-schema,config,phase,state}.cjs`** refreshed wholesale.
- **`bin/lib/model-catalog.cjs`** ([upstream #3293](https://github.com/gsd-build/get-shit-done/pull/3293)) — replaced single-path require with prioritised candidate list (install-path → source-repo dev path → `GSD_MODEL_CATALOG` env override). Plugin patch prepends the flat-layout 2-level traversal as candidate #0; upstream's three candidates kept intact below.
- **`agents/{gsd-intel-updater,gsd-planner,gsd-verifier}.md`** refreshed.
- **`workflows/{execute-phase,execute-plan,forensics,plan-phase,ship,verify-phase}.md`** refreshed.

### Fixed
Upstream bug fixes flowing through automatically:
- **State write integrity** ([#3291](https://github.com/gsd-build/get-shit-done/pull/3291)) — `state record-metric`, `state add-decision`, and `state add-blocker` no longer silently lose data. Missing target sections auto-created with canonical scaffolds; all three verbs honor `--ws <name>` workstream routing.
- **Verifier hardening — no pass with unresolved markers** ([#3343](https://github.com/gsd-build/get-shit-done/pull/3343)) — phase verification no longer passes with unresolved `TBD` / `FIXME` / `XXX` markers in phase-modified source files. Same-line issue/PR refs and `DEF-*` IDs remain valid formal deferrals.
- **Verifier runs probe scripts directly** ([#3350](https://github.com/gsd-build/get-shit-done/pull/3350)) — no longer accepts SUMMARY-reported probe PASS markers as evidence.
- **Human-needed verification no longer completes phases** ([#3339](https://github.com/gsd-build/get-shit-done/pull/3339)) — SDK keeps `human_needed` and missing verification results pending; `check.ship-ready` only passes explicit pass states.
- **Executor stall detection** ([#3329](https://github.com/gsd-build/get-shit-done/pull/3329)) — safe-resume contracts surface partial-plan drift before dispatching duplicate executor work.
- **`phase remove --force` renumbering** ([#3367](https://github.com/gsd-build/get-shit-done/pull/3367)) — integer phase removal preserves later ROADMAP progress rows and headings instead of collapsing to the removed phase number.
- **`detect-custom-files` scans `skills/`** ([#3318](https://github.com/gsd-build/get-shit-done/pull/3318)) — SDK custom-file detection back in parity with `bin/gsd-tools.cjs`, preventing user-added skills from being silently destroyed during `/gsd:update`.
- **`/gsd:plan-phase` deep-work rules** ([#3326](https://github.com/gsd-build/get-shit-done/pull/3326)) — planners keep action blocks as directive prose, avoid fenced implementation dumps.
- **Codex install hardening** — `gsd-sdk` installs reliably on Windows ([#3282](https://github.com/gsd-build/get-shit-done/pull/3282)); `gsd-tools.cjs` and CJS fallback bridge work post-install via the new `bin/shared/model-catalog.json` path ([#3293](https://github.com/gsd-build/get-shit-done/pull/3293)); `get-shit-done-cc --codex` accepts Codex `hooks.state.*` trust tables ([#3289](https://github.com/gsd-build/get-shit-done/pull/3289)); legacy GSD-managed hooks.json update hooks cleaned up after writing the TOML SessionStart hook ([#3364](https://github.com/gsd-build/get-shit-done/pull/3364)).
- **Gemini install/conversion** — Gemini install output valid on Windows PowerShell, agent conversion drops Claude-only `AskUserQuestion` / `ask_user` tool metadata ([#3368](https://github.com/gsd-build/get-shit-done/pull/3368)); Gemini and Antigravity conversion drops Claude-only agent dispatcher tools ([#3349](https://github.com/gsd-build/get-shit-done/pull/3349)).
- **SDK resolve-model / init.progress** ([#3361](https://github.com/gsd-build/get-shit-done/pull/3361)) — Codex runtime override models reported before `resolve_model_ids: "omit"`.
- **Installer SDK readiness detects stale `gsd-sdk` executables** earlier on PATH ([#3363](https://github.com/gsd-build/get-shit-done/pull/3363)).
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.2>.

### Removed
- Upstream removed the vestigial `Layout detection returned 'unknown'` line from `gsd-intel-updater` on non-GSD-framework projects ([#3299](https://github.com/gsd-build/get-shit-done/pull/3299)). Plugin follows.

### Plugin patches — 2 preserved verbatim, 1 evolved
- **`bin/lib/core.cjs`** — `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset` + `getAgentsDir` w/ `GSD_AGENTS_DIR` override. Untouched upstream this cycle (regression-grep verified intact).
- **`bin/gsd-tools.cjs`** — `migrate` / `write-phase-memory` / `checkpoint` / `hook` cases. Untouched upstream this cycle (regression-grep verified intact).
- **`bin/lib/model-catalog.cjs`** (`#PLUGIN-MODEL-CATALOG-PATH`) — patch shape evolved. v2.42.2 used a try-plugin-first-with-existsSync-fallback pattern (since the upstream baseline was a single `require()`). v2.42.4 folds the plugin's flat-layout candidate into upstream's new prioritised candidate list as entry #0. Cleaner, integrates with upstream's `_catalogLastErr` diagnostic chain.

### Notes
- Bundled SDK at `sdk/dist/cli.js` still on `v1.50.0-canary.0`. Will refresh on the next significant SDK update.
- v1.42.0 GA still pending — rc2 published 2026-05-10 22:10 UTC, 21 min after v1.41.2 GA. Same rolling-hotfix-while-RC pattern as v1.41.1.
- This is the second sync this week. Cadence is fast; consider folding multiple patches into a single sync next time if upstream patches keep landing daily.

## [2.42.3] - 2026-05-10

Adds optional `agents.workspace.json` SessionStart integration. Architectural discussion in [#5](https://github.com/jnuyens/gsd-plugin/issues/5); implementation in [PR #6](https://github.com/jnuyens/gsd-plugin/pull/6).

### Added
- **Optional `agents.workspace.json` read on SessionStart** ([#5](https://github.com/jnuyens/gsd-plugin/issues/5)). When `.agents/agents.workspace.json` (or the legacy `agents.workspace.json` root path) is present, the plugin injects structured codebase intelligence into the model's context:
  - Empirically-fragile files (filtered to `fragility ≥ 0.7`, with `aiModificationCount` vs `humanModificationCount` history)
  - Detected framework manifest (filtered to `confidence ≥ 0.7`)
  - Human-annotated fragile files and co-change patterns
- **Spec scope honored**: only reads the four agreed buckets — `generated.frameworkManifest`, `generated.fileIndex`, `manual.fragileFiles`, `manual.coChangePatterns`. PROJECT.md remains canonical for `manual.conventions` / `techStack` / `description` (the overlapping fields).
- **Strict major-version gating**: same major version loads, different major refuses with clear error message *"workspace.json requires version X but this plugin supports 0.1. Update gsd-plugin or regenerate your workspace.json."* No silent-corruption-via-load-future-version risk.
- **Configurable cap**: `gsd.workspace_json_max_files` in `.planning/config.json` controls how many fragile files surface (default 5).
- **Spec reference**: <https://workspacejson.dev/spec>

### Zero-token-impact convention
The integration adds an `existsSync` syscall to SessionStart. If the file is absent, the plugin behaves identically to v2.42.2 — no context injected, no tokens consumed. This convention now applies to all future optional integrations as a design rule: opt-in features must not cost anything to users who haven't opted in.

### Safety
- **Prompt-injection sanitization** via `bin/lib/security.cjs`'s `sanitizeForPrompt`. Every user-controlled string in `workspace.json` (file paths, framework names, fragility reasons, co-change notes) is stripped of zero-width characters and neutralized for `<system>` / `[INST]` / `<<SYS>>` markers before injection.
- **DoS guards**: input arrays/objects capped before processing (10K index entries, 100 framework entries, 500 fragile files, 200 co-change patterns).
- **Fail-soft read path**: never throws. Missing file, malformed JSON, schema mismatch, version mismatch — all return `null` with a clear stderr message; SessionStart behavior is unaffected.

### Credits
- **[@qmarcelle](https://github.com/qmarcelle)** — first external contributor to substantive plugin code. Wrote the implementation, the 538-line test suite, and the security/DoS hardening passes (the latter unsolicited).

### Files
- `bin/lib/workspace-json.cjs` (new, 176 lines) — the reader/parser/version-gate module
- `bin/gsd-tools.cjs` (+27 lines) — wires into the existing SessionStart hook
- `tests/workspace-json-integration.test.cjs` (new, 538 lines) — 22 test scenarios

### Notes
- Verified end-to-end on `debian:trixie` install-smoke + Check drift; 22/22 local tests pass.
- The integration carries forward all existing protections from v2.40.2 (MCP stdio framing) and v2.42.1 (bundled SDK with no external prereq).

## [2.42.2] - 2026-05-10  (based on upstream GSD 1.41.1)

Upstream patch sync — picks up GSD 1.41.1 (released 2026-05-09). Plugin-only patches in `bin/lib/core.cjs` (CLAUDE_PLUGIN_ROOT path resolution helpers + agent-dir override) and `bin/gsd-tools.cjs` (`migrate` / `write-phase-memory` / `checkpoint` / `hook` cases) preserved via 3-way merge. One new plugin patch in `bin/lib/model-catalog.cjs` for the flat plugin layout — same fallback pattern as `getAgentsDir()`.

### Added
- **`bin/lib/model-catalog.cjs`** + **`sdk/shared/model-catalog.json`** ([upstream #3230](https://github.com/gsd-build/get-shit-done/pull/3230)) — shared model catalog as the single source of truth for agent profiles and runtime tier defaults. Replaces four drifting truths (CJS `model-profiles`, SDK `config-query`, `settings-advanced.md`, session-runner) with a JSON file consumed by both packages via thin adapters. `resolve-model` now covers all 33 shipped agents; unknown-agent fallback is profile-semantic (`quality→opus`, `budget→haiku`, `balanced/adaptive→sonnet`) instead of hardcoded sonnet.
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.1>.

### Changed
- **Version bump** — plugin `2.42.1 → 2.42.2`.
- **`bin/lib/{config-schema,model-profiles,phase,state}.cjs`** refreshed wholesale. `model-profiles.cjs` thinned by ~95 lines as it now reads from the shared catalog.
- **`bin/lib/core.cjs`** got 87 lines smaller (-95/+8) — a chunk migrated into `model-catalog.cjs`. Plugin patches re-applied.
- **`bin/gsd-tools.cjs`** picked up the dotted-canonical-form shim ([#3243](https://github.com/gsd-build/get-shit-done/pull/3243)) — callers using `state.update` (dotted) now resolve correctly. Plugin's 4 patched cases unaffected.
- **`agents/{gsd-code-fixer,gsd-code-reviewer}.md`** — `BL-` / `blocker:` accepted as Critical-tier; macOS BSD-grep portability fix.
- **`workflows/{code-review,execute-phase,plant-seed,settings-advanced}.md`** refreshed.

### Fixed
Upstream bug fixes flowing through automatically:
- **Wave 0 plans no longer collapse into wave 1** ([#3276](https://github.com/gsd-build/get-shit-done/pull/3276)) — `phase-plan-index` switched from trusting the `wave:` frontmatter to a Kahn topological sort over `depends_on`. Plus a parsed `wave: 0` is preserved instead of being coerced by `parseInt(...) || 1`.
- **`execute-phase` step 5.5 documents the cross-wave-deviation cleanup tail** ([#3273](https://github.com/gsd-build/get-shit-done/pull/3273)) — deviation cleanup is no longer silently skipped between waves.
- **`state snapshot` prefers YAML frontmatter for canonical fields** ([#3275](https://github.com/gsd-build/get-shit-done/pull/3275)) — body table cells like `**Status:** to ✅ COMPLETE` no longer override the correct frontmatter value.
- **`state.update` on body-only changes preserves curated `progress.*` frontmatter** ([#3252](https://github.com/gsd-build/get-shit-done/pull/3252)).
- **`phase.add` honors `--dry-run` and rejects unknown flags** ([#3246](https://github.com/gsd-build/get-shit-done/pull/3246)).
- **Native `--help` is non-mutating** ([#3272](https://github.com/gsd-build/get-shit-done/pull/3272)) — dispatcher-level guard short-circuits to a help stub on `--help` / `-h`.
- **CJS dispatcher accepts the canonical dotted command form** ([#3248](https://github.com/gsd-build/get-shit-done/pull/3248)).
- **`extractFrontmatter` is anchored at file start** ([#3247](https://github.com/gsd-build/get-shit-done/pull/3247)).
- **`code-review` SUMMARY parser hardened** ([#3274](https://github.com/gsd-build/get-shit-done/pull/3274)) — `BL-` / `blocker:` accepted as Critical-tier-equivalent to `CR-*`.
- **`/gsd:capture --seed` one-shot contract restored** ([#3250](https://github.com/gsd-build/get-shit-done/pull/3250)).
- **Codex install accepts TOML float values** ([#3254](https://github.com/gsd-build/get-shit-done/pull/3254)).
- **`✓ GSD SDK ready` only prints once SDK is genuinely reachable** ([#3249](https://github.com/gsd-build/get-shit-done/pull/3249)).
- **`config-set model_overrides.<agent-id>` accepted** ([#3253](https://github.com/gsd-build/get-shit-done/pull/3253)).

### Plugin patches preserved + 1 new
- **`bin/lib/core.cjs`** — `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset` + the patched `getAgentsDir` reading `GSD_AGENTS_DIR`. Reapplied.
- **`bin/gsd-tools.cjs`** — `migrate` / `write-phase-memory` / `checkpoint` / `hook` cases. Reapplied.
- **`bin/lib/model-catalog.cjs`** (NEW patch — `#PLUGIN-MODEL-CATALOG-PATH`) — upstream's `../../../sdk/shared/model-catalog.json` traversal lands one level too high in the plugin's flat layout. Patched to try `../../sdk/shared/` first, fall back to `../../../sdk/shared/` for upstream installs. Same fallback pattern as `getAgentsDir()`.

### Notes
- Bundled SDK at `sdk/dist/cli.js` still reports `v1.50.0-canary.0`; upstream is at canary.2 but the canary line is separate from the GA line. Will refresh when v1.50.0 stabilises (or v1.42.0 GA arrives, expected in 3-5 days).
- Install-smoke CI ran green on this commit in `debian:trixie` container.

## [2.42.1] - 2026-05-07

Hotfix that completes v2.42.0's "no external prereq" promise. v2.42.0 shipped `sdk/dist/cli.js` (~3 KB tsc shim) without the ~81 MB of runtime npm dependencies it imports (`ws`, `@anthropic-ai/claude-agent-sdk`, transitives). On a truly fresh box (no prior `npx get-shit-done-cc`) the bundled `gsd-sdk` failed at module-resolution time. **Caught by smoke-testing v2.42.0 on a fresh Debian 13 box** (`192.168.1.170`) — the user's existing macOS/laptop installs had an external `gsd-sdk` already on `PATH` so the bug was invisible there.

### Fixed
- **`sdk/dist/cli.js`** — switched the SDK build from plain `tsc` to `tsc && esbuild --bundle --platform=node --format=esm --outfile=dist/cli.js --allow-overwrite`, with a `createRequire` shim banner so CJS deps (ws's transitive `require()` calls) work inside the ESM output. Result: `dist/cli.js` is now a single 1.5 MB self-contained file with all runtime deps inlined. No `node_modules` needed at plugin runtime. Verified against 6 test scenarios on fresh Debian 13 with no prior GSD install: `--version`, PATH-based resolution, `query state.load`, `query commands`, MCP regression test, and workflow-style callsite simulation. All pass.
- **`sdk/package.json`** — added `bundle` script and updated `build` to chain it after `tsc`. Added `esbuild ^0.28.0` as devDependency (build-time only, not shipped).

### Notes
- Plugin tree size grew by ~+1.5 MB (the bundled `cli.js`). Total cost is still ~80 MB less than committing `node_modules/` would have been.
- v2.42.0 is being **superseded immediately** rather than left in the wild. Anyone who already pulled v2.42.0 should run `/plugin marketplace update gsd-plugin` to surface this fix.

## [2.42.0] - 2026-05-07

**No more `gsd-sdk` prerequisite.** The plugin now bundles the GSD SDK inside its own tree, so `/plugin install gsd@gsd-plugin` is genuinely the only install step. Closes [#4](https://github.com/jnuyens/gsd-plugin/issues/4) at the architectural level (v2.41.1's README fix corrected the documentation; this release removes the requirement that documentation was trying to describe).

### Added
- **`sdk/`** — full GSD SDK source tree synced from upstream `gsd-build/get-shit-done@v1.41.0` (`src/`, `prompts/`, `scripts/`, `package.json`, `tsconfig.json`, `package-lock.json`).
- **`sdk/dist/`** — pre-built TypeScript output (`tsc` against the committed `src/`). Plugin commits `dist/` even though upstream gitignores it: plugin users won't run `npm install` / `npm run build`, so the binary needs to be ready immediately after `/plugin install`.
- **`bin/gsd-sdk`** — POSIX shell wrapper that `exec`s `node ${CLAUDE_PLUGIN_ROOT}/sdk/dist/cli.js`. Falls back to script-relative resolution if `CLAUDE_PLUGIN_ROOT` is unset, and to an external `gsd-sdk` on `PATH` if the bundled one is somehow missing (preserves legacy install path as a safety net).
- **`bin/gsd-sdk.cmd`** — Windows batch wrapper with the same logic.

### Changed
- **README** — replaced the "Prerequisites: install the GSD SDK CLI" subsection (added in v2.41.1 as a stop-gap) with a "No prerequisites" notice. Migration §2 now correctly tells users it's safe to `npm uninstall -g get-shit-done-cc` after upgrading to v2.42.0+.
- **Versioning rule exception** — bumping minor (`2.41.x → 2.42.0`) for a plugin-only feature even though upstream is still at `1.41.0`. Standard rule (`plugin_minor = upstream_minor`) resumes when the next upstream sync lands; if upstream then ships `1.42.0`, that sync goes out as `2.43.0` to avoid collision.

### Plugin patches
Two SDK source patches were needed for the plugin's flat directory layout:
- **`sdk/src/query/state-project-load.ts`** — adds `${CLAUDE_PLUGIN_ROOT}/bin/lib/core.cjs` as the first probe candidate. Upstream's resolver expects `<root>/get-shit-done/bin/lib/core.cjs`; the plugin's flat layout is `<plugin_root>/bin/lib/core.cjs`. Tagged `[PLUGIN PATCH]` inline.
- **`sdk/src/query-gsd-tools-path.ts`** — same patch for `gsd-tools.cjs`. Tagged `[PLUGIN PATCH]` inline.

### How resolution works (no callsite rewrite was needed)
Claude Code automatically prepends each plugin's `bin/` directory to `PATH` for every `Bash` tool call. Existing `gsd-sdk query ...` invocations across all 500+ workflow and skill callsites resolve to the bundled wrapper for plugin-only users, with **zero rewrite** required. Users with an external `gsd-sdk` already on `PATH` (e.g. `/opt/homebrew/bin` from a prior `npx get-shit-done-cc` install) keep using their external one because plugin `bin/` is appended (not prepended) by Claude Code — no behavior change for legacy users.

### Verified
- `gsd-sdk --version` → `v1.50.0-canary.0` (bundled, was the npm-published `0.1.0`)
- `gsd-sdk query state.load` returns valid project config block
- `gsd-sdk query roadmap.analyze` returns project milestones
- `gsd-sdk query commands` returns full command list
- `node tests/mcp-stdio-framing.test.cjs` still passes (regression fence from v2.40.2 unaffected)

### Notes
- Bundle adds ~6.8 MB to the plugin tree (`sdk/dist/` 3.9 MB + `sdk/src/` 2.8 MB + prompts/scripts). Plugin total still well under typical Claude Code plugin sizes.
- Long-term: route workflow scripts through the plugin's own MCP server instead of shelling out at all. Tracked separately; this release is the architectural prerequisite that makes the routing achievable.

## [2.41.1] - 2026-05-07

Documentation hotfix — corrects a README instruction that left migrating users (and any new user without a prior `npx get-shit-done-cc` install) with broken `/gsd:*` commands.

### Fixed
- **`README.md` — Manual migration §2** ([#4](https://github.com/jnuyens/gsd-plugin/issues/4)) — earlier versions told users to `npm uninstall -g get-shit-done-cc`, which removes the `gsd-sdk` binary that the plugin's workflow scripts shell out to in 500+ places. After following the step, every `/gsd:*` command failed with `command not found: gsd-sdk`. §2 now explicitly tells users to keep the package installed (with a "this README used to be wrong" callout) and points at the long-term plan to route workflows through the plugin's MCP server.
- **`README.md` — Installation prerequisites** — added a new "Prerequisites: install the GSD SDK CLI" subsection before Step 1, with the exact `npm install -g get-shit-done-cc` command and a verification snippet (`which gsd-sdk` / `gsd-sdk --version`). This closes the same gap for fresh installs that issue #4 surfaced for migrating ones.

### Notes
- Reported by @ThomasHezard ([#4](https://github.com/jnuyens/gsd-plugin/issues/4), 2026-04-28) with a Claude-on-behalf-of-user investigation that pinpointed exact line numbers and counted the `gsd-sdk` ref footprint. Confirmed independently by @herman925 (2026-05-06).
- This is a documentation-only release; no behavior change in plugin code. The architectural fix (routing workflow scripts through the plugin's MCP server so `gsd-sdk` is no longer a separate prerequisite) remains tracked at [#4](https://github.com/jnuyens/gsd-plugin/issues/4).

## [2.41.0] - 2026-05-07  (based on upstream GSD 1.41.0)

Upstream minor sync — picks up GSD 1.41.0 (released 2026-05-07). Plugin-only patches in `bin/lib/core.cjs` (CLAUDE_PLUGIN_ROOT path resolution helpers `resolveGsdRoot` / `resolveGsdDataDir` / `resolveGsdAsset` + agent-dir override `getAgentsDir` reading `GSD_AGENTS_DIR`) preserved via 3-way merge. `bin/gsd-tools.cjs` untouched upstream this cycle; plugin's `migrate` / `write-phase-memory` / `checkpoint` / `hook` cases verified intact via regression grep.

### Added
- **`/gsd:mvp-phase` workflow** — new MVP-phase command (vertical-slice planning + TDD execution + UAT verification). Includes 8 new references (`mvp-concepts`, `planner-mvp-mode`, `execute-mvp-tdd`, `verify-mvp-mode`, `spidr-splitting`, `skeleton-template`, `user-story-template`, `worktree-path-safety`). New plugin skill `skills/mvp-phase/SKILL.md` exposes the command.
- **3 new workflow bodies** for existing skills: `workflows/add-backlog.md`, `workflows/debug.md`, `workflows/thread.md` (the skills already existed in the plugin; upstream now ships the workflow files they reference).
- **`bin/lib/runtime-homes.cjs`** — runtime-aware `globalSkillsBase` resolution (replaces hardcoded path, upstream #3126).
- 7 agent-prompt updates: `gsd-codebase-mapper`, `gsd-debug-session-manager`, `gsd-executor`, `gsd-plan-checker`, `gsd-planner`, `gsd-roadmapper`, `gsd-verifier`.
- See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.0>.

### Changed
- **Version bump** — plugin `2.40.2 → 2.41.0` per `plugin_minor = upstream_minor` versioning (README § Versioning).
- **`workflows/extract_learnings.md` renamed to `workflows/extract-learnings.md`** (snake → kebab; git history preserved via `git mv`).
- **33 workflows refreshed** at top level: `ai-integration-phase`, `audit-fix`, `audit-milestone`, `code-review-fix`, `code-review`, `diagnose-issues`, `discuss-phase-assumptions`, `discuss-phase`, `docs-update`, `execute-phase`, `execute-plan`, `explore`, `help`, `import`, `ingest-docs`, `manager`, `map-codebase`, `new-milestone`, `new-project`, `next`, `plan-phase`, `progress`, `quick`, `resume-project`, `scan`, `secure-phase`, `settings`, `stats`, `ui-phase`, `ui-review`, `update`, `validate-phase`, `verify-work`. Notable: `quick.md` (history-based resurrection guard), `plan-phase.md` (removed stale OpenCode `agent:` directive #3156), `execute-phase.md` + sub-step files (cwd-drift sentinel + absolute-path guard #3097/#3099).
- **3 nested workflow files refreshed**: `discuss-phase/modes/advisor.md`, `execute-phase/steps/codebase-drift-gate.md`, `execute-phase/steps/per-plan-worktree-gate.md`.
- **12 `bin/lib/` modules refreshed** wholesale (no plugin patches in any of them): `artifacts`, `config-schema`, `graphify`, `init`, `milestone`, `phase-command-router`, `phase`, `profile-output`, `roadmap`, `state-command-router`, `state`, `verify`.
- **`templates/README.md`** updated.

### Fixed
- Upstream bug fixes flowing through automatically: milestone version-resolution (#3109), STATE narrative-tail normalization (#3122), `roadmap.cjs` plan-count for nested layout (#3128), `state.begin-phase` idempotency (#3127), workflow contract validation (#3151), and statusline numeric-100 / next_phases parsing (#3154).

## [2.40.2] - 2026-05-07

Hotfix — restores the bundled MCP server's stdio transport so `claude mcp list` reports `gsd: ✓ Connected` and the eight `gsd_*` MCP tools become reachable.

### Fixed
- **`mcp/server.cjs`** (#3) — switched the stdio transport to newline-delimited JSON, which is what the MCP spec and current Claude Code MCP clients send and expect. The previous LSP-style `Content-Length:` framing silently dropped every request: the reader required `\r\n\r\n` that ndjson never produces, and the writer emitted headers ndjson clients won't parse as a response boundary. Reader now tries ndjson first and falls back to Content-Length framing only when a complete LSP header block arrives before the next newline (safe for any legacy transport still emitting it). Verified locally: `initialize` returns 176 bytes, `tools/list` returns all 8 tools.

### Notes
- Reported and patched by @Sovereigntymind (the project's first external contributor!) and confirmed on macOS / 2.40.1 by @jesse-smith. The fix is the contributor's tested patch applied verbatim, with the LSP path kept as a fallback rather than removed.
- Slash commands were unaffected by this bug because they read `.planning/` files directly and don't go through the MCP server.

## [2.40.1] - 2026-05-06

Hotfix — suppresses a false-positive "GSD subagents are not installed" warning that appeared after `/gsd:new-project` and `/gsd:new-milestone` for plugin users.

### Fixed
- **`bin/lib/core.cjs::getAgentsDir()`** (#PLUGIN-AGENTS-DIR) — upstream's `__dirname/../../../agents` traversal assumes the upstream `<root>/get-shit-done/bin/lib/` layout and lands one level too high in the plugin's flattened `<plugin_root>/bin/lib/` layout. Patched to prefer `path.join(resolveGsdRoot(), 'agents')` when that directory exists, so `checkAgentsInstalled()` finds the bundled agents.
- **`workflows/new-project.md` + `workflows/new-milestone.md`** — the `agents_installed: false` warning gate now first overrides the flag for plugin users (`CLAUDE_PLUGIN_ROOT` set + bundled `agents/gsd-planner.md` present), and the fallback warning text clarifies that plugin users can ignore it. The previous warning recommended `npx get-shit-done-cc@latest --global`, which the plugin's `migrations/legacy-cleanup.cjs::autoMigrate` actively undoes — bad advice for plugin users.
- **`workflows/quick.md`** — exports `GSD_AGENTS_DIR=$CLAUDE_PLUGIN_ROOT/agents` before the `gsd-sdk query init.quick` call so the SDK's bundled (un-patched) `core.cjs` consults the plugin's agents directory.

### Notes
- Patches are tagged inline with `[PLUGIN PATCH]` / `#PLUGIN-AGENTS-DIR` markers and recorded in the persistent plugin-patches inventory so future upstream syncs preserve them.
- This is a plugin-side fix only. Standalone `gsd-sdk` invocations outside the plugin's workflows still report the false-negative, because the SDK ships its own bundled `core.cjs` from the npx cache and that copy is not patched. A future upstream PR can land the same `getAgentsDir()` fix at source.

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
