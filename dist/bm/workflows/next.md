<purpose>
Detect current project state and automatically advance to the next logical GSD workflow step.
Reads project state to determine: discuss → plan → execute → verify → complete progression.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="detect_state">
Read project state to determine current position:

```bash
gsd-sdk query state.json 2>/dev/null || echo "{}"
```

Also read:
- `.planning/STATE.md` — current phase, progress, plan counts
- `.planning/ROADMAP.md` — milestone structure and phase list

Extract:
- `current_phase` — which phase is active
- `plan_of` / `plans_total` — plan execution progress
- `progress` — overall percentage
- `status` — active, paused, etc.

If no `.planning/` directory exists:
```
No GSD project detected. Run `/bm:new-project` to get started.
```
Exit.
</step>

<step name="safety_gates">
Run hard-stop checks before routing. Exit on first hit unless `--force` was passed.

If `--force` flag was passed, skip all gates and the consecutive guard.
Print a one-line warning: `⚠ --force: skipping safety gates`
Then proceed directly to `determine_next_action`.

**Gate 1: Unresolved checkpoint**
Check if `.planning/.continue-here.md` exists:
```bash
[ -f .planning/.continue-here.md ]
```
If found:
```
⛔ Hard stop: Unresolved checkpoint

`.planning/.continue-here.md` exists — a previous session left
unfinished work that needs manual review before advancing.

Read the file, resolve the issue, then delete it to continue.
Use `--force` to bypass this check.
```
Exit (do not route).

**Gate 2: Error state**
Check if STATE.md contains `status: error` or `status: failed`:
If found:
```
⛔ Hard stop: Project in error state

STATE.md shows status: {status}. Resolve the error before advancing.
Run `/bm:health` to diagnose, or manually fix STATE.md.
Use `--force` to bypass this check.
```
Exit.

**Gate 3: Unchecked verification**
Check if the current phase has a VERIFICATION.md with any `FAIL` items that don't have overrides:
If found:
```
⛔ Hard stop: Unchecked verification failures

VERIFICATION.md for phase {N} has {count} unresolved FAIL items.
Address the failures or add overrides before advancing to the next phase.
Use `--force` to bypass this check.
```
Exit.

**Prior-phase completeness scan:**
After passing all three hard-stop gates, scan all phases preceding the current phase in ROADMAP.md order. For each prior phase number `N`, use `gsd-sdk query find-phase <N>` JSON (plans, summaries, incomplete_plans, etc.) to inspect it.

Detect three categories of incomplete work:
1. **Plans without summaries** — a PLAN.md exists in a prior phase directory but no matching SUMMARY.md exists (execution started but not completed).
2. **Verification failures not overridden** — a prior phase has a VERIFICATION.md with `FAIL` items that have no override annotation.
3. **CONTEXT.md without plans** — a prior phase directory has a CONTEXT.md but no PLAN.md files (discussion happened, planning never ran).

If no incomplete prior work is found, continue to `determine_next_action` silently with no interruption.

If incomplete prior work is found, show a structured completeness report:
```
⚠ Prior phase has incomplete work

Phase {N} — "{name}" has unresolved items:
  • Plan {N}-{M} ({slug}): executed but no SUMMARY.md
  [... additional items ...]

Advancing before resolving these may cause:
  • Verification gaps — future phase verification won't have visibility into what prior phases shipped
  • Context loss — plans that ran without summaries leave no record for future agents

Options:
  [C] Continue and defer these items to backlog
  [S] Stop and resolve manually (recommended)
  [F] Force advance without recording deferral

Choice [S]:
```

**If the user chooses "Stop" (S or Enter/default):** Exit without routing.

**If the user chooses "Continue and defer" (C):**
1. For each incomplete item, create a backlog entry in `ROADMAP.md` under `## Backlog` using the existing `999.x` numbering scheme:
```markdown
### Phase 999.{N}: Follow-up — Phase {src} incomplete plans (BACKLOG)

**Goal:** Resolve plans that ran without producing summaries during Phase {src} execution
**Source phase:** {src}
**Deferred at:** {date} during /bm:progress --next advancement to Phase {dest}
**Plans:**
- [ ] {N}-{M}: {slug} (ran, no SUMMARY.md)
```
2. Commit the deferral record:
```bash
gsd-sdk query commit "docs: defer incomplete Phase {src} items to backlog"
```
3. Continue routing to `determine_next_action` immediately — no second prompt.

