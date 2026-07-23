---
phase: quick-260723-exn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/lib/plan-scan.cjs
  - sdk/src/query/plan-scan.ts
  - sdk/src/query/plan-scan.test.ts
  - tests/plan-scan-matched-summaries.test.cjs
  - bin/lib/phase.cjs
  - bin/lib/core.cjs
  - bin/lib/verify.cjs
  - sdk/src/query/verify.ts
  - bin/lib/checkpoint.cjs
  - bin/lib/roadmap.cjs
  - bin/lib/init.cjs
  - sdk/src/query/phase.ts
  - sdk/src/query/phase.test.ts
  - sdk/src/query/roadmap-update-plan-progress.ts
  - sdk/src/query/roadmap-update-plan-progress.test.ts
  - sdk/src/query/check-completion.ts
  - sdk/src/query/check-completion.test.ts
  - sdk/src/phase-runner.ts
  - sdk/src/phase-runner.test.ts
  - sdk/src/types.ts
  - tests/status-aware-completion.test.cjs
  - tests/checkpoint-status-aware.test.cjs
  - workflows/execute-phase.md
  - workflows/transition.md
  - sdk/dist/
  - dist/bm/
autonomous: true
requirements: [QUICK-260723-EXN]
tags: [cjs-sdk-parity, plan-scan, completion-count, resume-safety, execute-phase]

