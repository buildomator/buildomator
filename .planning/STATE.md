---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: Buildomator Rebrand
status: executing
stopped_at: Phase 14 context gathered
last_updated: "2026-07-11T18:03:57.569Z"
last_activity: 2026-07-10 -- Phase 13 execution started
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 6
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-29)

**Core value:** Reduce GSD's per-turn token overhead and agent spawn latency without breaking multi-CLI compatibility
**Current focus:** Phase 13 — buildomator-plugin

## Current Position

Phase: 13 (buildomator-plugin) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 13
Last activity: 2026-07-10 -- Phase 13 execution started

Progress: [░░░░░░░░░░] 0% (0/4 phases)

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
| Phase 11 P01 | 245s | 3 tasks | 2 files |
| Phase 11 P03 | 127s | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
See: milestones/v1.0-ROADMAP.md for full v1.0 decision history.

- [Phase ?]: Used npm view @vibedrift/cli version as the authoritative version source for the second-upstream watch; GitHub release notes are best-effort (guarded || exit 0)
- [2026-06-29 roadmap]: Phase sequencing — BUILD foundation (Phase 12) before BM plugin (Phase 13) before coexistence testing (Phase 14); BRAND (Phase 15) last since it documents what shipped. Rationale: two-plugin generation must exist before both plugins can be tested together.

### Pending Todos

4 pending (see `.planning/todos/pending/`):

