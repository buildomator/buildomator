<purpose>
Lightweight codebase assessment. Spawns a single gsd-codebase-mapper agent for one focus area,
producing targeted documents in `.planning/codebase/`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd:gsd-codebase-mapper — Maps project structure and dependencies
</available_agent_types>

<process>

## Arguments

| Flag | Description |
|------|-------------|
| `--drift` | Drift scan mode (mutually exclusive with --focus): runs `gsd-tools verify drift`, prints ranked markdown to stdout, no agent spawned |
| `--top N` | (drift mode) Limit report to top N findings (default 20) |
| `--fail-on-score N` | (drift mode) Pass-through hard-gate: exit 1 if composite score is below N |
| `--focus <area>` | Codebase scan focus (see table below); default `tech+arch` |

## Focus-to-Document Mapping

| Focus | Documents Produced |
|-------|-------------------|
| `tech` | STACK.md, INTEGRATIONS.md |
| `arch` | ARCHITECTURE.md, STRUCTURE.md |
| `quality` | CONVENTIONS.md, TESTING.md |
| `concerns` | CONCERNS.md |
| `tech+arch` | STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md |

## Step 1: Parse arguments and resolve focus

### 1a. --drift mode (non-agent, pure-compute: check FIRST)

If the user input contains `--drift`:

- This is a **drift scan**, not a codebase map. Do NOT validate focus, do NOT spawn `gsd-codebase-mapper`, do NOT write to `.planning/codebase/`. Mutually exclusive with `--focus`.
- Parse `--top N` (default 20) and `--fail-on-score N` (optional).
- Build the command: `gsd-tools verify drift --scope . --top {N} --json` (append `--fail-on-score {N}` only when the user supplied it).

```bash
TOP=${top:-20}
FAIL_FLAG=""
[ -n "$fail_on_score" ] && FAIL_FLAG="--fail-on-score $fail_on_score"
DRIFT_JSON=$(gsd-tools verify drift --scope . --top "$TOP" $FAIL_FLAG --json 2>&1)
```

Parse the JSON result:

- If `skipped: true`: print `drift scan skipped: {reason}` and stop.
- Otherwise: render the ranked markdown report to stdout (see format below) and stop. Do NOT continue to Step 2.

**Ranked drift report format:**

```markdown
## Drift Report

**Composite score:** {score}  |  **Findings:** {findings.length}  |  **Suppressed:** {suppressed.length}

### Findings (ranked by severity)

| # | Kind | File:Line | Severity |
|---|------|-----------|----------|
| 1 | {kind} | {file}:{line} | {severity} |
...

### Suppressed (allowlisted) pairs

These pairs were intentionally suppressed and do NOT contribute to the score.
Suppression is listed here for auditability (D-07).

| Pair | Reason |
|------|--------|
| {a} / {b} | {reason} |
```

If `suppressed.length` is 0, emit the suppressed section with a "none" row so the auditability section is always present.

Exit with the code returned by `gsd-tools verify drift` (non-zero only when `--fail-on-score` was set and the score is below the cutoff).

### 1b. --focus mode

Parse the user's input for `--focus <area>`. Default to `tech+arch` if not specified.

Validate that the focus is one of: `tech`, `arch`, `quality`, `concerns`, `tech+arch`.

If invalid:
```
Unknown focus area: "{input}". Valid options: tech, arch, quality, concerns, tech+arch
```
Exit.

## Step 2: Check for existing documents

```bash
INIT=$(gsd-sdk query init.map-codebase 2>/dev/null || echo "{}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Look up which documents would be produced for the selected focus (from the mapping table above).

For each target document, check if it already exists in `.planning/codebase/`:
```bash
ls -la .planning/codebase/{DOCUMENT}.md 2>/dev/null
```

If any exist, show their modification dates and ask:
```
Existing documents found:
  - STACK.md (modified 2026-04-03)
  - INTEGRATIONS.md (modified 2026-04-01)

Overwrite with fresh scan? [y/N]
```

If user says no, exit.

## Step 3: Create output directory

```bash
mkdir -p .planning/codebase
```

## Step 4: Spawn mapper agent

Spawn a single `gsd-codebase-mapper` agent with the selected focus area:

```
Agent(
  prompt="Scan this codebase with focus: {focus}. Write results to .planning/codebase/. Produce only: {document_list}",
  subagent_type="gsd:gsd-codebase-mapper",
  model="{resolved_model}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Agent() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

## Step 5: Report

```
## Scan Complete

**Focus:** {focus}
**Documents produced:**
{list of documents written with line counts}

Use `/bm:map-codebase` for a comprehensive 4-area parallel scan.
```

</process>

<success_criteria>
- [ ] `--drift` detected first, before focus resolution; mutually exclusive with `--focus`
- [ ] Drift mode runs `gsd-tools verify drift` (no mapper agent, no .planning/codebase/ writes)
- [ ] Drift report includes suppressed-pairs section (always present, D-07 auditability)
- [ ] `--top N` and `--fail-on-score N` parsed and passed through in drift mode
- [ ] Focus area correctly parsed (default: tech+arch) in non-drift mode
- [ ] Existing documents detected with modification dates shown
- [ ] User prompted before overwriting
- [ ] Single mapper agent spawned with correct focus
- [ ] Output documents written to .planning/codebase/
</success_criteria>
