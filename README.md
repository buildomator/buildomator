<p align="center">
  <img src="assets/buildomator-logo-big.png" alt="Buildomator" width="320" />
</p>

# Buildomator for Claude Code

**Plugin version:** `4.1.0`

**Buildomator** is a Claude Code plugin that plans, executes, and verifies your work. It asks you only about the real design and architecture decisions that need your judgment, then carries out the rest on its own. Each step runs in its own focused subcontext, so token use stays low even on long projects.

Buildomator is a performance-optimized evolution of [GSD](https://github.com/open-gsd/get-shit-done-redux) for Claude Code: it cuts per-turn token overhead by ~92%, keeps project state in an MCP-backed store, and auto-resumes across `/compact` so a compaction never loses your place.

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

Enable auto-update for the marketplace in Claude Code settings and updates will be applied automatically at startup. To update manually:

1. **Refresh the plugin on disk.** Run `/plugins`, open **Marketplace**, and select **gsd-plugin** to refresh it. Then exit the marketplace by pressing **Esc twice**. This updates gsd-plugin on the filesystem.
2. **Activate it in your open sessions.** Run `/reload-plugins` in **each** Claude Code session you already have open, so they pick up the new version without restarting.

Note: the marketplace step (1) updates the plugin on disk; `/reload-plugins` (2) is what makes an already-running session use the new version. Sessions you start after the update load the new version automatically.

To check the active version in a session, run `/gsd:version` (it also checks GitHub for the latest release and prints the update steps when you are behind).

**Do I run `/reload-plugins` in all open sessions or just one?** In all of them. `/reload-plugins` is per-session: each Claude Code session loads its own copy of the plugin, so reloading in one session does not refresh the others. Run it once per session you have open. Sessions you start **after** the update load the new version automatically, with no reload needed (so only your already-open sessions need the command). No `/exit` or restart is required. gsd-plugin ships an MCP server, but its tools load on demand via tool search, so the reload applies cleanly; on Claude Code v2.1.163+ in the rare case a reload would force a full context re-read, `/reload-plugins` prints a warning and you re-run it as `/reload-plugins --force`.

## What's New

**v4.0.0**: **Consistency and code-integrity safeguards, and a second upstream.** GSD now derives a project's naming and architectural conventions and gates changes against them (`verify conventions`, wired into pattern-mapper and code-review), and ships native drift detection that finds duplicated logic, phantom/placeholder scaffolding, and structural near-clones across the repo (`verify drift`, `/gsd:scan --drift`, plus an opt-in `audit-milestone` integrity gate). All detection is 100% native with zero runtime dependency. This release also formalizes **[VibeDrift](https://www.npmjs.com/package/@vibedrift/cli) as a second upstream**: GSD never runs it, but ports its drift-detection heuristics natively and watches its releases to cherry-pick future ones. The major bump to 4.0 marks gsd-plugin as its own version line, signaling how far it has diverged from upstream GSD (see [Upstream projects](#upstream-projects) and [Versioning](#versioning)).

**v3.7.2**: `/gsd:autonomous` no longer stops to ask you to re-confirm before kicking off. The workflow had no confirm-scope step, so the orchestrator improvised one out of caution: it printed the phase plan, then waited for you to say "go" again, which defeats an autonomous command. A new explicit contract makes the rule plain (show the plan, then continue into execution in the same turn; surface a discovered constraint, like a migration-chain collision, as a one-line notice it acts on, not a gate that waits). The only pauses left are the real decision points: human verification, gaps after one auto-retry, audit gaps/tech-debt, and blockers.

**v3.7.1**: fixes `/gsd:version` reporting `Error: Exit code 1` when you are up to date (the update-hint chain exited non-zero; it printed correctly but Claude Code flagged it), and trims its bash. Extends the resilience sweep to `/gsd:validate-phase` and `/gsd:secure-phase` so the fix-it action is recommended (not a neutral menu).

**v3.7.0**: **Improved resilience when sessions are broken.** When a session drops and resumes, phases can be left partially delivered, and GSD used to either lose the thread or confront you with hard-to-read internals questions. Now it heals instead:
- **Interrupted UATs are never lost.** If you detour mid-verification (a bug to `/gsd:quick`, ideas to `/gsd:add-phase` / `/gsd:explore`), an unfinished UAT becomes a hard invariant in `/gsd:next` (resumed before any forward routing) and the detour itself leaves a "↩ resume UAT" breadcrumb.
- **Coverage gates auto-heal instead of interrogating.** When the decision/requirements-coverage gates find a plan that implements a decision but didn't literally tag it, GSD now backfills the `(D-NN)`/REQ-ID tags and proceeds silently (the plan-checker already confirmed the work is covered). Only decisions implemented in *no* plan surface, in plain language with the fix recommended.
- **Leaner `/gsd:version`** — inlined and node-free, so it works even when node is broken.

**v3.6.3**: the UI-SPEC gate now honors `auto_advance` (default on). A manual `plan-phase` on a frontend phase auto-generates the UI design contract and continues, instead of dead-ending with a "run `/gsd:ui-phase` then re-run" gate. `--no-auto` / `--skip-ui` keep the manual paths, and `/gsd:ui-phase` is still there for an interactive design session.

**v3.6.2**: corrects the "how to update" instructions (the `/plugins` Marketplace refresh flow, in the README and in `/gsd:version`), and makes `/gsd:version` leaner and node-independent so it works even when node is broken.

**v3.6.1**: fixes `/gsd:profile-user` and dev-preferences failing with "Template not found" in installs (the bundled SDK resolved templates at a stale nested path), and aligns the `commit_docs` new-project default between the CJS and SDK resolvers.

**v3.6.0**: **Less GSD housekeeping prompts.** GSD now interrupts you only for decisions about what you're building, not its own plumbing.
- **No more rubber-stamp prompts.** Process prompts that just confirmed a recommendation now auto-follow it (announced, with a per-run escape): the "Research first (Recommended)?" gate, the discuss-phase "ready for context?" gate, and the ~8-question new-project setup gauntlet (first run now offers a single "use recommended defaults" gate). Build and design prompts stay interactive.
- **Auto-advance on by default, context-aware.** `auto_advance` now defaults on: cheap phases (<=2 plans) flow plan to execute hands-free; big phases pause for a `/clear` hand-off (clean context plus live wave checkpoints). discuss to plan stays interactive. `--no-auto` opts out per run.
- **Gaps auto-route by severity.** Verification gaps that break the phase goal auto-escalate to gap-closure; minor-only gaps auto-park to backlog, with no "how should these gaps be handled?" prompt.

Recent: v4.0.0 added the convention conformance gate, native drift detection, and a second upstream (VibeDrift), and moved the plugin to its own version line; v3.7.0 added session-resilience healing. Full history in [CHANGELOG.md](./CHANGELOG.md).

> ### Upstream change (May 2026)
>
> In May 2026 the original GSD maintainer TÂCHES (Lex Christopherson) became unreachable, deleted his social accounts, and the associated `$GSD` Solana token was publicly linked to a rug-pull (see external coverage: [intellectia.ai](https://intellectia.ai/news/crypto/gsd-token-allegedly-rugpulled-after-founder-exit), [ourcryptotalk](https://ourcryptotalk.com/news/bags-hackathon-winner-gsd-cloud-rug-pull)).
>
> On 2026-05-22, GSD collaborator [trek-e](https://github.com/trek-e) launched a community continuation at [open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux): same MIT-licensed code, all 394 branches and 229 tags mirrored bit-for-bit, no token references. The [migration announcement](https://github.com/open-gsd/get-shit-done-redux/discussions/109) details what changed for downstream consumers. The original `gsd-build/get-shit-done` is now locked and auto-closes new issues and PRs.
>
> This plugin treats `open-gsd/get-shit-done-redux` as upstream from `v2.43.6` onward. No code changed at the cutover (the redux is bit-perfect with the pre-rug tree); only URLs and npm package names moved. See [Versioning](#versioning) and [Credits](#credits) for the historical relationship.

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
| **Native drift detection** (v4.0.0) | Repo-wide, zero-dep detection of duplicate logic, structural near-clones, and phantom/stub code, with an auditable allowlist. Ranked report plus an opt-in milestone gate. | `gsd-tools verify drift`, `/gsd:scan --drift` |
| **Convention and architectural conformance gate** (v4.0.0) | Derives your project's naming and architecture conventions by majority vote and flags changed files that deviate, in the existing review path. Never blocks. | `gsd-tools verify conventions`, wired into pattern-mapper + code-review |
| **Weekly plugin self-update watch** (v4.0.0) | Weekly cron emails you when your install is behind the latest tag (Claude Code auto-update is unreliable). Never fails cron. | `bin/check-plugin-update.sh` (cron, not a GSD command) |
| **VibeDrift second-upstream watch** (v4.0.0) | Watches `@vibedrift/cli` releases so its drift heuristics can be ported natively over time. Cron notifier only; vibedrift is never run. | `bin/check-vibedrift-release.sh` (cron, not a GSD command) |
| **Improved resilience when sessions are broken** (v3.7.0) | On a dropped/resumed session, interrupted UATs are never lost and coverage-tagging gaps auto-heal instead of interrogating you. | `/gsd:next`, `workflows/plan-phase.md`, `workflows/verify-work.md`, `references/continuation-format.md` |
| **Less GSD housekeeping prompts** (v3.6.0) | Rubber-stamp process prompts auto-follow their recommendation; `auto_advance` is on and context-aware; gaps auto-route by severity. Build/design prompts stay interactive. | `workflows/plan-phase.md`, `workflows/discuss-phase/`, `workflows/execute-phase.md`, `workflow.auto_advance`, `--no-auto` |
| **Reliable default-branch resolution (no more main-vs-master drift)** (v3.4.11; fixed ahead of upstream) | One resolver for the default branch (config, origin/HEAD, `git remote show`, local), so GSD stops forking off a non-existent `main` on `master` repos. | `gsd-tools.cjs base-branch` |
| **Token-overhead reduction across all instruction docs** (v3.4.10) | Trimmed ~1,810 lines of pure overhead from 173 instruction files, behavior unchanged (verified by a multi-agent compact-then-refute pipeline). | (all of `workflows/`, `skills/`, `agents/`, `references/`) |
| **`/gsd:version` command** (v3.4.9) | Prints the installed version and checks GitHub tags for the latest, showing update steps only when you are behind. Read-only, never fails the command. | `/gsd:version` |
| **Ultracode orchestration signal** (v3.4.8) | A signal that runs fan-out-friendly commands (map-codebase, code-review, review) at maximum multi-agent depth instead of their default. | `workflow.ultracode`, `references/ultracode-mode.md` |
| **Claude Fable 5 tier with auto-fallback to Opus** (v3.4.4; withdrawn 2026-06-12) | Added a `fable` model tier for the heaviest agents; since Fable's withdrawal it auto-falls back to `opus`, gated by a tunable `fable.mode`/`fable.until`. | `bin/lib/core.cjs`, `sdk/src/query/config-query.ts` |
| **Auto-capture durable decisions in ad-hoc work** (v3.4.1) | `/gsd:quick`, `/gsd:debug`, `/gsd:fast` save durable decisions to Claude Code memory at close-out, so context survives between milestones. Conservative by default. | `workflow.auto_memory_capture` |
| **Gaps auto-route by blocking severity** (v2.45.9; made automatic in v3.6.0) | Verifier `gaps_found` auto-routes by severity: goal-breaking gaps escalate to a follow-up phase, minor gaps park to backlog. No prompt. | `workflows/execute-phase.md`, `agents/gsd-verifier.md` |
| **Amend docs into work commit** (v2.45.7) | `/gsd:quick` folds PLAN/SUMMARY/STATE into the preceding work commit (one commit per task, not two), falling back to a separate commit when unsafe. | `workflows/quick.md` |
| **Executor self-test bias** (v2.45.6) | Nudges the executor toward automated self-checks instead of `human-verify` prompts that interrupt you. | `agents/gsd-executor.md` |
| **User-docs jargon ratchet** (v2.45.4) | Catches GSD-jargon leaks (raw paths, plan IDs, "phase N" prose) in user-facing docs at commit time and in CI, against a baseline. | `bin/maintenance/check-user-docs-jargon.cjs` |
| **Default Opus bumped to `claude-opus-4-8`** (v2.45.1) | Resolves `opus` to `claude-opus-4-8` across Anthropic-compatible runtimes. Sonnet and Haiku unchanged. | `sdk/shared/model-catalog.json` |
| **Documentation-Driven Development mode** (v2.44.0) | Sibling to new-project: write a user-facing `docs/SPEC.md`, validate it, then derive phases from its sections. Best for CLIs, libraries, APIs. | `/gsd:new-ddd` |
| **Auth-recipe memory** (v2.44.5) | Detects auth commands (gh/aws/ssh, credential env vars) via a hook with secret redaction; promote them to reusable per-project or cross-project recipes. | `/gsd:remember-access` |
| **Auto-approve non-critical artifacts** (v2.44.4) | Drops AFK-blocking prompts on ROADMAP/SPEC drafts (logged for review); real risks like verification gaps still prompt. | `workflow.auto_approve_non_critical` |
| **Scheduled resume** | Schedule a future Claude Code session to auto-run a GSD command at a set time (`HH:MM`, ISO, or `+2h`). Handy for quota windows. | `/gsd:resume-at <time>` |
| **Auto-resume across `/compact`** | On compaction a `HANDOFF.json` is written and the next session auto-runs `/gsd:resume-work` with zero manual input. | PreCompact + SessionStart hooks |
| **Mid-session checkpoints** | A PostToolUse hook writes a fresh checkpoint after most tool calls (throttled), covering Claude Code's silent microcompact gap. | PostToolUse hook |
| **Plugin-version-churn fallback** | If the plugin updates mid-run, hooks resolve through a fallback to the newest cached version, so long sessions survive. | Hook command resolver |
| **CI-enforced drift detection** | Three CI detectors (file-layout, HANDOFF schema, namespace) with ratchet baselines hard-fail on regression. | `bin/maintenance/check-drift.cjs` |
| **92% per-turn token reduction** | Skill bodies run in `context: fork` sub-agents and state uses MCP instead of CLI roundtrips, keeping the parent context clean. | Plugin architecture |
| **Plugin-local workflow bodies** | All 85 workflow bodies ship inside the plugin and resolve via `${CLAUDE_PLUGIN_ROOT}`, instead of a global dir that fails silently when missing. | `workflows/` dir |
| **Standardized continuation prompts** | 6 terminal skills emit "Next Up" blocks with `/clear`-then-next suggestions and a safe-to-clear footer. | All terminal skills |
| **Memory across sessions** | Phase outcomes persist via Claude Code memdir and auto-recall at session start (upstream starts cold). | Built-in |

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

The `/gsd:update` command is deprecated. Update via `/plugins` -> Marketplace -> select gsd-plugin to refresh, then `/reload-plugins` (see the Updating section above).

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

## Upstream projects

gsd-plugin draws on three upstream projects, in three different ways: it **packages** one, **ports ideas from** another, and **implements the format spec** of a third. None is a runtime dependency: the plugin bundles everything it needs.

**1. GSD (`@opengsd/gsd-core`): the primary upstream.** This is the workflow engine the plugin packages and optimizes. The plugin starts from gsd-core's source tree (the phase/plan/execute/verify lifecycle, the agents, the SDK) and adds Claude-Code-native capabilities on top: skill isolation via `context: fork`, MCP-backed project state, cross-session memory, auto-resume across `/compact`, and the token-overhead reductions. Content is selectively cherry-picked from gsd-core, not a full vendor sync, and `bin/check-gsd-release.sh` watches gsd-core for new releases to fold in. Provenance: gsd-core is the community continuation at [open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux) of the original GSD by TÂCHES (see the [Upstream change](#whats-new) note above and [Credits](#credits)).

**2. VibeDrift (`@vibedrift/cli`): a second, idea-only upstream.** As of v4.0.0, GSD treats VibeDrift the way it treats gsd-core: as an upstream to learn from. But the relationship is deliberately narrower. GSD **never installs or runs VibeDrift** at any point. Instead it ports VibeDrift's drift-detection heuristics natively (the MinHash+LCS structural-dup detector in this release is one such port, with its constants pinned to the v0.14.0 idea baseline) and watches the package for new releases (`bin/check-vibedrift-release.sh`) so future heuristics can be cherry-picked over time. This keeps drift detection 100% native and zero-dependency while still benefiting from VibeDrift's research. VibeDrift is an idea source, never a runtime component.

**3. workspace.json (`workspace-json/spec`): a consumed format spec.** gsd-plugin is a consumer implementation of the [workspace.json spec](https://github.com/workspace-json/spec): when a `.agents/workspace.json` file conforming to the spec is present, the plugin reads it at SessionStart and injects structured codebase intelligence (fragile files, frameworks, co-change notes) into the model's context, with strict major-version gating and prompt-injection sanitization. The plugin neither generates nor bundles the file; it implements the reader side of an open spec, so any tool that emits spec-conformant `workspace.json` interoperates. The integration was contributed by [Qwynn Marcelle](https://github.com/qmarcelle) (see [Credits](#credits)).

This multi-upstream posture is part of why v4.0.0 is a major bump: the plugin now accumulates a substantial body of capability (a convention conformance gate, native drift detection, an integrity gate) that does not exist in upstream GSD at all, pulls ideas from a second project entirely, and implements a third project's open format. See [Versioning](#versioning).

## Versioning

As of **v4.0.0**, the plugin version is its **own line**. Earlier releases mechanically tracked gsd-core (`plugin_major = gsd-core_major + 2`), but the plugin has diverged enough (a second upstream, plus features with no upstream equivalent) that a version coupled to gsd-core's major no longer reflects what a release means. The major bump now signals **the plugin's own significant milestones** (large feature sets, divergence from upstream), not gsd-core's major.

```
plugin_major = the plugin's own milestone line   (4.x = the post-divergence era)
plugin_minor = feature releases on that line
plugin_patch = plugin-only fixes between feature releases
```

For provenance, each release still notes which gsd-core line it follows (this `4.0.0` follows the gsd-core `1.x` line; see the "Based on" header and `bin/check-gsd-release.sh`), but the numbers no longer move in lockstep. If gsd-core reaches its own major (2.0), that is captured in the provenance note and the cherry-pick log, not forced into the plugin's major.

**History:** the original `gsd-build/get-shit-done` 1.x line was tracked at `+1` (the plugin reached `2.45.x`). After upstream moved to `@opengsd/gsd-core` and restarted at `1.x`, a `+2` offset re-aligned the minor while staying above the prior `2.x` lineage, producing the `3.x` series. v4.0.0 retires the offset scheme entirely in favor of an independent line.

**Note on the v3.7.2 → v4.0.0 jump:** this major bump is a **divergence signal, not a breaking change**. There are no breaking changes for users: existing commands, config, and planning artifacts work unchanged, and the new capabilities (drift detection, the integrity gate) are additive and opt-in. Update as you would any release.

This project repackages the GSD workflow system as a native Claude Code plugin with additional optimizations: skill isolation via `context: fork`, structured MCP tools replacing prompt injection, and cross-session memory via memdir.

## Credits

- **GSD (Get Shit Done)** by TACHES (Lex Christopherson) -- the original workflow framework this plugin is based on. Original repo at [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) (locked May 2026 after the founder rug-pulled the associated `$GSD` token and deleted his accounts).
- **[open-gsd/get-shit-done-redux](https://github.com/open-gsd/get-shit-done-redux)** by [trek-e](https://github.com/trek-e) (Tom Boucher) and contributors -- bit-perfect community continuation hosting the codebase going forward.
- **[workspace.json spec](https://github.com/workspace-json/spec)** -- the open codebase-intelligence format gsd-plugin reads at SessionStart; the consumer integration was contributed by [Qwynn Marcelle](https://github.com/qmarcelle).
- Plugin packaging, MCP integration, token optimization, and memory system by Jasper Nuyens

## License

MIT
