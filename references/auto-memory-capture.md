# Auto-capture of durable decisions (ad-hoc close-out)

Shared protocol for `/gsd:quick`, `/gsd:debug`, and `/gsd:fast`. Run this at task
close-out so durable decisions made during ad-hoc work are saved to the auto-memory
store without the user having to type "remember". Phase work has its own capture
(`gsd-tools write-phase-memory`); this fills the gap for everything between milestones.

## Config gate

```bash
AUTO_MEM=$(gsd-sdk query config-get workflow.auto_memory_capture 2>/dev/null || echo "true")
```

If `AUTO_MEM` is `"false"`, skip this protocol entirely (no judgement, no write, no notice).
Default is ON (`true` when the key is unset).

## What counts as "durable" (be conservative — most tasks capture NOTHING)

Capture only if the task produced something a FUTURE session would want and that is NOT
already recoverable from git history, the code itself, CLAUDE.md, or the task SUMMARY:

- **user** — a fact about who the user is (role, environment, expertise, hard preference).
- **feedback** — guidance on HOW to work that should persist (a correction, a confirmed
  approach, a style rule, a "always/never do X"). Include the WHY.
- **project** — an ongoing goal, constraint, or decision-with-rationale not derivable from
  the repo (e.g. "we chose X over Y because Z", a deferred-work decision, a non-obvious
  gotcha and its resolution).
- **reference** — a durable pointer to an external resource (URL, dashboard, ticket).

Do NOT capture: routine bug fixes, mechanical edits, anything in the SUMMARY/commit already,
restating code structure, or one-off conversational context. When in doubt, do NOT write.
A typical ad-hoc task captures zero memories; a task where the user corrected you, set a
preference, or you made a non-obvious judgement call captures one.

## Dedup first

Read the index before writing: `<auto-memory>/MEMORY.md` (resolve the dir with
`gsd-tools write-decision-memory` itself, or read the path the command reports). If the
decision refines or supersedes an existing memory, reuse that memory's slug so the command
updates it in place instead of creating a near-duplicate. Link related memories from the
body with `[[other-slug]]`.

## Write it

Compose the memory BODY (markdown, no frontmatter — the command adds frontmatter) to a temp
file, then call the command. For `feedback`/`project` memories, follow the body with
`**Why:**` and `**How to apply:**` lines.

```bash
# Body goes to a temp file (Write tool), then:
gsd-tools write-decision-memory \
  --slug <kebab-or-snake-case-slug> \
  --title "<Short Title>" \
  --description "<one-line hook used for recall>" \
  --type <user|feedback|project|reference> \
  --body-file <temp-path>
```

The command resolves the correct auto-memory path (handles worktree-shared and remote
memory dirs), writes `<slug>.md` idempotently, and flat-indexes it in `MEMORY.md`. On
success it prints `Saved memory: <slug>` — surface that one line to the user and nothing
more. If nothing durable emerged, write nothing and say nothing.
