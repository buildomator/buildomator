<purpose>
Retroactive audit of an implemented AI phase's evaluation coverage. Standalone command that works on any GSD-managed AI phase. Produces a scored EVAL-REVIEW.md with gap analysis and remediation plan.

Use after /bm:execute-phase to verify that the evaluation strategy from AI-SPEC.md was actually implemented. Mirrors the pattern of /bm:ui-review and /bm:validate-phase.
</purpose>

<required_reading>
@${CLAUDE_PLUGIN_ROOT}/references/ai-evals.md
</required_reading>

<process>

## 0. Initialize

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`.

```bash
AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-eval-auditor 2>/dev/null | jq -r '.model' 2>/dev/null || true)
```

Display banner:
```
GSD ► EVAL AUDIT — PHASE {N}: {name}
```

## 1. Detect Input State

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
EVAL_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-EVAL-REVIEW.md 2>/dev/null | head -1)
```

**State A** — AI-SPEC.md + SUMMARY.md exist: Full audit against spec
**State B** — SUMMARY.md exists, no AI-SPEC.md: Audit against general best practices
**State C** — No SUMMARY.md: Exit — "Phase {N} not executed. Run /bm:execute-phase {N} first."


**Parse flags from `$ARGUMENTS`:** `--refresh` (force re-audit, re-spawn eval-auditor), `--view` (print existing to stdout and exit).

**If `EVAL_REVIEW_FILE` non-empty AND no `--refresh` AND no `--view`:** auto-use existing. Emit a one-line notice and exit cleanly:

```
EVAL-REVIEW.md already exists for Phase {N}.
To force a fresh audit, re-invoke with --refresh.
To print the existing review, re-invoke with --view.
Path: ${EVAL_REVIEW_FILE}
```

**If `EVAL_REVIEW_FILE` non-empty AND `--view`:** display file contents, exit cleanly.

**If `EVAL_REVIEW_FILE` non-empty AND `--refresh`:** continue (re-spawn eval-auditor for a fresh audit).

**If `EVAL_REVIEW_FILE` empty:** continue (first audit run).

**If State B (no AI-SPEC.md):** Warn:
```
No AI-SPEC.md found for Phase {N}.
Audit will evaluate against general AI eval best practices rather than a phase-specific plan.
Consider running /bm:ai-integration-phase {N} before implementation next time.
```
Continue (non-blocking).

## 2. Gather Context Paths

Build file list for auditor:
- AI-SPEC.md (if exists — the planned eval strategy)
- All SUMMARY.md files in phase dir
- All PLAN.md files in phase dir

## 3. Spawn gsd-eval-auditor

```
◆ Spawning eval auditor...
```

Build prompt:

```markdown
Read ~/.claude/agents/gsd-eval-auditor.md for instructions.

<objective>
Conduct evaluation coverage audit of Phase {phase_number}: {phase_name}
{If AI-SPEC exists: "Audit against AI-SPEC.md evaluation plan."}
{If no AI-SPEC: "Audit against general AI eval best practices."}
</objective>

<files_to_read>
- {summary_paths}
- {plan_paths}
- {ai_spec_path if exists}
</files_to_read>

<input>
ai_spec_path: {ai_spec_path or "none"}
phase_dir: {phase_dir}
phase_number: {phase_number}
phase_name: {phase_name}
padded_phase: {padded_phase}
state: {A or B}
</input>
```

Spawn as Task with model `AUDITOR_MODEL`.

## 4. Parse Auditor Result

Read the written EVAL-REVIEW.md. Extract:
- `overall_score`
- `verdict` (PRODUCTION READY | NEEDS WORK | SIGNIFICANT GAPS | NOT IMPLEMENTED)
- `critical_gap_count`

## 5. Display Summary

```
GSD ► EVAL AUDIT COMPLETE — PHASE {N}: {name}

◆ Score: {overall_score}/100
◆ Verdict: {verdict}
◆ Critical Gaps: {critical_gap_count}
◆ Output: {eval_review_path}

{If PRODUCTION READY:}
  Next step: /bm:plan-phase (next phase) or deploy

{If NEEDS WORK:}
  Address critical gaps in EVAL-REVIEW.md, then re-run /bm:eval-review {N}

{If SIGNIFICANT GAPS or NOT IMPLEMENTED:}
  Review AI-SPEC.md evaluation plan. Critical eval dimensions are not implemented.
  Do not deploy until gaps are addressed.
```

## 6. Commit

**If `commit_docs` is true:**
```bash
git add "${EVAL_REVIEW_FILE}"
git commit -m "docs({phase_slug}): add EVAL-REVIEW.md — score {overall_score}/100 ({verdict})"
```

</process>

<success_criteria>
- [ ] Phase execution state detected correctly
- [ ] AI-SPEC.md presence handled (with or without)
- [ ] gsd-eval-auditor spawned with correct context
- [ ] EVAL-REVIEW.md written (by auditor)
- [ ] Score and verdict displayed to user
- [ ] Appropriate next steps surfaced based on verdict
- [ ] Committed if commit_docs enabled
</success_criteria>