must_haves:
  truths:
    - "scanPhasePlans excludes a summary whose frontmatter status is in the incomplete set (paused, partial, incomplete, blocked, gaps, gaps_found, not-complete, not_complete) from summaryCount and from completed, in BOTH the CJS and SDK twins; a summary with no status, status complete, or any other value still counts"
    - "A plan paused at a blocking checkpoint (partial SUMMARY with status: paused) appears in phase-plan-index incomplete / init.execute-phase incomplete_plans and is NOT filtered out by the execute-phase skip rule NOR by the SDK PhaseRunner.runExecuteStep filter; its dependent successor is therefore NOT dispatched early"
    - "NO completion/skip consumer decides completeness by bare summary existence. Every consumer is status-aware: the shared scanners (init-complex.ts and roadmap.ts via scanPhasePlans; the per-plan id-pairing scanners bin/lib/phase.cjs cmdPhasePlanIndex + bin/lib/core.cjs searchPhaseInDir + sdk/src/query/phase.ts searchPhaseInDir/phasePlanIndex), the verify-against-disk pair bin/lib/verify.cjs cmdVerifyPhaseCompleteness + its SDK twin sdk/src/query/verify.ts verifyPhaseCompleteness, the HANDOFF resume scanner bin/lib/checkpoint.cjs scanPhasePlans, the ROADMAP checkbox/table ticker cmdRoadmapUpdatePlanProgress + its SDK twin roadmap-update-plan-progress.ts, the roadmap/init trust-over-disk override (roadmap.cjs cmdRoadmapAnalyze + init.cjs), the SDK PhaseRunner.runExecuteStep plan filter, the completion rollup sdk/src/query/check-completion.ts checkPhaseCompletion/checkMilestoneCompletion, and the transition.md verify_completion gate"
    - "The verify.phase-completeness twins stay byte-identical: bin/lib/verify.cjs cmdVerifyPhaseCompleteness and sdk/src/query/verify.ts verifyPhaseCompleteness apply the SAME status-aware exclusion (a paused matched summary is NOT credited toward completeness) so the golden parity test at sdk/src/golden/golden.integration.test.ts (describe verify.phase-completeness) still passes"
    - "sdk/src/query/check-completion.ts checkPhaseCompletion no longer pairs by bare summaryIds.has: a matched summary counts toward plans_with_summaries / complete only when its status is complete; a paused matched summary lands in missing_summaries and keeps complete false; checkMilestoneCompletion inherits the same disk-status-awareness via roadmapAnalyze. Its test (check-completion.test.ts) asserts the paused-plan case"
    - "The 'trust roadmap checkbox over disk' override in bin/lib/roadmap.cjs cmdRoadmapAnalyze and bin/lib/init.cjs does NOT flip a non-complete disk_status back to complete when the phase has plans on disk: the override only promotes when planCount === 0 (the legacy no-PLAN/SUMMARY-pairs case). For any phase with planCount > 0 whose status-aware disk scan yields a non-'complete' status (planned, partial, etc.), the stricter disk status is kept, so a wrongly-ticked checkbox can no longer silently promote a single-plan phase whose only summary is paused (which scans as 'planned', not 'partial')"
    - "transition.md verify_completion no longer decides completeness by raw ls/count of *-PLAN.md vs *-SUMMARY.md: it determines completeness via the status-aware count (node bin/gsd-tools.cjs / node sdk/dist/cli.js query — phase-plan-index complete/incomplete or verify.phase-completeness), so a paused plan's partial SUMMARY does not make counts match and the inline auto-advance chain (execute-phase.md auto-advance) does NOT advance the phase without reading status"
    - "execute-phase safe_resume_gate handles the inverse of the missing-summary case: when the current plan's SUMMARY EXISTS but self-declares partial/paused, resume routes to THAT plan (its checkpoint), not its successor"
    - "When STATE.md stopped_at names a plan that the file-count marks complete but that self-declares paused at a checkpoint, execute-phase surfaces the disagreement to the user instead of silently trusting the file count"
    - "A readable SUMMARY that is unreadable/corrupt is treated as NOT complete (do not skip), preserving the safety bias against skipping unbuilt work"
    - "bin/lib and sdk/src comments describe behavior only; no issue/PR numbers, wave, or status bookkeeping in product code; the #25 reference lives only in the .planning SUMMARY"
    - "npm --prefix sdk run build succeeds; node bin/build-bm.cjs regenerates dist/bm; node bin/build-bm.cjs --check reports PASS; SDK unit + integration suites (including the roadmap.update-plan-progress AND verify.phase-completeness golden parity tests) show zero NEW failures over the pre-existing baseline"
  artifacts:
    - path: "bin/lib/plan-scan.cjs"
      provides: "INCOMPLETE_SUMMARY_STATUSES set + a summary-status-aware matched-and-complete count feeding scanPhasePlans summaryCount/completed; exports the status set + per-summary complete helper for the other CJS consumers"
      contains: "INCOMPLETE_SUMMARY_STATUSES"
    - path: "sdk/src/query/plan-scan.ts"
      provides: "byte-identical status-aware count for the SDK twin, reusing extractFrontmatter from ./frontmatter.js; exports the status set + helper for the SDK consumers"
      contains: "INCOMPLETE_SUMMARY_STATUSES"
    - path: "tests/plan-scan-matched-summaries.test.cjs"
      provides: "extended CJS fixture proving a paused/partial matched summary is excluded from summaryCount/completed and a status-less/complete one is counted"
      min_lines: 50
    - path: "tests/status-aware-completion.test.cjs"
      provides: "regression: temp phase dir with paused-summary plan A + summary-less plan B asserts A incomplete, B not counted complete, phase not complete; all-complete summaries flip phase complete"
      min_lines: 60
    - path: "bin/lib/phase.cjs"
      provides: "cmdPhasePlanIndex reads each matched summary status; adds a status-aware per-plan complete field and a status-aware incomplete array"
      contains: "INCOMPLETE_SUMMARY_STATUSES"
    - path: "bin/lib/core.cjs"
      provides: "searchPhaseInDir excludes incomplete-status summaries from completedPlanIds so incomplete_plans includes paused plans"
    - path: "bin/lib/verify.cjs"
      provides: "cmdVerifyPhaseCompleteness excludes incomplete-status summaries from summaryIds so verify-against-disk sees a paused plan as incomplete"
    - path: "sdk/src/query/verify.ts"
      provides: "verifyPhaseCompleteness (SDK twin of cmdVerifyPhaseCompleteness) applies the IDENTICAL status-aware exclusion so verify.phase-completeness stays byte-identical to the CJS side and the golden parity test holds"
      contains: "INCOMPLETE_SUMMARY_STATUSES"
    - path: "bin/lib/checkpoint.cjs"
      provides: "local scanPhasePlans marks a matched summary 'done' only when its status is complete; a paused-summary plan lands in remaining[] so HANDOFF.json does not resume past it"
      contains: "INCOMPLETE_SUMMARY_STATUSES"
    - path: "bin/lib/roadmap.cjs"
      provides: "cmdRoadmapUpdatePlanProgress uses a status-aware matched-and-complete count (not raw countMatchedSummaries) so a paused plan never ticks the phase/plan checkbox or flips status Complete; the cmdRoadmapAnalyze trust-roadmap-over-disk override only promotes when planCount === 0, so a non-complete disk_status on a phase with plans is never re-promoted"
    - path: "bin/lib/init.cjs"
      provides: "the trust-roadmap-over-disk override only promotes disk_status to complete when planCount === 0; a paused/planned/partial disk_status on a phase with plans is kept"
    - path: "sdk/src/query/roadmap-update-plan-progress.ts"
      provides: "SDK twin uses the identical status-aware count so the checkbox/table ticker never wrongly ticks a paused plan; parity with the CJS twin preserved for the golden test"
    - path: "sdk/src/query/roadmap-update-plan-progress.test.ts"
      provides: "unit regression: a paused matched summary is not counted, isComplete stays false, phase checkbox not ticked"
    - path: "sdk/src/query/check-completion.ts"
      provides: "checkPhaseCompletion credits plans_with_summaries / complete only for complete-status matched summaries (resolves each summary path from pdata.directory), so a paused plan lands in missing_summaries and complete stays false; checkMilestoneCompletion inherits disk-status-awareness through roadmapAnalyze"
    - path: "sdk/src/query/check-completion.test.ts"
      provides: "regression: a phase with a paused matched summary reports it in missing_summaries and complete false; a complete summary flips it"
    - path: "sdk/src/query/phase.ts"
      provides: "searchPhaseInDir + phasePlanIndex twins are status-aware (incomplete_plans, per-plan complete, incomplete array)"
    - path: "sdk/src/phase-runner.ts"
      provides: "runExecuteStep filters on the status-aware per-plan complete field (not bare has_summary) so a paused-summary plan stays in the run set and its successor is not dispatched"
    - path: "sdk/src/types.ts"
      provides: "PlanInfo gains a status-aware complete: boolean field alongside has_summary"
      contains: "complete"
    - path: "sdk/src/phase-runner.test.ts"
      provides: "regression: a plan with has_summary true but complete false stays in incompletePlans and is dispatched"
    - path: "workflows/execute-phase.md"
      provides: "safe_resume_gate inverse guard (partial SUMMARY -> resume that plan), skip-filter switched to status-aware completeness, STATE.md stopped_at disagreement surfaced"
    - path: "workflows/transition.md"
      provides: "verify_completion determines completeness via the status-aware CLI count instead of raw ls/count, so the inline auto-advance chain does not advance a phase whose only incomplete plan is paused"
  key_links:
    - from: "bin/lib/plan-scan.cjs"
      to: "bin/lib/frontmatter.cjs"
      via: "matched-summary counter reads each summary's status via extractFrontmatter and drops incomplete-status ones"
      pattern: "extractFrontmatter"
    - from: "sdk/src/query/plan-scan.ts"
      to: "sdk/src/query/frontmatter.ts"
      via: "identical status read via extractFrontmatter from ./frontmatter.js"
      pattern: "extractFrontmatter"
    - from: "bin/lib/checkpoint.cjs"
      to: "bin/lib/plan-scan.cjs"
      via: "local scanPhasePlans imports INCOMPLETE_SUMMARY_STATUSES + the per-summary complete helper and gates entry.status on it, so a paused summary is 'not_started'/remaining in HANDOFF.json"
      pattern: "INCOMPLETE_SUMMARY_STATUSES"
    - from: "bin/lib/verify.cjs"
      to: "sdk/src/query/verify.ts"
      via: "both back verify.phase-completeness with the identical status-aware summaryIds exclusion; byte-identical output keeps the golden parity test green"
      pattern: "INCOMPLETE_SUMMARY_STATUSES"
    - from: "bin/lib/roadmap.cjs"
      to: "bin/lib/plan-scan.cjs"
      via: "cmdRoadmapUpdatePlanProgress computes summaryCount from the status-aware matched-and-complete count instead of raw countMatchedSummaries"
      pattern: "INCOMPLETE_SUMMARY_STATUSES"
    - from: "sdk/src/query/roadmap-update-plan-progress.ts"
      to: "sdk/src/query/plan-scan.ts"
      via: "identical status-aware count for the checkbox/table ticker; parity with the CJS twin"
      pattern: "INCOMPLETE_SUMMARY_STATUSES"
    - from: "sdk/src/query/check-completion.ts"
      to: "sdk/src/query/plan-scan.ts"
      via: "checkPhaseCompletion imports INCOMPLETE_SUMMARY_STATUSES + the per-summary complete helper to gate plans_with_summaries / missing_summaries"
      pattern: "INCOMPLETE_SUMMARY_STATUSES"
    - from: "sdk/src/phase-runner.ts"
      to: "sdk/src/types.ts"
      via: "runExecuteStep filters planIndex.plans on the new PlanInfo.complete field, not has_summary"
      pattern: "!p\\.complete"
    - from: "bin/lib/init.cjs"
      to: "bin/lib/core.cjs"
      via: "init.execute-phase incomplete_plans comes from searchPhaseInDir incompletePlans, now status-aware; the trust-over-disk override only promotes when planCount === 0"
      pattern: "incomplete_plans"
    - from: "workflows/transition.md"
      to: "bin/gsd-tools.cjs"
      via: "verify_completion calls the status-aware phase-plan-index/verify.phase-completeness CLI instead of ls/count to decide the phase is complete"
      pattern: "phase-plan-index|phase-completeness"
    - from: "workflows/execute-phase.md"
      to: "sdk/src/query/phase.ts"
      via: "skip-filter uses status-aware per-plan complete (not bare has_summary); paused plan stays in the run set"
      pattern: "complete"
    - from: "must_haves build gates"
      to: "dist/bm"
      via: "npm --prefix sdk run build succeeds; node bin/build-bm.cjs regenerates dist/bm; node bin/build-bm.cjs --check reports PASS"
