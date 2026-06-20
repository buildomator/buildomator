---
name: gsd:version
description: Print the installed GSD plugin version and check online for updates
effort: low
allowed-tools:
  - Bash
  - Read
---

<objective>
Report the installed plugin version, check GitHub for the latest, and show update
steps only when behind. Output ONLY what the bash block prints; add nothing.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/version.md
</execution_context>

<process>
Run the bash block in @${CLAUDE_PLUGIN_ROOT}/workflows/version.md and relay its
output verbatim. The online check is best-effort and never blocks the command.
</process>
