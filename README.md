<p align="center">
  <img src="assets/gsd-plugin-logo.png" alt="GSD Plugin" width="320" />
</p>

# Get Shit Done for Claude Code

**Based on:** [GSD 1.42.3](https://github.com/open-gsd/get-shit-done-redux/releases/tag/v1.42.3) base tree by **TACHES** (Lex Christopherson), now maintained by the community at [open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux)

**Plugin version:** `2.45.0`

**GSD Plugin for Claude Code** ensures your coding work gets done in a systematic, structured way. It prompts you only for the important design and architectural decisions that actually need your judgment, and it splits each step into its own focused subcontext so token use stays optimised across long projects.

Under the hood, a performance-optimized plugin packaging of [GSD](https://github.com/open-gsd/get-shit-done-redux) for Claude Code: reduces per-turn token overhead by ~92%, adds MCP-backed project state, auto-resumes across `/compact`, and bundles everything into a single-install plugin.

> ### Upstream change (May 2026)
>
> In May 2026 the original GSD maintainer TÂCHES (Lex Christopherson) became unreachable, deleted his social accounts, and the associated `$GSD` Solana token was publicly linked to a rug-pull (see external coverage: [intellectia.ai](https://intellectia.ai/news/crypto/gsd-token-allegedly-rugpulled-after-founder-exit), [ourcryptotalk](https://ourcryptotalk.com/news/bags-hackathon-winner-gsd-cloud-rug-pull)).
>
> On 2026-05-22, GSD collaborator [trek-e](https://github.com/trek-e) launched a community continuation at [open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux): same MIT-licensed code, all 394 branches and 229 tags mirrored bit-for-bit, no token references. The [migration announcement](https://github.com/open-gsd/get-shit-done-redux/discussions/109) details what changed for downstream consumers. The original `gsd-build/get-shit-done` is now locked and auto-closes new issues and PRs.
>
> This plugin treats `open-gsd/get-shit-done-redux` as upstream from `v2.43.6` onward. No code changed at the cutover (the redux is bit-perfect with the pre-rug tree); only URLs and npm package names moved. See [Versioning](#versioning) and [Credits](#credits) for the historical relationship.

## Installation

GSD Plugin installs *inside* a Claude Code session, not from your host shell. If you have never used Claude Code plugins before, follow these steps in order.

### No prerequisites

As of **v2.42.0** the plugin bundles its own copy of the GSD SDK at `sdk/dist/cli.js` and ships a `bin/gsd-sdk` wrapper that Claude Code automatically puts on `PATH` for plugin Bash calls. You no longer need to `npm install -g get-shit-done-cc` (or its successor `get-shit-done-redux`). Closes [#4](https://github.com/jnuyens/gsd-plugin/issues/4).

### Pre-install: remove any pre-v2.42.0 global SDK install

If you previously installed `get-shit-done-cc` / `get-shit-done-redux` or `@gsd-build/sdk` / `@gsd-redux/sdk` via `npm -g` (or `npx`), the global binary at `/opt/homebrew/bin/gsd-sdk` (Apple Silicon) or `/usr/local/bin/gsd-sdk` (Intel macOS / Linux) takes precedence in `$PATH` over the plugin's bundled wrapper. The global SDK does NOT honor `CLAUDE_PLUGIN_ROOT`, so every plugin workflow that calls bare `gsd-sdk` (init queries, agent-skill lookups, config reads) reports `agents_installed: false`, and skills like `/gsd:new-project` silently degrade by skipping the parallel research path. The plugin's v2.42.5 wrapper-env-export patch only fires when the wrapper itself is invoked, so a shadowing global bypasses it.

Check whether you have a shadowing install:

```bash
which gsd-sdk
```

If the output is anything OTHER than a path under `~/.claude/plugins/cache/gsd-plugin/` (typical bad outputs are `/opt/homebrew/bin/gsd-sdk` or `/usr/local/bin/gsd-sdk`), uninstall it from your host shell before going further:

```bash
npm uninstall -g @gsd-build/sdk
npm uninstall -g get-shit-done-cc
npm uninstall -g @gsd-redux/sdk
npm uninstall -g @opengsd/get-shit-done-redux
npm uninstall -g get-shit-done-redux   # if you tried the unscoped name (404s on npm; v2.43.x docs incorrectly referenced this form, fixed in v2.44.6)
```

Re-run `which gsd-sdk`. The expected post-uninstall output is either a path under `~/.claude/plugins/cache/gsd-plugin/` (after the plugin is installed in Step 3) or `gsd-sdk not found` (before installation). Both are correct.

If you skip this step and install the plugin anyway, v2.43.1+ ships a `gsd-shadowing-sdk-detector` SessionStart hook that will detect the conflict at the start of every Claude Code session and emit a one-time advisory pointing back to this section.

### Step 1: Trust GitHub's SSH host key (first time only on a new machine)

`/plugin marketplace add` clones over SSH. On a fresh machine GitHub's host key is unknown, which makes the non-interactive `git clone` Claude Code runs fail silently. Prime `known_hosts` once from your host shell:

```bash
ssh -T git@github.com
```

Type `yes` at the *"Are you sure you want to continue connecting?"* prompt. The follow-up *"Permission denied (publickey)"* message is expected for a public-repo clone via SSH and harmless; you only needed the host key fingerprint to land in `~/.ssh/known_hosts`. Skip this step if you have used `git@github.com` from this machine before.

### Step 2: Launch Claude Code

From your host shell (Terminal, iTerm, etc.), in any directory:

```bash
claude --dangerously-skip-permissions
```

The `--dangerously-skip-permissions` flag is recommended for the install flow: it lets the plugin marketplace add, plugin install, and MCP server bootstrap run without a wall of permission prompts. You can launch with plain `claude` later if you prefer to approve each tool use.

### Step 3: Add the marketplace and install the plugin

You should now be inside a Claude Code session (you'll see the Claude Code prompt, not your shell prompt). Type these three commands at the Claude Code prompt:

```
/plugin marketplace add jnuyens/gsd-plugin
/plugin install gsd@gsd-plugin
/reload-plugins
```

That's it. This installs everything: slash commands, agent definitions, hooks, and an MCP server for project state. The `/reload-plugins` step activates the freshly installed plugin in your current session; without it the slash commands and hooks aren't loaded until you restart Claude Code. Enable auto-update for the marketplace in Claude Code settings to receive updates automatically.

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

# Step 3: Reload plugins so the new version is active (run in EACH open session)
/reload-plugins
```

Note: Step 1 refreshes the marketplace index but does not upgrade the installed plugin. Step 2 installs the new version on disk, and Step 3 makes Claude Code pick it up without restarting.

**Do I run `/reload-plugins` in all open sessions or just one?** In all of them. `/reload-plugins` is per-session: each Claude Code session loads its own copy of the plugin, so reloading in one session does not refresh the others. Run it once per session you have open. Sessions you start **after** the update load the new version automatically, with no reload needed (so only your already-open sessions need the command). No `/exit` or restart is required. gsd-plugin ships an MCP server, but its tools load on demand via tool search, so the reload applies cleanly; on Claude Code v2.1.163+ in the rare case a reload would force a full context re-read, `/reload-plugins` prints a warning and you re-run it as `/reload-plugins --force`.

## What GSD Plugin provides

- **82 slash commands** (`/gsd:*`) for project planning, execution, debugging, and verification
- **33 agent definitions** for specialized workflow roles (planner, executor, researcher, verifier, etc.)
- **85 workflow bodies** in `workflows/`: operational logic that skills delegate to via `@${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md`
- **MCP server** exposing project state as queryable resources and mutation tools
- **Hooks** for session-start context loading, workflow enforcement, checkpoint on compact, and tool-use monitoring
- **Auto-resume across `/compact`**: PreCompact hook writes `.planning/HANDOFF.json`; on the next session, SessionStart auto-invokes `/gsd:resume-work` so Claude continues at the same phase/plan/task with zero manual intervention
- **Execution context profiles** (dev, research, review) for role-specific behavior
- **Templates and references** for planning artifacts, summaries, verification checklists, and thinking-model guidance
- **Memory integration**: phase outcomes persist across sessions via Claude Code's memdir

## Session continuity + drift resilience

**Session continuity.** When Claude Code runs `/compact` (manual or automatic), this plugin's PreCompact hook captures the current session state to `.planning/HANDOFF.json`: phase, plan position, uncommitted files, recent decisions, and a resumption hint. On the next session start, the SessionStart hook detects the handoff and auto-invokes `/gsd:resume-work` with zero user intervention. CLAUDE.md carries the same instruction as a fallback for CLIs where hooks don't fire. The handoff file is deleted after a successful resume so stale state doesn't trigger phantom resume attempts.

A PostToolUse hook also writes a fresh checkpoint after most tool calls (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`), throttled to at most once per 60 seconds via mtime. This bridges Claude Code's *microcompact* path, which silently strips stale tool outputs without firing PreCompact, AND covers read-heavy research phases that don't write files: the periodic checkpoint keeps `HANDOFF.json` at most ~60s stale at any point during an active session, so resume after an unexpected session end (usage cap, kill, network drop) reflects recent state.

**Drift resilience.** The plugin sits downstream of [upstream GSD](https://github.com/open-gsd/get-shit-done-redux), which ships frequent feature releases. To catch structural drift before it reaches users, three detectors run in CI on every push: a **file-layout drift detector** flags dangling `@~/.claude/get-shit-done/*` references (e.g. skill files delegating to workflow bodies that don't exist in the plugin); a **HANDOFF schema validator** confirms `checkpoint.cjs` output matches the committed JSON Schema; and a **namespace drift check** fires if any `/gsd-<skill>` dash-style command refs have been reintroduced. Each detector has a committed ratchet baseline; regressions hard-fail. After each upstream sync, an additional **upstream schema drift detector** (`check-upstream-schema.cjs`) compares upstream's `/gsd:pause-work` output against our schema to catch format divergence early.

## Added features beyond upstream

This plugin starts from upstream GSD's source tree but adds Claude-Code-native capabilities that aren't possible in upstream's CLI-only design. If you're scanning for "what does this give me that upstream doesn't", these are the headliners:

| Feature | What it does | Command / hook |
|---------|--------------|----------------|
| **Reliable default-branch resolution (no more main-vs-master drift)** (v3.4.11; fixed ahead of upstream) | The branch-forking commands (`/gsd:execute-phase`, `/gsd:quick`, `/gsd:ship`, `/gsd:complete-milestone`, `/gsd:pr-branch`) used to detect the default branch with duplicated bash that only checked `refs/remotes/origin/HEAD` and then hardcoded a `:-main` fallback, so on any checkout where `origin/HEAD` is unset (a `git init` + `git remote add` repo, a fresh fetch, many worktrees, most CI checkouts) GSD would fork off a non-existent `main` and target PRs at the wrong branch on a `master` repo. Replaced with one resolver (`gsd-tools.cjs base-branch`): `git.base_branch` config -> `origin/HEAD` -> **`git remote show origin`** (the authoritative source the old code never consulted) -> local `master`/`main` existence -> `main`. Pure `git`, no `gsd-sdk` dependency. Reported upstream as [gsd-core#1146](https://github.com/open-gsd/gsd-core/issues/1146). | `gsd-tools.cjs base-branch` |
| **Token-overhead reduction across all instruction docs** (v3.4.10) | This is a **Claude Code only** plugin, so it carries no support for other LLM runtimes. Every instruction document that loads into context on invocation (173 files across `workflows/`, `skills/`, `agents/`, `references/`) was reviewed and trimmed of **~1,810 lines** of pure overhead: verbose prose, decorative ASCII banners, repeated blocks, oversized examples, over-commented bash, and genuinely non-Claude scaffolding. Behavior is unchanged: bash commands, gates, schemas, agent spawns, and the Claude-serving fallbacks (`TEXT_MODE` for `/rc` remote sessions, the all-runtimes orchestration rules) were preserved and re-verified. Done as a multi-agent compact then adversarial-verify pipeline, so every removed line was independently confirmed to be overhead, not instruction. | (all of `workflows/`, `skills/`, `agents/`, `references/`) |
| **`/gsd:version` command** (v3.4.9) | Prints the installed plugin version and checks GitHub for the latest release (via git tags, the repo's actual release signal), then shows the update steps only when you are behind or the check could not run. Read-only and best-effort: the online check never blocks or fails the command. The lightweight, report-only sibling of `/gsd:update` (which performs the upgrade). | `/gsd:version` |
| **Ultracode orchestration signal** (v3.4.8) | `workflow.ultracode` is a Claude Code orchestration signal: the GSD commands where multi-agent fan-out genuinely pays off run at maximum depth instead of their brevity-tuned default. `/gsd:map-codebase` spawns the full mapper set and reconciles overlap; `/gsd:code-review` runs every dimension then adversarially refutes each finding; `/gsd:review` adds a second reviewer panel and an extra convergence pass. **Auto-on through 2026-06-22** (the deeper runs are included during that window), **off afterward** since it becomes extra-paid; set `workflow.ultracode` to `true`/`false` to override the window either way. It is a signal, not a mechanism (a plugin cannot trigger Claude Code's multi-agent Workflow on your behalf), so each good-fit workflow carries an `<ultracode_gate>` that resolves the state (config override + date); commands that are sequential or cheap ignore it. | `workflow.ultracode`, `references/ultracode-mode.md` |
| **Claude Fable 5 tier with auto-fallback to Opus** (v3.4.4; withdrawn 2026-06-12) | Added `fable` (Claude Fable 5, `claude-fable-5`) as a model tier above `opus`, used as the quality-profile default for the 9 heaviest agents (planner, roadmapper, debugger, assumptions-analyzer, debug-session-manager, eval-planner, framework-selector, security-auditor, user-profiler). **Claude Fable 5 was withdrawn on 2026-06-12** (earlier than the originally planned 2026-06-22), so the `fable` tier now **automatically falls back to `opus`** and quality-profile heavy agents resolve to Opus. Availability is a **tunable knob** so it auto-selects without a code change: `fable.mode` = `auto` (default; date-gated) / `on` (force available) / `off` (force opus), plus `fable.until` to set the auto cutoff date. When Fable returns you flip it with one command (`config-set fable.mode on`, or `config-set fable.until 2026-09-30`). Honored on both resolution paths (`bin/lib/core.cjs` and `sdk/src/query/config-query.ts`); `GSD_FABLE_SUNSET_NOW` (ISO date) pins "now" for tests. | `bin/lib/core.cjs`, `sdk/src/query/config-query.ts` |
| **Auto-capture durable decisions in ad-hoc work** (v3.4.1) | `/gsd:quick`, `/gsd:debug`, and `/gsd:fast` now save durable decisions (hard preferences, non-obvious rationale, resolved-bug root causes) to Claude Code's auto-memory at task close-out, so context survives between milestones without you typing "remember". Conservative by default: most tasks capture nothing, and the writer is idempotent + flat-indexed in `MEMORY.md`. Also fixes the long-orphaned phase-completion memory writer (it called a non-existent export and read the wrong arg slot, so it had never actually fired). Config: `workflow.auto_memory_capture` (default `true`). | `workflow.auto_memory_capture` |
| **Gaps default to backlog, not new phase** (v2.45.9) | When the verifier returns `gaps_found`, the orchestrator now asks the user how to route them: **Park to backlog** (recommended, gaps become 999.x backlog entries via `/gsd:add-backlog`, milestone ships when in-scope phases close), **Escalate to current milestone** (previous behavior, gaps spawn a follow-up phase via `/gsd:plan-phase --gaps`), or **Decide later**. Default flip prevents unbounded milestone growth from verifier-driven phase multiplication. Escalation path preserved for gaps that genuinely block the milestone goal. | `workflows/execute-phase.md`, `agents/gsd-verifier.md` |
| **Amend docs into work commit** (v2.45.7) | `/gsd:quick` now folds the docs (PLAN, SUMMARY, STATE updates) into the preceding work commit via `git commit --amend --no-edit` instead of emitting a separate `docs(quick-NN): ...` commit. Common case: one commit per task instead of two. Falls back to a separate commit when the amend would be unsafe (no new work commit, HEAD is a merge commit, `commit_docs: false`, or nothing staged). | `workflows/quick.md` |
| **Executor self-test bias** (v2.45.6) | Nudges `gsd-executor` toward running automated checks (file existence, grep, command exit code, test runs) instead of emitting `checkpoint:human-verify` prompts that interrupt the user. Single-knob change: the agent prompt's declared `human-verify` share drops from 90% to 40%, with the implicit remainder being silent self-tests. Tunable based on observed false-positive rate. | `agents/gsd-executor.md` |
| **User-docs jargon ratchet** (v2.45.4) | Catches accidental GSD-jargon leaks (raw paths, internal artifact names, naked plan IDs, "phase N" prose) into plugin user-facing docs at commit time and in CI. Counts-based ratchet against a baseline in `tests/drift-baseline.json`. Fenced code blocks are stripped before scanning so command examples in code blocks do not pollute the ratchet. Plugin self-policing only, downstream user projects are left untouched. | `bin/maintenance/check-user-docs-jargon.cjs` |
| **Default Opus bumped to `claude-opus-4-8`** (v2.45.1) | Tracks Anthropic's 2026-05-28 release. All Anthropic-compatible runtimes (claude, opencode, copilot, hermes) now resolve `opus` to `claude-opus-4-8` by default. Sonnet and Haiku unchanged. Effort controls and fast-mode routing are tracked separately, not part of this bump. | `sdk/shared/model-catalog.json` |
| **Documentation-Driven Development mode** (v2.44.0) | Sibling to `/gsd:new-project`. Research, write user-facing `docs/SPEC.md` as the spec, user validates the spec, then phases are derived from SPEC.md sections (not REQ-ID clusters). Best for CLIs, libraries, SDKs, APIs, plugin systems. Minimal sketch shipped; per-phase docs-sync and docs-aware verification held for v2.45.x. | `/gsd:new-ddd` |
| **Auth-recipe memory** (v2.44.5) | Auto-detects auth-shaped Bash commands (`gh auth login`, `aws configure`, `ssh-keygen`, credential env vars, etc.) via a PostToolUse hook with secret redaction. Detections land in an inbox; `/gsd:remember-access --review` surfaces them. Recipes save to `.planning/AUTH-RECIPES.md` (per-project) and optionally `~/.claude/auth-recipes/<system>.md` (cross-project, survives across new projects). | `/gsd:remember-access` |
| **Auto-approve non-critical artifacts** (v2.44.4) | Removes AFK-blocking prompts on ROADMAP draft (`/gsd:new-project`) and SPEC.md draft (`/gsd:new-ddd`). Auto-decisions log to `.planning/AUTO-DECISIONS.md` for spot-checking. Verification gaps, architectural deviations, and package-install failures still prompt as today. Config: `workflow.auto_approve_non_critical` (default `true`). | `workflow.auto_approve_non_critical` |
| **Scheduled resume** | Schedule a future Claude Code session to auto-run `/gsd:resume-work` (or any GSD command) at a specific time. Useful when hitting a usage cap, pausing for the day, or queuing a phase to run during off-peak quota windows. Accepts `HH:MM`, ISO 8601, or `+<duration>` (e.g. `+2h`). | `/gsd:resume-at <time>` |
| **Auto-resume across `/compact`** | When Claude Code compacts a conversation, a 19-field `HANDOFF.json` is written automatically. The next session detects it via SessionStart and invokes `/gsd:resume-work` with **zero manual input**. | PreCompact + SessionStart hooks |
| **Mid-session checkpoints** | A PostToolUse hook writes a fresh checkpoint after most tool calls (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`), throttled to ≤1/min. Closes the gap when Claude Code's silent *microcompact* path strips tool outputs without firing PreCompact, AND covers read-heavy research phases that don't write files. | PostToolUse hook |
| **Plugin-version-churn fallback** | If another session upgrades the plugin mid-run and prunes the baked `${CLAUDE_PLUGIN_ROOT}` path, hooks resolve through a Node inline resolver that falls back to the newest cached plugin version. Long sessions survive plugin updates. | Hook command resolver |
| **CI-enforced drift detection** | Three detectors run on every push: file-layout drift, HANDOFF schema integrity, and namespace normalization. Each has a ratchet baseline; regressions hard-fail. An upstream-schema detector runs post-sync to catch upstream format divergence early. | `bin/maintenance/check-drift.cjs` |
| **92% per-turn token reduction** | Skill bodies are isolated in `context: fork` sub-agents; orchestration runs in clean child contexts instead of polluting the parent CLAUDE.md. State access uses MCP resources/tools instead of BashTool roundtrips to a CLI. | Plugin architecture |
| **Plugin-local workflow bodies** | All 85 workflow bodies ship inside the plugin (`workflows/<name>.md`) and resolve via `${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md`. Upstream's setup relies on a global `~/.claude/get-shit-done/` install dir that fails silently when missing. | `workflows/` dir |
| **Standardized continuation prompts** | 6 terminal skills (`execute-phase`, `complete-milestone`, `verify-work`, `quick`, `plan-phase`, `ship`) emit "Next Up" blocks per `references/continuation-format.md`: `/clear`-then-[next] suggestions with a "/clear is safe (resume restores from HANDOFF)" footer. | All terminal skills |
| **Memory across sessions** | Phase outcomes persist via Claude Code's memdir and are auto-recalled at session start. Upstream has no persistence; each session starts cold. | Built-in |

For implementation details, see the deep-dive tables in [For users of upstream GSD](#for-users-of-upstream-gsd) below.

## Maintenance scripts

Lightweight Node scripts live in `bin/maintenance/` for plugin upkeep tasks that aren't part of the user-facing CLI.

- `node bin/maintenance/check-file-layout.cjs`: **File-layout drift detector.** Scans plugin content for `@~/.claude/get-shit-done/*` references, classifies each as repairable (plugin has a local counterpart) or genuinely missing, and compares counts to `tests/drift-baseline.json`. Exits non-zero if drift regresses beyond baseline. Runs in CI on every push and pull request. Pass `--dry` to preview or `--write-baseline` to regenerate the baseline after an intentional reduction.
- `node bin/maintenance/rewrite-command-namespace.cjs`: **Namespace normalization.** Rewrites `/gsd-<skill>` to `/gsd:<skill>` across plugin content. Run after every upstream GSD sync since upstream uses the dash form.
- `node bin/maintenance/check-handoff-schema.cjs`: **HANDOFF schema validator.** Generates a fresh `HANDOFF.json` in a tmp dir via `bin/lib/checkpoint.cjs` `writeCheckpoint()`, then validates it against `schema/handoff-v1.json` using ajv. Does not touch the real `.planning/HANDOFF.json`; validation is isolated to a tmp dir that's cleaned up in a `finally` block. Runs in CI on every push and pull request (second job in `.github/workflows/check-drift.yml`). Exits 0 on schema-valid, 1 on violation, 2 on environment error (ajv missing, not at repo root, etc.).
- `node bin/maintenance/check-upstream-schema.cjs`: **Upstream drift detector.** Downloads the latest upstream GSD release tarball (or uses the cached `/tmp/gsd-sync-<version>/` directory from a prior sync), extracts the `/gsd:pause-work` declared field list from `get-shit-done/workflows/pause-work.md`, and compares it to `schema/handoff-v1.json`. Does **not** run in CI; invoke after each upstream sync (manually, or via the sync quick-task template; see `.planning/PROJECT.md` "After each upstream GSD sync" checklist). Set `UPSTREAM_VERSION=v1.38.x` to target a specific version; otherwise falls back to `gh release view` for the latest tag.
- `node bin/maintenance/check-drift.cjs`: **Unified drift check (umbrella).** Runs the file-layout, HANDOFF schema, and namespace detectors in sequence and reports a consolidated PASS/FAIL. Intended for local dev loops and post-upstream-sync verification. Not added to CI; CI runs each per-category detector as its own job for fast-feedback granularity. The upstream schema detector is deliberately excluded (network-dependent + post-sync-only).
- `bash bin/maintenance/install-git-hooks.sh`: **Install local pre-commit hook.** One-time setup per clone. Symlinks `.git/hooks/pre-commit` to `bin/maintenance/pre-commit-drift-baseline.sh`. The hook auto-regenerates `tests/drift-baseline.json` in-place when a feature commit adds a new tracked workflow/skill/agent file that legitimately bumps the unique-subpath count. Aborts the commit if `genuinely_missing` regresses (a real drift bug). Override per-commit: `git commit --no-verify`. Idempotent.

---

## For users of upstream GSD

If you already have GSD installed via `npx get-shit-done-cc`, `npx @opengsd/get-shit-done-redux`, or the legacy `~/.claude/get-shit-done/` setup, this section covers the move to the plugin. Skip this entirely if you're a new user.

### What changed from upstream GSD

This plugin starts from upstream GSD's source tree and adds Claude-Code-native features that aren't possible in upstream's CLI-only design. Areas where the plugin diverges meaningfully:

#### Install + runtime architecture

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Install | `npx @opengsd/get-shit-done-redux` (or pre-rug `get-shit-done-cc`) | `/plugin marketplace add jnuyens/gsd-plugin && /plugin install gsd@gsd-plugin` (run inside Claude Code) |
| Context overhead | ~3,000-5,000 tokens/turn via CLAUDE.md | ~200 tokens (92% reduction) |
| Skill isolation | Inline execution; orchestration prompts pollute parent context | `context: fork` sub-agent isolation; orchestration runs in clean child contexts |
| State access | BashTool roundtrips to `gsd-tools` CLI | MCP resources + tools; structured queries replace prompt injection |
| Agent definitions | Inline prompt role descriptions in skill bodies | `.claude/agents/*.md` with typed frontmatter (model overrides, tool restrictions, effort budgets) |
| Memory across sessions | None; each session starts cold | Phase outcomes persist via Claude Code's memdir; auto-recalled at session start |
| Command IDs | `/gsd-<skill>` (dash; works because no namespace in upstream's flat install) | `/gsd:<skill>` (colon; matches Claude Code's plugin namespace, autocompletes correctly) |

#### Session continuity (none of this exists upstream)

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Behavior at `/compact` | Conversation collapses; phase position lost; user manually re-orients next session | **PreCompact hook** writes a 19-field `HANDOFF.json` capturing phase, plan, task, decisions, uncommitted files. **SessionStart hook** detects it on next session and auto-invokes `/gsd:resume-work` with zero user input. |
| Periodic checkpoint mid-session | None; state only captured if user manually `/gsd:pause-work`'s | **PostToolUse hook** writes a fresh checkpoint after most tool calls (`Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`), throttled to ≤1/min via mtime. Bridges Claude Code's silent *microcompact* path AND read-heavy research phases. After an unexpected session end (usage cap, kill, network drop), HANDOFF reflects state from at most ~60s before the cut. |
| Hook-less environments | N/A | **CLAUDE.md fallback section** carries the same resume instruction so CLIs without hook support (or sessions where the hook fails to fire) still trigger resume on the next session. |
| Handoff lifecycle | N/A | `/gsd:resume-work` deletes `HANDOFF.json` after a successful resume, preventing stale handoffs from triggering phantom resumes. |

#### Drift resilience (CI-enforced; none upstream)

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| File-layout drift | None; broken `@`-includes ship silently | **`check-file-layout.cjs`** scans plugin content for dangling `@~/.claude/...` references, classifies each as repairable vs genuinely missing, ratchets against a committed baseline. Hard-fails in CI on regression. |
| HANDOFF schema integrity | None; schema lives only as prose in upstream's `pause-work.md` | **`schema/handoff-v1.json`** (JSON Schema draft-07, 19 fields). **`check-handoff-schema.cjs`** validates `writeCheckpoint()` output against the schema in CI. **`check-upstream-schema.cjs`** runs post-sync to catch upstream format drift early. |
| Namespace normalization | N/A; upstream commands ship in dash form | **`rewrite-command-namespace.cjs`** rewrites `/gsd-<skill>` to `/gsd:<skill>` across all plugin content. Run after every upstream sync; drift is detected by the umbrella check. |
| Unified drift check | None | **`check-drift.cjs`** umbrella runs all three detectors in one invocation. Used in local dev + post-upstream-sync verification. |

#### Plugin-environment robustness

| Aspect | Upstream GSD | This plugin |
|--------|-------------|-------------|
| Plugin-version churn mid-session | N/A | Hook commands resolve through a Node inline resolver that falls back to the newest cached plugin version when the baked `${CLAUDE_PLUGIN_ROOT}` path is pruned (e.g. after another session upgraded the plugin). Long sessions survive plugin updates. |
| Workflow body location | `~/.claude/get-shit-done/workflows/<name>.md` (legacy install dir; absent for plugin users → silent "fall back to legacy file" failures) | **Plugin-local `workflows/` dir** with all 78 bodies; skills `@`-include via `${CLAUDE_PLUGIN_ROOT}/workflows/<name>.md` which Claude Code's plugin loader resolves to the version-stamped install path |
| End-of-flow continuation prompts | Inconsistent; some skills emit `/clear`-then-X blocks, many don't | Standardized: 6 terminal skills (`execute-phase`, `complete-milestone`, `verify-work`, `quick`, `plan-phase`, `ship`) emit Next Up blocks per `references/continuation-format.md` with `/clear`-then-[next] + a "/clear is safe" parenthetical (resume restores from HANDOFF) |

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
/reload-plugins
```

#### 2. Uninstall the global `get-shit-done-*` npm package (now safe -- v2.42.0+)

```bash
npm uninstall -g get-shit-done-cc                  # pre-rug package, may still be installed
npm uninstall -g @opengsd/get-shit-done-redux      # post-rug package, if you installed it
```

> **History:** this step's wording has changed twice. Versions ≤ v2.41.0 told users to uninstall while the plugin still needed the package's `gsd-sdk` binary, which silently broke every `/gsd:*` command ([#4](https://github.com/jnuyens/gsd-plugin/issues/4)). v2.41.1 corrected the README to "keep installed". v2.42.0 bundles the SDK inside the plugin, making the uninstall genuinely safe again. Thanks to @ThomasHezard for catching the original bug and @herman925 for confirming. The post-rug package name (`get-shit-done-redux`) was added in v2.43.6.

If you're on **v2.42.0 or newer** the plugin's `bin/gsd-sdk` wrapper takes over once the global one is gone; nothing breaks. If you're on an older plugin version, leave the global package alone until you've upgraded the plugin first.

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

If you want to switch from the legacy backup to the post-rug upstream (`get-shit-done-redux`), install it via `npx @opengsd/get-shit-done-redux@latest`; it preserves all commits/branches/tags from the pre-rug tree, so any `.planning/` directory built with the legacy install continues to work without changes.

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

The plugin version tracks the upstream `@opengsd/gsd-core` release line it follows, with the major bumped by **two** to signal a distinct, more-featured derivative:

```
plugin_major = gsd-core_major + 2
plugin_minor = gsd-core_minor     (the upstream line this release follows)
plugin_patch = plugin's own release counter on that line
```

So upstream gsd-core `1.4.x` ships here as plugin `3.4.x` (this release: `3.4.1`, aligned to gsd-core `1.4.1`). When upstream advances to `1.5.0`, the plugin moves to `3.5.0`; when upstream reaches `2.0.0`, the plugin moves to `4.0.0`. Plugin-only changes between upstream releases bump the patch (`3.4.2`, `3.4.3`, ...).

**Why `+2`, and the v3.4.1 re-base:** earlier releases used a `+1` offset against the original `gsd-build/get-shit-done` 1.x line, so the plugin had reached `2.45.x`. After upstream moved to `@opengsd/gsd-core` (which restarted numbering at `1.x`), a `+1` re-align would have produced `2.4.x` — a version regression below the existing `2.45.x`. The `+2` offset re-aligns the minor.patch to the gsd-core line being tracked while staying monotonically above the prior `2.x` lineage. Content is selectively cherry-picked from gsd-core, not a full vendor sync, so `3.4.x` signals "follows the gsd-core 1.4.x line", not byte-identical parity.

This project repackages the GSD workflow system as a native Claude Code plugin with additional optimizations: skill isolation via `context: fork`, structured MCP tools replacing prompt injection, and cross-session memory via memdir.

## Credits

- **GSD (Get Shit Done)** by TACHES (Lex Christopherson) -- the original workflow framework this plugin is based on. Original repo at [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) (locked May 2026 after the founder rug-pulled the associated `$GSD` token and deleted his accounts).
- **[open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux)** by [trek-e](https://github.com/trek-e) (Tom Boucher) and contributors -- bit-perfect community continuation hosting the codebase going forward.
- Plugin packaging, MCP integration, token optimization, and memory system by Jasper Nuyens

## License

MIT
