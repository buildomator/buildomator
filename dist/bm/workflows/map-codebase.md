<purpose>
Orchestrate parallel codebase mapper agents to analyze the codebase and produce 7 structured documents in .planning/codebase/. Each agent explores a focus area and **writes documents directly**; the orchestrator only receives confirmation + line counts, then writes a summary.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd:gsd-codebase-mapper — Maps project structure and dependencies
</available_agent_types>

<philosophy>
Dedicated mapper agents: fresh context per domain, write documents directly, run simultaneously; orchestrator only summarizes what was created.

Document quality over length: include enough detail to be useful as reference; prioritize practical code-pattern examples over brevity.

Always include actual file paths formatted with backticks: `src/services/user.ts`.
</philosophy>

<ultracode_gate>
Resolve whether **ultracode mode** is active for this run:
```bash
ULTRA=$(gsd-sdk query config-get workflow.ultracode --default auto 2>/dev/null || echo auto)
TODAY=$(date +%F)
# Active when: ULTRA = "true" (explicit opt-in), OR
#              ULTRA != "false" AND TODAY <= 2026-06-22 (the window during which
#              these deeper runs are included; after 2026-06-22 ultracode becomes
#              extra-paid, so it is OFF then unless workflow.ultracode is explicitly true).
```
When **active**, run in ultracode mode: spawn the FULL mapper set (never a trimmed subset for brevity) and reconcile overlapping findings across mappers before writing the summary. When **inactive**, run normally. See `references/ultracode-mode.md`.
</ultracode_gate>

<process>

<step name="parse_paths_flag" priority="first">
Parse an optional `--paths <p1,p2,...>` argument. When supplied (by the
post-execute codebase-drift gate in `/bm:execute-phase` or by a user running
`/bm:map-codebase --paths apps/accounting,packages/ui`), the workflow
operates in **incremental-remap mode**:

- Pass `--paths <p1>,<p2>,...` through to each spawned `gsd-codebase-mapper`
  agent's prompt. Agents scope their Glob/Grep/Bash exploration to the listed
  repo-relative prefixes only — no whole-repo scan.