---

<objective>
Make plan and phase completion STATUS-AWARE across both resolver twins (CJS bin/lib + SDK sdk/src), the completion rollup, and the phase-progression workflows (execute-phase + transition), so a plan that paused at a blocking checkpoint and wrote a partial SUMMARY (status: paused) is no longer counted complete, skipped on resume, its dependent successor dispatched early against unbuilt output, NOR its phase auto-advanced past.

Root cause (verified in code): completion is decided by paired-SUMMARY existence. `scanPhasePlans` counts `countMatchedSummaries(...)` by filename pairing only and never reads a summary's `status:`. The per-plan scanners in `bin/lib/phase.cjs` cmdPhasePlanIndex, `bin/lib/core.cjs` searchPhaseInDir, and the `sdk/src/query/phase.ts` twins build `completedPlanIds` / `has_summary` from filename existence. The SAME class of bug lives in more consumers: (1) `bin/lib/checkpoint.cjs` scanPhasePlans sets HANDOFF.json entry.status = summaryIds.has(id) ? 'done' : 'not_started', so a paused plan is resumed past; (2) `bin/lib/roadmap.cjs` cmdRoadmapUpdatePlanProgress + its SDK twin tick the ROADMAP phase/plan checkboxes from existence-only counts, and the "trust roadmap over disk" override in roadmap.cjs/init.cjs then flips the status-aware disk_status back to complete; (3) `sdk/src/phase-runner.ts` runExecuteStep filters on `!p.has_summary`, skipping a paused plan; (4) `bin/lib/verify.cjs` cmdVerifyPhaseCompleteness AND its SDK twin `sdk/src/query/verify.ts` verifyPhaseCompleteness pair by bare `summaryIds.has`; (5) `sdk/src/query/check-completion.ts` checkPhaseCompletion pairs by bare `summaryIds.has` (dead in the live path today, but documented to replace ad-hoc counting in transition/complete-milestone/execute-phase — a future wiring would silently reintroduce the bug); (6) `workflows/transition.md` verify_completion `ls`+counts *-PLAN.md vs *-SUMMARY.md and, when counts match, declares all plans complete — and it is invoked INLINE by the execute-phase auto-advance chain, so a paused plan's partial SUMMARY makes the counts match and the phase advances without reading status. A paused plan has a summary file, so it is wrongly counted complete and skipped. This is the same class as the prior pair-summaries-before-counting fix, on the STATUS axis it did not cover.

Purpose: a resume must route to the plan that actually paused, never past it; a phase must not auto-advance past a paused plan. Safety-critical: dispatching a successor out of depends_on order, or advancing the phase, runs work against output the paused plan never produced.

