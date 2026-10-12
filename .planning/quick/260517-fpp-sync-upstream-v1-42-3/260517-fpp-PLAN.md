---
phase: 260517-fpp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/gsd-executor.md
  - agents/gsd-phase-researcher.md
  - agents/gsd-planner.md
  - agents/gsd-research-synthesizer.md
  - agents/gsd-roadmapper.md
  - bin/lib/
  - sdk/src/
  - sdk/dist/cli.js
  - workflows/execute-phase.md
  - workflows/plan-phase.md
  - workflows/ultraplan-phase.md
  - workflows/update.md
  - package.json
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - README.md
  - CHANGELOG.md
autonomous: true
requirements: []
tags: [upstream-sync, plugin-patches, version-bump, hotfix-sync]

must_haves:
  truths:
    - "Plugin tree contains upstream get-shit-done v1.42.3 source-of-truth content for the changed surfaces (agents/{5 files}, bin/lib/{8 files}, sdk/src/{8 files}, workflows/{4 files}). Plugin tree is byte-identical to v1.42.2 baseline for surfaces unchanged upstream (hooks/, templates/, references/, bin/gsd-tools.cjs, bin/lib/model-catalog.cjs)."
    - "The 4 in-tree plugin patches (codename #PLUGIN-AGENTS-DIR `[PLUGIN PATCH]` markers in bin/lib/core.cjs, [PLUGIN PATCH #PLUGIN-MODEL-CATALOG-PATH] in bin/lib/model-catalog.cjs, 4 dispatch cases in bin/gsd-tools.cjs, [PLUGIN PATCH] #PLUGIN-HOOK-CONTEXT-MONITOR in hooks/gsd-context-monitor.js) AND the 2 SDK source patches ([PLUGIN PATCH] markers in sdk/src/query/state-project-load.ts and sdk/src/query-gsd-tools-path.ts) AND the consolidated sdk/src/sdk-package-compatibility.ts::legacyAssetProbes plugin-flat candidate ALL survive the sync verbatim. Plugin-owned bin/gsd-sdk + bin/gsd-sdk.cmd wrappers (#PLUGIN-WRAPPER-ENV-EXPORT codename) remain byte-identical (sha256-verified). hooks/gsd-shadowing-sdk-detector.js (plugin-owned, added in v2.43.1) remains untouched."
    - "commands/ directory remains absent in the plugin tree (was not added by the sync)."
    - "sdk/dist/cli.js is freshly rebuilt and >= 1.4 MB, containing the SDK source patches (>= 2 CLAUDE_PLUGIN_ROOT matches, one per patched module)."
    - "Three metadata files (package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json) all report version 2.43.3."
    - "README.md header (first 10 lines) references upstream GSD v1.42.3 as the new base and plugin v2.43.3; stale v1.42.2 / 2.43.2 header references removed."
    - "CHANGELOG.md has a new [2.43.3] section dated 2026-05-17 with concise upstream highlights (3-5 most plugin-relevant items from the 35-commit hotfix delta) and the 'based on upstream GSD 1.42.3' marker."
    - "Existing regression tests (tests/mcp-stdio-framing.test.cjs, tests/workspace-json-integration.test.cjs, tests/hooks-smoke.test.cjs at 16 cases including v2.43.1 shadowing-sdk-detector) still pass against the synced tree."
  artifacts:
    - path: .planning/quick/260517-fpp-sync-upstream-v1-42-3/260517-fpp-PLAN.md
      provides: "this plan file"
    - path: package.json
      provides: "plugin version metadata"
      contains: '"version": "2.43.3"'
    - path: .claude-plugin/plugin.json
      provides: "Claude Code plugin manifest"
      contains: '"version": "2.43.3"'
    - path: .claude-plugin/marketplace.json
      provides: "marketplace manifest (commonly missed in prior syncs)"
      contains: '"version": "2.43.3"'
    - path: sdk/dist/cli.js
      provides: "rebundled SDK CLI carrying SDK source patches"
      min_bytes: 1400000
    - path: CHANGELOG.md
      provides: "release notes entry"
      contains: "## [2.43.3] - 2026-05-17"
    - path: README.md
      provides: "user-facing version reference"
      contains: "v1.42.3"
    - path: /tmp/namespace-hits.txt
      provides: "positive proof Task 5 detection step ran (per prior sync Warning 4 fix)"
  key_links:
    - from: "bin/lib/core.cjs"
      to: "plugin-flat-layout agents/"
      via: "getAgentsDir() patched to prefer resolveGsdRoot() + 'agents'"
      pattern: "[PLUGIN PATCH] (codename #PLUGIN-AGENTS-DIR), two literal marker blocks"
    - from: "bin/lib/model-catalog.cjs"
      to: "sdk/shared/model-catalog.json"
      via: "flat-layout candidate prepended to resolver list"
      pattern: "#PLUGIN-MODEL-CATALOG-PATH (untouched this cycle, upstream did not modify file)"
    - from: "hooks/gsd-context-monitor.js"
      to: "bin/gsd-tools.cjs"
      via: "__dirname traversal with 'get-shit-done' segment dropped + GSD_TOOLS_PATH env override"
      pattern: "#PLUGIN-HOOK-CONTEXT-MONITOR (untouched this cycle, upstream hooks/ unchanged)"
    - from: "sdk/dist/cli.js"
      to: "sdk/src/query/state-project-load.ts and sdk/src/query-gsd-tools-path.ts"
      via: "rebundled by 'cd sdk && npm run build' after re-applying SDK source patches (note: neither patched file appears in v1.42.2..v1.42.3 sdk/src/ diff, so patches survive automatically; rebundle still required because OTHER sdk/src/ modules changed)"
      pattern: "CLAUDE_PLUGIN_ROOT candidates inside compiled bundle (>= 2 matches)"
---

<objective>
Sync upstream get-shit-done v1.42.3 source tree into the plugin layout (currently at v1.42.2 baseline) and ship as plugin v2.43.3. This is a HOTFIX-style patch sync: 76 files / 4.4k LOC delta upstream, ~13x smaller than the v1.41.2 to v1.42.2 sync (which was 609 files). Established pattern adapts to a 5-task structure (no hooks task this cycle, because upstream hooks/ is unchanged between v1.42.2..v1.42.3).

Critical simplifications vs prior sync:
- Upstream hooks/ unchanged: no refresh of hooks/gsd-context-monitor.js or hooks/gsd-workflow-guard.js. The #PLUGIN-HOOK-CONTEXT-MONITOR patch survives automatically.
- bin/gsd-tools.cjs unchanged upstream: 4 dispatch cases survive verbatim with no merge needed. Sanity-grep only.
- bin/lib/model-catalog.cjs unchanged upstream: #PLUGIN-MODEL-CATALOG-PATH patch survives automatically. Sanity-grep only.
- sdk/src/ patched files (state-project-load.ts, query-gsd-tools-path.ts) NOT in upstream's v1.42.2..v1.42.3 sdk/src/ diff: patches survive automatically. Rebundle still required because OTHER sdk/src/ modules changed.

What IS plugin-relevant work:
- Wholesale refresh of 5 agents/ files, 8 bin/lib/ files, 8 sdk/src/ files, 4 workflows/ files
- Re-apply 2 plugin patches in bin/lib/core.cjs (upstream MAY have touched core.cjs; verified via diff: NOT in v1.42.2..v1.42.3 lib diff, so technically untouched, but established sync discipline requires surgical re-apply discipline regardless — defensive)
- Rebuild sdk/dist/cli.js (other sdk/src/ modules changed)
- Version bump 2.43.2 -> 2.43.3 across 3 metadata files
- README.md + CHANGELOG.md docs refresh
- Conditional namespace rewrite in 4 newly-pulled workflows/ files (probably 0 hits, but detection-step artifact is mandatory)

Purpose: Keep the plugin current with upstream while preserving plugin-specific patches and architecture.

