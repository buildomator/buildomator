---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Upstream Resilience
status: shipped
stopped_at: v1.2 archived 2026-04-24 — milestone shipped; tags v1.2 + v2.38.4 created
last_updated: "2026-04-24T00:00:00Z"
last_activity: 2026-04-24
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility
**Current focus:** v1.2 shipped. Next action: `/gsd:new-milestone` to scope v1.3 (backlog: LIFE-02, LIFE-03, BEHAVIOR-01, UPST-03, UPST-04).

## Current Position

Milestone: v1.2 shipped (2026-04-24) — all 9 requirements satisfied, tagged, archived.
Phase: none active. v1.2 phase artifacts moved to `.planning/milestones/v1.2-phases/`.
Next action: `/gsd:new-milestone` to scope v1.3.
Last activity: 2026-05-01 — Completed quick task 260501-sun: sync upstream GSD to v1.39.0 (plugin v2.39.0, --validate verified)

```
v1.2 shipped: [==========] 100%
v1.1 shipped: [==========] 100%
v1.0 shipped: [==========] 100%
v1.3: not yet scoped
```

## Performance Metrics

**v1.0 Summary:**

| Phase | Plans | Duration | Tasks |
|-------|-------|----------|-------|
| Phase 01 | 3 | ~8min | 7 |
| Phase 02 | 2 | ~17min | 4 |
| Phase 03 | 5 | ~35min | 16 |
| **Total** | **10** | **~60min** | **27** |

**v1.2 Summary:**

