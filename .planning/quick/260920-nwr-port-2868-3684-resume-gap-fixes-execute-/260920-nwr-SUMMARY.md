---
phase: 260920-nwr
plan: 01
subsystem: [execute-phase, agent-skills, config-schema, security]
tags: [upstream-sync, resume, agent-skills, config-schema, security]
requires:
  - workflows/execute-phase.md discover_and_group_plans
  - bin/lib/security.cjs validatePath
  - sdk/src/query/skills.ts resolveWithinBase
provides:
  - Status-aware all-filtered resume decision (resumes at aggregate_results or update_roadmap)
  - agent_skills_security.trusted_global_roots in both resolver + schema twins
affects:
  - /bm:execute-phase resume behaviour
  - global:<name> skill resolution
tech-stack:
  added: []
  patterns: [twin-parity (CJS+SDK), byte-identical strings across twins]
key-files:
  created:
    - tests/execute-phase-resume-gaps.test.cjs
    - tests/trusted-global-roots.test.cjs
  modified:
    - workflows/execute-phase.md
    - bin/lib/security.cjs
    - bin/lib/init.cjs
    - bin/lib/core.cjs
    - sdk/src/query/skills.ts
    - bin/lib/config-schema.cjs
    - sdk/src/query/config-schema.ts
    - sdk/src/query/skills.test.ts
    - references/planning-config.md
    - README.md
    - .github/workflows/check-drift.yml
    - sdk/dist/
    - dist/bm/
decisions:
  - Dropped upstream's blocked_by ("stuck on a halt") branch: our phase-plan-index has no blocked_by and the status-aware filter keeps blocked/paused/partial plans (complete:false) in the run set, so an all-filtered state can only mean every plan is complete or retired.
  - Surfaced agent_skills_security through the CJS shaped loadConfig (core.cjs). The CJS loadConfig returns a constructed object, not the raw parsed config, so agent_skills_security would be invisible to buildAgentSkillsBlock without this line. The SDK loadConfig spreads ...parsed, so no SDK config change was needed.
metrics:
  duration: ~35m
  completed: 2026-09-20
---

# Phase 260920-nwr Plan 01: Resume-gap fixes and trusted global skill roots Summary

Two disjoint upstream ports landed in both plugins (gsd source tree and the generated dist/bm). Part A replaces execute-phase's unconditional "No matching incomplete plans" dead-end with a status-aware 4-way decision that resumes the phase tail (upstream issues 2868 and 3684). Part B adds agent_skills_security.trusted_global_roots so a global skill symlinked outside the runtime skills dir is accepted only when its real location sits under a configured trusted root (upstream PR 754).

## Part A: status-aware all-filtered resume (upstream 2868, 3684)

`workflows/execute-phase.md` discover_and_group_plans previously exited whenever every plan was filtered out, even when the run that completed the plans died before verification (no VERIFICATION.md) or before the ROADMAP tick (VERIFICATION.md exists, checkbox unticked). The single exit line is now a 4-way decision, evaluated in order:

1. A filter is active (`--gaps-only` or `WAVE_FILTER`): exit unchanged.
2. No filter and `check.verification-status` is `missing`: resume at `aggregate_results` (upstream 2868).
3. No filter, verification exists, `roadmap_complete` is not true: resume at `update_roadmap` (upstream 3684).
4. No filter, verified, and ticked: exit (genuinely done).

Two read-only probes drive it: `bm-sdk query check.verification-status` (SDK-only, returns `missing` when no VERIFICATION.md exists) and `roadmap.analyze` (both twins) with leading-zero normalization on both sides of the phase-number compare. Both have the bundled-tool fallback per the plugin path-form convention. No CJS/SDK source change for Part A.

Dropped upstream's condition 2 (the `blocked_by` "stuck on a halt" branch): our plan index does not surface `blocked_by`, and the status-aware filter keeps blocked/paused/partial plans (`complete:false`) in the run set. Our `complete` vocabulary (a SUMMARY whose frontmatter status is not in INCOMPLETE_SUMMARY_STATUSES) reads `retired` as complete without any code change, so `status: retired` counts as complete and does not need the upstream `has_summary` distinction.