Output: 4 mandatory atomic commits (Tasks 1-4) + 1 conditional commit (Task 5, only if namespace hits found) on the worktree branch, ready for orchestrator merge + release.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jnuyens/src/gsd-plugin/.planning/STATE.md
@/Users/jnuyens/src/gsd-plugin/CHANGELOG.md
@/Users/jnuyens/.claude/projects/-Users-jnuyens-src-gsd-plugin/memory/feedback_plugin_patches_inventory.md
@/Users/jnuyens/src/gsd-plugin/.planning/quick/260515-f2d-new-upstream-version/260515-f2d-SUMMARY.md
@/Users/jnuyens/src/gsd-plugin/.planning/quick/260515-f2d-new-upstream-version/260515-f2d-PLAN.md

# Source-of-truth upstream tree (read-only, read via `git -C /tmp/gsd-upstream-check show v1.42.3:<path>`)
- /tmp/gsd-upstream-check/  — fresh clone, checked out at v1.42.3
- /tmp/gsd-upstream-check/CHANGELOG.md  — upstream changelog (only goes up to v1.42.1; v1.42.2 and v1.42.3 release notes are in GitHub Releases / changesets, not CHANGELOG.md)
- /tmp/gsd-upstream-check/.changeset/  — per-PR changesets for v1.42.3 (3541, 3542, 3562, 3566, 3591, 3593, 3599, 3600, 3601, 3602, 3605, 3608, 3610, 3621)

<interfaces>
<!-- Patch surfaces — extracted from the live plugin tree at v2.43.2 (HEAD). -->
<!-- Executor: most patches survive automatically this cycle; verify-only is the dominant pattern. -->

CODENAME vs LITERAL CLARIFICATION (unchanged from v2.43.0 sync):
  - "#PLUGIN-AGENTS-DIR", "#PLUGIN-MODEL-CATALOG-PATH", "#PLUGIN-HOOK-CONTEXT-MONITOR", "#PLUGIN-WRAPPER-ENV-EXPORT" are CODENAMES used in the memory-inventory feedback file. They are NOT all present as literal in-source strings.
  - The actual in-source markers are:
      * bin/lib/core.cjs : two `[PLUGIN PATCH]` comment blocks. Functional landmarks: `resolveGsdRoot` exports + `function getAgentsDir` body.
      * bin/lib/model-catalog.cjs : literal `[PLUGIN PATCH #PLUGIN-MODEL-CATALOG-PATH]`.
      * hooks/gsd-context-monitor.js : literal `[PLUGIN PATCH] #PLUGIN-HOOK-CONTEXT-MONITOR`.
      * sdk/src/query/state-project-load.ts : literal `[PLUGIN PATCH]`.
      * sdk/src/query-gsd-tools-path.ts : literal `[PLUGIN PATCH]`.
      * sdk/src/sdk-package-compatibility.ts : `[PLUGIN PATCH]` marker added in v2.43.0 (consolidated CLAUDE_PLUGIN_ROOT probe via legacyAssetProbes).
      * bin/gsd-tools.cjs : NO literal marker; identified by 4 dispatch cases.
  - Grep gates therefore must target the actual in-source string per file, not the codename.

