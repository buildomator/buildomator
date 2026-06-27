---
created: 2026-06-27T01:16:05.450Z
title: Codify general comment and style conventions
area: general
files:
  - CLAUDE.md
---

## Problem

Recurring authoring conventions the user wants applied consistently across generated code, comments, and commits. Several are enforced ad hoc (em-dash ban, no Co-Authored-By) but not all are written down where code-generating workflows/agents will honor them. Captured as a todo to fold into project conventions (CLAUDE.md / conventions.cjs / executor + agent guidance) so they apply automatically.

Conventions to codify:

1. **No em-dashes** when avoidable. Use commas, colons, or parentheses instead. (Already a docs rule; extend to all output incl. code/comments.)
2. **No GSD phase references in code comments.** Comments must not mention phase numbers, plan IDs, or the GSD process (e.g. avoid `// Phase 11 DRIFT-05`). Process belongs in planning artifacts, not source.
3. **Compact, code-focused comments.** Comments should be terse and describe what the code does / why, not the workflow or process that produced it.
4. **No "Co-Authored-By: Claude" lines** in commit messages. (Already in global CLAUDE.md; ensure plugin agents/executors never add it.)

## Solution

TBD. Likely surface in:
- Project `CLAUDE.md` conventions section (so all agents inherit it)
- `bin/lib/conventions.cjs` rule set if mechanically checkable (em-dash in source comments, phase IDs in comments)
- Executor / agent prompt guidance for comment style

Audit current executor + agent templates for any "Phase N" comment patterns or Co-Authored-By emission and strip them.
