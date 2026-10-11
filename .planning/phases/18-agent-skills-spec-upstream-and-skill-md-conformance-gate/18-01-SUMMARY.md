---
phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate
plan: 01
subsystem: testing
tags: [skill-conformance, ratchet, drift-baseline, frontmatter, agent-skills-spec]

# Dependency graph
requires:
  - phase: 09-upstream-resilience-detectors
    provides: the loud-fail ratchet template (check-user-docs-jargon.cjs, drift-baseline.json convention)
  - phase: 16-catalog-and-trust-gate-foundation
    provides: the craft-skill trust gate that the native validator subset can feed via the exported seam
provides:
  - "bin/maintenance/check-skill-conformance.cjs: zero-dep CJS gate over skills/*/SKILL.md"
  - "skill-count ceiling (90) with a warn band from 88"
  - "description-length ratchet off a committed baseline (380 today)"
  - "hard-fail subset: name, description, allowed-tools; license/compatibility/metadata advisory only"
  - "standalone --validate <dir> mode and exported validateSkill/listSkillFiles/CEILING/WARN_AT"
  - "tests/drift-baseline.json skill_conformance section (count 86, max 380)"
affects: [pre-commit-drift-baseline wiring, check-drift.yml CI job, agentskills-spec-upstream-watch, phase-16-trust-gate external-candidate path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loud-fail ratchet with sibling-preserving baseline write (clone of the jargon/prose gates)"
    - "Narrow native validation subset: tolerate unknown frontmatter keys, hard-fail only startup-token fields"
    - "Script-vs-require guard (main only under require.main === module) so the subset is callable without spawning"

key-files:
  created:
    - tests/skill-conformance.test.cjs
    - bin/maintenance/check-skill-conformance.cjs
  modified:
    - tests/drift-baseline.json

key-decisions:
  - "Warn band fixed at 88 (D-01 Claude discretion A2): count 88-90 warns and exits 0, count above 90 hard-fails"
  - "allowed-tools accepts all three in-repo shapes (YAML list, empty inline array, comma string); tool token regex allows letter-led tokens with word chars, *, -, and a parenthesised suffix"
  - "name-vs-directory mismatch and name charset are advisory only (keeps skills/extract_learnings green)"
  - "Gate is CJS-only; main runs only as a script so the trust gate can require the subset without spawning"

patterns-established:
  - "Pattern 1: structural regressions (count ceiling + hard findings) are checked independently of the baseline, so a missing name fails even with no baseline"
  - "Pattern 2: --write-baseline refuses to write while a structural regression exists"

requirements-completed: [CAT-08]

# Metrics
duration: 4min
completed: 2026-10-11
---

# Phase 18 Plan 01: SKILL.md Conformance Gate Summary

**Zero-dep CJS loud-fail gate over the plugin's 86 own skills: a fixed count ceiling of 90 with a warn band from 88, a 380-char description ratchet, and a narrow name/description/allowed-tools hard-fail subset, test-driven by a 24-case sandbox discrimination test.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-11T21:53:34Z
- **Completed:** 2026-10-11T21:57:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 24-case sandbox discrimination test covering the ceiling warn/fail bands, the description ratchet, the hard-fail frontmatter subset, advisory-only optional fields, all three in-repo allowed-tools shapes, the repo-root guard, --write-baseline sibling preservation, --dry, and standalone --validate
- `check-skill-conformance.cjs` passing on the real 86 skills (0 hard findings, max description 380 at skills/discuss-phase/SKILL.md), exit 0
- `tests/drift-baseline.json` gains a `skill_conformance` section with file_layout and user_docs_prose preserved byte-for-byte
- Exported `validateSkill`, `listSkillFiles`, `CEILING`, `WARN_AT`; main runs only as a script, so the Phase 16 trust gate can require the subset without spawning

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Write the sandbox discrimination test (Wave 0, RED)** - `09d2f80` (test)
2. **Task 2: Implement the gate and capture the baseline (GREEN)** - `4570d27` (feat)

## Files Created/Modified
- `tests/skill-conformance.test.cjs` - 24-case spawnSync sandbox test for every gate behavior
- `bin/maintenance/check-skill-conformance.cjs` - the conformance + ceiling + description ratchet gate (CJS, zero-dep, 321 lines)
- `tests/drift-baseline.json` - added the `skill_conformance` section (count 86, max 380, ceiling 90, warn_at 88)

## Decisions Made
- Warn band at 88 (D-01 discretion A2): 88-90 warns and exits 0; above 90 hard-fails.
- `allowed-tools` tolerance (Pitfall 1): a YAML list, an empty inline array, and a comma string all pass; the string form splits on commas and whitespace (not spaces alone) so `Read,` does not mis-tokenize. Verified the token regex accepts every real tool token across all 86 skills (0 rejects) before writing the test.
- name-vs-directory and name charset stay advisory (Pitfall 2), so `skills/extract_learnings` (name `extract-learnings`) does not hard-fail.
- Structural regressions (count ceiling, hard findings) are evaluated before the baseline comparison and before the no-baseline early return, so a missing name fails even with no baseline present; `--write-baseline` refuses to write while any structural regression exists.
- Did NOT port the reference validator's unknown-field rejection (Pitfall 3); our skills legitimately carry argument-hint, type, agent, model.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- My global instructions forbid Co-Authored-By trailers; the first commit was created with one and immediately amended to remove it (keeping the Claude-Session line). No other issues.

## Verification Results (observed)
- `node bin/maintenance/check-skill-conformance.cjs` exits 0: `skills: 86 (ceiling 90, warn at 88)`, `hard findings: 0`, `Status: PASS`.
- `node tests/skill-conformance.test.cjs` exits 0: 24/24 checks passed.
- Baseline verify `b.skill_conformance.skill_count===86 && max===380 && file_layout && user_docs_prose`: exit 0.
- Wrong cwd (`cd /tmp`): exit 2 with `run from repo root`.
- `--validate skills/discuss-phase`: exit 0; `--validate /nonexistent`: exit 1 mentioning SKILL.md.
- `require()` of the module: exit 0, prints nothing (main does not run on require); exports present.
- `grep -c "js-yaml\|eval("`: 0. `package.json` unchanged (threat T-18-SC).
- Dash / "canonical" / phase-number guards on both files: exit 0.

## Next Phase Readiness
- The gate is ready to be wired into `.github/workflows/check-drift.yml` and `bin/maintenance/pre-commit-drift-baseline.sh` (later plans in this phase).
- The exported `validateSkill` subset is ready for the Phase 16 trust gate's external-candidate path.
- No blockers.

## Self-Check: PASSED

- FOUND: tests/skill-conformance.test.cjs
- FOUND: bin/maintenance/check-skill-conformance.cjs
- FOUND: tests/drift-baseline.json
- FOUND commit: 09d2f80 (test)
- FOUND commit: 4570d27 (feat)

---
*Phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate*
*Completed: 2026-10-11*