Output: a shared incomplete-status set + status-aware matched-summary count in both plan-scan twins, EXPORTED for reuse; EVERY completion/skip consumer (the per-plan scanners, the verify.phase-completeness twins, the checkpoint HANDOFF scanner, the ROADMAP checkbox/table ticker + its trust-over-disk override, the SDK PhaseRunner filter, the check-completion rollup, and the transition.md verify_completion gate) routed through status-aware logic; a status-aware per-plan `complete` field feeding the execute-phase skip-filter and PhaseRunner; the safe_resume_gate inverse guard; a STATE.md stopped_at disagreement surface; regression tests on both sides; rebuilt sdk/dist and regenerated dist/bm.

Context note for the executor: `gsd-sdk` is OFF PATH this session (node switched to v26). Use `node sdk/dist/cli.js query ...` and `node bin/gsd-tools.cjs ...` for any query; use `node`/`npm` directly for builds/tests. This plan spans ~24 files across 4 tasks. Complete and verify one task fully before opening files for the next; do not re-read files already in context.
</objective>

<execution_context>
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.2.1/workflows/execute-plan.md
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.2.1/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@bin/lib/plan-scan.cjs
@sdk/src/query/plan-scan.ts
@bin/lib/phase.cjs
@bin/lib/core.cjs
@bin/lib/verify.cjs
@sdk/src/query/verify.ts
@bin/lib/checkpoint.cjs
@bin/lib/roadmap.cjs
@sdk/src/query/phase.ts
@sdk/src/query/roadmap-update-plan-progress.ts
@sdk/src/query/check-completion.ts
@sdk/src/phase-runner.ts
@workflows/execute-phase.md
@workflows/transition.md
@.planning/quick/260718-vxw-port-upstream-gsd-core-1-7-0-tier-1-corr/260718-vxw-PLAN.md

<interfaces>
<!-- Reuse (do NOT modify bin/lib/audit.cjs. Extract the status-set pattern only). -->

The completion incomplete-status set (case-insensitive), a SUPERSET of audit.cjs's
INCOMPLETE_QUICK_STATUSES (which lacks `paused`, `not-complete`, `not_complete`):
  paused, partial, incomplete, blocked, gaps, gaps_found, not-complete, not_complete
A readable SUMMARY with no status, status `complete`, or any other value = complete.
An unreadable/corrupt SUMMARY = NOT complete (safety bias: do not skip).

Frontmatter status read:
  CJS: const { extractFrontmatter } = require('./frontmatter.cjs');  // fm.status
  SDK: import { extractFrontmatter } from './frontmatter.js';         // (fm.status)

CJS plan-scan.cjs (current):
  countMatchedSummaries(planFiles, summaryFiles) -> number   // filename pairing only
  scanPhasePlans(phaseDir) -> { planCount, summaryCount, completed, hasNestedPlans, planFiles, summaryFiles }
  Root summaries live in phaseDir; nested summaries live in phaseDir/plans.

Completion/skip consumers that decide by bare summary existence (audit all; all must become status-aware):
  - bin/lib/plan-scan.cjs   scanPhasePlans/countMatchedSummaries (FIX 1 core; feeds init.cjs + roadmap.cjs)
  - bin/lib/phase.cjs       cmdPhasePlanIndex ~373 completedPlanIds, ~430 hasSummary -> has_summary/incomplete
  - bin/lib/core.cjs        searchPhaseInDir ~902 completedPlanIds, ~909 incompletePlans -> init.cjs -> init.execute-phase incomplete_plans
  - bin/lib/verify.cjs      cmdVerifyPhaseCompleteness ~190-215 planIds/summaryIds -> incomplete_plans/complete (verify.phase-completeness). Golden parity test at sdk/src/golden/golden.integration.test.ts describe 'verify.phase-completeness'.
  - sdk/src/query/verify.ts verifyPhaseCompleteness ~137-210 SDK TWIN of the above; bare summaryIds.has(id). Must stay byte-identical to verify.cjs. BLOCKER 2.
  - bin/lib/checkpoint.cjs  scanPhasePlans ~139 (LOCAL, own copy) entry.status = summaryIds.has(id) ? 'done' : 'not_started' ~169-178 -> generateCheckpoint -> HANDOFF.json completed_tasks/remaining_tasks -> /gsd:resume-work. CJS-ONLY (no SDK twin).
  - bin/lib/roadmap.cjs     cmdRoadmapUpdatePlanProgress ~365 summaryCount = countMatchedSummaries -> isComplete -> phase checkbox ~424 + per-plan checkbox ~428-437; ALSO cmdRoadmapAnalyze ~281 "trust roadmap checkbox over disk" flips diskStatus back to complete.
  - bin/lib/init.cjs        ~1174-1177 the same "trust roadmap over disk" override.
  - sdk/src/query/plan-scan.ts   scanPhasePlans/countMatchedSummaries (FIX 1 twin)
  - sdk/src/query/phase.ts       searchPhaseInDir ~118 completedPlanIds -> incomplete_plans (consumed by init.ts:391); phasePlanIndex ~297/~361 -> has_summary/incomplete
  - sdk/src/query/roadmap-update-plan-progress.ts  ~65 summaryCount = countMatchedSummaries -> checkbox ticking ~125-147. SDK twin. Golden parity test at sdk/src/golden/golden.integration.test.ts:214.
  - sdk/src/query/check-completion.ts  checkPhaseCompletion ~55-125 plans_with_summaries/missing_summaries via bare summaryIds.has; checkMilestoneCompletion ~129-154 via roadmapAnalyze disk_status. Registered as check.completion (command-static-catalog-foundation.ts). Golden policy at golden-policy.ts:38. DEAD in live path today (no workflow invokes it) but documented to replace transition/complete-milestone/execute-phase counting. WARNING 2 — fix now so a future wiring can't reintroduce the bug.
  - sdk/src/phase-runner.ts      runExecuteStep ~667 planIndex.plans.filter(p => !p.has_summary). PUBLIC entry (GSD.runPhase/PhaseRunner, sdk/README.md, phase-runner.integration.test.ts).
  - workflows/transition.md      verify_completion ~48-58 `ls *-PLAN.md` + `ls *-SUMMARY.md` + count-match => "all plans complete". Invoked INLINE by execute-phase.md auto-advance (~1723-1725, passes --auto). BLOCKER 1.
  - sdk/src/query/init-complex.ts + sdk/src/query/roadmap.ts  consume scanPhasePlans.summaryCount/completed (auto-fixed by FIX 1; verify, no edit expected)

