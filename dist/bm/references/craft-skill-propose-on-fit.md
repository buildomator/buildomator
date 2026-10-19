# Craft skill propose-on-fit

A per-task check that runs at the moment a task's scope becomes known, never at session start and never per turn, so a task entering a cataloged domain surfaces the right candidate at zero cost when nothing matches. Nine surfaces call it: discuss-phase, quick, autonomous, ui-phase, secure-phase, code-review, plan-phase, debug, and verify-work. execute-phase does not run it. All nine surfaces filter the matched candidates to the target agent before anything is shown: discuss-phase, quick, and autonomous filter to bm-executor (discuss-phase records for bm-executor rather than inserting), while ui-phase, secure-phase, code-review, plan-phase, debug, and verify-work filter to their lane agent (the bm-ui-* agents, bm-security-auditor, bm-code-reviewer, bm-planner, bm-debugger, and bm-verifier) and insert into that agent instead.

## Step 1: Pre-filter (deterministic)

The surface runs the deterministic trigger pre-filter, passing the task scope as one quoted argument treated purely as data (never interpolated into another command, never used as a path):

```bash
MATCH=$(bm-sdk query craft-skill.match "<scope text>")
```

Parse `candidates`. Each candidate carries `id`, `domain`, `matched_triggers`, `publisher_label`, `license`, `obligations`, `trust_tier`, `verdict` (`allow` | `flag` | `block`), `summary`, `target_agents`, and `prompt` (an array of display lines). When `candidates` is `[]` (the common case) stop silently: nothing is shown and nothing is written.

## Step 2: Relevance (model)

For each candidate, judge relevance only, from `summary`, `domain`, and `matched_triggers` against the actual task. The model never judges safety or license; the structural gate owns that and runs on insert regardless. Drop not-relevant candidates silently. A high-confidence match means both signals agree: a trigger hit AND the model judges the candidate relevant.

## Step 3a: Interactive accept (discuss-phase, quick, ui-phase, secure-phase, code-review, plan-phase, debug, verify-work)

For each relevant candidate, show one `AskUserQuestion`. Header: `Catalog skill`. The question text renders the candidate's `prompt` lines verbatim between `DATA_START` and `DATA_END`, then one line:

```
Insert into bm-executor for this task? Nothing is written until you accept.
```

Options, in this order:

- `Accept (ephemeral, this task only)` (first, the default)
- `Accept sticky (persist for bm-executor)`
- `Skip`

In text mode (`workflow.text_mode` or `--text`) present the same as a numbered list. On `Skip`, nothing is written. On an accept, resolve a checkout (see Checkout contract), then:

```bash
bm-sdk query craft-skill.insert <id> --agent bm-executor --location <checkout> --approved
```

Add `--sticky` only for the sticky option. On `inserted:true`, remember `CRAFT_SKILL_ID=<id>` and `CRAFT_SKILL_MODE` for release.

discuss-phase does not spawn an executor, so on accept it does NOT insert. It records the acceptance in CONTEXT.md under `### Craft skills` with: id, mode, publisher label, license plus one-line obligation, trust tier, verdict, the pin line, and the ready-to-run insert command. The insert then runs in-session only on the explicit `--auto` / `--chain` chain (see chain.md) or by autonomous; a later standalone execute session relies on the recorded command.

## Step 3b: Autonomous auto-insert

Autonomous has no human per step, so a high-confidence match auto-inserts. The structural gate on insert refuses only a `block` verdict, so checking for `flag` is the surface's own responsibility. Conditions, all required:

- `verdict === 'allow'`
- relevant (an acceptance already recorded in CONTEXT.md `### Craft skills` counts as relevant)
- a checkout resolves

Command (never `--sticky` in autonomous):

```bash
bm-sdk query craft-skill.insert <id> --agent bm-executor --location <checkout> --approved
```

On success, print the run-log line exactly:

