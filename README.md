# GSD Plugin -- Get Shit Done for Claude Code

**Based on:** [GSD 1.40.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.40.0) base tree by **TACHES** (Lex Christopherson)

**Plugin version:** `2.40.0`

A performance-optimized plugin packaging of [GSD](https://github.com/gsd-build/get-shit-done) for Claude Code. Reduces per-turn token overhead by ~92%, adds MCP-backed project state, auto-resumes across `/compact`, and bundles everything into a single-install plugin.

## What GSD Plugin provides

- **82 slash commands** (`/gsd:*`) for project planning, execution, debugging, and verification
- **33 agent definitions** for specialized workflow roles (planner, executor, researcher, verifier, etc.)
- **85 workflow bodies** in `workflows/` — operational logic that skills delegate to via `@${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md`
- **MCP server** exposing project state as queryable resources and mutation tools
- **Hooks** for session-start context loading, workflow enforcement, checkpoint on compact, and tool-use monitoring
- **Auto-resume across `/compact`** -- PreCompact hook writes `.planning/HANDOFF.json`; on the next session, SessionStart auto-invokes `/gsd:resume-work` so Claude continues at the same phase/plan/task with zero manual intervention
- **Execution context profiles** (dev, research, review) for role-specific behavior
- **Templates and references** for planning artifacts, summaries, verification checklists, and thinking-model guidance
- **Memory integration** -- phase outcomes persist across sessions via Claude Code's memdir

## Session continuity + drift resilience

**Session continuity.** When Claude Code runs `/compact` (manual or automatic), this plugin's PreCompact hook captures the current session state to `.planning/HANDOFF.json` — phase, plan position, uncommitted files, recent decisions, and a resumption hint. On the next session start, the SessionStart hook detects the handoff and auto-invokes `/gsd:resume-work` with zero user intervention. CLAUDE.md carries the same instruction as a fallback for CLIs where hooks don't fire. The handoff file is deleted after a successful resume so stale state doesn't trigger phantom resume attempts.

A PostToolUse hook also writes a fresh checkpoint after most tool calls — `Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch` — throttled to at most once per 60 seconds via mtime. This bridges Claude Code's *microcompact* path, which silently strips stale tool outputs without firing PreCompact, AND covers read-heavy research phases that don't write files: the periodic checkpoint keeps `HANDOFF.json` at most ~60s stale at any point during an active session, so resume after an unexpected session end (usage cap, kill, network drop) reflects recent state.

**Drift resilience.** The plugin sits downstream of [upstream GSD](https://github.com/gsd-build/get-shit-done), which ships frequent feature releases. To catch structural drift before it reaches users, three detectors run in CI on every push: a **file-layout drift detector** flags dangling `@~/.claude/get-shit-done/*` references (e.g. skill files delegating to workflow bodies that don't exist in the plugin); a **HANDOFF schema validator** confirms `checkpoint.cjs` output matches the committed JSON Schema; and a **namespace drift check** fires if any `/gsd-<skill>` dash-style command refs have been reintroduced. Each detector has a committed ratchet baseline; regressions hard-fail. After each upstream sync, an additional **upstream schema drift detector** (`check-upstream-schema.cjs`) compares upstream's `/gsd:pause-work` output against our schema to catch format divergence early.

## Added features beyond upstream

This plugin starts from upstream GSD's source tree but adds Claude-Code-native capabilities that aren't possible in upstream's CLI-only design. If you're scanning for "what does this give me that upstream doesn't" — these are the headliners:

| Feature | What it does | Command / hook |
|---------|--------------|----------------|
| **Scheduled resume** | Schedule a future Claude Code session to auto-run `/gsd:resume-work` (or any GSD command) at a specific time. Useful when hitting a usage cap, pausing for the day, or queuing a phase to run during off-peak quota windows. Accepts `HH:MM`, ISO 8601, or `+<duration>` (e.g. `+2h`). | `/gsd:resume-at <time>` |
| **Auto-resume across `/compact`** | When Claude Code compacts a conversation, a 19-field `HANDOFF.json` is written automatically. The next session detects it via SessionStart and invokes `/gsd:resume-work` with **zero manual input**. | PreCompact + SessionStart hooks |
| **Mid-session checkpoints** | A PostToolUse hook writes a fresh checkpoint after most tool calls (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`), throttled to ≤1/min. Closes the gap when Claude Code's silent *microcompact* path strips tool outputs without firing PreCompact, AND covers read-heavy research phases that don't write files. | PostToolUse hook |
| **Plugin-version-churn fallback** | If another session upgrades the plugin mid-run and prunes the baked `${CLAUDE_PLUGIN_ROOT}` path, hooks resolve through a Node inline resolver that falls back to the newest cached plugin version. Long sessions survive plugin updates. | Hook command resolver |
| **CI-enforced drift detection** | Three detectors run on every push: file-layout drift, HANDOFF schema integrity, and namespace normalization. Each has a ratchet baseline; regressions hard-fail. An upstream-schema detector runs post-sync to catch upstream format divergence early. | `bin/maintenance/check-drift.cjs` |
| **92% per-turn token reduction** | Skill bodies are isolated in `context: fork` sub-agents; orchestration runs in clean child contexts instead of polluting the parent CLAUDE.md. State access uses MCP resources/tools instead of BashTool roundtrips to a CLI. | Plugin architecture |
| **Plugin-local workflow bodies** | All 85 workflow bodies ship inside the plugin (`workflows/<name>.md`) and resolve via `${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md`. Upstream's setup relies on a global `~/.claude/get-shit-done/` install dir that fails silently when missing. | `workflows/` dir |
| **Standardized continuation prompts** | 6 terminal skills (`execute-phase`, `complete-milestone`, `verify-work`, `quick`, `plan-phase`, `ship`) emit "Next Up" blocks per `references/continuation-format.md` — `/clear`-then-[next] suggestions with a "/clear is safe (resume restores from HANDOFF)" footer. | All terminal skills |
| **Memory across sessions** | Phase outcomes persist via Claude Code's memdir and are auto-recalled at session start. Upstream has no persistence — each session starts cold. | Built-in |

For implementation details, see the deep-dive tables in [For users of upstream GSD](#for-users-of-upstream-gsd) below.

## Installation

GSD Plugin installs *inside* a Claude Code session, not from your host shell. If you have never used Claude Code plugins before, follow these steps in order.

### Step 1 — Launch Claude Code

From your host shell (Terminal, iTerm, etc.), in any directory:

```bash
claude --dangerously-skip-permissions
```

The `--dangerously-skip-permissions` flag is recommended for the install flow: it lets the plugin marketplace add, plugin install, and MCP server bootstrap run without a wall of permission prompts. You can launch with plain `claude` later if you prefer to approve each tool use.

### Step 2 — Add the marketplace and install the plugin

You should now be inside a Claude Code session (you'll see the Claude Code prompt, not your shell prompt). Type these two commands at the Claude Code prompt:

```
/plugin marketplace add jnuyens/gsd-plugin
/plugin install gsd@gsd-plugin
```

That's it. This installs everything: slash commands, agent definitions, hooks, and an MCP server for project state. No manual configuration required. Enable auto-update for the marketplace in Claude Code settings to receive updates automatically.

## Quick start

Assumes you have already completed the Installation section above (Claude Code is running with the plugin installed). All commands below are typed at the Claude Code prompt, not in your shell.

1. Start a new project: `/gsd:new-project`
2. Plan your first phase: `/gsd:plan-phase`
3. Execute: `/gsd:execute-phase`
4. Verify: `/gsd:verify-work`

## Updating

Enable auto-update for the marketplace in Claude Code settings and updates will be applied automatically at startup. For manual updates, type these at the Claude Code prompt:

```
# Step 1: Pull the latest marketplace catalog from GitHub
/plugin marketplace update gsd-plugin

# Step 2: Reinstall the plugin to pick up the new version
/plugin install gsd@gsd-plugin
```

Note: Step 1 refreshes the marketplace index but does not upgrade the installed plugin. Step 2 is needed to install the new version.

## Maintenance scripts

Lightweight Node scripts live in `bin/maintenance/` for plugin upkeep tasks that aren't part of the user-facing CLI.

- `node bin/maintenance/check-file-layout.cjs` — **File-layout drift detector.** Scans plugin content for `@~/.claude/get-shit-done/*` references, classifies each as repairable (plugin has a local counterpart) or genuinely missing, and compares counts to `tests/drift-baseline.json`. Exits non-zero if drift regresses beyond baseline. Runs in CI on every push and pull request. Pass `--dry` to preview or `--write-baseline` to regenerate the baseline after an intentional reduction.
- `node bin/maintenance/rewrite-command-namespace.cjs` — **Namespace normalization.** Rewrites `/gsd-<skill>` → `/gsd:<skill>` across plugin content. Run after every upstream GSD sync since upstream uses the dash form.
- `node bin/maintenance/check-handoff-schema.cjs` — **HANDOFF schema validator.** Generates a fresh `HANDOFF.json` in a tmp dir via `bin/lib/checkpoint.cjs` `writeCheckpoint()`, then validates it against `schema/handoff-v1.json` using ajv. Does not touch the real `.planning/HANDOFF.json` — isolates validation to a tmp dir that's cleaned up in a `finally` block. Runs in CI on every push and pull request (second job in `.github/workflows/check-drift.yml`). Exits 0 on schema-valid, 1 on violation, 2 on environment error (ajv missing, not at repo root, etc.).
- `node bin/maintenance/check-upstream-schema.cjs` — **Upstream drift detector.** Downloads the latest upstream GSD release tarball (or uses the cached `/tmp/gsd-sync-<version>/` directory from a prior sync), extracts the `/gsd:pause-work` declared field list from `get-shit-done/workflows/pause-work.md`, and compares it to `schema/handoff-v1.json`. Does **not** run in CI — invoke after each upstream sync (manually, or via the sync quick-task template; see `.planning/PROJECT.md` "After each upstream GSD sync" checklist). Set `UPSTREAM_VERSION=v1.38.x` to target a specific version; otherwise falls back to `gh release view` for the latest tag.
- `node bin/maintenance/check-drift.cjs` — **Unified drift check (umbrella).** Runs the file-layout, HANDOFF schema, and namespace detectors in sequence and reports a consolidated PASS/FAIL. Intended for local dev loops and post-upstream-sync verification. Not added to CI — CI runs each per-category detector as its own job for fast-feedback granularity. The upstream schema detector is deliberately excluded (network-dependent + post-sync-only).

---

## For users of upstream GSD

If you already have GSD installed via `npx get-shit-done-cc` or the legacy `~/.claude/get-shit-done/` setup, this section covers the move to the plugin. Skip this entirely if you're a new user.

### What changed from upstream GSD

This plugin starts from upstream GSD's source tree and adds Claude-Code-native features that aren't possible in upstream's CLI-only design. Areas where the plugin diverges meaningfully:

#### Install + runtime architecture

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Install | `npx get-shit-done-cc` | `/plugin marketplace add jnuyens/gsd-plugin && /plugin install gsd@gsd-plugin` (run inside Claude Code) |
| Context overhead | ~3,000-5,000 tokens/turn via CLAUDE.md | ~200 tokens (92% reduction) |
| Skill isolation | Inline execution; orchestration prompts pollute parent context | `context: fork` sub-agent isolation; orchestration runs in clean child contexts |
| State access | BashTool roundtrips to `gsd-tools` CLI | MCP resources + tools; structured queries replace prompt injection |
| Agent definitions | Inline prompt role descriptions in skill bodies | `.claude/agents/*.md` with typed frontmatter (model overrides, tool restrictions, effort budgets) |
| Memory across sessions | None — each session starts cold | Phase outcomes persist via Claude Code's memdir; auto-recalled at session start |
| Command IDs | `/gsd-<skill>` (dash; works because no namespace in upstream's flat install) | `/gsd:<skill>` (colon; matches Claude Code's plugin namespace, autocompletes correctly) |

#### Session continuity (none of this exists upstream)

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Behavior at `/compact` | Conversation collapses; phase position lost; user manually re-orients next session | **PreCompact hook** writes a 19-field `HANDOFF.json` capturing phase, plan, task, decisions, uncommitted files. **SessionStart hook** detects it on next session and auto-invokes `/gsd:resume-work` with zero user input. |
| Periodic checkpoint mid-session | None — state only captured if user manually `/gsd:pause-work`'s | **PostToolUse hook** writes a fresh checkpoint after most tool calls (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`), throttled to ≤1/min via mtime. Bridges Claude Code's silent *microcompact* path AND read-heavy research phases. After an unexpected session end (usage cap, kill, network drop), HANDOFF reflects state from at most ~60s before the cut. |
| Hook-less environments | N/A | **CLAUDE.md fallback section** carries the same resume instruction so CLIs without hook support (or sessions where the hook fails to fire) still trigger resume on the next session. |
| Handoff lifecycle | N/A | `/gsd:resume-work` deletes `HANDOFF.json` after a successful resume, preventing stale handoffs from triggering phantom resumes. |

#### Drift resilience (CI-enforced; none upstream)

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| File-layout drift | None — broken `@`-includes ship silently | **`check-file-layout.cjs`** scans plugin content for dangling `@~/.claude/...` references, classifies each as repairable vs genuinely missing, ratchets against a committed baseline. Hard-fails in CI on regression. |
| HANDOFF schema integrity | None — schema lives only as prose in upstream's `pause-work.md` | **`schema/handoff-v1.json`** (JSON Schema draft-07, 19 fields). **`check-handoff-schema.cjs`** validates `writeCheckpoint()` output against the schema in CI. **`check-upstream-schema.cjs`** runs post-sync to catch upstream format drift early. |
| Namespace normalization | N/A — upstream commands ship in dash form | **`rewrite-command-namespace.cjs`** rewrites `/gsd-<skill>` → `/gsd:<skill>` across all plugin content. Run after every upstream sync; drift is detected by the umbrella check. |
| Unified drift check | None | **`check-drift.cjs`** umbrella runs all three detectors in one invocation. Used in local dev + post-upstream-sync verification. |

#### Plugin-environment robustness

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Plugin-version churn mid-session | N/A | Hook commands resolve through a Node inline resolver that falls back to the newest cached plugin version when the baked `${CLAUDE_PLUGIN_ROOT}` path is pruned (e.g. after another session upgraded the plugin). Long sessions survive plugin updates. |
| Workflow body location | `~/.claude/get-shit-done/workflows/<name>.md` (legacy install dir; absent for plugin users → silent "fall back to legacy file" failures) | **Plugin-local `workflows/` dir** with all 78 bodies; skills `@`-include via `${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md` which Claude Code's plugin loader resolves to the version-stamped install path |
| End-of-flow continuation prompts | Inconsistent — some skills emit `/clear`-then-X blocks, many don't | Standardized: 6 terminal skills (`execute-phase`, `complete-milestone`, `verify-work`, `quick`, `plan-phase`, `ship`) emit Next Up blocks per `references/continuation-format.md` with `/clear`-then-[next] + a "/clear is safe" parenthetical (resume restores from HANDOFF) |

### Automatic migration on install

On your first session after installing the plugin, GSD auto-migrates. These moves prevent duplicate slash commands, dead MCP entries, and stale hook scripts:

- **Moves** `~/.claude/get-shit-done/` to `~/.claude/get-shit-done-legacy/` (safe backup, not deleted)
- **Moves** `~/.claude/commands/gsd/` to `~/.claude/commands/gsd-legacy/` (prevents duplicate slash commands)
- **Removes** legacy GSD skill directories (`gsd-*`) from `~/.claude/skills/`
- **Removes** legacy GSD agent files (`gsd-*.md`) from `~/.claude/agents/`
- **Removes** legacy GSD MCP server entries from your project's `.mcp.json`
- **Removes** legacy GSD hook entries from `~/.claude/settings.json`
- **Removes** legacy hook scripts (`gsd-check-update.js`, `gsd-context-monitor.js`, `gsd-prompt-guard.js`, `gsd-statusline.js`) from `~/.claude/hooks/`

You'll see a summary of what was migrated in the session output.

### Manual migration steps

A few things the auto-migration can't do for you:

#### 1. Install the plugin

Type these at the Claude Code prompt:

```
/plugin marketplace add jnuyens/gsd-plugin
/plugin install gsd@gsd-plugin
```

#### 2. Uninstall `get-shit-done-cc` npm package (if installed)

```bash
npm uninstall -g get-shit-done-cc
```

#### 3. Stop using `/gsd:update`

The `/gsd:update` command is deprecated. Use `/plugin marketplace update gsd-plugin` to update (see the Updating section above).

#### 4. Clean up the backup (optional, after verifying the plugin works)

```bash
rm -rf ~/.claude/get-shit-done-legacy/
```

### Testing the plugin without affecting your current install

If you want to try the plugin without touching your existing `~/.claude/get-shit-done/` setup, run it in an isolated environment:

```bash
# 1. Clone this repo somewhere
git clone https://github.com/jnuyens/gsd-plugin.git ~/src/gsd-plugin

# 2. Move the legacy install out of the way (prevents duplicate commands)
mv ~/.claude/get-shit-done ~/.claude/get-shit-done-legacy

# 3. Create a throwaway test project
mkdir ~/test-gsd-plugin && cd ~/test-gsd-plugin
git init

# 4. Launch Claude Code with the plugin root override
CLAUDE_PLUGIN_ROOT=~/src/gsd-plugin claude --dangerously-skip-permissions

# 5. Inside the session, only plugin GSD commands are active
```

To restore your legacy install after testing:

```bash
mv ~/.claude/get-shit-done-legacy ~/.claude/get-shit-done
```

The `CLAUDE_PLUGIN_ROOT` env var tells the plugin's `bin/lib/core.cjs` to resolve all paths from the specified directory instead of the default plugin cache.

### Rolling back

To revert to upstream GSD after testing or after a full migration:

```bash
# Remove the plugin
claude plugin uninstall gsd

# Your legacy ~/.claude/get-shit-done/ backup is still in place and working
# (or restore from ~/.claude/get-shit-done-legacy/ if you've already cut over)
```

### Migration audit

To check for any remaining legacy artifacts after migration:

```bash
node bin/gsd-tools.cjs migrate
```

This prints all legacy GSD artifacts found on your system. To remove them (with confirmation):

```bash
node bin/gsd-tools.cjs migrate --clean
```

### Verifying migration

After migration, verify the plugin is active:

1. Start a new Claude Code session
2. Run `/gsd:help` -- should list all commands
3. Run `/gsd:progress` -- shows project state (or prompts to create one)
4. Check MCP resources are available (the GSD MCP server should auto-start via plugin manifest)

## Versioning

The plugin version mirrors upstream GSD with the major bumped by one to signal that this is a derivative with extra features layered on top:

```
plugin_major = upstream_major + 1
plugin_minor = upstream_minor
plugin_patch = upstream_patch
```

So upstream GSD `1.38.3` ships here as plugin `2.38.3`. When upstream advances to `2.x`, this plugin will move to `3.x`. Patch-level changes that are plugin-only (not tied to an upstream sync) bump the patch number further (e.g. `2.38.4`).

This project repackages the GSD workflow system as a native Claude Code plugin with additional optimizations: skill isolation via `context: fork`, structured MCP tools replacing prompt injection, and cross-session memory via memdir.

## Credits

- **[GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done)** by TACHES (Lex Christopherson) -- the original workflow framework this plugin is based on
- Plugin packaging, MCP integration, token optimization, and memory system by Jasper Nuyens

## License

MIT
