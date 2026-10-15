---
phase: quick-261015-dx1
plan: 01
subsystem: craft-skill-propose-on-fit
tags: [craft-skill, workflows, propose-on-fit, target-agents]
requires: [craft-skill.match carries target_agents, code-review.md filter pattern]
provides: [executor-lane target_agents filter in quick/discuss-phase/autonomous]
affects: [workflows/quick.md, workflows/discuss-phase.md, workflows/autonomous.md, references/craft-skill-propose-on-fit.md]
tech-stack:
  added: []
  patterns: [workflow-side node -e target_agents filter after craft-skill.match]
key-files:
  created: []
  modified:
    - workflows/quick.md
    - workflows/discuss-phase.md
    - workflows/autonomous.md
    - references/craft-skill-propose-on-fit.md
    - dist/bm/workflows/quick.md
    - dist/bm/workflows/discuss-phase.md
    - dist/bm/workflows/autonomous.md
    - dist/bm/references/craft-skill-propose-on-fit.md
decisions:
  - Filter stays workflow-side keyed to ["bm-executor"]; craft-skill.match handler untouched (candidates already carry target_agents)
metrics:
  duration: ~4min
  completed: 2026-10-15
---

# Phase quick-261015-dx1 Plan 01: Filter craft-skill candidates to bm-executor Summary

Added the workflow-side `target_agents` filter to the three executor-lane propose-on-fit surfaces (quick, discuss-phase, autonomous) so they only surface catalog candidates whose `target_agents` includes `bm-executor`, mirroring the filter already in code-review.md, ui-phase.md and secure-phase.md, and corrected the reference doc to say all six surfaces filter to the agent they spawn.

## What was built

- **Task 1:** Inserted two verbatim lines (the `# keep only candidates targeting an agent this flow spawns` comment plus the `node -e` reassignment with `A=["bm-executor"]`) directly after each file's `MATCH=$(bm-sdk query craft-skill.match ...)` line, inside the same bash fence, in workflows/quick.md (after the `"$DESCRIPTION"` match), workflows/discuss-phase.md (after the `"<domain boundary sentence>"` match), and workflows/autonomous.md (after the `"$SCOPE_TEXT"` match). The diff adds exactly two lines per file and nothing else.
- **Task 2:** Rewrote the opening-paragraph last sentence of references/craft-skill-propose-on-fit.md to state all six surfaces filter the matched candidates to the agent they spawn before anything is shown, and added a `filter to \`bm-executor\`` clause to the discuss-phase, quick and autonomous per-surface bullets. Specialist bullets and all Step sections unchanged.
- **Task 3:** Regenerated the four dist/bm twins via `node bin/build-bm.cjs`, staged exactly the 8 files, committed with no attribution trailer, and confirmed `node bin/build-bm.cjs --check` reports PASS on the clean committed tree.

## Verification (observed)

- Task 1 automated check: each workflow has exactly one match line, followed by the comment line, the `A=["bm-executor"]` filter line, then the closing fence; `A=["bm-executor"]` count is 1 per file; diff adds 0 unexpected lines; no U+2014/U+2013 on added lines.
- Task 2 automated check: old sentence gone; line 3 contains "all six", "bm-executor", "bm-code-reviewer"; `filter to \`bm-executor\`` appears 3 times; each executor-lane bullet names bm-executor; ui-phase and code-review bullets untouched; no dashes on added lines.
- Task 3 automated check: tree clean; `build-bm.cjs --check` printed PASS; commit touches exactly 8 files; 0 paths under sdk/ or bin/lib/ or plugin.json/marketplace.json; no dashes on added lines; no Co-Authored-By trailer.
- Smoke test (observed output): input with a reviewer-only candidate `x` and an executor-targeted candidate `y` returned `{"candidates":[{"id":"y","target_agents":["bm-executor","bm-code-reviewer"]}]}` (x dropped, y kept); garbage input returned `{"candidates":[]}`.

## Deviations from Plan

None - plan executed exactly as written.

## Commit

- b5efb8b: feat(quick-261015-dx1): filter craft-skill candidates to bm-executor in quick, discuss-phase, autonomous (8 files)

## Self-Check: PASSED

All 8 modified files present on disk; commit b5efb8b present in git log.
