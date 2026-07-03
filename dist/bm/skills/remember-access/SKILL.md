---
name: gsd:remember-access
description: Capture or review how this project connects to external systems (GitHub, AWS, npm, SSH, etc.) so future sessions know the auth recipe. Auto-detection hook logs candidate captures to an inbox; this skill promotes them to permanent recipes in `.planning/AUTH-RECIPES.md` and optionally to user-global memory at `~/.claude/auth-recipes/`.
argument-hint: "[--review] [<system-name>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - AskUserQuestion
---
<context>
Auth setup is one of those things every project does once and then forgets the details of. GSD captures the recipe so future sessions on the same project (or future projects on the same system) can replay or surface it.

**Two modes:**

- `/gsd:remember-access <system-name>`: manual capture. Walks you through documenting how to authenticate to a system, writes to `.planning/AUTH-RECIPES.md` (per-project), optionally promotes to `~/.claude/auth-recipes/<system>.md` (cross-project).
- `/gsd:remember-access --review`: surface the auto-detection inbox (`.planning/.pending-auth-captures.jsonl`, populated by the `gsd-auth-detector` PostToolUse hook), let you confirm each detection and save it as a recipe.

**Auto-detection** runs continuously: every Bash command you execute is checked against auth-shaped patterns (`gh auth login`, `aws configure`, `ssh-keygen`, `export GITHUB_TOKEN=...`, etc.). Secret-looking content is redacted before the inbox entry is written. Review at your own pace.

**Privacy:** the detector NEVER stores the actual secret values. It stores the SHAPE of the command (which tool, which flags) with credential payloads replaced by `[REDACTED]` markers. The recipe is "how to authenticate," not "what the password is."
</context>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/remember-access.md
</execution_context>

<process>
Execute the remember-access workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/remember-access.md.
</process>