- Add more programming language rule packs for the naming-drift/convention checks (tooling; extends Phase 10 D-05)
- Convert "(Recommended)"-default rubber-stamp prompts into announced auto-actions
- Collapse plan-phase's two upstream-artifact dead-ends into auto-chaining
- auto_advance default-on (context-aware) + auto-escalate blocking gaps

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
| 260502-0h9 | Sync upstream GSD to v1.39.1 (plugin v2.39.1): hotfix bundle (~12 PRs incl. #2917 raw agent_skills, #2942 skills/ in GSD_MANAGED_DIRS, #2924 worktree HEAD assertion); core.cjs untouched upstream so patches kept verbatim, gsd-tools.cjs 1-line merge clean, namespace rewrite 820 replacements across 119 files, drift-baseline matched exactly (no regen) — both gates pass | 2026-05-02 | 1a4996c |  | [260502-0h9-address-another-upstream-version-jump](./quick/260502-0h9-address-another-upstream-version-jump/) |
| 260502-rx0 | Surface rate-limit fallback example (/exit + gsd-resume-at HH:MM) at 3 surfaces: new Stop hook in gsd-tools.cjs that tails transcript and prints bordered hint on rate-limit pattern, /exit-first example added to resume-at SKILL.md No-token fallback callout, same example added to gsd-resume-at wrapper head comment + usage() — drift gates clean | 2026-05-02 | 364ae58 |  | [260502-rx0-surface-rate-limit-fallback-example-for-](./quick/260502-rx0-surface-rate-limit-fallback-example-for-/) |
| 260503-ier | Sync upstream GSD v1.40.0 + bump plugin to v2.40.0 | 2026-05-03 | 8af38a3 |  | [260503-ier-1-40-0-is-release-upstream-update-gsd-pl](./quick/260503-ier-1-40-0-is-release-upstream-update-gsd-pl/) |
| 260507-esn | Sync upstream GSD v1.41.0 + bump plugin to v2.41.0 (incl. MVP-phase workflow, 8 new MVP/SPIDR refs, runtime-homes helper, extract_learnings rename); MCP stdio framing fix released as v2.40.2 with regression test in CI (closes #3) | 2026-05-07 | 69e3843 | Verified | [260507-esn-there-is-a-new-upstream-version-see-what](./quick/260507-esn-there-is-a-new-upstream-version-see-what/) |
| 260510-141 | Sync upstream GSD v1.41.1 + bump plugin to v2.42.2 (wave-0 plan-index fix, shared model-catalog convergence #3230, code-review pipeline hardening, dotted-command-form shim, install fixes); new plugin patch in bin/lib/model-catalog.cjs for flat layout (#PLUGIN-MODEL-CATALOG-PATH) | 2026-05-10 | b1425b1 | Verified | (no quick dir — inline sync) |
| 260510-ws  | Workspace.json SessionStart integration (issue #5, PR #6 by @qmarcelle); released as v2.42.3 with zero-token-impact convention locked into project design rules | 2026-05-10 | 9ffa947 | Verified | (PR-driven) |
| 260511-142 | Sync upstream GSD v1.41.2 + bump plugin to v2.42.4 (state-mutation data-loss fixes, verifier TBD/probe hardening, executor stall detection, phase remove renumbering, Codex/Gemini install hardening); #PLUGIN-MODEL-CATALOG-PATH evolved to fold into upstream's new candidate list | 2026-05-11 | 067308a | Verified | (no quick dir — inline sync) |
| 260513-2zg | Pull 8 upstream security/correctness hook scripts into plugin (prompt-guard, workflow-guard, read-guard, read-injection-scanner, validate-commit, phase-boundary, context-monitor, session-state) + lib/git-cmd.js; first-ship soft-warn; `#PLUGIN-HOOK-CONTEXT-MONITOR` layout patch; smoke tests; bump 2.42.5→2.42.6 | 2026-05-13 | 346d517 |  | [260513-2zg-audit-upstream-hooks-tree-and-pull-in-se](./quick/260513-2zg-audit-upstream-hooks-tree-and-pull-in-se/) |
| 260515-f2d | Sync upstream GSD v1.42.2 (latest stable, published 2026-05-15) into plugin tree; bump 2.42.6→2.43.0; 4 in-tree plugin patches re-applied; SDK probe consolidated into `legacyAssetProbes` (upstream restructured CLAUDE_PLUGIN_ROOT detection); hooks refresh limited to gsd-context-monitor.js + gsd-workflow-guard.js; commands/ exclusion preserved; 90 workflows + 33 agents synced; sdk/dist/cli.js rebundled (1.6MB, 3 CLAUDE_PLUGIN_ROOT matches); /gsd-X → /gsd:X normalization across 28 workflows; one over-match bug found by verifier and patched (gsd-build URL in update.md) | 2026-05-15 | 928a160 | Verified (gaps_found, both fixed) | [260515-f2d-new-upstream-version](./quick/260515-f2d-new-upstream-version/) |
| 260515-vrk | v2.43.1 hotfix, SessionStart hook gsd-shadowing-sdk-detector.js detects pre-v2.42.0 global gsd-sdk shadowing the plugin's bundled wrapper in PATH (root cause of agents_installed: false in /gsd:new-project for users with legacy npm install of @gsd-build/sdk or get-shit-done-cc); 3 new hooks-smoke sub-cases (16/16); cross-platform PATH walker with symlink resolution; uninstalled the legacy global on the maintainer's machine as immediate fix | 2026-05-15 | f5fa004 | Verified | (inline hotfix, no quick dir) |
| 260515-ndo | v2.43.2 docs hotfix, README now has a Pre-install subsection with which-gsd-sdk diagnostic + npm uninstall recipe + forward reference to the v2.43.1 detector hook; replaces the misleading No prerequisites claim that downplayed shadowing globals as no breakage; layered defense pairing docs warning + runtime detector | 2026-05-17 | e43968c | Verified | (inline hotfix, no quick dir) |
| 260517-fpp | Sync upstream GSD v1.42.3 (hotfix patch, published 2026-05-16) into plugin tree; bump 2.43.2→2.43.3; 4 in-tree patches + 2 SDK source patches + consolidated probe survive (5/6 auto-surviving this cycle, only bin/lib/core.cjs surgical re-apply); upstream hooks/ unchanged this cycle so plugin hooks tree untouched; commands/ exclusion preserved; 5 agents + 8 bin/lib + 8 sdk/src + 4 workflows refreshed; sdk/dist/cli.js rebundled (1.66MB, 3 CLAUDE_PLUGIN_ROOT matches); Task 5 namespace rewrite skipped, all 29 detected /gsd-X hits classified as false positives (agent .md paths, /tmp paths, github.com URLs, deliberate negative refs to removed commands); regression trifecta 16/16 incl. v2.43.1 detector | 2026-05-17 | 3b3557c | Verified | [260517-fpp-sync-upstream-v1-42-3](./quick/260517-fpp-sync-upstream-v1-42-3/) |
| 260522-wop | Verify upstream changes in new upstream (open-gsd/get-shit-done-redux) vs last followed v1.42.3 (gsd-build/get-shit-done): 290 commits ahead, 300+ files changed, 117 fix / 25 test / 23 feat / 20 chore / 14 refactor commit-type distribution; 3 plugin-patched lib files affected (core.cjs/model-catalog.cjs/phase.cjs); case-insensitive patch retires on next sync (upstream PR #88 supersedes); 6 new modules to fold in (prompt-budget, runtime-artifact-layout, cjs-sdk-bridge, command-routing-hub, 2 generated configs); 45 workflows + 9 agents modified; 41 "behind" commits explained as migration rebase, not missing functionality; no urgency to sync, wait for first redux release | 2026-05-22 |  |  | [260522-wop-verify-upstream-changes-vs-last-followed](./quick/260522-wop-verify-upstream-changes-vs-last-followed/) |
| 260529-3l0 | v2.45.1 routine model bump: default Opus moves from `claude-opus-4-7` to `claude-opus-4-8` across the four Anthropic-compatible runtimes (claude, opencode, copilot, hermes) in `sdk/shared/model-catalog.json` + `workflows/settings-advanced.md` table + `workflows/execute-phase.md:76` example + README features table + CHANGELOG; pricing parity with 4.7; sonnet and haiku untouched; non-Anthropic runtimes (codex/gemini/qwen) untouched; test fixtures pinning historical IDs untouched; effort-control + fast-mode integration deferred to a separate feature tracked upstream as open-gsd/get-shit-done-redux#443 | 2026-05-29 | de8374c |  | [260529-3l0-bump-default-opus-model-from-claude-opus](./quick/260529-3l0-bump-default-opus-model-from-claude-opus/) |
| 260529-g58 | v2.45.2 landing @dboeckenhoff's PR #12 trivial-handoff guard via cherry-pick (`146ac86`, Author: Daniel Böckenhoff preserved) + follow-up commit (`9bd0bf1`) adding regression test at `tests/session-start-skip-trivial-handoff.test.cjs` (6 cases, 6/6 pass; sanity-verified 5/6 fails when guard reverted) + .claude-plugin/{plugin,marketplace}.json bump 2.45.1 -> 2.45.2 + CHANGELOG ### Fixed crediting @dboeckenhoff. PR #12 commented + closed (not merged, to avoid redundant merge commit on top of cherry-pick). Plugin-only fix in `bin/gsd-tools.cjs` hook dispatcher (flat-layout territory, not in upstream redux's `get-shit-done/bin/` parallel path) so NOT proposed upstream | 2026-05-29 | 9bd0bf1 |  | [260529-g58-land-pr-12-session-start-trivial-handoff](./quick/260529-g58-land-pr-12-session-start-trivial-handoff/) |
| 260607-w0s | v2.45.10 selective cherry-pick of 5 TIER-1 bug fixes from upstream v1.3.1 (NOT a full sync): writer-agent Edit grants (7 agents, #582/#571), Brave websearch fetch timeout+retry (#387/#308), plan-phase decision-gate jq hardening (#283/#275), AskUserQuestion 4-option cap splits (#243/#17). Investigation found upstream restructured heavily (build-at-publish, SDK retired, renamed to @opengsd/gsd-core) making a full sync a ~350-file migration; pulled portable low-risk wins only. gsd-core native plugin manifest (#766) is next-only, not v1.3.1; our manifest stays authoritative. Strategy + research artifacts in the task dir. 5 commits + release commit; 9/9 tests green | 2026-06-08 | 1ab88fb | Verified | [260607-w0s-sync-upstream-redux-to-v1-3-1](./quick/260607-w0s-sync-upstream-redux-to-v1-3-1/) |
| 260608-vk9 | Retarget the scheduled upstream-release notification (`bin/check-gsd-release.sh`) from the locked `gsd-build/get-shit-done` to `open-gsd/gsd-core` (npm @opengsd/gsd-core; redux mirrors tags). The watch was silently dead since the old repo ships no releases. Synced the live cron copy at ~/claude-code-gsd + reseeded ~/.gsd-last-known-version to 1.4.0 so the switch fires no spurious cross-numbering email; arms on next genuine release. Follow-up: also retargeted `bin/maintenance/check-upstream-schema.cjs` (all 4 sites: gh repo x2, extract-dir gsd-core-<v>, internal gsd-core/workflows path) — verified live against v1.4.0 (PASS, HANDOFF schema 17 fields subset, no drift) | 2026-06-08 | 57796b9 | Done | [260608-vk9-retarget-upstream-release-notification-t](./quick/260608-vk9-retarget-upstream-release-notification-t/) |
| 260609-mem | v2.46.0 ad-hoc durable-decision auto-capture: /gsd:quick, /gsd:debug, /gsd:fast now save durable decisions (preferences, non-obvious rationale, resolved-bug root causes) to Claude Code auto-memory at close-out, gated on `workflow.auto_memory_capture` (default on). Adds `gsd-tools write-decision-memory` + memory.cjs cmdWriteDecisionMemory/appendDecisionIndex + references/auto-memory-capture.md + 3 workflow close-out steps + tests (10/10). Also fixed two latent bugs that meant the plugin never auto-captured before: write-phase-memory called undefined `memory.writePhaseMemory` and read phase from args[0]. README feature row + CHANGELOG. Commits 88d1288/8429b8c | 2026-06-09 | 8429b8c | Done | (feature, no task dir) |
| 260609-kb0 | Cherry-picked 5 TIER-1 wins from gsd-core v1.3.1->v1.4.1 (incremental, NOT a full sync): #905 STATE.md scalar preservation (state.cjs), #904 phase-branch normalization under project_code (init.cjs+commands.cjs), #771 14 agent color: hex->named, #25 verifier Step 7b enumerate-or-single-test, #913 plan-phase role-collapse guard + 7 CODEX->ALL RUNTIMES markers (execute-phase scoping deferred TIER 2). Shipped bundled into the v3.4.1 release. 10/10 tests. Survey + per-candidate detail in task dir | 2026-06-09 | 8221979 | Done | [260609-kb0-cherry-pick-cc-relevant-wins-from-upstre](./quick/260609-kb0-cherry-pick-cc-relevant-wins-from-upstre/) |
| 260611-pab | v3.4.8 ultracode orchestration signal: Claude-only `workflow.ultracode` that runs the good-fit heavy commands at max multi-agent depth. Per user: AUTO-ON through 2026-06-22 (deeper runs included; same cutoff as Fable sunset), OFF after (extra-paid); explicit true/false overrides. Signal not mechanism (plugin can't trigger CC Workflow): each good-fit workflow has an `<ultracode_gate>` resolving active via `config-get workflow.ultracode --default auto` + `date +%F` vs 2026-06-22 (NO resolver code duplicated; agent evaluates the window). Wired into map-codebase (full mapper set + reconcile), code-review (every dimension + adversarial refute), plan-review-convergence (second panel + extra pass); execute-phase/new-project research already maximal. KEY GOTCHA discovered: `gsd-sdk query` runs the SDK (sdk/dist), NOT bin/gsd-tools.cjs — config-set validates against the SDK's OWN key list, so workflow.ultracode had to be added to BOTH bin/lib/config-schema.cjs AND sdk/src/query/config-schema.ts (rebuilt sdk/dist); test has a CJS/SDK parity guard. Also: `gsd-sdk` on PATH resolves the INSTALLED CACHE (v3.4.6), not the working repo, so gsd-sdk tests this session hit the cache; verified the real change via `node sdk/dist/cli.js` directly. references/ultracode-mode.md (single source w/ truth table) + README row + /gsd:settings + tests/ultracode-signal.test.cjs (10). Suite 18/18. ALSO FIXED in this release (folded in per user): v3.4.7 Fable sunset was only in bin/lib/core.cjs, NOT the SDK resolver (sdk/src/query/config-query.ts resolveModel returned bare "fable") — a no-op on the real spawn path. Ported applyFableSunset into the SDK resolver + rebuilt dist; verified via `node sdk/dist/cli.js query init.quick` that quality planner_model = fable before 2026-06-22, opus after. CJS/SDK parity guards added to both ultracode + fable-sunset tests. Corrects the v3.4.7 claim that the SDK is off-path. Commit 21497ce | 2026-06-11 | 1e02bde | Done | [260611-pab-integrate-workflow-ultracode-orchestrati](./quick/260611-pab-integrate-workflow-ultracode-orchestrati/) |
| 260611-e7x | v3.4.7 Fable sunset: the `fable` tier (quality-profile default for the 9 heaviest agents since v3.4.4) now auto-falls-back to `opus` after 2026-06-22, since Claude Fable 5 is only offered through that date. Single injection in `bin/lib/core.cjs` resolveModelInternal (applyFableSunset/fableAvailable + FABLE_SUNSET_DATE), applied to the requested tier before the runtime/resolve_model_ids/alias exit points so one effective tier flows everywhere. Inclusive cutoff; GSD_FABLE_SUNSET_NOW env override for tests; invalid-now stays available (no early fallback). init.cjs resolves planner/executor models via this fn so spawns inherit it; SDK ts resolver intentionally untouched (not on plugin spawn path). tests/fable-sunset.test.cjs (11 checks) + e2e (quality gsd-planner: claude-fable-5 before, claude-opus-4-8 after). Suite 17/17. README row extended + CHANGELOG | 2026-06-11 | 00041b7 | Done | [260611-e7x-fable-tier-auto-falls-back-to-opus-after](./quick/260611-e7x-fable-tier-auto-falls-back-to-opus-after/) |
| 260628-3hr | Wire the issue #17 checkpoint write-guards regression test into the CI handoff-schema job (runs on every push = pre-release gate) + new RELEASING.md pre-release checklist. Closes the loop on the /gsd:debug 17 fix (commit 79c5f63, Fixes #17). | 2026-06-28 | 738cdbb | Done | [260628-3hr-wire-checkpoint-write-guards-test-into-p](./quick/260628-3hr-wire-checkpoint-write-guards-test-into-p/) |
| 260628-hyu | Encode the third-party contribution policy (run all feasible checks, minimal patch, produce a .patch file, manual review before submit, never auto-submit) in CLAUDE.md + a feedback memory. | 2026-06-28 | 93454a2 | Done | [260628-hyu-third-party-contribution-policy-checks-m](./quick/260628-hyu-third-party-contribution-policy-checks-m/) |
| 260629-2ui | Version-alignment drift detector: fails CI when the internal milestone version diverges from the actual product version (plugin/marketplace), preventing a recurrence of the v1.x-vs-4.x split. | 2026-06-29 | eed1ea6 | Done | [260629-2ui-prevent-internal-milestone-version-diver](./quick/260629-2ui-prevent-internal-milestone-version-diver/) |
| 260629-35t | Exploration (no code): design for evidence-based verification (red→green repro capture, screenshots/run-the-app) integrated into GSD at low token overhead. Produced EXPLORATION.md with ranked seams + incremental rollout. | 2026-06-29 | 39469cc | Done | [260629-35t-evidence-based-verification-screenshots-](./quick/260629-35t-evidence-based-verification-screenshots-/) |
| 260629-rcy | Research (no code): surveyed gsd-core 1.6.0 (2026-06-24) for cherry-picks. Headline = Capability Registry (multi-runtime) = SKIP. Worth-including = correctness fixes; #1520 mktemp BSD/macOS collision VERIFIED real in our 5 callsites; #1369 wave-base mostly already present; #1572/#1445/#1532/#1534 are verify-then-pick. | 2026-06-29 | 49ef0a3 | Done | [260629-rcy-survey-gsd-core-1-6-upstream-changes-wor](./quick/260629-rcy-survey-gsd-core-1-6-upstream-changes-wor/) |
| 260629-rrr | Ported gsd-core 1.6 #1520: fixed BSD/macOS mktemp suffix collision across 5 callsites (X's moved to end; extension was cosmetic) + tests/mktemp-portable.test.cjs regression guard wired into CI. | 2026-06-29 | e93417c | Done | [260629-rrr-fix-bsd-macos-mktemp-suffix-collision-gs](./quick/260629-rrr-fix-bsd-macos-mktemp-suffix-collision-gs/) |

| 260701-gbo | Upstream follow-ups (parallel): surveyed gsd-core 1.6.1 (ADOPT #1580 + #1591; #1847 claude-sonnet-5 verify-first; no #1520 companion) + 1.7.0-rc.1 (multi-runtime = SKIP; watch ADR-1769 vs #9); FIXED vibedrift watcher npm-path freeze (was stuck 0.14.4 vs 0.14.8). | 2026-07-01 | 1b3dbd7 | Done | [260701-gbo-upstream-follow-ups-survey-gsd-core-1-6-](./quick/260701-gbo-upstream-follow-ups-survey-gsd-core-1-6-/) |
| 260701-gzj | Cherry-picked gsd-core 1.6.1 #1580 (roadmap-analyze Phase 0/999 sentinel exclusion) + #1591 (isLastPhase checkbox/bold-checkbox detection, kills false milestone-complete) into BOTH resolvers + rebuilt sdk/dist + regression tests (1815 SDK tests green). #1847 initially skipped then ADOPTED (d5667a9): Claude Sonnet 5 (claude-sonnet-5) IS real (announced 2026-06-30, after the cached model catalog); Sonnet tier updated in the shared model-catalog.json, 4.6 is now legacy. | 2026-07-01 | d5667a9 | Done | [260701-gzj-cherry-pick-gsd-core-1-6-1-1580-1591-sen](./quick/260701-gzj-cherry-pick-gsd-core-1-6-1-1580-1591-sen/) |

| 260701-vnh | Investigation (no code): security issue #19 "Multiple Skills Auto-Approve Unrestricted Shell" (Trustabl scanner). VERDICT: theoretical/mischaracterized, not a real Critical — allowed-tools:Bash only suppresses prompts while the user-INVOKED skill runs (documented CC behavior); no bypass/mode/background vector; 83/86 skills declare Bash of necessity. Optional hardening: scoped Bash(gsd-sdk:*). | 2026-07-01 | (docs) | Done | [260701-vnh-investigate-trustabl-security-report-19-](./quick/260701-vnh-investigate-trustabl-security-report-19-/) |
| 260701-wxe | Re-enabled Claude Fable 5 tier through its redeploy free-usage window (redeployed 2026-07-01, plan-included through 2026-07-07). Bumped FABLE_SUNSET_DATE 2026-06-12 -> 2026-07-07 in both resolvers + tests + dist; heavy agents ride Fable through 07-07 then auto-downgrade to Opus. Shipped as 4.0.4. | 2026-07-01 | v4.0.4 | Done | [260701-wxe-re-enable-fable-5-through-2026-07-07-red](./quick/260701-wxe-re-enable-fable-5-through-2026-07-07-red/) |

| 260703-2zr | Discoverability fix: /gsd:scan --drift was implemented in workflows/scan.md but invisible (scan had no argument-hint). Added argument-hint to scan (+ --drift in description), explore, workstreams, next; audited all 23 hint-less skills, rest take no user args. No workflow logic changed. | 2026-07-03 | f00ac99 | Done | [260703-2zr-add-argument-hint-to-scan-skill-advertis](./quick/260703-2zr-add-argument-hint-to-scan-skill-advertis/) |
| 260706-2jy | Guardrail: GSD agents must not write phase/housekeeping metadata into generated product code or comments (user flagged `# Phase 1: skeleton only ...` in a generated project). Root cause: rule was never encoded. Added "No GSD metadata in product code" to agents/gsd-executor.md `<project_context>` + "## Generated Code Hygiene" in CLAUDE.md + memory. flashsystem project cleanup + planner-agent hardening left for user. | 2026-07-05 | 2548d54 | Done | [260706-2jy-executor-must-not-write-gsd-phase-housek](./quick/260706-2jy-executor-must-not-write-gsd-phase-housek/) |

## Session Continuity

Last session: 2026-07-10T22:28:35.502Z
Stopped at: Phase 14 context gathered
Next action: `/gsd:plan-phase 12` to plan the Two-Plugin Build Foundation phase.

## Operator Next Steps

- Plan Phase 12 with `/gsd:plan-phase 12`
