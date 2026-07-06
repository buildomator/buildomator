<!-- GSD:project-start source:minimal -->
## Project

Loaded on demand by GSD commands.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:minimal -->
## Technology Stack

Loaded on demand by GSD commands.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:minimal -->
## Conventions

Loaded on demand by GSD commands.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:minimal -->
## Architecture

Loaded on demand by GSD commands.
<!-- GSD:architecture-end -->

<!-- GSD:session-continuity-start source:GSD defaults -->
## Session Continuity

If `.planning/HANDOFF.json` exists at the start of a session, a previous session was interrupted (for example by `/compact` or `/bm:pause-work`) and its state is captured there.

Run `/bm:resume-work` immediately — before anything else, without waiting for user input. The resume skill will restore context, show project status, and clean up the handoff file.

This instruction is a backup path. When the SessionStart hook fires it emits the same directive via systemMessage; either trigger is sufficient.
<!-- GSD:session-continuity-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/bm:quick` for small fixes, doc updates, and ad-hoc tasks
- `/bm:debug` for investigation and bug fixing
- `/bm:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Third-Party Contributions

When contributing a change to a repository you do not own (upstream gsd-core, VibeDrift, the workspace.json spec, or any external repo):

1. Run every feasible check first. Before proposing the change, run the target repo's tests, linters, build, and any CI-equivalent commands you can run locally, and report what passed and what could not be run.
2. Keep the patch minimal. Make the smallest diff that fixes the issue, and match the target repo's conventions, not this project's.
3. Produce a patch file. Generate a `.patch` (for example `git format-patch` or `git diff > NNNN-description.patch`) instead of pushing or opening a PR directly.
4. Hand it to the user for manual review. Surface the patch and wait for explicit approval before anything is submitted (PR, push, or a diff comment on an issue). Never auto-submit to a third-party repo.

## Generated Code Hygiene

GSD agents must never leave GSD workflow metadata in the product code they write. Code and its comments describe the code's behavior, not the GSD process that produced it. No phase/plan numbers, wave, "skeleton only", or status/housekeeping notes in product source or comments (e.g. `# Phase 1: skeleton only ...`). These are GSD bookkeeping and belong only in `.planning/` artifacts, never in the product's code, comments, or commit messages. This rule is enforced in `agents/gsd-executor.md` (the `<project_context>` block); keep the two in sync.



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/bm:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
