<purpose>
Retroactive 6-pillar visual audit of implemented frontend code. Standalone command that works on any project — GSD-managed or not. Produces scored UI-REVIEW.md with actionable findings.
</purpose>

<required_reading>
@${CLAUDE_PLUGIN_ROOT}/references/ui-brand.md
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- bm:gsd-ui-auditor — Audits UI against design requirements
</available_agent_types>

<process>

## 0. Initialize

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI_REVIEWER=$(gsd-sdk query agent-skills gsd-ui-auditor)
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`.

```bash
UI_AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-ui-auditor --raw)
```

Display heading: `GSD ► UI AUDIT — PHASE {N}: {name}`

## 1. Detect Input State

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-UI-REVIEW.md 2>/dev/null | head -1)
```

**If `SUMMARY_FILES` empty:** Exit — "Phase {N} not executed. Run /bm:execute-phase {N} first."


**Parse flags from `$ARGUMENTS`:** `--refresh` (force re-audit, re-spawn ui-auditor), `--view` (print existing to stdout and exit).

**If `UI_REVIEW_FILE` non-empty AND no `--refresh` AND no `--view`:** auto-use existing. Emit a one-line notice and exit cleanly:

```
UI-REVIEW.md already exists for Phase {N}.
To force a fresh audit, re-invoke with --refresh.
To print the existing review, re-invoke with --view.
Path: ${UI_REVIEW_FILE}
```

**If `UI_REVIEW_FILE` non-empty AND `--view`:** display file contents, exit cleanly.

**If `UI_REVIEW_FILE` non-empty AND `--refresh`:** continue (re-spawn ui-auditor for a fresh audit).

**If `UI_REVIEW_FILE` empty:** continue (first audit run).

## 2. Gather Context Paths

Build file list for auditor:
- All SUMMARY.md files in phase dir
- All PLAN.md files in phase dir
- UI-SPEC.md (if exists — audit baseline)
- CONTEXT.md (if exists — locked decisions)

## 3. Spawn gsd-ui-auditor

```
◆ Spawning UI auditor...
```

Build prompt:

```markdown
Read ~/.claude/agents/gsd-ui-auditor.md for instructions.

<objective>
Conduct 6-pillar visual audit of Phase {phase_number}: {phase_name}
{If UI-SPEC exists: "Audit against UI-SPEC.md design contract."}
{If no UI-SPEC: "Audit against abstract 6-pillar standards."}
</objective>

<files_to_read>
- {summary_paths} (Execution summaries)
- {plan_paths} (Execution plans — what was intended)
- {ui_spec_path} (UI Design Contract — audit baseline, if exists)
- {context_path} (User decisions, if exists)
</files_to_read>

${AGENT_SKILLS_UI_REVIEWER}

<config>
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omit null file paths.

```
Agent(
  prompt=ui_audit_prompt,
  subagent_type="bm:gsd-ui-auditor",
  model="{UI_AUDITOR_MODEL}",
  description="UI Audit Phase {N}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Agent() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

## 4. Handle Return

**If `## UI REVIEW COMPLETE`:**

Display score summary:

```
GSD ► UI AUDIT COMPLETE ✓

**Phase {N}: {Name}** — Overall: {score}/24

| Pillar | Score |
|--------|-------|
| Copywriting | {N}/4 |
| Visuals | {N}/4 |
| Color | {N}/4 |
| Typography | {N}/4 |
| Spacing | {N}/4 |
| Experience Design | {N}/4 |

Top fixes:
1. {fix}
2. {fix}
3. {fix}

Full review: {path to UI-REVIEW.md}

───────────────────────────────────────────────────────────────

## ▶ Next

`/clear` then one of:

- `/bm:verify-work {N}` — UAT testing
- `/bm:plan-phase {N+1}` — plan next phase

───────────────────────────────────────────────────────────────
```

## Automated UI Verification (when Playwright-MCP is available)

If `mcp__playwright__*` tools are accessible in this session:

1. Navigate to each UI component described in the phase's UI-SPEC.md using
   `mcp__playwright__navigate` (or equivalent Playwright-MCP tool).
2. Take a screenshot of each component using `mcp__playwright__screenshot`.
3. Compare against the spec's visual requirements — dimensions, color palette,
   layout, spacing scale, and typography.
4. Report any dimension, color, or layout discrepancies automatically as
   additional findings within the relevant pillar section of UI-REVIEW.md.
5. Flag items that require human judgment (brand feel, content tone) as
   `needs_human_review: true` in the findings — surfaced to the user separately
   after the automated pass completes.

If Playwright-MCP is not available, skip this section and fall back to the standard code-only review above. Availability of `mcp__playwright__*` is detected at runtime; no configuration change required.

## 5. Commit (if configured)

```bash
gsd-sdk query commit "docs(${padded_phase}): UI audit review" --files "${PHASE_DIR}/${PADDED_PHASE}-UI-REVIEW.md"
```

</process>

<success_criteria>
- [ ] Phase validated
- [ ] SUMMARY.md files found (execution completed)
- [ ] Existing review handled (re-audit/view)
- [ ] gsd-ui-auditor spawned with correct context
- [ ] UI-REVIEW.md created in phase directory
- [ ] Score summary displayed to user
- [ ] Next steps presented
</success_criteria>