## Part B: trusted_global_roots (upstream PR 754)

`loadTrustedGlobalRoots(config)` is exported from `bin/lib/security.cjs` and inlined byte-identically in `sdk/src/query/skills.ts`. Hardening: tilde-expand, reject non-absolute, reject the filesystem/drive/UNC root and the home directory, realpath every root, drop non-existent roots, de-dupe by resolved real path (first occurrence wins). Any non-array config, missing key, or non-string entry yields `[]`, so the default behaviour is byte-identical to today.

The `global:<name>` containment check in both resolver twins (`bin/lib/init.cjs` buildAgentSkillsBlock, `sdk/src/query/skills.ts` agentSkills) computes the trusted roots once before the skill loop. On base-check failure it accepts the skill if the resolved path is contained under any trusted root (reusing `validatePath` / `resolveWithinBase` per root) and writes a stderr NOTE; otherwise the existing symlink-escape WARNING stands and the skill is skipped. The plugin-form `global:<plugin>:<skill>` branch and the project-relative branch are untouched. The NOTE and WARNING strings are byte-identical across twins. The blocks were restructured so the pre-existing WARNING line (which carries an em-dash) stays as unchanged diff context, keeping the hygiene scan clean.

`agent_skills_security.trusted_global_roots` is registered as a fixed leaf key in both `VALID_CONFIG_KEYS` sets (config-schema twins); the parity test extracts and compares both, and stays green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CJS loadConfig did not surface agent_skills_security**
- **Found during:** Task 2
- **Issue:** The plan assumed both config loaders pass unknown top-level keys through untouched. That is true for the SDK (`...parsed`) but not the CJS `loadConfig`, which returns a shaped object with only explicitly extracted keys. `buildAgentSkillsBlock` therefore received a config with no `agent_skills_security`, so `loadTrustedGlobalRoots(config)` always returned `[]` and the trusted-accept path never fired.
- **Fix:** Added `agent_skills_security: parsed.agent_skills_security || null,` next to the existing `agent_skills` line in `bin/lib/core.cjs` loadConfig. No SDK change needed.
- **Files modified:** bin/lib/core.cjs
- **Commit:** 356726c

## Assumption Drift (advisory)

- Planned: both config loaders pass unknown top-level keys through untouched (so agent_skills_security reaches the resolvers with no loader change). Actual: only the SDK does; the CJS loadConfig is a shaped extractor and needed one explicit passthrough line. Why: the CJS twin constructs its return object rather than spreading the parsed config. Handled as the Rule 3 fix above.

## Mandatory Final Gate (real output)

### Gate 1: Part A #2868 inputs (all plans complete, one retired, NO VERIFICATION.md)

```
phase-plan-index 9 -> complete: [true,true] incomplete: []
check.verification-status 9 -> status: missing
```

### Gate 2: Part A #3684 inputs (verified + ROADMAP unticked) + idempotency

```
roadmap.analyze phase 9 -> roadmap_complete: false
check.verification-status 9 -> status: passed (not missing)
phase complete twice -> ROADMAP md5 first=710613e667abe9737a4c4728dd8af846 second=710613e667abe9737a4c4728dd8af846 IDENTICAL
```

### Gate 3: Part A workflow-text pins

```
old exit line present?: 0 (0 = gone)
markers in discover_and_group_plans slice:
  check.verification-status: 3
  roadmap_complete: 1
  aggregate_results: 1
  update_roadmap: 1
  WAVE_FILTER: 4
  --gaps-only: 2
  #2868: 1
  #3684: 1
```

### Gate 4: Part B acceptance / rejection matrix (both twins)

CJS `tests/trusted-global-roots.test.cjs`: 11/11 checks passed (default reject with WARNING; trusted accept with NOTE and the exact `- @<cfg>/skills/ext-skill/SKILL.md` block; project-relative, `/`, homedir and non-existent roots each rejected; in-base skill loads with no NOTE; plugin-form untouched).

SDK vitest `src/query/skills.test.ts`: 25 tests passed (the 5 new trusted_global_roots cases plus the prior 20).

