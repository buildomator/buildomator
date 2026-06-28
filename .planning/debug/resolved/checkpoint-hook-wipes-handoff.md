---
status: resolved
trigger: "GitHub issue #17 — PostToolUse periodic-checkpoint hook destructively overwrites .planning/HANDOFF.json with an empty skeleton in idle GSD projects, and creates .planning/HANDOFF.json in directories that are not GSD projects at all. Reported against v4.0.0 by alperkaganavci."
created: 2026-06-28
updated: 2026-06-28
github_issue: 17
---

## Symptoms

**Expected:** The PostToolUse periodic-checkpoint hook should only persist a HANDOFF when there is real work to resume. It must NOT (a) blank out an existing hand-authored HANDOFF.json in an idle GSD project, nor (b) create `.planning/HANDOFF.json` (and a `.planning/` dir) in a directory that is not a GSD project.

**Actual:**
1. In an idle GSD project (no active phase/task in STATE.md), the hook overwrites `.planning/HANDOFF.json` with a `phase:null / task:null` skeleton, destroying any existing content.
2. In a non-GSD directory (no `.planning/`), the hook creates a brand-new `.planning/HANDOFF.json` out of nothing.

**Error messages:** None. Silent data loss + unwanted file/dir creation.

**Timeline:** Present in v4.0.0. The PostToolUse periodic checkpoint shipped as quick task 260425-mct (60s mtime throttle) and was broadened to Read/Grep/Glob/WebFetch/WebSearch in 260425-rgw. Runs after most tool calls (Bash|Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Glob|WebFetch|WebSearch), throttled to once / 60s.

**Reproduction:** Any session with tool activity. Confirmed FIRSTHAND this session: at session start `.planning/HANDOFF.json` existed with all-null fields (`phase:null, task:null, status:"auto-checkpoint", source:"auto-postool", partial:true`) and was deleted as stale — that was this hook firing on the idle project at the prior session's start.

## Current Focus

hypothesis: `writeCheckpoint()` in `bin/lib/checkpoint.cjs` (~line 366) unconditionally ensures `.planning/` exists (creating it in non-GSD dirs) and writes HANDOFF.json even when STATE.md has no active phase/task, so the PostToolUse handler (`gsd-tools.cjs hook post-tool-use`) persists an empty skeleton instead of no-op'ing.
test: trace the post-tool-use command handler in gsd-tools.cjs and writeCheckpoint(); check for any guard on (a) pre-existing `.planning/` and (b) an active phase/task before writing.
expecting: no guard exists, OR the guard is on the wrong condition (e.g. checks `.planning` existence AFTER already creating it).
next_action: gather evidence from bin/gsd-tools.cjs post-tool-use case + bin/lib/checkpoint.cjs writeCheckpoint(), and the SessionStart trivial-handoff guard (260529-g58) which may already encode the "is this skeleton trivial" logic to reuse.

## Evidence

- timestamp: 2026-06-28 — hooks/hooks.json PostToolUse runs `gsd-tools.cjs hook post-tool-use` after Bash|Edit|Write|MultiEdit|NotebookEdit|Read|Grep|Glob|WebFetch|WebSearch.
- timestamp: 2026-06-28 — checkpoint.cjs writeCheckpoint() (line ~366) comment "Ensure .planning/ exists (it should, but be safe)" indicates it mkdir's `.planning/` rather than treating its absence as a non-GSD-project signal to skip.
- timestamp: 2026-06-28 — firsthand repro: session opened with an all-null `auto-postool` HANDOFF.json on an idle project.

## Eliminated

(none yet)

## Eliminated

- hypothesis: guard might exist in gsd-tools.cjs post-tool-use handler
  evidence: handler only has a 60s mtime throttle; no guard on .planning/ existence or trivial data
  timestamp: 2026-06-28

## Specialist Review

specialist: engineering:debug (hint: general)
verdict: LOOKS_GOOD
- Guard (a) sound: fs.existsSync(planningDirPath) checked before any write or mkdir; non-GSD dirs never touched.
- Guard (b) reliable: data.phase is set in generateCheckpoint() only when STATE.md has a parseable non-null Phase number; data.task only when a Task field parses. Idle/no-STATE.md correctly yields phase:null/task:null and triggers the guard; active work writes a real phase so the write proceeds.
- Call-site audit complete: only automatic callers are auto-postool and auto-compact (both gsd-tools.cjs). check-handoff-schema.cjs and the cmdCheckpoint CLI use manual-pause by design.
- Observation (addressed): original allow-list (source === 'auto-postool' || 'auto-compact') would let a future auto-* source silently bypass guard (b). Hardened to a deny-list (everything except manual-pause is treated as automatic). Tests re-run: 8/8 + 6/6 still pass.

## Resolution

root_cause: writeCheckpoint() in bin/lib/checkpoint.cjs unconditionally mkdir'd .planning/ when absent (creating it in non-GSD dirs) and wrote HANDOFF.json regardless of whether the checkpoint had any real work to persist (phase:null, task:null). The PostToolUse handler's only guard was a 60s mtime throttle, which did not prevent either (a) creation of .planning/ in non-GSD directories or (b) silent overwrite of hand-authored HANDOFF.json with empty skeletons in idle GSD projects.
fix: Added two early-return guards in writeCheckpoint() before any mkdir or write: (a) if planningDir does not exist, return early -- cwd is not a GSD project; (b) if source is anything other than manual-pause and data.phase and data.task are both null, return early -- trivial checkpoint would destroy hand-authored content. manual-pause bypasses guard (b) so explicit /gsd:pause-work still works on idle projects. Guard (b) uses a deny-list (post specialist review) so any future automatic source is guarded by default.
verification: New test suite tests/checkpoint-write-guards.test.cjs (8/8 PASS). Existing tests/session-start-skip-trivial-handoff.test.cjs (6/6 PASS, no regression).
files_changed: [bin/lib/checkpoint.cjs, tests/checkpoint-write-guards.test.cjs]
