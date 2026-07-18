---
phase: quick-260718-vxw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/lib/surface.cjs
  - tests/surface-empty-manifest-agents.test.cjs
  - bin/lib/config.cjs
  - sdk/src/query/config-mutation.ts
  - sdk/src/query/config-mutation.test.ts
  - tests/config-set-coercion.test.cjs
  - bin/lib/plan-scan.cjs
  - sdk/src/query/plan-scan.ts
  - sdk/src/query/plan-scan.test.ts
  - bin/lib/roadmap.cjs
  - sdk/src/query/roadmap-update-plan-progress.ts
  - sdk/src/query/roadmap-update-plan-progress.test.ts
  - tests/plan-scan-matched-summaries.test.cjs
  - bin/lib/init.cjs
  - sdk/src/query/init-complex.ts
  - sdk/src/query/init-complex.test.ts
  - sdk/src/query/roadmap.ts
  - sdk/src/query/roadmap.test.ts
  - sdk/dist/
  - dist/bm/
autonomous: true
requirements: [QUICK-260718-VXW]
tags: [upstream-sync, cjs-sdk-parity, surface, config-set, plan-scan, completion-count]

must_haves:
  truths:
    - "applySurface with an empty, null, or unresolvable manifest does NOT delete existing gsd-* agent files; a populated manifest still prunes superseded gsd-* files"
    - "config-set with value 'Infinity' or '-Infinity' persists the literal string, never a coerced Infinity that JSON.stringify turns into null"
    - "config-set project_code 007 persists the string '007', not the number 7, in BOTH the CJS and SDK resolvers with byte-identical {updated,key,value,previousValue} output"
    - "A stray non-plan summary (e.g. 30-FIX-CR02-SUMMARY.md, 30-GAPCLOSURE-SUMMARY.md) is excluded from summaryCount in both twins, so a phase with 3 plans, 2 plan summaries, and 1 stray summary reports 2/3 and stays incomplete"
    - "roadmap update-plan-progress does not tick the phase checkbox when the count only reaches planCount via a stray summary, in both twins"
    - "init-manager and the init phase-list (bin/lib/init.cjs), initProgress/initManager (sdk init-complex.ts), and roadmap.analyze (sdk roadmap.ts) do NOT report a phase as complete off a stray non-plan summary; all three route through the paired count"
    - "bin/lib and sdk/src comments describe behavior only; no upstream PR numbers or porting notes in product code"
  artifacts:
    - path: "bin/lib/surface.cjs"
      provides: "empty-staged-set guard so the gsd-* prune loop cannot run against a nothing-staged sync"
    - path: "tests/surface-empty-manifest-agents.test.cjs"
      provides: "regression: empty/unresolvable manifest must not delete existing gsd-* agents; populated manifest still prunes"
      min_lines: 50
    - path: "bin/lib/config.cjs"
      provides: "Number.isFinite numeric branch + string-typed key carve-out in cmdConfigSet"
      contains: "Number.isFinite"
    - path: "sdk/src/query/config-mutation.ts"
      provides: "Number.isFinite in parseConfigValue + string-typed key carve-out in configSet (not in key-context-free parseConfigValue)"
      contains: "Number.isFinite"
    - path: "bin/lib/plan-scan.cjs"
      provides: "shared summary-to-plan pairing helper (countMatchedSummaries) wired into scanPhasePlans"
      contains: "countMatchedSummaries"
    - path: "sdk/src/query/plan-scan.ts"
      provides: "identical pairing helper for the SDK twin, exported for roadmap-update-plan-progress, init-complex, and roadmap consumers"
      contains: "countMatchedSummaries"
    - path: "tests/plan-scan-matched-summaries.test.cjs"
      provides: "CJS fixture proof that stray non-plan summaries are excluded from summaryCount/completed, including the init.cjs completion paths"
      min_lines: 50
  key_links:
    - from: "bin/lib/roadmap.cjs"
      to: "bin/lib/plan-scan.cjs"
      via: "cmdUpdatePlanProgress computes summaryCount through the pairing helper, not phaseInfo.summaries.length"
      pattern: "countMatchedSummaries"
    - from: "sdk/src/query/roadmap-update-plan-progress.ts"
      to: "sdk/src/query/plan-scan.ts"
      via: "summaryCount through the pairing helper, not info.summaries.length"
      pattern: "countMatchedSummaries"
    - from: "bin/lib/init.cjs"
      to: "bin/lib/plan-scan.cjs"
      via: "cmdInitManager (~1143-1147) and the phase-list block (~1424-1428) take summaryCount/completed from scanPhasePlans paired output, not listPhaseSummaryFiles(...).length"
      pattern: "scanPhasePlans"
    - from: "sdk/src/query/init-complex.ts"
      to: "sdk/src/query/plan-scan.ts"
      via: "listPhasePlanAndSummaryCounts duplicate raw scanner replaced by scanPhasePlans import; initProgress/initManager status uses the paired count"
      pattern: "plan-scan"
    - from: "sdk/src/query/roadmap.ts"
      to: "sdk/src/query/plan-scan.ts"
      via: "countPhasePlansAndSummaries duplicate raw scanner replaced by scanPhasePlans import; roadmapAnalyze diskStatus uses the paired count"
      pattern: "plan-scan"
    - from: "sdk/src/golden/golden-integration-covered.ts"
      to: "config-set"
      via: "existing golden parity keeps CJS and SDK config-set output byte-identical after the coercion change"
    - from: "must_haves build gates"
      to: "dist/bm"
      via: "npm --prefix sdk run build succeeds; node bin/build-bm.cjs regenerates dist/bm; node bin/build-bm.cjs --check reports PASS"