Built SDK CLI (`sdk/dist/cli.js`) proof:

```
=== BUILT CLI trusted: stdout ===
<agent_skills>
Read these user-configured skills:
- @/private/tmp/.../bcli-sKUA/cfg/skills/ext-skill/SKILL.md
</agent_skills>
=== BUILT CLI trusted: stderr ===
[agent-skills] NOTE: Global skill "ext-skill" accepted via trusted_global_roots (resolves under /private/tmp/.../bcli-sKUA/outside)
=== BUILT CLI default: stdout ===
""
=== BUILT CLI default: stderr ===
[agent-skills] WARNING: Global skill "ext-skill" failed path check (symlink escape?) - skipping
```

(The literal WARNING string in source retains its pre-existing em-dash; reproduced here with an ASCII hyphen per output rules.)

### Gate 5: config-schema parity + leaf-key accept / arbitrary reject

```
config-schema-sdk-parity: all checks passed
config-set agent_skills_security.trusted_global_roots '["/tmp/foo"]' -> {"updated":true,...}
config-set agent_skills_security.bogus '1' -> Error: Unknown config key: "agent_skills_security.bogus". Valid keys: agent_skills_security.trusted_global_roots, ...
```

### Gate 6: full CJS battery, SDK unit, SDK integration vs baseline

```
CJS baseline FAILs: context-monitor-hook-event, version-command
CJS after   FAILs: context-monitor-hook-event, version-command
diff baseline vs after -> NO NEW CJS FAILURES

SDK unit: Test Files 129 passed (129); Tests 1913 passed (1913)

SDK integration baseline: 14 failed | 72 passed | 13 skipped
SDK integration after (3 consecutive runs): 14 failed | 72 passed | 13 skipped
```

Note: one intermediate integration run showed 15/71, a transient blip: the golden/read-only-parity tests read the live (dirty) repo `.planning/ROADMAP.md`, whose milestone parse and clock-derived quick fields are volatile. Three consecutive re-runs all return 14/72, matching baseline exactly; no failure references agent_skills_security or trusted_global_roots. The `agent-name-normalization` failure the planner measured did not appear in either baseline or after (commit cfaaadf scoped the doc-marker scan to product files).

### Gate 7: git add -N, build-bm, --check

```
git add -N tests/execute-phase-resume-gaps.test.cjs tests/trusted-global-roots.test.cjs
node bin/build-bm.cjs -> built dist/bm (version 4.8.0)
node bin/build-bm.cjs --check -> bm drift check: PASS (committed dist/bm matches a fresh build)
bm-parity + build-bm-drift tests -> all passed
dist twins carried: check.verification-status(dist/bm workflow)=4, loadTrustedGlobalRoots(dist/bm security.cjs)=2, trusted_global_roots(dist/bm config ref)=1
dist/bm/tests/execute-phase-resume-gaps.test.cjs and dist/bm/tests/trusted-global-roots.test.cjs present
both new tests wired into .github/workflows/check-drift.yml
```

### Gate 8: hygiene over added lines

```
bin/lib + sdk/src + tests dashes/canonical (excl resume-gaps literals): CLEAN
bin/lib + sdk/src #NNNN issue numbers: CLEAN
workflows + references + README + .github dashes/canonical: CLEAN
version/CHANGELOG diff (CHANGELOG, package.json, plugin.json, marketplace.json): CLEAN (no changes)
```

Issue markers (#2868, #3684) appear only in the workflow resume-message prose and in the resume-gaps test string literals that assert those markers, never in bin/lib, sdk/src source or comments, nor in commit messages.

## Commits

- 0be0032 feat(execute-phase): status-aware all-filtered resume decision
- 356726c feat(agent-skills): trusted_global_roots for symlinked global skills
- e433ebd docs+build(agent-skills,execute-phase): config reference, README row, CI wiring, dist regen

## Self-Check: PASSED

All created files exist (tests/execute-phase-resume-gaps.test.cjs, tests/trusted-global-roots.test.cjs, dist twins, SUMMARY.md) and all three per-task commits (0be0032, 356726c, e433ebd) are present in git history.
