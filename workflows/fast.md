<purpose>
Execute a trivial task inline without subagent overhead: understand → do → commit → log.
No PLAN.md, no Task spawning, no research, no plan checking.

For tasks like: fix a typo, update a config value, add a missing import, rename a
variable, commit uncommitted work, add a .gitignore entry, bump a version number.

Use /gsd:quick for anything that needs multi-step planning or research.
</purpose>

<process>

<step name="parse_task">
Parse `$ARGUMENTS` for the task description.

If empty, ask:
```
What's the quick fix? (one sentence)
```

Store as `$TASK`.
</step>

<step name="scope_check">
**Before doing anything, verify this is actually trivial.**

A task is trivial if it can be completed in:
- ≤ 3 file edits
- ≤ 1 minute of work
- No new dependencies or architecture changes
- No research needed

If the task seems non-trivial (multi-file refactor, new feature, needs research),
say:

```
This looks like it needs planning. Use /gsd:quick instead:
  /gsd:quick "{task description}"
```

And stop.
</step>

<step name="execute_inline">
Do the work directly:

1. Read the relevant file(s)
2. Make the change(s)
3. Actually RUN the relevant check yourself: the test, the build, the command, or the query the change touches. Report its real observed output (pass/fail, counts, exit status). Never report the change as done or working from code inspection alone, and never write "should work" as a substitute for running it.
   - If the change genuinely cannot be executed here (prose or prompt-only edits, needs a live host, GUI, or credentials), say so explicitly and state what WAS verified and what was NOT, rather than implying it is confirmed.

**No PLAN.md.**
</step>

<step name="commit">
Commit the change atomically:

```bash
git add -A
git commit -m "fix: {concise description of what changed}"
```

Use conventional commit format: `fix:`, `feat:`, `docs:`, `chore:`, `refactor:` as appropriate.
</step>

<step name="log_to_state">
If `.planning/STATE.md` exists, append to the "Quick Tasks Completed" table.
If the table doesn't exist, skip this step silently.

```bash
# Check if STATE.md has quick tasks table
if grep -q "Quick Tasks Completed" .planning/STATE.md 2>/dev/null; then
  # Append entry — workflow handles the format
  echo "| $(date +%Y-%m-%d) | fast | $TASK | ✅ |" >> .planning/STATE.md
fi
```
</step>

<step name="auto_memory_capture">
Run the durable-decision capture protocol in `references/auto-memory-capture.md`. Gated on
`workflow.auto_memory_capture` (default ON). Fast tasks are usually too trivial to produce a
durable decision, so this almost always writes nothing — but if the user stated a preference
or you made a non-obvious judgement call, capture ONE memory via
`gsd-tools write-decision-memory` and surface only the `Saved memory: <slug>` line. When
nothing durable emerged, write nothing and say nothing.
</step>

<step name="done">
Report completion:

```
✅ Done: {what was changed}
   Commit: {short hash}
   Files: {list of changed files}
```

No next-step suggestions or workflow routing.
</step>

</process>

<guardrails>
- NEVER spawn a Task/subagent — this runs inline
- NEVER create PLAN.md or SUMMARY.md files
- NEVER run research or plan-checking
- If the task takes more than 3 file edits, STOP and redirect to /gsd:quick
- If you're unsure how to implement it, STOP and redirect to /gsd:quick
</guardrails>

<success_criteria>
- [ ] Task completed in current context (no subagents)
- [ ] Atomic git commit with conventional message
- [ ] STATE.md updated if it exists
- [ ] Total operation under 2 minutes wall time
</success_criteria>
