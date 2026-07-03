---
name: gsd:scan
description: Rapid codebase assessment — lightweight alternative to /gsd:map-codebase
argument-hint: "[--focus tech|arch|quality|concerns|tech+arch] | --drift [--top N] [--fail-on-score N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
Run a focused codebase scan for a single area, producing targeted documents in `.planning/codebase/`.
Accepts an optional `--focus` flag (`tech`, `arch`, `quality`, `concerns`, or `tech+arch` (default)), OR a `--drift` mode (mutually exclusive with `--focus`) that runs `gsd-tools verify drift` and prints a ranked drift report to stdout, no agent spawned. In `--drift` mode, `--top N` limits the report (default 20) and `--fail-on-score N` exits 1 when the composite score is below N.

Lightweight alternative to `/gsd:map-codebase` — spawns one mapper agent instead of four parallel ones.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/scan.md
</execution_context>

<process>
Execute the scan workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/scan.md end-to-end.
</process>
