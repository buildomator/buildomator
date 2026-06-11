---
name: gsd:version
description: Print the installed GSD plugin version and check online for updates
allowed-tools:
  - Bash
  - Read
---

<objective>
Report the installed GSD plugin version, check GitHub for the latest release, and
when an update is available (or the check could not run) show how to update.

Output ONLY the version report. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions beyond the update guidance the workflow prints
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/version.md
</execution_context>

<process>
Execute the version workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/version.md.
Run its bash block and relay the output verbatim. The online check is best-effort
and must never block or fail the command.
</process>