- Reject path values that contain `..`, start with `/`, or include shell
  metacharacters (`;`, `` ` ``, `$`, `&`, `|`, `<`, `>`). If all provided
  paths are invalid, fall back to a normal whole-repo run.
- On write, each mapper stamps `last_mapped_commit: <HEAD sha>` into the YAML
  frontmatter of every document it produces (see `bin/lib/drift.cjs:writeMappedCommit`).

**Contract:** downstream steps (`spawn_agents` and any Agent-mode prompt) MUST use the single normalized `${PATH_SCOPE_HINT}` variable so every mapper gets the same scope. Without it, incremental-remap can silently regress to a whole-repo scan.

```bash
# Validated, comma-separated paths (empty if --paths absent or all rejected):
SCOPED_PATHS="<validated paths or empty>"
if [ -n "$SCOPED_PATHS" ]; then
  PATH_SCOPE_HINT="--paths $SCOPED_PATHS"
else
  PATH_SCOPE_HINT=""
fi
```

All mapper prompts built later in this workflow MUST include
`${PATH_SCOPE_HINT}` (expanded to empty when full-repo mode is in effect).

When `--paths` is absent, behave exactly as before: full-repo scan, all 7
documents refreshed.
</step>

<step name="init_context" priority="first">
Load codebase mapping context:

```bash
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_MAPPER=$(gsd-sdk query agent-skills gsd-codebase-mapper)
```

Extract from init JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`, `subagent_timeout`, `date`.
</step>

<step name="check_existing">
Check if .planning/codebase/ already exists using `has_maps` from init context.

If `codebase_dir_exists` is true:
```bash
ls -la .planning/codebase/
```

**Parse flags from `$ARGUMENTS`:** `--refresh` (delete and remap from scratch), `--update [<docs>]` (partial update, optionally scoped to a comma-separated list of doc names like `STACK.md,STRUCTURE.md`).

**If exists AND no `--refresh` AND no `--update`:** auto-use existing. Emit a brief notice and exit cleanly:

```
.planning/codebase/ already exists with these documents:
[List files found]

Using existing map as-is.
To force a full remap, re-invoke with --refresh.
To partially update specific documents, re-invoke with --update <docs> (comma-separated, e.g. --update STACK.md,STRUCTURE.md; or bare --update to be asked which).
```

**If exists AND `--refresh`:** delete `.planning/codebase/`, continue to `create_structure`.

**If exists AND `--update <docs>`:** continue to `spawn_agents` filtered to the named documents. With bare `--update` (no args), ask which documents to update via AskUserQuestion checkbox list, then continue to `spawn_agents` filtered.

**If doesn't exist:**
Continue to `create_structure`.
</step>

<step name="create_structure">
Create .planning/codebase/ directory:

```bash
mkdir -p .planning/codebase
```

**Expected output files:**
- STACK.md (from tech mapper)
- INTEGRATIONS.md (from tech mapper)
- ARCHITECTURE.md (from arch mapper)
- STRUCTURE.md (from arch mapper)
- CONVENTIONS.md (from quality mapper)
- TESTING.md (from quality mapper)
- CONCERNS.md (from concerns mapper)

Continue to spawn_agents.
</step>

<step name="spawn_agents">
Spawn 4 parallel gsd-codebase-mapper agents using the Agent tool with `subagent_type="gsd:gsd-codebase-mapper"`, `model="{mapper_model}"`, and `run_in_background=true`.

**CRITICAL:** Use the dedicated `gsd-codebase-mapper` agent, NOT `Explore` or `browser_subagent`. The mapper agent writes documents directly.

**Agent 1: Tech Focus**

```text
Agent(
  subagent_type="gsd:gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase tech stack",
  prompt="Focus: tech
Today's date: {date}

Analyze this codebase for technology stack and external integrations.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Scope: ${PATH_SCOPE_HINT:-(full repo)} — when --paths is supplied, restrict exploration to those prefixes only.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 2: Architecture Focus**

```text
Agent(
  subagent_type="gsd:gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase architecture",
  prompt="Focus: arch
Today's date: {date}

Analyze this codebase architecture and directory structure.

Write these documents to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Scope: ${PATH_SCOPE_HINT:-(full repo)} — when --paths is supplied, restrict exploration to those prefixes only.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 3: Quality Focus**

```text
Agent(
  subagent_type="gsd:gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase conventions",
  prompt="Focus: quality
Today's date: {date}

Analyze this codebase for coding conventions and testing patterns.

Write these documents to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Scope: ${PATH_SCOPE_HINT:-(full repo)} — when --paths is supplied, restrict exploration to those prefixes only.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 4: Concerns Focus**

```
Agent(
  subagent_type="gsd:gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase concerns",
  prompt="Focus: concerns
Today's date: {date}

Analyze this codebase for technical debt, known issues, and areas of concern.

Write this document to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Scope: ${PATH_SCOPE_HINT:-(full repo)} — when --paths is supplied, restrict exploration to those prefixes only.

Explore thoroughly. Write document directly using template. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling all 4 Agent() calls above with `run_in_background=true`, do NOT read any source files, analyze the codebase, or write any mapping documents independently while the subagents are active. Wait for all 4 agents to complete before proceeding to collect_confirmations. This prevents duplicate work and wasted context.

Continue to collect_confirmations.
</step>

<step name="collect_confirmations">
Wait for all 4 agents to complete using TaskOutput tool.

**For each agent task_id returned by the Agent tool calls above:**
```
TaskOutput tool:
  task_id: "{task_id from Agent result}"
  block: true
  timeout: {subagent_timeout from init context, default 300000}
```

> The timeout is configurable via `workflow.subagent_timeout` in `.planning/config.json` (milliseconds). Default: 300000 (5 minutes). Increase for large codebases or slower models.

Call TaskOutput for all 4 agents in parallel (single message with 4 TaskOutput calls).

Once all TaskOutput calls return, read each agent's output file to collect confirmations.

**Expected confirmation format from each agent:**
```
## Mapping Complete

**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

**What you receive:** Just file paths and line counts. NOT document contents.

If any agent failed, note the failure and continue with successful documents.

Continue to verify_output.
</step>

<step name="verify_output">
Verify all documents created successfully:

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Verification checklist:**
- All 7 documents exist
- No empty documents (each should have >20 lines)

If any documents missing or empty, note which agents may have failed.

Continue to scan_for_secrets.
</step>

<step name="scan_for_secrets">
**CRITICAL SECURITY CHECK:** Scan output files for accidentally leaked secrets before committing.

Run secret pattern detection:

```bash
# Check for common API key patterns in generated docs
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**If SECRETS_FOUND=true:**

```
⚠️  SECURITY ALERT: Potential secrets detected in codebase documents!

Found patterns that look like API keys or tokens in:
[show grep output]

This would expose credentials if committed.

**Action required:**
1. Review the flagged content above
2. If these are real secrets, they must be removed before committing
3. Consider adding sensitive files to Claude Code "Deny" permissions

Pausing before commit. Reply "safe to proceed" if the flagged content is not actually sensitive, or edit the files first.
```

Wait for user confirmation before continuing to commit_codebase_map.

**If SECRETS_FOUND=false:**

Continue to commit_codebase_map.
</step>

<step name="commit_codebase_map">
Commit the codebase map:

```bash
gsd-sdk query commit "docs: map existing codebase" --files .planning/codebase/*.md
```

Continue to offer_next.
</step>

<step name="offer_next">
Present completion summary and next steps.

**Get line counts:**
```bash
wc -l .planning/codebase/*.md
```

**Output format:**

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues


---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Initialize project** — use codebase context for planning

`/clear` then:

`/bm:new-project`

---

**Also available:**
- Re-run mapping: `/bm:map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```

End workflow.
</step>

</process>

<success_criteria>
- .planning/codebase/ directory created
- 4 parallel gsd-codebase-mapper agents spawned with run_in_background=true
- All 7 codebase documents exist
- No empty documents (each should have >20 lines)
- Clear completion summary with line counts
- User offered clear next steps in GSD style
</success_criteria>
