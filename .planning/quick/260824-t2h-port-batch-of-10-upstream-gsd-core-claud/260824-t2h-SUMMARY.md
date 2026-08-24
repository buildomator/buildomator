---
phase: quick-260824-t2h
plan: 01
subsystem: resolver-twins
tags: [upstream-sync, frontmatter, roadmap, phase, summary, state, init, validate, skills, review]
requires: []
provides:
  - BOM-tolerant frontmatter parse (both twins)
  - letter-named phase membership + letter-prefixed analyze (both twins)
  - active-milestone-scoped phase insertion (both twins)
  - summary-shaped-heading one-liner extraction (three sites)
  - zero-plan progress no-op + roadmap-order next_phase (both twins)
  - sentinel-phase W006/W007/consistency guard (both twins)
  - effort-free skill frontmatter + isolated claude reviewer lane
affects: [bin/lib, sdk/src/query, skills, workflows, dist/bm]
tech-stack:
  added: []
  patterns: [hand-synced CJS+SDK twins, standalone CJS regression harness, SDK vitest unit twins]
key-files:
  created:
    - tests/frontmatter-bom.test.cjs
    - tests/letter-phase-ids.test.cjs
    - tests/phase-add-milestone-scope.test.cjs
    - tests/one-liner-summary-heading.test.cjs
    - tests/progress-and-frontier.test.cjs
    - tests/sentinel-validate-guard.test.cjs
  modified:
    - bin/lib/frontmatter.cjs
    - sdk/src/query/frontmatter.ts
    - bin/lib/core.cjs
    - sdk/src/query/state.ts
    - bin/lib/roadmap.cjs
    - sdk/src/query/roadmap.ts
    - bin/lib/phase.cjs
    - sdk/src/query/phase-lifecycle.ts
    - sdk/src/query/phase-lifecycle-policy.ts
    - sdk/src/query/summary.ts
    - bin/lib/state.cjs
    - sdk/src/query/state-mutation.ts
    - bin/lib/init.cjs
    - sdk/src/query/init-complex.ts
    - bin/lib/verify.cjs
    - sdk/src/query/validate.ts
    - skills/progress/SKILL.md
    - skills/stats/SKILL.md
    - skills/version/SKILL.md
    - workflows/review.md
    - tests/effort-frontmatter.test.cjs
    - .github/workflows/check-drift.yml
    - sdk/dist (rebuilt)
    - dist/bm (regenerated)
metrics:
  duration: ~55min
  completed: 2026-08-24
---

# Quick 260824-t2h: Port batch of 10 upstream gsd-core Claude fixes Summary

Ported 9 of the 10 pre-triaged Claude-relevant correctness fixes from upstream gsd-core v1.10.0 + v1.11.0 into both hand-synced resolver twins (CJS `bin/lib` + SDK `sdk/src`) plus skills and the review workflow; the 10th (effort removal) and the reviewer-lane isolation are the two skill/workflow-only wins. All eight tasks landed as atomic commits with RED/green regression coverage; sdk/dist and dist/bm rebuilt, `build-bm --check` PASS, zero new CJS or SDK-integration failures.

## Item-to-commit map (10 triage items)

| # | upstream PR(s) | item | commit | landed |
|---|----------------|------|--------|--------|
| 1 | #2977 / #3076 | tolerate a leading UTF-8 BOM before the frontmatter fence | 766fae9 | yes |
| 2 | #3213 / #3368 | segment-boundary membership for letter-named phase dirs | 2bdc1bf | yes |
| 3 | #3036 / #3117 | accept letter-prefixed ids in roadmap.analyze | 2bdc1bf | yes |
| 4 | #3163 / #3400 | scope add-phase insertion to the active milestone | d6af2c3 | yes |
| 5 | #3170 / #3401 | anchor one-liner extraction to a summary-shaped heading | 97ed020 | yes |
| 6 | #3233 / #3375 | no-op state update-progress on a zero-plan milestone scan | 87b40d3 | yes |
| 7 | #3581 / #3603 | derive init.progress next_phase from roadmap order | 87b40d3 | yes |
| 8 | #3225 / #3371 | sentinel-phase guard on W006/W007 + consistency loops | 07742a4 | yes |
| 9 | #3151 / #3425 | stop emitting effort: into skill frontmatter | af891cc | yes |
| 10 | #2483 / #2493 | stop the claude reviewer lane inheriting CLAUDE.md + auto-memory | af891cc | yes |