SDK PlanInfo type (sdk/src/types.ts ~496): currently { id, wave, depends_on, autonomous, objective, files_modified, task_count, has_summary }. ADD `complete: boolean`.

Trust-over-disk override (roadmap.cjs cmdRoadmapAnalyze ~281 and init.cjs ~1174-1177) — CURRENT shape:
  if (roadmapComplete && diskStatus !== 'complete') { diskStatus = 'complete'; }
WARNING 1: for a single-plan phase whose only summary is paused, the status-aware scan gives
summaryCount=0/planCount=1 -> diskStatus = 'planned' (NOT 'partial'). Guarding only 'partial' would
miss this. Broaden: only promote when planCount === 0 (legacy no-pairs case); keep any non-complete
disk_status whenever planCount > 0.

execute-phase.md sites:
  - :137 safe_resume_gate  (only stops when production commits exist AND SUMMARY missing)
  - :291/:293 skip-filter  (Skip plans where has_summary: true)
  - :1144 partial-wave skip (ignore plans with has_summary: true)
  - :1723-1725 auto-advance -> inline transition.md (BLOCKER 1 reaches here)

transition.md sites:
  - :44-58 verify_completion  (ls PLAN/SUMMARY, count-match => complete)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Status-aware matched-summary count in both plan-scan twins (FIX 1)</name>
  <files>bin/lib/plan-scan.cjs, sdk/src/query/plan-scan.ts, sdk/src/query/plan-scan.test.ts, tests/plan-scan-matched-summaries.test.cjs</files>
  <behavior>
    - A phase with 2 plans where plan A's matched summary has `status: paused` and plan B's matched summary has no status field: summaryCount = 1, completed = false, in both twins.
    - Same with status: partial / incomplete / blocked / gaps / gaps_found / not-complete / not_complete on A: A excluded, summaryCount = 1.
    - Both matched summaries status-less (or status: complete): summaryCount = 2, completed = true.
    - A matched summary that is unreadable/corrupt: treated as NOT complete (excluded from summaryCount).
    - A stray summary matching no plan stays excluded (existing behavior unchanged).
    - Nested-layout summaries (phaseDir/plans/SUMMARY-NN-*.md) resolve their status file from the plans/ subdir.
  </behavior>
  <action>Add a hoisted module const INCOMPLETE_SUMMARY_STATUSES = new Set of the eight case-insensitive tokens listed in the interfaces block, identical in both twins, and EXPORT it (module.exports in CJS, export const in SDK) so Task 2's consumers import one definition. Add and export a helper that, given a summary's absolute path, reads the file and returns whether it counts as complete: unreadable -> false; else extractFrontmatter, lowercase (fm.status || ''), complete = the status is NOT in INCOMPLETE_SUMMARY_STATUSES (absent/complete/other = true). CJS requires extractFrontmatter from ./frontmatter.cjs; SDK imports it from ./frontmatter.js.

Rework the matched-summary count so it reads each MATCHED summary's status and counts only complete ones. countMatchedSummaries currently receives only filenames and cannot resolve paths; give it the directory context it needs. Preferred shape: have scanPhasePlans resolve each summary's absolute path (root summaries -> phaseDir, nested summaries -> path.join(phaseDir, 'plans')) and compute the matched-and-complete count with those paths. Keep countMatchedSummaries exported (other callers/tests use it); if you change its signature, update every caller and the existing test accordingly. summaryCount = matched AND complete; completed = planCount > 0 && summaryCount >= planCount (formula unchanged, input now status-aware). Keep the two twins byte-behavior identical.

