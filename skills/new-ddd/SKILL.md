---
name: gsd:new-ddd
description: Initialize a new project using Documentation-Driven Development. Research, then write user-facing docs (DOCS.md) as the spec, then user validates docs, then phases derive from doc sections. Best for CLIs, libraries, SDKs, APIs, plugin systems, anything with a well-defined user-facing surface.
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<runtime_note>
**Copilot (VS Code):** Use `vscode_askquestions` wherever this workflow calls `AskUserQuestion`. They are equivalent, `vscode_askquestions` is the VS Code Copilot implementation of the same interactive question API.
</runtime_note>

<context>
**Documentation-Driven Development (DDD) mode for project initialization.**

Differs from `/gsd:new-project` in three ways:

1. The artifact users validate is `DOCS.md` (user-facing documentation: README, USAGE, CONCEPTS, API surface) rather than `REQUIREMENTS.md` (REQ-IDs and acceptance criteria).
2. Phases are derived from `DOCS.md` sections / chapters rather than from REQ-ID clusters.
3. The success criterion for each phase is "implementation matches the corresponding DOCS.md section" rather than "tests pass and UAT satisfied."

**When to use DDD vs. standard new-project:**
- CLIs (the help text IS the spec)
- Libraries / SDKs (README + API reference is the contract)
- APIs (OpenAPI-style docs-as-spec)
- Plugin / extension systems (extension API surface = docs)
- Any project where the user-facing surface is the deliverable

**When to skip DDD and use standard new-project:**
- Exploratory research where the system shape is unknown
- Pure refactors or performance optimization
- Backend services with no human-readable interface

**Flags:**
- `--auto`, Automatic mode. After config questions, runs research → docs → roadmap without further interaction. Expects idea document via @ reference.
</context>

<objective>
Initialize a new project through Documentation-Driven Development:

1. Questioning (deep context gathering, same as new-project)
2. Research (parallel, same as new-project)
3. **DOCS.md drafting** (NEW, writes user-facing documentation as the spec)
4. **User validation of DOCS.md** (NEW, read-through and approve before any phase work)
5. Roadmap generation (phases derived from DOCS.md sections)
6. STATE.md initialization

**Creates:**
- `.planning/PROJECT.md`, project context
- `.planning/config.json`, workflow preferences (`mode: ddd` set)
- `.planning/research/`, domain research (optional)
- `.planning/DOCS.md`, user-facing documentation as the spec
- `.planning/REQUIREMENTS.md`, thin traceability shell, each entry pointing at a DOCS.md section
- `.planning/ROADMAP.md`, phase structure derived from DOCS.md sections
- `.planning/STATE.md`, project memory (with `mode: ddd` marker)

**After this command:** Run `/gsd:plan-phase 1` to start execution. Per-phase work proceeds the same as standard GSD; DOCS.md is the canonical spec that each phase implements against. Manual doc updates during execution are expected; per-phase doc-sync automation is held for a future release.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/new-ddd.md
@${CLAUDE_PLUGIN_ROOT}/workflows/new-project.md
@${CLAUDE_PLUGIN_ROOT}/references/questioning.md
@${CLAUDE_PLUGIN_ROOT}/references/ui-brand.md
@${CLAUDE_PLUGIN_ROOT}/templates/project.md
</execution_context>

<process>
Execute the new-ddd workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/new-ddd.md end-to-end.
Where the workflow says "as in new-project step N", follow the matching step from @${CLAUDE_PLUGIN_ROOT}/workflows/new-project.md to avoid duplicated logic.
Preserve all workflow gates (validation, approvals, commits, routing).
</process>