| Phase | Plans | Duration | Tasks |
|-------|-------|----------|-------|
| Phase 07 | 1 | ~9min | 4 |
| Phase 08 | 1 | ~12min | 6 |
| Phase 09 | 1 | ~5min | 4 |
| **Total** | **3** | **~26min** | **14** |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
See: milestones/v1.0-ROADMAP.md for full v1.0 decision history.

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260407-1up | Sync full GSD 1.32.0 base tree into plugin layout and reapply Phase 3 improvements | 2026-04-06 | 3d0c1cc |  | [260407-1up-update-gsd-base-tree-to-latest-version-a](./quick/260407-1up-update-gsd-base-tree-to-latest-version-a/) |
| 260407-2rh | Add GSD 1.32.0 base version to README header | 2026-04-06 | ba0b3c0 |  | [260407-2rh-add-gsd-base-version-to-readme](./quick/260407-2rh-add-gsd-base-version-to-readme/) |
| 260407-4gi | Add scheduled task to check for new upstream GSD releases | 2026-04-07 | — |  | [260407-4gi-add-scheduled-task-to-check-for-new-upst](./quick/260407-4gi-add-scheduled-task-to-check-for-new-upst/) |
| 260410-0np | Draft GSD Discussions post introducing plugin packaging work | 2026-04-09 | 56f8a73 |  | [260410-0np-draft-gsd-discussions-post-introducing-p](./quick/260410-0np-draft-gsd-discussions-post-introducing-p/) |
| 260411-12i | Propose session continuity feature upstream to GSD project | 2026-04-11 | 35375e7 |  | [260411-12i-propose-session-continuity-feature-upstr](./quick/260411-12i-propose-session-continuity-feature-upstr/) |
| 260414-1lv | Update gsd-plugin to 1.35.0 upstream version | 2026-04-13 | 62ce0ca |  | [260414-1lv-update-gsd-plugin-to-1-35-0-upstream-ver](./quick/260414-1lv-update-gsd-plugin-to-1-35-0-upstream-ver/) |
| 260414-1yo | Update README to reflect v1.35.0 and add upstream sync checklist | 2026-04-13 | e3fb14e |  | [260414-1yo-update-readme-to-reflect-v1-35-0-and-ens](./quick/260414-1yo-update-readme-to-reflect-v1-35-0-and-ens/) |
| 260414-k59 | Clarify plugin commands run inside Claude Code session (install instructions for first-time users) | 2026-04-14 | 4a2f751 |  | [260414-k59-in-the-documentation-assume-people-never](./quick/260414-k59-in-the-documentation-assume-people-never/) |
| 260417-3jn | Make gsd-plugin cross-platform: fix hardcoded macOS node path, command injection, Windows tty probe, Windows path redaction | 2026-04-17 | b7dba4a |  | [260417-3jn-make-gsd-plugin-cross-platform-fix-hardc](./quick/260417-3jn-make-gsd-plugin-cross-platform-fix-hardc/) |
| 260417-wib | Integrate Opus 4.7 model and analyse gsd-2 for feature borrowing | 2026-04-17 | 97fc602 |  | [260417-wib-integrate-opus-4-7-model-and-analyse-gsd](./quick/260417-wib-integrate-opus-4-7-model-and-analyse-gsd/) |
| 260417-x1d | Investigate and fix GSD upstream release notification for 1.36.0 | 2026-04-17 | — |  | [260417-x1d-investigate-and-fix-gsd-upstream-release](./quick/260417-x1d-investigate-and-fix-gsd-upstream-release/) |
| 260417-x7a | Create system crontab for hourly GSD release check with email notification | 2026-04-18 | c36bdb5 |  | [260417-x7a-create-system-crontab-for-hourly-gsd-rel](./quick/260417-x7a-create-system-crontab-for-hourly-gsd-rel/) |
| 260418-033 | Upgrade gsd-plugin to version 1.36.0 matching upstream | 2026-04-18 | 4d14c00 |  | [260418-033-upgrade-gsd-plugin-to-version-1-36-0-mat](./quick/260418-033-upgrade-gsd-plugin-to-version-1-36-0-mat/) |
| 260418-kon | Upgrade gsd-plugin to version 1.37.1 matching upstream | 2026-04-18 | c64475b |  | [260418-kon-upgrade-gsd-plugin-to-version-1-37-1-mat](./quick/260418-kon-upgrade-gsd-plugin-to-version-1-37-1-mat/) |
| 260418-r6d | Adopt versioning scheme `plugin_major = upstream_major + 1` (bump to 2.37.1, tag, release) | 2026-04-18 | ac4c2f8 |  | [260418-r6d-align-version-tags](./quick/260418-r6d-align-version-tags/) |
| 260418-s52 | Evaluate rtk-ai/rtk for token savings — recommend companion tool, not bundle (analysis only) | 2026-04-18 | — |  | [260418-s52-rtk-integration-evaluation](./quick/260418-s52-rtk-integration-evaluation/) |
| 260418-s8i | rtk spike: install + per-command A/B — verdict: do NOT bundle/recommend (breaks gsd-code-reviewer + find pipelines) | 2026-04-18 | — |  | [260418-s8i-rtk-spike](./quick/260418-s8i-rtk-spike/) |
| 260419-lxi | Repo root cleanup — moved research artefacts into `_research/` | 2026-04-19 | — |  | [260419-lxi-repo-root-cleanup](./quick/260419-lxi-repo-root-cleanup/) |
| 260420-7js | Upgrade gsd-plugin to upstream GSD 1.38.1 (plugin v2.38.1) and publish GitHub release | 2026-04-20 | 08477e0 |  | [260420-7js-upgrade-gsd-plugin-to-version-1-38-1-mat](./quick/260420-7js-upgrade-gsd-plugin-to-version-1-38-1-mat/) |
| 260420-7tx | Include release notes body in upstream release notification mail | 2026-04-20 | c43a67c |  | [260420-7tx-cron-release-notes-in-mail](./quick/260420-7tx-cron-release-notes-in-mail/) |
| 260420-rar | Advertise auto-resume across `/compact` in README features list | 2026-04-20 | 21ee182 |  | [260420-rar-readme-autoresume-feature](./quick/260420-rar-readme-autoresume-feature/) |
| 260420-vfb | Hook commands fall back to newest cached plugin version when baked `${CLAUDE_PLUGIN_ROOT}` is pruned | 2026-04-20 | 7a80d47 |  | [260420-vfb-hook-version-fallback](./quick/260420-vfb-hook-version-fallback/) |
| 260420-cns | Rewrite `/gsd-<skill>` → `/gsd:<skill>` across plugin content (273 replacements, 100 files) | 2026-04-20 | 5dfbbd2 |  | [260420-cns-command-colon-fix](./quick/260420-cns-command-colon-fix/) |
| 260421-u38 | Upgrade gsd-plugin to upstream GSD 1.38.3 (plugin v2.38.3) and publish GitHub release | 2026-04-21 | 1c75799 |  | [260421-u38-upgrade-gsd-plugin-to-version-1-38-3-mat](./quick/260421-u38-upgrade-gsd-plugin-to-version-1-38-3-mat/) |
| 260421-rnu | Reorganize README — new-user flow (install/use/update) first; upstream-user migration content consolidated at end | 2026-04-21 | 5b5efd5 |  | [260421-rnu-readme-new-user-reorg](./quick/260421-rnu-readme-new-user-reorg/) |
| 260424-srn | Rename `skills/gsd-<name>/` → `skills/<name>/` — fixes duplicated prefix in plugin command IDs (81 renames, 22 ref updates) | 2026-04-24 | b652f55 |  | [260424-srn-skill-dir-rename](./quick/260424-srn-skill-dir-rename/) |
| 260425-mct | PostToolUse periodic checkpoint bridges Claude Code's microcompact gap (60s mtime throttle, source=auto-postool) | 2026-04-25 | 1c0ab2f |  | [260425-mct-postool-checkpoint](./quick/260425-mct-postool-checkpoint/) |
| 260425-clr | Resurface `/clear` suggestions at end-of-flow boundaries (6 skills now emit Next Up continuation blocks; references/continuation-format.md was dormant) | 2026-04-25 | e0903f7 |  | [260425-clr-clear-suggestions](./quick/260425-clr-clear-suggestions/) |
| 260425-wfd | Ship plugin-local `workflows/` dir (78 files) + rewrite all `@~/.claude/get-shit-done/*` refs to `@${CLAUDE_PLUGIN_ROOT}/*` form — closes Category B drift (genuinely-missing now 0; baseline 122/122/0) | 2026-04-25 | 8d3fbf9 |  | [260425-wfd-ship-workflows-dir](./quick/260425-wfd-ship-workflows-dir/) |
| 260425-rgw | Broaden PostToolUse matcher to also include Read/Grep/Glob/WebFetch/WebSearch (closes 18-min research-read checkpoint gap from sftp-manager incident) | 2026-04-25 | 7497cc6 |  | [260425-rgw-postool-read-tools](./quick/260425-rgw-postool-read-tools/) |
| 260421-rnu | Reorganize README — new-user flow (install/use/update) first; upstream-user migration content consolidated at end | 2026-04-21 | 5b5efd5 |  | [260421-rnu-readme-new-user-reorg](./quick/260421-rnu-readme-new-user-reorg/) |
| 260427-rat | Add `/gsd:resume-at` skill (wraps `/schedule` for future-resume) + new README "Added features beyond upstream" section; bump 2.38.7→2.38.8 | 2026-04-27 | — |  | [260427-rat-resume-at-skill](./quick/260427-rat-resume-at-skill/) |
| 260427-r6c | Replace resume-at description with concrete invocation examples | 2026-04-27 | 4cb0368 |  | [260427-r6c-replace-resume-at-skill-description-with](./quick/260427-r6c-replace-resume-at-skill-description-with/) |
| 260428-1fl | Add `bin/gsd-resume-at` shell wrapper so resume-at scheduling works without tokens (macOS, nohup+sleep+osascript) | 2026-04-28 | c166a04 |  | [260428-1fl-add-bin-gsd-resume-at-shell-wrapper-so-r](./quick/260428-1fl-add-bin-gsd-resume-at-shell-wrapper-so-r/) |
| 260501-sun | Sync upstream GSD to v1.39.0 (plugin v2.39.0): tree-copy with patch preservation in core.cjs/gsd-tools.cjs, version bumps, README/PROJECT.md/CHANGELOG updates, namespace rewrite (831 replacements across 120 files), drift-baseline regen — both gates pass | 2026-05-01 | 8b128f2 | Verified | [260501-sun-sync-upstream-gsd-to-v1-39-0-per-project](./quick/260501-sun-sync-upstream-gsd-to-v1-39-0-per-project/) |

## Session Continuity

Last session: 2026-04-24 (v1.2 archived + tagged)
Stopped at: v1.2 shipped. REQUIREMENTS.md deleted (archived to milestones/v1.2-REQUIREMENTS.md). Fresh REQUIREMENTS.md will be generated for v1.3 via `/gsd:new-milestone`.
Next action: `/gsd:new-milestone` to scope v1.3 (questioning → research → requirements → roadmap).