---

<objective>
Port the three Tier-1 correctness fixes identified by the 260718-vhs triage of upstream gsd-core 1.7.0 into this fork: the applySurface empty-manifest agent-delete guard (CJS only), the config-set Infinity/string-key coercion fix (both twins), and the stray-summary phase-completion inflation fix (both twins). The completion fix must reach EVERY consumer that flips a phase to complete, including the three duplicate raw-count scanners in init.cjs, init-complex.ts, and roadmap.ts. Keep CJS and SDK resolvers in lock-step (golden parity), rebuild sdk/dist, and regenerate dist/bm so the bm plugin carries the fixes too.

Purpose: an empty manifest currently deletes every installed gsd-* agent; config-set silently destroys data for Infinity and mangles string-typed keys like project_code; stray remediation summaries can flip a phase to Complete in roadmap update-plan-progress, init-manager, init-progress, and roadmap.analyze. All three are shipping data-loss or state-corruption bugs.

Output: guarded surface.cjs, corrected coercion in both config twins, a shared summary-to-plan pairing helper in both plan-scan twins wired through every completion-count consumer (plan-scan callers plus the init/roadmap duplicate scanners), regression tests on both sides, rebuilt sdk/dist and dist/bm.

Context note for the executor: this plan spans ~20 files across 4 tasks. Each task is self-contained; complete and verify one task fully before opening files for the next, and do not re-read files already in context.
</objective>

<execution_context>
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.1.1/workflows/execute-plan.md
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.1.1/templates/summary.md
</execution_context>

<context>
@.planning/quick/260718-vhs-triage-upstream-gsd-core-1-7-0-claude-re/260718-vhs-FINDINGS.md
@bin/lib/surface.cjs
@bin/lib/config.cjs
@bin/lib/plan-scan.cjs
@sdk/src/query/config-mutation.ts
@sdk/src/query/plan-scan.ts

<interfaces>
<!-- Extracted from the codebase; use directly, no exploration needed. -->

From bin/lib/surface.cjs (the bug):
- applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, clusterMap) at line 213; resolveSurface derives skills/agents from the manifest, so an empty/null manifest yields empty sets.
- _syncGsdDir(stagedDir, destDir, context) at line 245: builds stagedFiles from readdirSync(stagedDir), then at lines 267-273 unlinks every dest .md not in stagedFiles (agents context: only gsd-* prefixed). Empty stagedFiles = every gsd-* agent deleted.