Note: the triage table numbered items 1-13; the 10 ported here are the recommended batch (items 2,3,4,5,6,8,9,10,11,12 in the triage's ranked table). All 10 landed; none required design work beyond a mechanical port, so nothing was stopped-and-left-unported. Explicitly out of scope and NOT attempted (per the plan): #2648 (fail-closed phase.complete, needs a retired-plan marker), #3350 (lowest-outstanding next phase, needs native reimpl), #2868 (workflow-prose resume seam).

Task 8 (fd8a130) wired the six new CJS regression tests plus the previously-unwired effort-frontmatter guard into CI.

## What changed (behavior)

- **BOM tolerance:** both `extractFrontmatter` (CJS) and `extractFrontmatterLeading` (SDK) strip a single leading U+FEFF before the byte-0 fence match. BOM-less files parse byte-identically to before.
- **Letter membership:** the greedy custom-ID capture in both `getMilestonePhaseFilter` twins is replaced by a longest-first segment-boundary test scoped to letter-leading dir names (`A-...`, `PROJ-42-...`). Numeric and project-code-prefixed dirs keep matching exactly as before; undeclared letter dirs stay excluded.
- **analyze widening:** the heading, section-boundary, and checklist regexes in both roadmap twins now accept a single leading letter (`B7`). `extractPhasesFromSection` and all non-analyze regexes are untouched.
- **Active-milestone insertion:** a shared `currentMilestoneSectionRange` + `phaseEntryInsertOffset` scopes new-phase insertion to the active milestone's window; legacy whole-file insertion is preserved when no milestone resolves. `extractCurrentMilestone` output is unchanged for existing fixtures.
- **One-liner anchor:** all three `extractOneLinerFromBody` sites iterate headings in document order and only extract from a summary/overview/accomplishment heading (labeled or bare bold form), returning null over wrong text. The two SDK copies were brought up to the CJS labeled/bare/null logic.
- **Zero-plan no-op:** `state update-progress` returns `{updated:false}` without writing when the current-milestone scan finds zero plans, so a shipped 100% Progress line survives an archive; the legitimate 0% case (plans exist, none summarized) still writes 0%.
- **Roadmap-order frontier:** `init progress` re-derives `next_phase` as the first pending/not_started phase in sorted roadmap order, so a stray higher-numbered artifact dir cannot skip a pending phase.
- **Sentinel guard:** a module-local `isSentinelPhaseId` (leading integer 0 or 999) guards the consistency loops, the sequential gap filter, and the W006/W007 health loops in both twins. Non-sentinel strays (e.g. 7-stray) still warn. Naming-format W005 is a separate check and was intentionally left as-is (out of scope).
- **Skills + reviewer:** removed `effort: low` from the progress, stats, and version skills (prompt-cache invalidation); prefixed both claude reviewer invocations with `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.

## Deviations from Plan

**None material.** The plan was executed as written. Two mechanical notes:

- The SDK `extractCurrentMilestone` has extra fallbacks (a `<details>/<summary>` variant and a generic Phase Details tail) beyond the CJS version. Rather than refactor those return paths, `currentMilestoneSectionRange` shares the version-resolution step (via a new `resolveMilestoneVersion` helper) and re-computes the primary markdown-section window; it returns null for the `<details>` variant so `phaseEntryInsertOffset` falls back to legacy insertion there. Behavior for the markdown-heading path is byte-identical to the CJS twin.
- The B-2 frontier assertion compares `parseInt(next_phase.number)` because the disk-derived phase number is zero-padded (`08`) while the roadmap-only branch strips zeros. Same phase, different string form.

## Assumption Drift (advisory)

- Planned: Task 7's inverted effort test would show "the expected dist failure until Task 8" because dist/bm still carried the old effort lines. Actual: dist/bm was regenerated during Task 7 so both the source and dist/bm halves of the guard were green immediately, and dist/bm carried the full batch (Tasks 1-6 twins too). Why: keeping each commit self-consistent (dist matching source) was cleaner than leaving a knowingly-failing intermediate; Task 8's `build-bm --check` re-confirmed consistency. Advisory only; no behavior change.

## Gate results (real output)

**Step 2 - full CJS battery:** 64 files pass. Two failures, both PRE-EXISTING (confirmed failing at base commit 8f59719, unrelated to this batch and untouched by it):
- `tests/context-monitor-hook-event.test.cjs` (5/6 — SubagentStop stale-path resolver shim assertion)
- `tests/version-command.test.cjs`
All six new tests + the inverted effort test pass.

**Step 3 - SDK unit:** 129 files, 1889 tests passed, 0 failed.

**Step 4 - SDK integration:** 14 failed / 72 passed / 13 skipped. The failing set is identical to the Task 1 baseline (`integration-baseline.txt`, the ~14 known archived-v4.1 golden/parity divergences). `comm -13 base post` = empty: ZERO new failures.

**Step 5 - build-bm:** `node bin/build-bm.cjs` then `node bin/build-bm.cjs --check` -> `bm drift check: PASS (committed dist/bm matches a fresh build).`

**Step 6 - dist/bm carry-through:** `grep "^effort:" dist/bm/skills/*/SKILL.md` = none; reviewer env-prefix count in `dist/bm/workflows/review.md` = 2; effort-frontmatter guard PASS (source + dist/bm).

**Step 7 - hygiene greps** over `git diff 8f59719..HEAD -- bin sdk/src tests skills workflows` added lines: zero `#[0-9]{4}` issue/PR numbers, zero em/en dashes, zero "canonical".

**Step 8 - VERIFY-BY-RUNNING (real output):**

BOM parse (CJS): `extractFrontmatter(U+FEFF + "---\nphase: 01-x\nplan: 2\n---\nbody")` = `{"phase":"01-x","plan":"2"}`, identical to BOM-less.

Letter membership (CJS `getMilestonePhaseFilter`): phaseCount 2, `A-tool-output-contract` -> true, `B-x` -> false. (SDK `state.json` on the same fixture: `total_phases: 2`.)

Zero-plan no-op: CJS `state update-progress` and SDK `state.update-progress` both returned `{"updated":false,"reason":"no plans found in current-milestone phases, STATE.md left unchanged (milestone archived?)"}`; STATE.md byte-unchanged (shasum equal) on both.

Sentinel W006/W007 (before/after): base commit CJS consistency emitted `["Phase 0 exists on disk but not in ROADMAP.md","Phase 999 exists on disk but not in ROADMAP.md","Gap in phase numbering: 1 → 999"]`; after this batch, CJS consistency `[]`, SDK consistency `[]`, CJS health W006/W007 `[]`.

## Self-Check: PASSED

All six new test files exist and pass; all eight commits present in `git log 8f59719..HEAD`.