```
craft-skill: auto-inserted <id> for bm-executor (ephemeral, verdict allow, pin <first 7 of pinned_commit>) record <record_id>
```

Otherwise print the notice line exactly:

```
craft-skill: candidate <id> not inserted (<reason: verdict flag|verdict block|not relevant|no checkout at pin>); review manually
```

The pin record in `.planning/craft-skills/pins.json` plus this run-log line is the audit trail. There is no separate log file.

## Step 4: Release after the task

After the executor for that task completes:

```bash
bm-sdk query craft-skill.release --agent bm-executor --id "$CRAFT_SKILL_ID"
```

This releases ephemeral records only; sticky survives by design. Passing `--id` means another surface's ephemeral record is never cleared. Print `craft-skill: released <id> (ephemeral)` or, when the entry was sticky, `craft-skill: <id> is sticky, kept`.

## Checkout contract

Insert needs the skill source locally at the pinned commit. `--location` is either a project-relative directory containing `SKILL.md`, or `global:<skill_name>` resolving under the runtime skills dir (`~/.claude/skills/<skill_name>`). The SKILL.md frontmatter `name` must equal the catalog `skill_name`. A git checkout must sit at `pinned_commit`; a non-git copy is accepted and recorded `pin_verified:false`. This procedure fetches nothing: if no checkout resolves, show the candidate's `Pin:` line and skip the insert (interactive) or emit the notice line (autonomous). To prepare one, a user clones the `Pin:` source, checks out the pinned commit, and makes `<skill_path>` reachable as `~/.claude/skills/<skill_name>` (a symlink target must be listed in `agent_skills_security.trusted_global_roots`).

## Document deliverables

When the scope is a document deliverable (docx, pdf, pptx), there is no catalog lookup, no gate, and no accept: Claude Code's built-in first-party document skills are always available to the executor and carry no license surface. discuss-phase notes this in CONTEXT.md `<specifics>`; executors already carry the note in their project context.

## Per-surface notes

- discuss-phase: run Step 1 after `analyze_phase`, filter to `bm-executor`, record only (Step 3a records, does not insert); release is not applicable since it spawns no executor.
- quick: run Step 1 after init, filter to `bm-executor`, and before the `AGENT_SKILLS_EXECUTOR` capture (re-capture after an insert); run Step 4 release after the executor returns.
- autonomous: run Step 1 after plan verification, filter to `bm-executor`, and before the execute dispatch; run Step 4 release after execute returns.
- ui-phase: run Step 1 once the UI-SPEC focus is known and before the ui agents spawn; filter candidates to `bm-ui-researcher` and `bm-ui-checker` and substitute them for bm-executor in the accept, insert, and log lines; re-capture their agent-skills after an insert; run Step 4 release after the revision loop.
- secure-phase: run Step 1 before the auditor spawns; filter to `bm-security-auditor` and substitute it; re-capture its agent-skills after an insert; run Step 4 release after the auditor returns.
- code-review: run Step 1 in `spawn_reviewer` before the reviewer spawns; filter to `bm-code-reviewer` and substitute it; capture and inject the reviewer agent-skills (this flow carried none before); run Step 4 release on both the success and failure paths.
- plan-phase: run Step 1 at step 7.9, before the planner spawns at step 8 (covering the chunked step 8.5 path); filter to `bm-planner` and substitute it; re-capture its agent-skills after an insert so the planner prompt carries it; run Step 4 release at step 13, after the revision loop (step 12 re-spawns the planner).
- debug: run Step 1 at step 3.5, before the debug session manager spawns the lane work; filter to `bm-debugger` and substitute it; pass the bug symptom text as data only; the insert registers the skill on bm-debugger, which the session manager spawns; run Step 4 release after the session manager returns.
- verify-work: run Step 1 in the initialize step once phase data is known and before UAT verification begins; filter to `bm-verifier` and substitute it; run Step 4 release when the UAT session completes.