UPSTREAM DIFF AUDIT (v1.42.2..v1.42.3) — already performed during plan-write, captured here:

  Plugin-relevant SDK source files (M = modified, A = added, R = renamed, D = deleted, C = copied):
    A  sdk/src/bug-3591-gsdtools-runtime-workstream.test.ts
    M  sdk/src/query-gsd-tools-runtime.ts
    M  sdk/src/query/config-mutation.ts
    M  sdk/src/query/init.test.ts
    M  sdk/src/query/init.ts
    M  sdk/src/query/state.ts
    M  sdk/src/query/validate.test.ts
    M  sdk/src/query/validate.ts
  - CRITICAL: sdk/src/query/state-project-load.ts NOT in this list (patches survive).
  - CRITICAL: sdk/src/query-gsd-tools-path.ts NOT in this list (patches survive).
  - CRITICAL: sdk/src/sdk-package-compatibility.ts NOT in this list (consolidated probe survives).
  - 8 sdk/src/ files total to refresh from upstream; rebuild bundle after refresh.

  Plugin-relevant bin/lib/ files:
    M  get-shit-done/bin/lib/commands.cjs
    M  get-shit-done/bin/lib/config.cjs
    M  get-shit-done/bin/lib/core.cjs
    M  get-shit-done/bin/lib/init.cjs
    M  get-shit-done/bin/lib/installer-migration-report.cjs
    M  get-shit-done/bin/lib/phase-command-router.cjs
    M  get-shit-done/bin/lib/phase.cjs
    M  get-shit-done/bin/lib/roadmap.cjs
  - core.cjs IS in the list — surgical re-apply of the 2 [PLUGIN PATCH] blocks required, same as v2.43.0 sync.
  - model-catalog.cjs NOT in the list — patch survives automatically (sanity-grep only).
  - 8 bin/lib/ files total to refresh from upstream.

  Plugin-relevant agents/ files:
    M  agents/gsd-executor.md
    M  agents/gsd-phase-researcher.md
    M  agents/gsd-planner.md
    M  agents/gsd-research-synthesizer.md
    M  agents/gsd-roadmapper.md
  - 5 files to refresh. No plugin patches in agents/.

  Plugin-relevant workflows/ files:
    M  get-shit-done/workflows/execute-phase.md
    M  get-shit-done/workflows/plan-phase.md
    M  get-shit-done/workflows/ultraplan-phase.md
    M  get-shit-done/workflows/update.md
  - 4 files to refresh. Task 5 namespace-rewrite check runs on these (and ALL workflows/ for safety).

  Plugin-relevant hooks/ files: NONE (no files changed upstream — #PLUGIN-HOOK-CONTEXT-MONITOR patch survives automatically).
  Plugin-relevant bin/ root: ONLY `bin/install.js` upstream — NOT shipped by the plugin (plugin owns bin/gsd-sdk wrappers, not the upstream installer). EXCLUDED.

  Upstream-only / EXCLUDED:
    - All .changeset/*.md (15 files, upstream changeset metadata, plugin doesn't ship)
    - .github/workflows/release-sdk.yml (upstream CI)
    - docs/ARCHITECTURE.md, docs/installer-migrations.md (upstream-only docs)
    - bin/install.js (upstream installer; plugin uses Claude Code plugin loader, not npm install)
    - package-lock.json, package.json (upstream npm metadata — DIFFERENT from plugin's package.json)
    - scripts/diff-touches-shipped-paths.cjs (upstream CI script)
    - sdk/package-lock.json, sdk/package.json (upstream SDK npm metadata)
    - tests/* additions and modifications (upstream regression tests; plugin has its own tests/)

Patch 1: bin/lib/core.cjs ([PLUGIN PATCH] -- codename #PLUGIN-AGENTS-DIR)
  - Upstream v1.42.2 -> v1.42.3: core.cjs IS modified upstream. Apply same wholesale-copy + surgical-re-apply discipline as v2.43.0.
  - Use `git -C "$WT_ROOT" show HEAD:bin/lib/core.cjs` as source of truth for the patch shape.
  - Required surface: 2x `[PLUGIN PATCH]` literal comment blocks + resolveGsdRoot/resolveGsdDataDir/resolveGsdAsset helper exports + patched getAgentsDir body.
  - Verification: `grep -c '\[PLUGIN PATCH\]' bin/lib/core.cjs` >= 2 AND `grep -q 'resolveGsdRoot' bin/lib/core.cjs` AND `grep -q 'function getAgentsDir' bin/lib/core.cjs`.

Patch 2: bin/lib/model-catalog.cjs ([PLUGIN PATCH #PLUGIN-MODEL-CATALOG-PATH])
  - Upstream v1.42.2 -> v1.42.3: model-catalog.cjs NOT in diff. Patch survives automatically.
  - Verify only: `grep -q '#PLUGIN-MODEL-CATALOG-PATH' bin/lib/model-catalog.cjs`.

Patch 3: bin/gsd-tools.cjs -- 4 dispatch cases
  - Upstream v1.42.2 -> v1.42.3: gsd-tools.cjs NOT in diff. Dispatch cases survive automatically.
  - Verify only: 4 case strings present.

Patch 4: hooks/gsd-context-monitor.js ([PLUGIN PATCH] #PLUGIN-HOOK-CONTEXT-MONITOR)
  - Upstream v1.42.2 -> v1.42.3: hooks/ entirely unchanged. Patch survives automatically.
  - Verify only: `grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' hooks/gsd-context-monitor.js`.

Patch 5: SDK source patches (sdk/src/) -- two files + one consolidated helper:
  - sdk/src/query/state-project-load.ts -- `[PLUGIN PATCH]` marker.
  - sdk/src/query-gsd-tools-path.ts -- `[PLUGIN PATCH]` marker.
  - sdk/src/sdk-package-compatibility.ts -- `[PLUGIN PATCH]` marker (legacyAssetProbes consolidated probe added in v2.43.0).
  - Upstream v1.42.2 -> v1.42.3: NONE of these three files are in the sdk/src/ diff. Patches survive automatically.
  - HOWEVER: 8 OTHER sdk/src/ files changed, so the bundle MUST be rebuilt regardless. After wholesale sdk/src/ refresh, run `cd sdk && npm run build` and verify the bundle still carries the SDK source patches (gate: `grep -c CLAUDE_PLUGIN_ROOT sdk/dist/cli.js` >= 2; the v2.43.0 baseline had 3 matches).

Plugin-OWNED files (DO NOT touch during wholesale copy):
  - bin/gsd-sdk (#PLUGIN-WRAPPER-ENV-EXPORT codename, POSIX wrapper)
  - bin/gsd-sdk.cmd (Windows wrapper)
  - bin/maintenance/check-drift.cjs
  - bin/validate-plugin.cjs
  - hooks/gsd-prompt-guard.js, gsd-read-guard.js, gsd-read-injection-scanner.js, gsd-validate-commit.sh, gsd-phase-boundary.sh, gsd-session-state.sh, gsd-workflow-guard.js, gsd-context-monitor.js, hooks.json, hooks/lib/, **hooks/gsd-shadowing-sdk-detector.js (plugin-OWNED since v2.43.1, NEVER upstream-synced)**
  - tests/  -- plugin-owned regression tests (including tests/hooks-smoke.test.cjs at 16 cases)
  - .planning/  -- plugin-owned planning artifacts
  - .claude-plugin/  -- plugin manifest dir
  - README.md, CHANGELOG.md, CONTEXT.md, CONTRIBUTING.md, VERSIONING.md, LICENSE  -- plugin-owned docs

NEW IN UPSTREAM v1.42.3 (35 commits, hotfix-style):
  - **Phase removal logic hardening** (#3599, #3600, #3601, #3602): prefixed-phase headings as section boundaries, peer-depth decimal phase preservation, slugged plan ref renumbering, project-code-prefixed phase dir counting in milestone filter.
  - **plan-phase gated on closed phases** (#3569): `init.plan-phase` surfaces phase_status, `/gsd:plan-phase` errors on closed phases.
  - **Antigravity first-class runtime** (#3608) in update.md.
  - **Codex install hardening** (#3582, #3610): bundled hooks leftovers, skill materialization expectations.
  - **W007 warning ignores archived phases** (#3560).
  - **Installer migration env override** honored.
  - **CodeRabbit phase mode parsing fixes**.

Pick 3-5 of the above for the CHANGELOG [2.43.3] entry — DO NOT enumerate all 35 commits.
</interfaces>

<worktree_branch_check>
Before EVERY commit, the executor MUST assert:
1. cwd is the worktree (not main repo). All file edits use absolute paths under the worktree root.
2. `git -C "$WT" rev-parse --abbrev-ref HEAD` returns the quick-task branch (NOT master).
3. `git -C "$WT" status` shows the expected staged files (no surprise additions, no missing patch markers).
4. After committing, `git -C "$WT" log -1 --stat` confirms only the intended files changed.

If any check fails, STOP and surface as deviation. The worktree HEAD-assertion hook (#2924) will refuse any accidental commit to a protected ref.
</worktree_branch_check>

<assumed_paths>
- WT_ROOT: the worktree path (resolve via `git worktree list` at task start; do NOT hardcode)
- UPSTREAM: /tmp/gsd-upstream-check  (v1.42.3 source-of-truth, read-only)
- In-source markers to grep AFTER each commit touching the relevant file:
  - bin/lib/core.cjs : `grep -c '\[PLUGIN PATCH\]' bin/lib/core.cjs` >= 2 AND `grep -q 'resolveGsdRoot' bin/lib/core.cjs` AND `grep -q 'function getAgentsDir' bin/lib/core.cjs`
  - bin/lib/model-catalog.cjs : `grep -q '#PLUGIN-MODEL-CATALOG-PATH' bin/lib/model-catalog.cjs`
  - hooks/gsd-context-monitor.js : `grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' hooks/gsd-context-monitor.js`
  - bin/gsd-tools.cjs : 4 case strings present (write-phase-memory, checkpoint, hook, migrate)
  - sdk/src/query/state-project-load.ts : `grep -q '\[PLUGIN PATCH\]' sdk/src/query/state-project-load.ts`
  - sdk/src/query-gsd-tools-path.ts : `grep -q '\[PLUGIN PATCH\]' sdk/src/query-gsd-tools-path.ts`
  - sdk/src/sdk-package-compatibility.ts : `grep -q '\[PLUGIN PATCH\]' sdk/src/sdk-package-compatibility.ts`
  - sdk/dist/cli.js : `grep -c CLAUDE_PLUGIN_ROOT sdk/dist/cli.js` >= 2 (proves rebundle carried the SDK source patches; v2.43.0 baseline had 3)
- bin/gsd-sdk + bin/gsd-sdk.cmd + hooks/gsd-shadowing-sdk-detector.js MUST be byte-identical post-task-1 (sha256 unchanged from pre-task-1).
</assumed_paths>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wholesale upstream source-tree copy + re-apply core.cjs patches + verify all other patches survive + rebundle sdk/dist/cli.js</name>
  <files>
    agents/gsd-executor.md,
    agents/gsd-phase-researcher.md,
    agents/gsd-planner.md,
    agents/gsd-research-synthesizer.md,
    agents/gsd-roadmapper.md,
    bin/lib/commands.cjs,
    bin/lib/config.cjs,
    bin/lib/core.cjs (refresh + re-apply two [PLUGIN PATCH] blocks: resolveGsdRoot helpers + getAgentsDir body, codename #PLUGIN-AGENTS-DIR),
    bin/lib/init.cjs,
    bin/lib/installer-migration-report.cjs,
    bin/lib/phase-command-router.cjs,
    bin/lib/phase.cjs,
    bin/lib/roadmap.cjs,
    sdk/src/bug-3591-gsdtools-runtime-workstream.test.ts (new from upstream),
    sdk/src/query-gsd-tools-runtime.ts,
    sdk/src/query/config-mutation.ts,
    sdk/src/query/init.test.ts,
    sdk/src/query/init.ts,
    sdk/src/query/state.ts,
    sdk/src/query/validate.test.ts,
    sdk/src/query/validate.ts,
    sdk/dist/cli.js (rebundled via `cd sdk && npm run build`),
    workflows/execute-phase.md,
    workflows/plan-phase.md,
    workflows/ultraplan-phase.md,
    workflows/update.md
  </files>
  <action>
    Operate on the worktree only (resolve WT_ROOT via `git worktree list`; do NOT hardcode). Use absolute paths.

    Pre-task snapshot (MANDATORY):
      Snapshot sha256 of plugin-owned files that MUST NOT change during this task:
        shasum -a 256 bin/gsd-sdk bin/gsd-sdk.cmd hooks/gsd-shadowing-sdk-detector.js > /tmp/260517-fpp-presync.sha256
      These MUST be byte-identical at end of task.

    Pre-Task-1 SDK source path audit (MANDATORY before wholesale sdk/src/* copy):
      Already performed during plan-write; result is DOCUMENTED in <interfaces> above. The 3 patched SDK source files (state-project-load.ts, query-gsd-tools-path.ts, sdk-package-compatibility.ts) are NOT in the upstream v1.42.2..v1.42.3 sdk/src/ diff, so patches survive automatically. REVERIFY at task start by running:
        git -C /tmp/gsd-upstream-check diff --name-status v1.42.2..v1.42.3 -- sdk/src/ > /tmp/sdk-src-diff.txt
        cat /tmp/sdk-src-diff.txt
      Assert NONE of the 3 patched files appear in /tmp/sdk-src-diff.txt. If ANY DO appear with status M (modified), STOP and surface "SDK source patch file modified upstream — manual merge required" as deviation. If R/C/D (rename/copy/delete) ANY: ABORT.

    Source-tree wholesale copy from /tmp/gsd-upstream-check (at v1.42.3). Map ONLY the 25 actually-changed files (not the entire tree, to minimize the diff):

      agents (5 files):
        cp /tmp/gsd-upstream-check/agents/gsd-executor.md "$WT_ROOT/agents/gsd-executor.md"
        cp /tmp/gsd-upstream-check/agents/gsd-phase-researcher.md "$WT_ROOT/agents/gsd-phase-researcher.md"
        cp /tmp/gsd-upstream-check/agents/gsd-planner.md "$WT_ROOT/agents/gsd-planner.md"
        cp /tmp/gsd-upstream-check/agents/gsd-research-synthesizer.md "$WT_ROOT/agents/gsd-research-synthesizer.md"
        cp /tmp/gsd-upstream-check/agents/gsd-roadmapper.md "$WT_ROOT/agents/gsd-roadmapper.md"

      bin/lib (8 files):
        for f in commands.cjs config.cjs core.cjs init.cjs installer-migration-report.cjs phase-command-router.cjs phase.cjs roadmap.cjs; do
          cp "/tmp/gsd-upstream-check/get-shit-done/bin/lib/$f" "$WT_ROOT/bin/lib/$f"
        done

      sdk/src (8 files, including 1 new test file):
        cp /tmp/gsd-upstream-check/sdk/src/bug-3591-gsdtools-runtime-workstream.test.ts "$WT_ROOT/sdk/src/bug-3591-gsdtools-runtime-workstream.test.ts"
        cp /tmp/gsd-upstream-check/sdk/src/query-gsd-tools-runtime.ts "$WT_ROOT/sdk/src/query-gsd-tools-runtime.ts"
        for f in config-mutation.ts init.test.ts init.ts state.ts validate.test.ts validate.ts; do
          cp "/tmp/gsd-upstream-check/sdk/src/query/$f" "$WT_ROOT/sdk/src/query/$f"
        done

      workflows (4 files):
        for f in execute-phase.md plan-phase.md ultraplan-phase.md update.md; do
          cp "/tmp/gsd-upstream-check/get-shit-done/workflows/$f" "$WT_ROOT/workflows/$f"
        done

    EXCLUDED -- do NOT copy any of these even if upstream has changes:
      - upstream/commands/  (HARD RULE — see memory entry "No bundled commands/")
      - upstream/bin/install.js  (plugin uses Claude Code plugin loader)
      - upstream/.changeset/*.md  (upstream changeset metadata)
      - upstream/.github/workflows/*  (upstream CI)
      - upstream/docs/*  (upstream-only docs)
      - upstream/package.json, upstream/package-lock.json  (DIFFERENT from plugin's package.json — plugin's package.json owns v2.43.X version)
      - upstream/sdk/package.json, upstream/sdk/package-lock.json  (upstream SDK npm metadata)
      - upstream/scripts/*  (upstream CI scripts)
      - upstream/tests/*  (upstream tests; plugin has its own tests/)
      - hooks/* entirely  (upstream did NOT change any hook file v1.42.2..v1.42.3 — verified)
      - bin/gsd-tools.cjs  (upstream did NOT change v1.42.2..v1.42.3 — verified; dispatch cases survive automatically)
      - bin/lib/model-catalog.cjs  (upstream did NOT change v1.42.2..v1.42.3 — verified; #PLUGIN-MODEL-CATALOG-PATH survives automatically)
      - templates/, references/  (upstream did NOT change v1.42.2..v1.42.3 — verified)
      - sdk/src/query/state-project-load.ts, sdk/src/query-gsd-tools-path.ts, sdk/src/sdk-package-compatibility.ts  (NOT in upstream sdk/src/ diff; patches survive automatically)

    Re-apply ONLY the 2 [PLUGIN PATCH] blocks in bin/lib/core.cjs (the ONE file in this sync that requires surgical re-apply):
      1. Read `git -C "$WT_ROOT" show HEAD:bin/lib/core.cjs` to capture the pre-copy plugin patch shape (the resolveGsdRoot/resolveGsdDataDir/resolveGsdAsset helper exports + the patched getAgentsDir body + the two [PLUGIN PATCH] comment blocks).
      2. After the wholesale copy of upstream v1.42.3 bin/lib/core.cjs landed at $WT_ROOT/bin/lib/core.cjs, use the Edit tool to surgically re-insert:
         - The `resolveGsdRoot`, `resolveGsdDataDir`, `resolveGsdAsset` helper functions + their `module.exports` entries.
         - The patched `getAgentsDir()` body preferring `path.join(resolveGsdRoot(), 'agents')` when that directory exists, before falling back to upstream's path.join.
         - Both `[PLUGIN PATCH]` literal-marker comment blocks.
      3. Confirm the file still parses as valid JavaScript: `node --check $WT_ROOT/bin/lib/core.cjs` returns clean (exit 0).

    Verify all other patches survive automatically (no edits required; pure grep gates):
      - bin/lib/model-catalog.cjs : grep -q '#PLUGIN-MODEL-CATALOG-PATH' (untouched upstream)
      - bin/gsd-tools.cjs : 4 case strings present (untouched upstream)
      - hooks/gsd-context-monitor.js : grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' (untouched upstream)
      - sdk/src/query/state-project-load.ts : grep -q '\[PLUGIN PATCH\]' (untouched upstream)
      - sdk/src/query-gsd-tools-path.ts : grep -q '\[PLUGIN PATCH\]' (untouched upstream)
      - sdk/src/sdk-package-compatibility.ts : grep -q '\[PLUGIN PATCH\]' (untouched upstream)

    If ANY of the above grep gates fail (i.e. a patch marker is missing in a file we did NOT copy), STOP and surface as deviation. Either the audit was wrong or the file was inadvertently touched.

    Syntax check the 8 modified bin/lib .cjs files:
      for f in commands.cjs config.cjs core.cjs init.cjs installer-migration-report.cjs phase-command-router.cjs phase.cjs roadmap.cjs; do
        node --check "$WT_ROOT/bin/lib/$f" || { echo "FAIL: $f"; exit 1; }
      done

    Rebuild sdk/dist/cli.js (8 sdk/src/ modules changed, so bundle must rebuild):
      cd "$WT_ROOT/sdk" && npm run build

      Post-rebundle gates:
        - sdk/dist/cli.js exists
        - file size >= 1,400,000 bytes:
            [ $(stat -f%z "$WT_ROOT/sdk/dist/cli.js" 2>/dev/null || stat -c%s "$WT_ROOT/sdk/dist/cli.js") -ge 1400000 ]
        - CLAUDE_PLUGIN_ROOT match count >= 2:
            [ $(grep -c CLAUDE_PLUGIN_ROOT "$WT_ROOT/sdk/dist/cli.js") -ge 2 ]
        - Fallback module-name check (if bundle is heavily minified):
            grep -q 'state-project-load' "$WT_ROOT/sdk/dist/cli.js" AND grep -q 'query-gsd-tools-path' "$WT_ROOT/sdk/dist/cli.js"

      If `npm run build` fails, STOP and surface the failure as a deviation. Do NOT commit a tree with a stale or broken bundle.

    Run regression tests (from WT_ROOT) BEFORE committing:
      - node tests/mcp-stdio-framing.test.cjs
      - node tests/workspace-json-integration.test.cjs
      - node tests/hooks-smoke.test.cjs  (MUST pass all 16 cases including the v2.43.1 shadowing-sdk-detector cases)
    All three MUST pass. Surface failures as deviations and STOP — do not commit a regressed tree.

    Pre-commit verification (executor MUST verify all of these BEFORE committing):
      - sha256 of bin/gsd-sdk unchanged vs /tmp/260517-fpp-presync.sha256
      - sha256 of bin/gsd-sdk.cmd unchanged vs /tmp/260517-fpp-presync.sha256
      - sha256 of hooks/gsd-shadowing-sdk-detector.js unchanged vs /tmp/260517-fpp-presync.sha256
      - `grep -c '\[PLUGIN PATCH\]' bin/lib/core.cjs` >= 2
      - `grep -q 'resolveGsdRoot' bin/lib/core.cjs && grep -q 'function getAgentsDir' bin/lib/core.cjs`
      - `grep -q '#PLUGIN-MODEL-CATALOG-PATH' bin/lib/model-catalog.cjs`  (untouched)
      - `grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' hooks/gsd-context-monitor.js`  (untouched)
      - `grep -c "case 'write-phase-memory'" bin/gsd-tools.cjs` >= 1
      - `grep -c "case 'checkpoint'" bin/gsd-tools.cjs` >= 1
      - `grep -c "case 'hook'" bin/gsd-tools.cjs` >= 1
      - `grep -c "case 'migrate'" bin/gsd-tools.cjs` >= 1
      - `grep -q '\[PLUGIN PATCH\]' sdk/src/query/state-project-load.ts`
      - `grep -q '\[PLUGIN PATCH\]' sdk/src/query-gsd-tools-path.ts`
      - `grep -q '\[PLUGIN PATCH\]' sdk/src/sdk-package-compatibility.ts`
      - `test ! -d commands`  (plugin must still have NO commands/ dir)
      - sdk/dist/cli.js size >= 1,400,000 bytes
      - `grep -c CLAUDE_PLUGIN_ROOT sdk/dist/cli.js` >= 2

    Commit (after worktree_branch_check assertions):
      cd "$WT_ROOT"
      git add agents/gsd-executor.md agents/gsd-phase-researcher.md agents/gsd-planner.md agents/gsd-research-synthesizer.md agents/gsd-roadmapper.md
      git add bin/lib/commands.cjs bin/lib/config.cjs bin/lib/core.cjs bin/lib/init.cjs bin/lib/installer-migration-report.cjs bin/lib/phase-command-router.cjs bin/lib/phase.cjs bin/lib/roadmap.cjs
      git add sdk/src/bug-3591-gsdtools-runtime-workstream.test.ts sdk/src/query-gsd-tools-runtime.ts sdk/src/query/config-mutation.ts sdk/src/query/init.test.ts sdk/src/query/init.ts sdk/src/query/state.ts sdk/src/query/validate.test.ts sdk/src/query/validate.ts
      git add sdk/dist/cli.js
      git add workflows/execute-phase.md workflows/plan-phase.md workflows/ultraplan-phase.md workflows/update.md

      NOTE on sdk/dist: the v2.43.0 sync deviated by staging sdk/dist/ wholesale (190 files) because the bundle process regenerated the entire dist tree. If `git status` after `npm run build` shows MORE than just sdk/dist/cli.js modified (e.g. sdk/dist/cli.js.map, sdk/dist/lib/*.js, etc.), stage the whole sdk/dist/ tree the same way: `git add sdk/dist/`. Surface as deviation in SUMMARY.

      git commit -m "$(cat <<'EOF'
chore(260517-fpp): sync upstream get-shit-done v1.42.3 source tree

- Wholesale refresh of 25 changed files: agents/{5}, bin/lib/{8},
  sdk/src/{8 incl. 1 new test file}, workflows/{4}.
- Re-applied #PLUGIN-AGENTS-DIR plugin patches (2x [PLUGIN PATCH] blocks)
  in bin/lib/core.cjs surgically after wholesale copy.
- Other plugin patches survive automatically (upstream did NOT modify
  bin/lib/model-catalog.cjs, bin/gsd-tools.cjs, hooks/*, or the 3 SDK
  source patch files). Verified via grep gates.
- Rebundled sdk/dist/cli.js via 'cd sdk && npm run build'; bundle
  carries >=2 CLAUDE_PLUGIN_ROOT matches.
- Excluded: commands/ (per policy), bin/install.js, .changeset/,
  upstream/docs, upstream/package*.json, upstream/scripts, upstream/tests.
- Regression tests pass: mcp-stdio-framing, workspace-json-integration,
  hooks-smoke (16 cases including v2.43.1 shadowing-sdk-detector).
EOF
)"

    DO NOT use Co-Authored-By lines in any commit message (per global instruction).
  </action>
  <verify>
    <automated>cd "$WT_ROOT" && node tests/mcp-stdio-framing.test.cjs && node tests/workspace-json-integration.test.cjs && node tests/hooks-smoke.test.cjs && [ $(grep -c '\[PLUGIN PATCH\]' bin/lib/core.cjs) -ge 2 ] && grep -q 'resolveGsdRoot' bin/lib/core.cjs && grep -q 'function getAgentsDir' bin/lib/core.cjs && grep -q '#PLUGIN-MODEL-CATALOG-PATH' bin/lib/model-catalog.cjs && grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' hooks/gsd-context-monitor.js && grep -q "case 'write-phase-memory'" bin/gsd-tools.cjs && grep -q "case 'migrate'" bin/gsd-tools.cjs && grep -q '\[PLUGIN PATCH\]' sdk/src/query/state-project-load.ts && grep -q '\[PLUGIN PATCH\]' sdk/src/query-gsd-tools-path.ts && grep -q '\[PLUGIN PATCH\]' sdk/src/sdk-package-compatibility.ts && [ ! -d commands ] && [ $(stat -f%z sdk/dist/cli.js 2>/dev/null || stat -c%s sdk/dist/cli.js) -ge 1400000 ] && [ $(grep -c CLAUDE_PLUGIN_ROOT sdk/dist/cli.js) -ge 2 ] && node --check bin/lib/core.cjs && shasum -a 256 -c /tmp/260517-fpp-presync.sha256</automated>
  </verify>
  <done>
    Upstream v1.42.3 source files copied into the plugin layout for the 25 actually-changed files, bin/lib/core.cjs's 2 [PLUGIN PATCH] blocks re-applied surgically, all OTHER plugin patches confirmed surviving automatically via grep gates (no edits required), SDK bundle rebuilt and >= 1.4 MB with >= 2 CLAUDE_PLUGIN_ROOT matches, commands/ absent, plugin-owned wrappers and shadowing-sdk-detector hook byte-identical (sha256-verified), 3 regression test suites pass (16 hook-smoke cases), single atomic commit created on the worktree branch.
  </done>
</task>

<task type="auto">
  <name>Task 2: Bump version 2.43.2 -> 2.43.3 across all 3 metadata files</name>
  <files>
    package.json,
    .claude-plugin/plugin.json,
    .claude-plugin/marketplace.json
  </files>
  <action>
    Update the "version" field in each of the THREE metadata files from "2.43.2" to "2.43.3":
      - package.json (top-level "version")
      - .claude-plugin/plugin.json (top-level "version")
      - .claude-plugin/marketplace.json (per-plugin "version" inside plugins[] array — the entry where "name": "gsd")

    CRITICAL: marketplace.json was missed in v2.42.6 and several prior syncs. It is NOT optional. After the edit, verify with grep that all three files now show 2.43.3.

    Each file MUST still parse as valid JSON after the edit (no trailing commas introduced, no escape issues).

    Pre-commit grep gates:
      - `grep -c '"version": "2.43.3"' package.json` >= 1
      - `grep -c '"version": "2.43.3"' .claude-plugin/plugin.json` >= 1
      - `grep -c '"version": "2.43.3"' .claude-plugin/marketplace.json` >= 1
      - Total count of "2.43.2" across all three files == 0 (no stale references)
      - `node -e 'JSON.parse(require("fs").readFileSync("package.json"))'` returns clean (no parse error)
      - Same JSON-parse check for .claude-plugin/plugin.json and .claude-plugin/marketplace.json

    Commit (after worktree_branch_check):
      cd "$WT_ROOT"
      git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json
      git commit -m "chore(260517-fpp): bump plugin version 2.43.2 -> 2.43.3 (upstream GSD 1.42.3)"
  </action>
  <verify>
    <automated>cd "$WT_ROOT" && [ $(grep -h '"version": "2.43.3"' package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json | wc -l) -ge 3 ] && [ $(grep -h '"version": "2.43.2"' package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json | wc -l) -eq 0 ] && node -e 'JSON.parse(require("fs").readFileSync("package.json")); JSON.parse(require("fs").readFileSync(".claude-plugin/plugin.json")); JSON.parse(require("fs").readFileSync(".claude-plugin/marketplace.json"))'</automated>
  </verify>
  <done>
    All three metadata files (package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json) show "version": "2.43.3", no remaining references to 2.43.2 across the three files, all JSON valid, single atomic commit.
  </done>
</task>

<task type="auto">
  <name>Task 3: README.md upstream-reference refresh (v1.42.2 -> v1.42.3, plugin 2.43.2 -> 2.43.3)</name>
  <files>
    README.md
  </files>
  <action>
    Inspect README.md first 10 lines BEFORE editing — the current header (HEAD) is:
      Line 3: "**Based on:** [GSD 1.42.2](https://github.com/gsd-build/get-shit-done/releases/tag/v1.42.2) base tree by **TACHES** (Lex Christopherson)"
      Line 5: "**Plugin version:** `2.43.2`"

    Update README.md header text:
      - Line 3: change "GSD 1.42.2" -> "GSD 1.42.3" AND `tag/v1.42.2` -> `tag/v1.42.3` in the URL.
      - Line 5: change `2.43.2` -> `2.43.3`.
      - Search the rest of README.md for other forward-facing references to "v1.42.2", "1.42.2", "2.43.2" and update to v1.42.3 / 2.43.3 where the reference is to the upstream GSD base version or the current plugin version (install snippets, version-notes blocks).
      - Do NOT touch historical CHANGELOG-style mentions of older versions inside README (e.g. inside a "## Version history" table). Only forward-facing "current version" references.

    Pre-commit gates (HEADER-SCOPED, positive + negative):
      - `head -10 README.md | grep -q 'Based on:.*GSD 1.42.3'`  (positive: new header reference present in first 10 lines)
      - `head -10 README.md | grep -vq 'GSD 1.42.2'`  (negative: stale v1.42.2 reference removed from first 10 lines)
      - `head -10 README.md | grep -q '2.43.3'`  (positive: plugin version updated in header)
      - `head -10 README.md | grep -vq '2.43.2'`  (negative: stale plugin version removed from header)
      - Em-dash diff-scoped gate: `git -C "$WT_ROOT" diff --cached README.md | awk '/^\+/ && !/^\+\+\+/' | grep -c '—'` == 0  (no em-dashes introduced in this diff; per memory rule)

    Commit (after worktree_branch_check):
      cd "$WT_ROOT"
      git add README.md
      git commit -m "docs(260517-fpp): refresh upstream reference to GSD v1.42.3 + plugin v2.43.3"
  </action>
  <verify>
    <automated>cd "$WT_ROOT" && head -10 README.md | grep -q 'Based on:.*GSD 1.42.3' && ! head -10 README.md | grep -q 'GSD 1.42.2' && head -10 README.md | grep -q '2.43.3' && ! head -10 README.md | grep -q '2.43.2'</automated>
  </verify>
  <done>
    README.md header (first 10 lines) references upstream GSD 1.42.3 and plugin v2.43.3; stale v1.42.2 and 2.43.2 references removed from the header; no em-dashes introduced in the diff; single atomic commit.
  </done>
</task>

<task type="auto">
  <name>Task 4: CHANGELOG.md — add [2.43.3] entry with concise upstream highlights</name>
  <files>CHANGELOG.md</files>
  <action>
    Prepend a new "## [2.43.3] - 2026-05-17  (based on upstream GSD 1.42.3)" section between the existing "## [Unreleased]" marker and "## [2.43.2]".

    Format MUST match the established CHANGELOG style (see [2.43.0] and [2.43.2] entries as templates). This is a PATCH-level hotfix sync; the entry should be SMALLER than [2.43.0]'s entry. Sections to include:

      - One-paragraph summary (2-3 sentences) explaining this is an upstream hotfix sync from v1.42.2 -> v1.42.3 (35 commits, primarily phase-removal logic hardening and plan-phase closed-phase guard). Note that all 4 in-tree plugin patches and the 2 SDK source patches survive automatically because upstream did not touch the patched files this cycle; only bin/lib/core.cjs required surgical re-apply.

      - ### Changed
        - "Version bump 2.43.2 -> 2.43.3"
        - "Refreshed wholesale from upstream: agents/{5 files}, bin/lib/{8 files}, sdk/src/{8 files including 1 new test}, workflows/{4 files}"
        - "Rebundled sdk/dist/cli.js via tsc + esbuild"

      - ### Fixed (selected upstream highlights — pick 3-5, DO NOT enumerate all 35)
        Recommended set:
          - **Phase removal logic hardening** (v1.42.3, #3599, #3600, #3601, #3602) prefixed-phase headings as section boundaries, peer-depth decimal phase preservation on integer phase removal, slugged plan-ref renumbering on phase removal, project-code-prefixed phase dir counting in milestone filter.
          - **`plan-phase` gated on closed phases** (v1.42.3, #3569) `init.plan-phase` surfaces `phase_status`; `/gsd:plan-phase` errors out on closed phases instead of silently re-planning.
          - **W007 warning ignores archived phases** (v1.42.3, #3560) repos using milestone-archive layout no longer get false-positive "Phase N in ROADMAP but no directory" warnings for archived phases.
          - **Codex install hardening** (v1.42.3, #3610) fresh Codex installs no longer block when leftover bundled hooks are present in the project tree.
          - **Installer migration env override** (v1.42.3) `GSD_INSTALLER_MIGRATION_DIR` honored when resolving the migrations directory.

      - ### Added (if relevant — 1-2 most plugin-relevant new features)
        - **Antigravity first-class runtime** (v1.42.3, #3608) `update.md` now models Antigravity (Google's IDE) as a first-class runtime alongside Claude Code, Cursor, Codex, etc.

      - ### Plugin patches preserved verbatim
        - **`bin/lib/core.cjs`** (`#PLUGIN-AGENTS-DIR`) upstream modified core.cjs this cycle; the 2x [PLUGIN PATCH] blocks (resolveGsdRoot/resolveGsdDataDir/resolveGsdAsset helper exports + the patched getAgentsDir body) re-applied surgically after wholesale copy.
        - **`bin/lib/model-catalog.cjs`** (`#PLUGIN-MODEL-CATALOG-PATH`) upstream did NOT modify this file v1.42.2..v1.42.3; flat-layout candidate-prepend patch survives automatically.
        - **`bin/gsd-tools.cjs`** upstream did NOT modify this file v1.42.2..v1.42.3; 4 dispatch cases (`write-phase-memory`, `checkpoint`, `hook`, `migrate`) survive automatically.
        - **`hooks/gsd-context-monitor.js`** (`#PLUGIN-HOOK-CONTEXT-MONITOR`) upstream `hooks/` entirely unchanged v1.42.2..v1.42.3; patch survives automatically.
        - **`sdk/src/query/state-project-load.ts` + `sdk/src/query-gsd-tools-path.ts` + `sdk/src/sdk-package-compatibility.ts::legacyAssetProbes`** (SDK source patches) none of the 3 patched files appear in upstream's v1.42.2..v1.42.3 sdk/src/ diff; patches survive automatically. Bundle rebuilt because 8 OTHER sdk/src/ modules changed; bundle still carries >=2 CLAUDE_PLUGIN_ROOT matches.

      - ### Plugin-owned (untouched by sync)
        - `bin/gsd-sdk` + `bin/gsd-sdk.cmd` (`#PLUGIN-WRAPPER-ENV-EXPORT`) byte-identical (sha256-verified pre/post sync).
        - `hooks/gsd-shadowing-sdk-detector.js` (added in v2.43.1) byte-identical (sha256-verified pre/post sync).
        - `commands/` remains absent (per plugin policy).

      - ### Tests
        - Regression trifecta passes against the synced tree: `tests/mcp-stdio-framing.test.cjs`, `tests/workspace-json-integration.test.cjs`, `tests/hooks-smoke.test.cjs` (16/16 including v2.43.1 shadowing-sdk-detector cases).

      - Link line: "See full upstream release notes: <https://github.com/gsd-build/get-shit-done/releases/tag/v1.42.3>"

    Style rules:
      - No em-dashes (`—` U+2014) introduced. Use commas, colons, or parentheses instead. (Per memory entry "No em-dashes in docs".)
      - Use upstream PR / issue numbers in (#NNNN) form for traceability.
      - Be CONCISE: this is a patch release entry, target ~30-40 lines (much shorter than [2.43.0]'s ~50 lines).

    Pre-commit grep gates:
      - `grep -c '^## \[2.43.3\] - 2026-05-17' CHANGELOG.md` == 1
      - `grep -c 'based on upstream GSD 1.42.3' CHANGELOG.md` >= 1
      - Em-dash diff-scoped gate: `git -C "$WT_ROOT" diff --cached CHANGELOG.md | awk '/^\+/ && !/^\+\+\+/' | grep -c '—'` == 0  (no em-dashes introduced in this diff; existing older entries may have em-dashes from earlier ungated commits and are unaffected by this scoped gate)
      - Section-order check: new `## [2.43.3]` appears BEFORE `## [2.43.2]` in the file:
          awk '/^## \[2.43.3\]/{found=1} /^## \[2.43.2\]/{if(found){print "OK"; exit 0} else {print "ORDER_WRONG"; exit 1}}' CHANGELOG.md | grep -q OK

    Commit (after worktree_branch_check):
      cd "$WT_ROOT"
      git add CHANGELOG.md
      git commit -m "docs(260517-fpp): CHANGELOG entry for v2.43.3 (upstream GSD 1.42.3)"
  </action>
  <verify>
    <automated>cd "$WT_ROOT" && grep -q '^## \[2.43.3\] - 2026-05-17' CHANGELOG.md && grep -q 'based on upstream GSD 1.42.3' CHANGELOG.md && awk '/^## \[2.43.3\]/{found=1} /^## \[2.43.2\]/{if(found){print "OK"; exit 0} else {print "ORDER_WRONG"; exit 1}}' CHANGELOG.md | grep -q OK</automated>
  </verify>
  <done>
    CHANGELOG.md has a new [2.43.3] - 2026-05-17 section, properly ordered above [2.43.2], formatted to match prior entries (concise hotfix-sized entry: ~30-40 lines, no em-dashes introduced in the diff, 3-5 fixes + 1 feature + plugin-patches-preserved-verbatim summary + tests confirmation + upstream-release link), single atomic commit.
  </done>
</task>

<task type="auto">
  <name>Task 5: Conditional namespace rewrite — /gsd-X -> /gsd:X in newly-pulled workflows (MANDATORY detection artifact regardless of outcome)</name>
  <files>workflows/{execute-phase,plan-phase,ultraplan-phase,update}.md (only the 4 files refreshed in Task 1) — plus any other workflows/*.md that contain newly-introduced /gsd-X references after the sync</files>
  <action>
    This task is CONDITIONAL — perform the detection step first, then act only if hits found. The /tmp/namespace-hits.txt artifact is MANDATORY regardless of outcome (positive proof the detection step ran; per prior sync's Warning 4 fix).

    Detection step (ALWAYS RUN, regardless of skip-or-act outcome):
      cd "$WT_ROOT"
      grep -rEn '/gsd-[a-z]' workflows/ 2>/dev/null | grep -vE '(`/gsd-|gsd-2|gsd-tools|gsd-sdk|gsd-resume-at|gsd-validate|gsd-context-monitor|gsd-phase-boundary|gsd-prompt-guard|gsd-workflow-guard|gsd-read-guard|gsd-read-injection-scanner|gsd-session-state|gsd-statusline|gsd-update-banner|gsd-check-update|gsd-shadowing-sdk-detector|gsd-review-stderr|/tmp/gsd-)' > /tmp/namespace-hits.txt
      wc -l /tmp/namespace-hits.txt

    Surface in SUMMARY.md (the executor's per-task summary should record):
      - The line count of /tmp/namespace-hits.txt
      - A short listing (or "empty file") so the orchestrator can see at a glance that the detection step ran and what it found.

    Interpretation:
      - Each pre-existing exclusion is a legitimate non-skill reference: `bin/gsd-*` binaries, related-project (gsd-2) cross-refs, the gsd-* hook script filenames, gsd-resume-at, gsd-shadowing-sdk-detector (v2.43.1 plugin-owned hook), gsd-review-stderr.log temp paths, /tmp/gsd-* paths, etc.
      - Surviving hits in /tmp/namespace-hits.txt are LIVE /gsd-<skill-name> references that upstream's commands/ historically used but the plugin's workflows/ should normalize to `/gsd:<skill-name>` (per project decision from 260420-cns).
      - Expected outcome this cycle: VERY LIKELY ZERO hits, because the prior sync (v2.43.0) did the comprehensive normalization across all 90 workflows files, and v1.42.3 is a small 4-file workflow refresh that already uses /gsd: syntax upstream (per the v1.42.3 commit `0d336e81 fix(3541): use /gsd:update colon syntax in comment (retired /gsd:update form)`).

    If /tmp/namespace-hits.txt is EMPTY (0 lines): SKIP this task. Record "Task 5 SKIPPED — /tmp/namespace-hits.txt has 0 lines, no /gsd-X references found in workflows/" as a deviation note in the SUMMARY produced later. Do NOT create an empty commit. The /tmp/namespace-hits.txt artifact (size 0) is the positive proof the skip was deliberate, not forgotten.

    If /tmp/namespace-hits.txt is NON-EMPTY: for each unique file in the hit list, apply the substitution `/gsd-<skill>` -> `/gsd:<skill>` (only at word boundaries — preserve `bin/gsd-sdk`, `bin/gsd-tools`, hook script names, agent .md filenames, /tmp/gsd-* paths, etc.). Use the same approach as 260420-cns + 260515-f2d: targeted regex `s|/gsd-([a-z][a-z0-9-]*)|/gsd:\1|g` with a per-file allow-list of exceptions for binary names and hook scripts. Note from prior sync deviation: be extremely careful about over-match (the 260515-f2d sync had a verifier-caught bug where `gsd-build` URL in update.md was wrongly rewritten — that exact URL pattern should be in the allow-list).

    Post-substitution gate (only if hits were found):
      cd "$WT_ROOT"
      grep -rEn '/gsd-[a-z]' workflows/ 2>/dev/null | grep -vE '(`/gsd-|gsd-2|gsd-tools|gsd-sdk|gsd-resume-at|gsd-validate|gsd-context-monitor|gsd-phase-boundary|gsd-prompt-guard|gsd-workflow-guard|gsd-read-guard|gsd-read-injection-scanner|gsd-session-state|gsd-statusline|gsd-update-banner|gsd-check-update|gsd-shadowing-sdk-detector|gsd-review-stderr|/tmp/gsd-|gsd-build)' > /tmp/namespace-post-sub.txt
      [ ! -s /tmp/namespace-post-sub.txt ]  # should be empty

    Em-dash diff-scoped gate (only when committing):
      `git -C "$WT_ROOT" diff --cached workflows/ | awk '/^\+/ && !/^\+\+\+/' | grep -c '—'` == 0  (no em-dashes introduced in the normalized workflows; on lines that the substitution touched, replace ` — ` with `, ` same as v2.43.0 deviation #4)

    Commit (only if substitution was performed; skip if Task 5 was a no-op):
      cd "$WT_ROOT"
      git add workflows
      git commit -m "fix(260517-fpp): normalize /gsd-X -> /gsd:X in newly-pulled workflows"
  </action>
  <verify>
    <automated>cd "$WT_ROOT" && test -f /tmp/namespace-hits.txt && (! grep -rEn '/gsd-[a-z]' workflows/ 2>/dev/null | grep -vE '(`/gsd-|gsd-2|gsd-tools|gsd-sdk|gsd-resume-at|gsd-validate|gsd-context-monitor|gsd-phase-boundary|gsd-prompt-guard|gsd-workflow-guard|gsd-read-guard|gsd-read-injection-scanner|gsd-session-state|gsd-statusline|gsd-update-banner|gsd-check-update|gsd-shadowing-sdk-detector|gsd-review-stderr|/tmp/gsd-|gsd-build)' | grep -q .)</automated>
  </verify>
  <done>
    /tmp/namespace-hits.txt exists (positive proof the detection step ran). EITHER (a) /tmp/namespace-hits.txt has 0 lines and the task was skipped (no commit, deviation note + line count recorded in SUMMARY) OR (b) /tmp/namespace-hits.txt was non-empty, substitutions applied to one or more workflows/*.md files, and a single atomic commit landed. In either case, the verify command reports zero non-allow-listed /gsd-X references in workflows/.
  </done>
</task>

</tasks>

<verification>

After Task 4 (and conditional Task 5) completes, the executor MUST run an end-to-end verification pass:

1. **Commit count check + namespace-hits artifact**: `git -C "$WT_ROOT" log --oneline master..HEAD | wc -l` reports either:
   (a) 4 commits AND `wc -l /tmp/namespace-hits.txt` reports 0 lines (Task 5 was a deliberate skip, no /gsd-X hits in workflows/), OR
   (b) 5 commits AND the 5th commit touches ONLY `workflows/*.md` (Task 5 ran a real substitution).
   Any other combination (e.g. 4 commits but /tmp/namespace-hits.txt missing, 5 commits but the extra one touches non-workflows files) is a deviation and must be surfaced.

2. **Patch markers survive**: grep all in-source patch markers across the worktree tree:
   - `grep -c '\[PLUGIN PATCH\]' bin/lib/core.cjs` >= 2
   - `grep -q '#PLUGIN-MODEL-CATALOG-PATH' bin/lib/model-catalog.cjs`
   - `grep -q '#PLUGIN-HOOK-CONTEXT-MONITOR' hooks/gsd-context-monitor.js`
   - `grep -q '\[PLUGIN PATCH\]' sdk/src/query/state-project-load.ts`
   - `grep -q '\[PLUGIN PATCH\]' sdk/src/query-gsd-tools-path.ts`
   - `grep -q '\[PLUGIN PATCH\]' sdk/src/sdk-package-compatibility.ts`
   All present.

3. **Plugin-owned wrappers + shadowing-sdk-detector untouched**: sha256 of bin/gsd-sdk, bin/gsd-sdk.cmd, hooks/gsd-shadowing-sdk-detector.js unchanged vs the /tmp/260517-fpp-presync.sha256 baseline captured at Task 1 start.

4. **No commands/ dir**: `test ! -d "$WT_ROOT/commands"` passes.

5. **SDK bundle rebuilt + carries patches**: `[ $(stat -f%z "$WT_ROOT/sdk/dist/cli.js" 2>/dev/null || stat -c%s "$WT_ROOT/sdk/dist/cli.js") -ge 1400000 ]` AND `grep -c CLAUDE_PLUGIN_ROOT "$WT_ROOT/sdk/dist/cli.js"` >= 2.

6. **Regression test trifecta**: `node tests/mcp-stdio-framing.test.cjs && node tests/workspace-json-integration.test.cjs && node tests/hooks-smoke.test.cjs` all pass (hooks-smoke must report all 16/16 cases).

7. **Version consistency**: `grep -c '"version": "2.43.3"'` across package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json sums to >= 3; no surviving 2.43.2 strings in those three files.

8. **CHANGELOG well-formed**: `[2.43.3]` section exists, ordered above `[2.43.2]`, dated 2026-05-17, references "upstream GSD 1.42.3".

9. **README header refreshed**: `head -10 README.md | grep -q 'Based on:.*GSD 1.42.3'` AND `head -10 README.md` does NOT contain `GSD 1.42.2`.

10. **Worktree clean**: `git -C "$WT_ROOT" status --porcelain` returns empty (nothing uncommitted).

</verification>

<success_criteria>

- All 4 mandatory atomic commits (Tasks 1-4) + 0 or 1 conditional commit (Task 5) landed on the worktree branch with clear conventional-commit messages.
- All 4 in-tree plugin patches AND 2 SDK source patches AND 1 consolidated probe in sdk-package-compatibility.ts present and grep-able post-sync.
- 4 dispatch cases (migrate, write-phase-memory, checkpoint, hook) intact in bin/gsd-tools.cjs (auto-survived this cycle, verified).
- Plugin-owned wrappers (bin/gsd-sdk, bin/gsd-sdk.cmd) and the v2.43.1 shadowing-sdk-detector hook byte-identical to baseline.
- commands/ remains absent.
- sdk/dist/cli.js rebuilt, >= 1.4 MB, contains >= 2 CLAUDE_PLUGIN_ROOT matches from SDK source patches.
- 3 regression test suites pass (mcp-stdio-framing, workspace-json-integration, hooks-smoke 16/16).
- All three metadata files at v2.43.3.
- README.md header (first 10 lines) references upstream GSD 1.42.3, plugin v2.43.3; stale v1.42.2 / 2.43.2 references removed from header.
- CHANGELOG.md has well-formed [2.43.3] entry, properly ordered above [2.43.2].
- No em-dashes introduced in newly-added content (diff-scoped gates clean for README, CHANGELOG, workflows).
- /tmp/namespace-hits.txt exists as positive proof of the Task 5 detection step.
- Worktree clean, ready for orchestrator merge + tag + release.

</success_criteria>

<output>
After completion, the orchestrator will:
  - Merge the worktree branch into master (--no-ff)
  - Update STATE.md with the merge commit SHA and quick-task row (final docs commit)
  - Produce `.planning/quick/260517-fpp-sync-upstream-v1-42-3/260517-fpp-SUMMARY.md` mirroring the 260515-f2d-SUMMARY.md structure

The executor's responsibility ends at Task 5 (or Task 4 if Task 5 is a no-op skip). The orchestrator handles merge + docs-fixup + release-tag.
</output>