**If the user chooses "Force" (F):** Continue to `determine_next_action` without recording deferral.
</step>

<step name="resume_incomplete_phase">
**Hard invariant: any phase with PLAN.md files lacking matching SUMMARY.md files must be completed before /bm:next routes to any forward action.** This catches the failure mode where a session died mid-execution and STATE.md's `current_phase` advanced past the phase with unfinished work; without this gate, `/bm:next` would route by `current_phase` and skip the partially-executed phase.

**Skip if `--force` or `--no-resume` was passed.**

Scan ALL phases in ROADMAP order (lowest to highest) for incomplete-execution state. Use `gsd-sdk query roadmap.analyze` to get the phase list, then for each phase number `N` query `gsd-sdk query find-phase <N>` JSON and inspect its `plans` and `summaries` arrays. A phase is **incomplete-execution** when at least one entry in `plans` has no matching SUMMARY.md (i.e., `plans.length > summaries.length`, or `incomplete_plans` array is non-empty if the find-phase JSON exposes that directly).

Stop at the first such phase. Record its phase number as `INCOMPLETE_PHASE` (the lowest-numbered phase needing continued execution).

Illustrative bash:

```bash
INCOMPLETE_PHASE=""
PHASES=$(gsd-sdk query roadmap.analyze --pick phases 2>/dev/null)
for PHASE_NUM in $(echo "$PHASES" | jq -r '.[].number // .[].phase_number // empty'); do
  PHASE_JSON=$(gsd-sdk query find-phase "$PHASE_NUM" 2>/dev/null)
  [ -z "$PHASE_JSON" ] && continue
  PLAN_COUNT=$(echo "$PHASE_JSON" | jq '(.plans // []) | length')
  SUMMARY_COUNT=$(echo "$PHASE_JSON" | jq '(.summaries // []) | length')
  if [ "${PLAN_COUNT:-0}" -gt "${SUMMARY_COUNT:-0}" ]; then
    INCOMPLETE_PHASE="$PHASE_NUM"
    break
  fi
done
```

**If `INCOMPLETE_PHASE` is non-empty:** route to `/bm:execute-phase $INCOMPLETE_PHASE` and exit. Display a one-line notice before invoking:

```
▶ Resuming incomplete Phase ${INCOMPLETE_PHASE} (plans without summaries detected)
  /bm:execute-phase ${INCOMPLETE_PHASE}
  (use --no-resume to skip this check and defer via the prior-phase prompt; --force to skip both)
```

Then invoke via SlashCommand. Do not continue to subsequent steps.

**If `INCOMPLETE_PHASE` is empty:** continue to `resume_partial_uat`.

**Why Route 0, not part of `determine_next_action`:** it's a hard invariant independent of `current_phase`, so it must run before any routing rule that reads `current_phase`. The prior-phase-scan in `safety_gates` remains the explicit opt-out path (via `--no-resume`) for deferring incomplete plans to backlog; this Route 0 makes the no-flag default "continue the partially-executed phase" instead of "stop and ask."
</step>

<step name="resume_partial_uat">
**Hard invariant (Route 0.5): any phase with a started-but-unfinished UAT (`{phase}-UAT.md` with `status: testing` or `status: partial`) must be finished before /bm:next routes to any forward action.** This catches the failure mode where a UAT was interrupted by a detour (a bug surfaced -> `/bm:quick`, feature requests -> `/bm:add-phase` / `/bm:explore`) and `current_phase` advanced past it; without this gate the partial UAT goes silently incomplete and is found out late. Runs AFTER the execution invariant (finish executing, then finish verifying) and BEFORE any `current_phase`-based routing.

**Skip if `--force` or `--no-resume` was passed.**

Scan all phases for an unfinished UAT, lowest phase first. `diagnosed` (UAT done, gaps found) is NOT included here — that routes to gap-closure via `determine_next_action`, not a UAT resume:

```bash
PARTIAL_UAT_FILE=$(grep -lE '^status:[[:space:]]*(testing|partial)[[:space:]]*$' .planning/phases/*/*-UAT.md 2>/dev/null | sort | head -1)
PARTIAL_UAT_PHASE=""
[ -n "$PARTIAL_UAT_FILE" ] && PARTIAL_UAT_PHASE=$(basename "$PARTIAL_UAT_FILE" | grep -oE '^[0-9]+(\.[0-9]+)?')
```

**If `PARTIAL_UAT_PHASE` is non-empty:** route to `/bm:verify-work $PARTIAL_UAT_PHASE` and exit. Display a one-line notice before invoking:

```
▶ Resuming unfinished UAT for Phase ${PARTIAL_UAT_PHASE} (verification was interrupted)
  /bm:verify-work ${PARTIAL_UAT_PHASE}
  (use --no-resume to skip and route forward; --force to skip all resume gates)
```

Then invoke via SlashCommand. Do not continue to subsequent steps.

**If `PARTIAL_UAT_PHASE` is empty:** continue to `spike_sketch_notice`.
</step>

<step name="spike_sketch_notice">
Check for pending spike/sketch work and surface a notice (does not change routing):

```bash
# Pending spikes (verdict: PENDING) and sketches (winner: null)
PENDING_SPIKES=$(grep -rl 'verdict: PENDING' .planning/spikes/*/README.md 2>/dev/null | wc -l | tr -d ' ')
PENDING_SKETCHES=$(grep -rl 'winner: null' .planning/sketches/*/README.md 2>/dev/null | wc -l | tr -d ' ')
```

If either count is > 0, display before routing:
```
⚠ Pending exploratory work:
  {PENDING_SPIKES} spike(s) with unresolved verdicts in .planning/spikes/
  {PENDING_SKETCHES} sketch(es) without a winning variant in .planning/sketches/

  Resume with `/bm:spike` or `/bm:sketch`, or continue with phase work below.
```

Only show lines for non-zero counts. If both are 0, skip this notice entirely.
</step>

<step name="determine_next_action">
Apply routing rules based on state:

**Route 1: No phases exist yet → discuss**
If ROADMAP has phases but no phase directories exist on disk:
→ Next action: `/bm:discuss-phase <first-phase>`

**Route 2: Phase exists but has no CONTEXT.md or RESEARCH.md → discuss**
If the current phase directory exists but has neither CONTEXT.md nor RESEARCH.md:
→ Next action: `/bm:discuss-phase <current-phase>`

**Route 3: Phase has context but no plans → plan**
If the current phase has CONTEXT.md (or RESEARCH.md) but no PLAN.md files:
→ Next action: `/bm:plan-phase <current-phase>`

**Route 4: Phase has plans but incomplete summaries → execute**
If plans exist but not all have matching summaries:
→ Next action: `/bm:execute-phase <current-phase>`

**Route 5: All plans have summaries → verify and complete**
If all plans in the current phase have summaries:
→ Next action: `/bm:verify-work`

**Route 6: Phase complete, next phase exists → advance**
If the current phase is complete and the next phase exists in ROADMAP:
→ Next action: `/bm:discuss-phase <next-phase>`

**Route 7: All phases complete → complete milestone**
If all phases are complete:
→ Next action: `/bm:complete-milestone`
(If the milestone is code-complete but a prior milestone was never formally closed, do not ask the user how to sequence it. Close the prior one first, then proceed, and report the call. That is GSD-internal mechanics; see `references/gate-prompts.md` Rules.)

**Route 8: Paused → resume**
If STATE.md shows paused_at:
→ Next action: `/bm:resume-work`
</step>

<step name="show_and_execute">
Display the determination:

```
## GSD Next

**Current:** Phase [N] — [name] | [progress]%
**Status:** [status description]

▶ **Next step:** `/gsd-[command] [args]`
  [One-line explanation of why this is the next step]
```

Then immediately invoke the determined command via SlashCommand.
Do not ask for confirmation — `/bm:progress --next` is zero-friction advancement.
</step>

</process>

<success_criteria>
- [ ] Project state correctly detected
- [ ] Route 0 (resume_incomplete_phase) fires before any other routing when any phase has plans without summaries, unless `--force` or `--no-resume` was passed
- [ ] Next action correctly determined from routing rules
- [ ] Command invoked immediately without user confirmation
- [ ] Clear status shown before invoking
</success_criteria>