Extend tests/plan-scan-matched-summaries.test.cjs with cases: paused matched summary excluded; status-less matched summary counted; all-complete flips completed true; unreadable summary excluded; existing stray-summary case still passes. Add the mirror cases to sdk/src/query/plan-scan.test.ts. Do NOT run the sdk build or bm regen yet (Task 4 finishes with the gates). Comments describe behavior only; no issue/PR numbers.</action>
  <verify>
    <automated>node tests/plan-scan-matched-summaries.test.cjs && npm --prefix sdk run test -- plan-scan</automated>
  </verify>
  <done>Both twins exclude an incomplete-status matched summary from summaryCount/completed; status-less/complete summaries still count; unreadable excluded; the status set + per-summary complete helper are exported; CJS + SDK plan-scan tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Route EVERY per-plan / completion / skip consumer through status-aware completeness</name>
  <files>bin/lib/phase.cjs, bin/lib/core.cjs, bin/lib/verify.cjs, sdk/src/query/verify.ts, bin/lib/checkpoint.cjs, bin/lib/roadmap.cjs, bin/lib/init.cjs, sdk/src/query/phase.ts, sdk/src/query/phase.test.ts, sdk/src/query/roadmap-update-plan-progress.ts, sdk/src/query/roadmap-update-plan-progress.test.ts, sdk/src/query/check-completion.ts, sdk/src/query/check-completion.test.ts, sdk/src/phase-runner.ts, sdk/src/phase-runner.test.ts, sdk/src/types.ts, tests/status-aware-completion.test.cjs, tests/checkpoint-status-aware.test.cjs</files>
  <behavior>
    - phase-plan-index for a phase with paused-summary plan A + summary-less plan B: A is in `incomplete`; B is in `incomplete`; A's per-plan `complete` is false.
    - After completing A (status-less summary), phase-plan-index reports A `complete: true` and drops A from `incomplete`.
    - init.execute-phase incomplete_plans (via core.cjs searchPhaseInDir) includes the paused plan A.
    - verify.phase-completeness (BOTH bin/lib/verify.cjs and sdk/src/query/verify.ts) reports the paused plan A in incomplete_plans / complete:false; the two twins return byte-identical output (golden parity holds).
    - checkpoint.cjs scanPhasePlans: plan A (paused matched summary) lands in `remaining` with status not 'done'; plan B (no summary) also in `remaining`; a status-less/complete matched summary lands in `completed`. HANDOFF.json therefore lists A under remaining_tasks, so /gsd:resume-work resumes A rather than skipping past it.
    - roadmap.update-plan-progress (both twins) on a phase with a paused plan A: summaryCount excludes A, isComplete stays false, the phase checkbox is NOT ticked and A's per-plan checkbox is NOT ticked. Both twins return identical plan_count/summary_count/complete (golden parity holds).
    - cmdRoadmapAnalyze / init disk_status: a single-plan phase whose only summary is paused scans as 'planned'; when its ROADMAP checkbox is (wrongly) ticked, the trust-over-disk override does NOT promote disk_status to complete (planCount > 0). A truly-legacy phase with planCount === 0 and a ticked checkbox still promotes to complete.
    - check.completion phase scope for a phase with paused plan A: A is in missing_summaries, plans_with_summaries excludes A, complete stays false. All-complete summaries flip complete true.
    - SDK PhaseRunner.runExecuteStep: a plan with has_summary true but complete false stays in incompletePlans and is dispatched; a truly-complete plan is filtered out.
    - CJS phase-plan-index and SDK phase-plan-index agree on `incomplete`, per-plan `complete`, and `has_summary` for the same fixture.
  </behavior>
  <action>Make each completion/skip consumer status-aware by only crediting a summary toward completion when its file status is complete (reuse the Task 1 helper + INCOMPLETE_SUMMARY_STATUSES imported from the plan-scan twins; do not redefine the set).

bin/lib/phase.cjs cmdPhasePlanIndex: when building completedPlanIds from summaryFiles (~379), read each summary's status (resolve its path in phaseDir) and skip incomplete-status ones so they do not enter the completed set. Keep `has_summary` = existence for backward compatibility, and ADD a status-aware per-plan `complete` field (existence AND complete-status) to each plan object and to the output. Make the `incomplete` array status-aware (a paused plan with a summary must appear in `incomplete`). Do not silently redefine has_summary.

bin/lib/core.cjs searchPhaseInDir (~902): exclude incomplete-status summaries from completedPlanIds so incompletePlans (-> init.execute-phase incomplete_plans) includes paused plans.

verify.phase-completeness twins — bin/lib/verify.cjs cmdVerifyPhaseCompleteness (~190-215) AND its SDK twin sdk/src/query/verify.ts verifyPhaseCompleteness (~137-210): apply the IDENTICAL status-aware exclusion. When building `summaryIds` from the *-SUMMARY.md files, resolve each summary's path in the phase dir and drop incomplete-status (or unreadable) ones, so incomplete_plans / complete reflect a paused plan. Both back the same registered command and there is a golden parity test (sdk/src/golden/golden.integration.test.ts describe 'verify.phase-completeness'); keep the two byte-identical so the parity test holds. Import INCOMPLETE_SUMMARY_STATUSES + the helper from the plan-scan twins on each side (CJS from bin/lib/plan-scan.cjs, SDK from ./plan-scan.js).

bin/lib/checkpoint.cjs local scanPhasePlans (~139): this is a SEPARATE local copy (not the plan-scan module) that drives HANDOFF resume. Import INCOMPLETE_SUMMARY_STATUSES + the per-summary complete helper from bin/lib/plan-scan.cjs and gate entry.status: a matched summary only becomes 'done'/completed when its status is complete; a paused/partial (or unreadable) matched summary becomes 'not_started'/remaining. CJS-only (no SDK twin — confirm none exists). Add tests/checkpoint-status-aware.test.cjs: temp phase dir with a paused SUMMARY for plan A + plan B with no summary, assert scanPhasePlans puts A in `remaining` (not `completed`) and a complete summary flips A to `completed`.

bin/lib/roadmap.cjs cmdRoadmapUpdatePlanProgress (~365): replace `summaryCount = countMatchedSummaries(...)` with the status-aware matched-and-complete count (reuse the Task 1 path-aware counter / helper) so a paused plan never makes summaryCount reach planCount, never ticks the phase checkbox (~424) or a per-plan checkbox (~428-437), and never flips status to Complete. Apply the identical status-aware count to the SDK twin sdk/src/query/roadmap-update-plan-progress.ts (~65) so the checkbox/table ticker matches — this preserves the golden parity test (sdk/src/golden/golden.integration.test.ts:214). Extend sdk/src/query/roadmap-update-plan-progress.test.ts with a paused-plan case (isComplete false, checkbox not ticked). Update any golden fixture for roadmap.update-plan-progress if the fixture phase now yields a different count.

Trust-over-disk override (WARNING 1) — bin/lib/roadmap.cjs cmdRoadmapAnalyze (~281) AND bin/lib/init.cjs (~1174-1177): the current guard `if (roadmapComplete && diskStatus !== 'complete') { diskStatus = 'complete'; }` must NOT re-promote a phase that has plans on disk. A single-plan phase whose only summary is paused scans as 'planned' (summaryCount 0 / planCount 1), NOT 'partial', so guarding only 'partial' is insufficient. Broaden the guard to promote ONLY when there are no plans on disk: add `&& planCount === 0` (the legacy "completed before GSD tracking, lacks PLAN/SUMMARY pairs" case). For any phase with planCount > 0, keep the stricter status-aware disk_status. Confirm the planCount variable is in scope at both override sites; if not, thread it through from the disk scan performed just above.