From bin/lib/config.cjs cmdConfigSet (line 393):
- Coercion chain at 415-421: 'true'/'false' -> boolean; `!isNaN(value) && value !== ''` -> Number(value); leading [ or { -> JSON.parse. Output contract via output(): { updated, key, value, previousValue }.

From sdk/src/query/config-mutation.ts:
- parseConfigValue(value) at line 207 (key-context-free; same chain, `!isNaN(Number(value))` at 210).
- configSet handler at line 266 calls parseConfigValue at 289, has per-key validations after (context at 292, ship.pr_body_sections at 300). The string-key carve-out belongs HERE, keyed off keyPath, NOT inside parseConfigValue.
- String-typed schema keys live in bin/lib/config-schema.cjs (project_code at line 76; also phase_naming, response_language, claude_md_path, etc. in the same set).

From bin/lib/plan-scan.cjs / sdk/src/query/plan-scan.ts (identical twins):
- scanPhasePlans(phaseDir) returns { planCount, summaryCount, completed, hasNestedPlans, planFiles, summaryFiles }; summaryCount = summaryFiles.length raw (CJS 120-121, SDK 71-72); completed = planCount > 0 && summaryCount >= planCount.
- isRootSummaryFile: endsWith('-SUMMARY.md') || f === 'SUMMARY.md' (CJS 62, SDK 29). Nested layout uses SUMMARY-NN / PLAN-NN names.
- Existing base-id derivation to mirror for pairing: bin/lib/phase.cjs:55 and sdk/src/query/phase.ts:84 strip -PLAN.md / -SUMMARY.md to a base; phase.cjs:381 and phase.ts:299 pair via `s === 'SUMMARY.md' ? 'PLAN' : s.replace('-SUMMARY.md','')` plus extractCanonicalPlanId.

Completion-count consumers, full map (verified):

Group A: fixed automatically once scanPhasePlans pairs (they already call it):
- bin/lib/roadmap.cjs:41 countPhasePlansAndSummaries, bin/lib/state.cjs:408,824,1465,1547, workstream-inventory (both twins).

Group B: raw counts bypassing scanPhasePlans, must be rerouted explicitly:
- bin/lib/roadmap.cjs:362 `summaryCount = phaseInfo.summaries.length` then `isComplete = summaryCount >= planCount` (~369) in cmdUpdatePlanProgress; checkbox tick below. (Task 3)
- sdk/src/query/roadmap-update-plan-progress.ts:61-62 (info.plans.length / info.summaries.length) and :75 isComplete. (Task 3)
- bin/lib/init.cjs: helper listPhaseSummaryFiles (line 20) returns scanPhasePlans(...).summaryFiles, the RAW list. cmdInitManager at 1142-1147 does `summaryCount = listPhaseSummaryFiles(fullDir).length` then `if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete'`. The phase-list block at 1424-1428 does the same with `summaries.length >= plans.length` for status 'complete'. (Task 4)
- sdk/src/query/init-complex.ts:177 listPhasePlanAndSummaryCounts is an INDEPENDENT duplicate raw scanner (own readdirSync + endsWith filters, no plan-scan import); used at ~396-400 (initProgress status 'complete'), ~424 (summary_count), and ~572-578 (initManager diskStatus). (Task 4)
- sdk/src/query/roadmap.ts:560 countPhasePlansAndSummaries is ANOTHER independent duplicate raw scanner (no plan-scan import); used by the exported roadmapAnalyze handler at ~690-699 to set diskStatus 'complete'/'partial'. (Task 4)

Group C: verified correct or intentionally untouched, do NOT change:
- bin/lib/checkpoint.cjs:139 local scanner already pairs by id (summaryIds.has(id)); no inflation.
- bin/lib/phase.cjs:373 / sdk/src/query/phase.ts:289 already pair summaries to plan ids per-plan; leave the id-pairing logic alone (only replace any remaining raw length-vs-length completion comparison, per Task 3 audit).
- bin/lib/init.cjs:973,985 `hasSummary = ...length > 0` is activity detection, not completion; leave as-is.
- Display-only ratios (cosmetic, do NOT gate anything): bin/lib/phase.cjs cmdPhaseComplete ~1103 (`summaryCount = phaseInfo.summaries.length`, rendered as "X/Y plans complete" at ~1151-1177) and sdk/src/query/phase-lifecycle.ts ~1073 (same twin). Pairing the displayed count is optional if trivial; do NOT add a completion/verification gate there (that is the separate deferred #2022 decision, out of scope).

Test conventions:
- CJS: zero-dep node:assert scripts at tests/*.test.cjs, run via `node tests/<name>.test.cjs` (see tests/audit-open-quick-tasks.test.cjs for fixture-tempdir style).
- SDK: vitest colocated *.test.ts; `npm --prefix sdk test` (unit), `npm --prefix sdk run test:integration` (golden CJS-vs-SDK parity; config-set is in golden-integration-covered.ts:8, roadmap.update-plan-progress in golden-mutation-covered.ts:16). Existing suites to extend in Task 4: sdk/src/query/init-complex.test.ts, sdk/src/query/roadmap.test.ts.
- Manual SDK checks must use `node sdk/dist/cli.js`, never the PATH `gsd-sdk` (resolves the installed cache, not this repo).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Guard applySurface against empty/unresolvable manifests deleting gsd-* agents</name>
  <files>bin/lib/surface.cjs, tests/surface-empty-manifest-agents.test.cjs</files>
  <action>In bin/lib/surface.cjs, stop the prune loop from running when nothing was staged. In _syncGsdDir (line 245), after building stagedFiles, return before the removal loop (lines 264-273) when stagedFiles.size === 0; the copy loop is a no-op in that case so copying of genuinely-new files is unaffected. Additionally, in applySurface (line 213), early-return before any sync when the manifest is null/undefined or has no entries (manifest.size === 0), so an unresolvable install source or empty manifest can never reach the sync at all. Comment the guard in behavior terms only (an empty staged set means the surface could not be resolved, so pruning would delete every installed agent); no upstream PR numbers or porting notes anywhere in the file.

Create tests/surface-empty-manifest-agents.test.cjs following the zero-dep node:assert + os.tmpdir fixture style of tests/audit-open-quick-tasks.test.cjs. Cases: (1) dest agents dir with gsd-planner.md, gsd-executor.md, and a non-gsd other.md; calling _syncGsdDir with an existing-but-empty staged dir must leave all three untouched; (2) applySurface with an empty Map() manifest must leave existing gsd-* agents untouched; (3) control: _syncGsdDir with a staged dir containing gsd-planner.md must still prune gsd-executor.md (superseded) and never touch other.md, proving the normal prune path still works. Exercise the internals via require('../bin/lib/surface.cjs') exported functions; if _syncGsdDir is not exported, export it alongside applySurface (module.exports addition, no behavior change).</action>
  <verify>
    <automated>node tests/surface-empty-manifest-agents.test.cjs && npm --prefix sdk test && npm --prefix sdk run test:integration</automated>
  </verify>
  <done>Empty/null manifest and empty staged dir leave existing gsd-* agents intact; populated staged set still prunes superseded gsd-* files and never touches non-gsd files; new CJS regression test passes; SDK unit + golden parity suites stay green (this fix is CJS-only, suites prove no collateral).</done>
</task>

<task type="auto">
  <name>Task 2: Fix config-set numeric coercion (Infinity + string-typed keys) in both twins</name>
  <files>bin/lib/config.cjs, sdk/src/query/config-mutation.ts, sdk/src/query/config-mutation.test.ts, tests/config-set-coercion.test.cjs</files>
  <action>Two coordinated changes, kept byte-identical in effect across twins (config-set is golden-covered with contract {updated,key,value,previousValue}).

(a) Finite-number gate. In bin/lib/config.cjs cmdConfigSet line 418, replace the `!isNaN(value) && value !== ''` branch with a Number.isFinite(Number(value)) check (empty-string exclusion preserved), so 'Infinity' and '-Infinity' fall through and stay strings instead of coercing to Infinity and persisting as null via JSON.stringify. In sdk/src/query/config-mutation.ts parseConfigValue line 210, make the same change (`value !== '' && Number.isFinite(Number(value))`).

(b) String-typed key carve-out, keyed off the config PATH. Define a STRING_CONFIG_KEYS set (minimum: 'project_code'; include the other free-string schema keys from bin/lib/config-schema.cjs line 76 area that a numeric-looking value could corrupt, e.g. phase_naming, response_language, claude_md_path) and, when keyPath is in the set, bypass coercion entirely: parsedValue = the raw string verbatim. In CJS this goes in cmdConfigSet before the coercion chain (line ~415). In the SDK this goes in configSet (line ~289, skip the parseConfigValue call for those keys); do NOT touch the key-context-free parseConfigValue for this. Keep the set literally identical in both twins so golden output matches.

Tests. SDK: extend sdk/src/query/config-mutation.test.ts with parseConfigValue cases ('Infinity' -> 'Infinity', '-Infinity' -> '-Infinity', '42' still -> 42, '4.5' still -> 4.5) and a configSet case writing project_code '007' then asserting the persisted config.json value and the returned value are the string '007'. CJS: new tests/config-set-coercion.test.cjs (node:assert, temp project dir) driving `node bin/gsd-tools.cjs config-set` for: workflow.inline_plan_threshold 'Infinity' stays the string 'Infinity' in config.json (not null); project_code '007' stays '007'; a genuine number key still coerces (control). Comments describe behavior only; no upstream PR references.</action>
  <verify>
    <automated>node tests/config-set-coercion.test.cjs && node tests/config-schema-sdk-parity.test.cjs && npm --prefix sdk test && npm --prefix sdk run test:integration</automated>
  </verify>
  <done>'Infinity'/'-Infinity' persist as literal strings in both twins (no null in config.json); project_code '007' persists as the string '007' in both twins; ordinary numeric values still coerce; CJS+SDK unit tests and the config-set golden parity check all pass.</done>
</task>

<task type="auto">
  <name>Task 3: Pair summaries to plans before counting phase completion in the plan-scan twins and roadmap update-plan-progress</name>
  <files>bin/lib/plan-scan.cjs, sdk/src/query/plan-scan.ts, sdk/src/query/plan-scan.test.ts, bin/lib/roadmap.cjs, sdk/src/query/roadmap-update-plan-progress.ts, sdk/src/query/roadmap-update-plan-progress.test.ts, tests/plan-scan-matched-summaries.test.cjs</files>
  <action>Add ONE shared pairing helper per twin and wire it through the plan-scan core and the roadmap update-plan-progress path (Task 4 routes the remaining init/roadmap-analyze consumers through the same helper). Do NOT modify bin/lib/audit.cjs (the 4.1.2 audit-open work is a different file and unrelated).

Helper: export countMatchedSummaries(planFiles, summaryFiles) from bin/lib/plan-scan.cjs and sdk/src/query/plan-scan.ts (identical logic). Derive a base id per file by stripping -PLAN.md / -SUMMARY.md (bare PLAN.md pairs with bare SUMMARY.md; nested SUMMARY-NN pairs with PLAN-NN), mirroring the existing derivation at bin/lib/phase.cjs:55 / sdk phase.ts:84 and the exact+canonical dual at phase.cjs:381 / phase.ts:299 so extended layouts (5-PLAN-01-setup.md) still pair. A summary counts only if its id matches some plan file's id; 30-FIX-CR02-SUMMARY.md and 30-GAPCLOSURE-SUMMARY.md match no plan and are excluded.

Wiring: (1) scanPhasePlans in BOTH twins sets summaryCount = countMatchedSummaries(planFiles, summaryFiles) and derives completed from it; keep summaryFiles as the raw list (init.cjs and display consumers want the real files). This automatically fixes roadmap.cjs countPhasePlansAndSummaries (:41/:260), state.cjs (:408,:824,:1465,:1547), and workstream-inventory in both twins. (2) bin/lib/roadmap.cjs cmdUpdatePlanProgress (~:362): compute summaryCount via countMatchedSummaries(phaseInfo.plans, phaseInfo.summaries) instead of phaseInfo.summaries.length, so isComplete and the checkbox tick cannot be inflated. (3) sdk/src/query/roadmap-update-plan-progress.ts (:61-62,:75): same change via the plan-scan.js import. (4) Audit bin/lib/phase.cjs:315,373 and sdk/src/query/phase.ts:70,289: the per-plan pairing there already uses ids (no inflation), so only replace any remaining raw `summaries.length` vs `plans.length` completion comparison with the helper; leave the id-pairing logic itself alone. bin/lib/checkpoint.cjs:139's local scanner already pairs by id and needs no change. Audit scope note: bin/lib/phase.cjs cmdPhaseComplete ~1103 and sdk/src/query/phase-lifecycle.ts ~1073 build a DISPLAY-ONLY "X/Y plans complete" ratio from the raw summaries.length; they gate nothing. Pairing the displayed count via the helper is optional if trivial while you are in the file; do NOT add any completion/verification gate there (that is the separate deferred #2022 decision, out of scope).

Tests: extend sdk/src/query/plan-scan.test.ts with stray-summary fixtures (3 plans + 3 plan summaries + 1 stray -> summaryCount 3, completed true; 1 plan + only a stray summary -> summaryCount 0, completed false; bare PLAN.md + SUMMARY.md still pairs; nested layout stray SUMMARY excluded). New tests/plan-scan-matched-summaries.test.cjs with the same fixture matrix against the CJS twin. Extend sdk/src/query/roadmap-update-plan-progress.test.ts with a phase containing a stray non-plan summary: summary_count excludes it and the phase checkbox is NOT ticked when only the stray would push the count to planCount.

Do NOT run the sdk build or bm regeneration yet; Task 4 modifies more SDK sources and finishes with the build gates. Product-code comments describe pairing behavior only; upstream PR numbers (#2018/#1581/#1988) belong ONLY in the .planning SUMMARY.</action>
  <verify>
    <automated>node tests/plan-scan-matched-summaries.test.cjs && npm --prefix sdk test && npm --prefix sdk run test:integration</automated>
  </verify>
  <done>Stray non-plan summaries are excluded from summaryCount/completed in both plan-scan twins; roadmap update-plan-progress reports the paired count and never ticks a checkbox off a stray summary (roadmap.update-plan-progress golden parity green); phase.cjs/phase.ts audit done with id-pairing left intact.</done>
</task>

<task type="auto">
  <name>Task 4: Route the init and roadmap-analyze completion consumers through the paired count, then rebuild sdk/dist and regenerate dist/bm</name>
  <files>bin/lib/init.cjs, sdk/src/query/init-complex.ts, sdk/src/query/init-complex.test.ts, sdk/src/query/roadmap.ts, sdk/src/query/roadmap.test.ts, tests/plan-scan-matched-summaries.test.cjs, sdk/dist/, dist/bm/</files>
  <action>Three consumers still compute phase completion from raw summary counts and would flip a phase to complete off a stray summary even after Task 3. Route each through the paired count from the plan-scan twins. Do not touch the Group C sites listed in the interfaces block (checkpoint.cjs, phase.cjs:373/phase.ts:289 id-pairing, init.cjs:973/985 hasSummary activity checks, state.cjs, roadmap.cjs:41, workstream-inventory).

(1) bin/lib/init.cjs. In cmdInitManager (~1128-1152), replace `planCount = listPhasePlanFiles(fullDir).length; summaryCount = listPhaseSummaryFiles(fullDir).length` with a single `scanPhasePlans(fullDir)` call, taking planCount and the PAIRED summaryCount from it, so the `summaryCount >= planCount` diskStatus='complete' branch at 1147 cannot be inflated. In the phase-list block (~1424-1428), same change: take plan_count, summary_count, and the 'complete' status from scanPhasePlans paired output instead of `listPhaseSummaryFiles(phasePath)` + `summaries.length >= plans.length`. scanPhasePlans is already required at init.cjs:11; keep listPhaseSummaryFiles for the raw-list callers that remain.

(2) sdk/src/query/init-complex.ts. Delete the duplicate raw scanner listPhasePlanAndSummaryCounts (~177-195) and import scanPhasePlans from './plan-scan.js' instead. At ~396-400 (initProgress status), ~424 (summary_count), and ~572-578 (initManager diskStatus), use scanPhasePlans's planCount/summaryCount/completed; if the plan or summary file LISTS are needed anywhere, use planFiles/summaryFiles from the same scan result. The paired summaryCount must feed every status/diskStatus 'complete' comparison and every summary_count output field.

(3) sdk/src/query/roadmap.ts. Replace the internals of countPhasePlansAndSummaries (~560-580) with a call to scanPhasePlans (import from './plan-scan.js'): planCount/summaryCount come from the scan (paired), while the hasContext/hasResearch checks keep reading the phase dir as today. Signature may stay async; the roadmapAnalyze diskStatus chain at ~690-699 then inherits the paired count. total_summaries (~769) inherits it too, which is the desired behavior.

Tests. Extend sdk/src/query/init-complex.test.ts and sdk/src/query/roadmap.test.ts with a shared-shape fixture: a phase dir with 2 plans, 1 matching plan summary, and 1 stray summary (e.g. 30-GAPCLOSURE-SUMMARY.md) must report summary_count 1 and status/diskStatus NOT 'complete' (partial/in_progress per each handler's vocabulary). Extend tests/plan-scan-matched-summaries.test.cjs (or add a section to it) covering the CJS init paths with the same fixture, driving the exported functions from bin/lib/init.cjs or the gsd-tools CLI, asserting the phase is not reported complete.

Finish (the bm gate, LAST because it snapshots all SDK source changes from Tasks 2-4): run `npm --prefix sdk run build` to rebuild sdk/dist, then `node bin/build-bm.cjs` to regenerate dist/bm, then `node bin/build-bm.cjs --check` and confirm PASS. Commit the rebuilt sdk/dist and dist/bm alongside the source. Product-code comments describe behavior only; no upstream PR numbers or porting notes.</action>
  <verify>
    <automated>node tests/plan-scan-matched-summaries.test.cjs && npm --prefix sdk test && npm --prefix sdk run test:integration && npm --prefix sdk run build && node bin/build-bm.cjs && node bin/build-bm.cjs --check</automated>
  </verify>
  <done>init-manager and the init phase-list (CJS), initProgress/initManager (SDK), and roadmap.analyze all take completion from the paired count; the duplicate raw scanners in init-complex.ts and roadmap.ts are gone (both import plan-scan); stray-summary fixtures pass in both twins; sdk/dist rebuilt; dist/bm regenerated with --check PASS.</done>
</task>

</tasks>

<verification>
- All three new CJS tests pass standalone: `node tests/surface-empty-manifest-agents.test.cjs`, `node tests/config-set-coercion.test.cjs`, `node tests/plan-scan-matched-summaries.test.cjs`
- SDK unit suite green: `npm --prefix sdk test`
- Cross-boundary golden parity green (covers config-set and roadmap.update-plan-progress): `npm --prefix sdk run test:integration`
- Duplicate raw scanners removed: `grep -c "rootSummaries" sdk/src/query/init-complex.ts sdk/src/query/roadmap.ts` reports 0 for both (their local raw filters are gone; both files import from './plan-scan.js')
- init.cjs completion paths paired: `grep -n "listPhaseSummaryFiles(fullDir).length" bin/lib/init.cjs` returns nothing
- Build gates: `npm --prefix sdk run build` succeeds; `node bin/build-bm.cjs` regenerates dist/bm; `node bin/build-bm.cjs --check` reports PASS
- Grep gate for bookkeeping leakage: `grep -rn "2018\|1581\|1988\|upstream" bin/lib/surface.cjs bin/lib/config.cjs bin/lib/plan-scan.cjs bin/lib/init.cjs sdk/src/query/config-mutation.ts sdk/src/query/plan-scan.ts sdk/src/query/init-complex.ts sdk/src/query/roadmap.ts | grep -v node_modules` shows no upstream-PR/porting references introduced by this work
- bin/lib/audit.cjs untouched: `git diff --name-only` does not list it
</verification>

<success_criteria>
- An empty or unresolvable surface manifest can no longer delete installed gsd-* agents, with a regression test proving it
- config-set 'Infinity'/'-Infinity' and string-typed keys (project_code '007') survive verbatim in both resolvers with byte-identical output
- Phase completion counts pair summaries to real plans in both resolvers and every completion consumer (plan-scan callers, roadmap update-plan-progress, init-manager, init phase-list, initProgress, roadmap.analyze); a stray remediation summary can no longer flip a phase to Complete anywhere
- sdk/dist and dist/bm are regenerated and in sync (--check PASS), so the bm plugin ships all three fixes
</success_criteria>

<output>
Create `.planning/quick/260718-vxw-port-upstream-gsd-core-1-7-0-tier-1-corr/260718-vxw-SUMMARY.md` when done. Record the upstream provenance there (gsd-core 1.7.0 PRs #2018, #1581, #1988), NOT in product code.
</output>