sdk/src/query/check-completion.ts (WARNING 2) — checkPhaseCompletion (~55-125): it pairs plans_with_summaries / missing_summaries by bare `summaryIds.has(planId)`. findPhase returns filename arrays plus `pdata.directory`; resolve each matched summary's absolute path under `join(projectDir, pdata.directory)` and only credit it toward plans_with_summaries when the status is complete (reuse INCOMPLETE_SUMMARY_STATUSES + the helper imported from ./plan-scan.js). A paused matched summary goes into missing_summaries and keeps `complete` false. checkMilestoneCompletion (~129-154) already derives per-phase completeness from roadmapAnalyze disk_status, which becomes status-aware via the roadmap changes above — confirm no bare-existence pairing remains. Extend sdk/src/query/check-completion.test.ts with a paused-plan phase case (in missing_summaries, complete false) and a complete-summary case that flips it. This consumer is dead in the live path today; fixing it now makes the completion family exhaustive so a future wiring cannot reintroduce the bug.

sdk/src/phase-runner.ts runExecuteStep (~667): change `planIndex.plans.filter(p => !p.has_summary)` to `filter(p => !p.complete)` once phasePlanIndex exposes the status-aware per-plan `complete`. Add `complete: boolean` to PlanInfo in sdk/src/types.ts. Update the doc comment (~625) from "has_summary: true" to the status-aware `complete`. Extend sdk/src/phase-runner.test.ts (makePlanInfo default `complete`, and a case where has_summary true + complete false stays in the run set); keep phase-runner.integration.test.ts green.

sdk/src/query/phase.ts: apply the same status-awareness to BOTH searchPhaseInDir (~118, feeds incomplete_plans) and phasePlanIndex (~297/~361, add the per-plan `complete` field + status-aware `incomplete`, keep has_summary as existence). Confirm (no edit expected) that sdk/src/query/init-complex.ts and sdk/src/query/roadmap.ts inherit the fix through scanPhasePlans.summaryCount/completed.

Add tests/status-aware-completion.test.cjs: build a temp phase dir with plan A (paused summary) + plan B (no summary), assert scanPhasePlans reports A incomplete and phase not complete, phase-plan-index puts A in incomplete with complete:false and does not skip B; then add a complete summary for A and assert phase-plan-index flips A complete. Mirror the phase-plan-index assertions in sdk/src/query/phase.test.ts. Do NOT build sdk/dist or bm yet. Comments describe behavior only; no issue/PR numbers.</action>
  <verify>
    <automated>node tests/status-aware-completion.test.cjs && node tests/checkpoint-status-aware.test.cjs && node tests/plan-scan-matched-summaries.test.cjs && npm --prefix sdk run test && npm --prefix sdk run test:integration</automated>
  </verify>
  <done>phase-plan-index, core searchPhaseInDir, verify.phase-completeness (verify.cjs + verify.ts twins byte-identical), checkpoint.cjs HANDOFF scanner, roadmap.cjs + SDK checkbox ticker, the roadmap/init trust-over-disk override (planCount===0 guard), check-completion.ts, and the SDK PhaseRunner filter all treat a paused-summary plan as incomplete; per-plan `complete` field present on both CJS + SDK phase-plan-index and on PlanInfo; roadmap + verify golden parity holds; CJS + SDK unit green; integration shows zero NEW failures over the pre-existing baseline.</done>
</task>

<task type="auto">
  <name>Task 3: Phase-progression workflows: execute-phase skip-filter + safe_resume_gate + stopped_at veto, transition verify_completion</name>
  <files>workflows/execute-phase.md, workflows/transition.md</files>
  <action>execute-phase.md — Switch the skip-filter to status-aware completeness. At :291 add the new per-plan `complete` field to the parsed field list. At :293 change "Skip plans where has_summary: true" to skip plans where `complete: true` (a paused plan has a summary but complete:false, so it stays in the run set). At :1144 change "ignore plans with has_summary: true" to ignore plans with `complete: true`. Keep the wave-safety and gaps-only rules unchanged.

safe_resume_gate (~:137): today it only stops when production commits exist AND SUMMARY.md is missing. Add the inverse branch: if the current plan's SUMMARY EXISTS but self-declares a partial/paused status (read the SUMMARY's status: front-matter, incomplete set = paused/partial/incomplete/blocked/gaps/gaps_found/not-complete/not_complete), STOP before dispatching the successor and route resume to THAT plan (its checkpoint). Present it as a resume-this-plan recovery path, not the missing-summary options. Use `node bin/gsd-tools.cjs frontmatter get "$SUMMARY_PATH" status` (or the SDK cli equivalent) for the read; note the OFF-PATH gsd-sdk env caveat.

STATE.md stopped_at veto (defense in depth): when STATE.md `stopped_at` names a plan paused at a checkpoint while the file-count marks that same plan complete, surface the disagreement to the user (file-count says complete, stopped_at says paused) rather than silently resolving by file count; route to resume-that-plan. Wire this into the resume routing in the safe_resume_gate step.

transition.md verify_completion (~:44-58) — BLOCKER 1: this step is invoked INLINE by the execute-phase auto-advance chain (execute-phase.md ~:1723-1725 passes --auto). Today it `ls`es *-PLAN.md and *-SUMMARY.md, counts them, and declares "all plans complete" when the counts match — a paused plan's partial SUMMARY makes the counts match and the phase advances without reading status. Replace the raw ls/count logic with the status-aware count: determine completeness by calling the CLI (gsd-sdk is OFF PATH this session, so use `node bin/gsd-tools.cjs query phase.plan-index <phase>` and read its status-aware `complete`/`incomplete`, or `node bin/gsd-tools.cjs query verify.phase-completeness <phase>` and read `complete`/`incomplete_plans`; note the SDK equivalent `node sdk/dist/cli.js query ...`). "All plans complete" only when the status-aware result says complete with an empty incomplete set; if a plan is paused/incomplete, follow the existing "plans incomplete" branch (which already prompts, safety-rail intact). Keep the verification-debt scan and the interactive/yolo confirm branches unchanged. Note the OFF-PATH caveat inline.

Keep edits tight and prose-only; this is workflow markdown, no code. No issue/PR numbers in the workflow text.</action>
  <verify>
    <automated>grep -nE "complete: true|self-declares (partial|paused)|partial/paused|stopped_at" workflows/execute-phase.md | grep -v '^#' | head && grep -nE "phase.plan-index|phase-completeness|status-aware" workflows/transition.md | grep -v '^#' | head</automated>
  </verify>
  <done>execute-phase skip-filter keys on status-aware `complete`; safe_resume_gate has an inverse partial-SUMMARY branch that resumes the paused plan; stopped_at disagreement is surfaced not silently resolved; transition verify_completion decides completeness via the status-aware CLI count, not raw ls/count.</done>
</task>

<task type="auto">
  <name>Task 4: Rebuild sdk/dist, regenerate dist/bm, full-suite + build gates</name>
  <files>sdk/dist/, dist/bm/</files>
  <action>Run LAST, after Tasks 1-3 land the source and workflow changes (build-bm snapshots tracked sdk/dist AND workflows via git ls-files, so the regen must follow the workflow edits). Run `npm --prefix sdk run build` to rebuild sdk/dist, then `node bin/build-bm.cjs` to regenerate dist/bm, then `node bin/build-bm.cjs --check` and confirm PASS. Commit the rebuilt sdk/dist and dist/bm alongside the source. If new test files under tests/ must appear in dist/bm for parity, ensure they are git-tracked before regen. No version bump, no CHANGELOG entry. No issue/PR numbers anywhere in product code or dist.</action>
  <verify>
    <automated>node tests/status-aware-completion.test.cjs && node tests/checkpoint-status-aware.test.cjs && node tests/plan-scan-matched-summaries.test.cjs && npm --prefix sdk run test && npm --prefix sdk run test:integration && npm --prefix sdk run build && node bin/build-bm.cjs && node bin/build-bm.cjs --check</automated>
  </verify>
  <done>SDK unit green (incl. check-completion + verify twin + roadmap ticker parity); integration zero NEW failures over baseline; sdk/dist rebuilt; dist/bm regenerated; build-bm --check reports PASS.</done>
</task>

</tasks>

<verification>
- Live proof (run after Task 2): create a temp phase dir with plan A + a paused SUMMARY for A and plan B with no summary; assert `node -e` that scanPhasePlans reports summaryCount 0 (A excluded) and completed false, that phase-plan-index puts both A and B in `incomplete` with A `complete:false`, that checkpoint.cjs scanPhasePlans puts A in `remaining`, that verify.phase-completeness reports A incomplete on BOTH twins, that check.completion phase scope puts A in missing_summaries with complete false, and that roadmap.update-plan-progress leaves isComplete false.
- CJS regressions: tests/status-aware-completion.test.cjs + tests/checkpoint-status-aware.test.cjs + tests/plan-scan-matched-summaries.test.cjs green.
- SDK parity: npm --prefix sdk run test + npm --prefix sdk run test:integration (zero NEW failures over the pre-existing baseline; roadmap.update-plan-progress AND verify.phase-completeness golden parity tests still pass; phase-runner.integration.test.ts still passes; check-completion.test.ts green).
- Build gates: npm --prefix sdk run build succeeds; node bin/build-bm.cjs regenerates dist/bm; node bin/build-bm.cjs --check reports PASS.
- Hygiene: grep bin/lib sdk/src for issue/PR numbers or status/wave bookkeeping introduced by this change -> none.
</verification>

<success_criteria>
- scanPhasePlans (both twins) excludes incomplete-status matched summaries from summaryCount/completed; status-less/complete counted; unreadable excluded.
- A plan paused at a checkpoint appears in phase-plan-index incomplete / init.execute-phase incomplete_plans and is NOT skipped by the execute-phase filter NOR by SDK PhaseRunner.runExecuteStep; its successor is not dispatched.
- init-complex.ts, roadmap.ts, phase.cjs, core.cjs, phase.ts, verify.cjs + verify.ts, checkpoint.cjs, roadmap.cjs + roadmap-update-plan-progress.ts, check-completion.ts, phase-runner.ts, transition.md verify_completion are all status-aware; NONE uses bare summary existence for completion/skip.
- verify.phase-completeness twins are byte-identical (golden parity holds); check.completion phase scope treats a paused plan as incomplete.
- The roadmap/init trust-over-disk override cannot re-promote a non-complete disk_status when the phase has plans (planCount === 0 guard); the checkbox ticker never wrongly ticks a paused plan; roadmap golden parity holds.
- transition.md verify_completion (the inline auto-advance gate) decides completeness via the status-aware CLI count, so a phase with a paused plan does not auto-advance.
- execute-phase safe_resume_gate resumes a plan whose SUMMARY exists but self-declares partial/paused; skip-filter keys on status-aware `complete`; stopped_at disagreement surfaced.
- CJS + SDK unit + integration green (zero new failures); sdk/dist rebuilt; dist/bm regenerated; build-bm --check PASS.
- No GSD bookkeeping in product code; no version bump / CHANGELOG.
</success_criteria>

<output>
Create `.planning/quick/260723-exn-fix25-status-aware-completion/260723-exn-SUMMARY.md` when done. The #25 root-cause reference and porting notes belong ONLY in that SUMMARY, never in product source.
</output>
