---
phase: 260920-mb0
plan: 01
subsystem: query-parsers
tags: [upstream-sync, state-md, phase-ordering, roadmap-analyze, regex-hardening]
requires: []
provides:
  - Line-anchored STATE.md field read/write grammar in both twins
  - Committed TS-to-CJS generator for the STATE.md document module
  - Decimal-aware init phase ordering in both twins
  - Index-preserving maskFencedBlocks helper in both twins
  - Fence-masked, line-anchored roadmap analyze scans
  - Lowest-successor phase-complete ROADMAP fallback
affects:
  - bin/lib/state-document.generated.cjs
  - bin/lib/state.cjs
  - bin/lib/init.cjs
  - bin/lib/core.cjs
  - bin/lib/roadmap.cjs
  - bin/lib/phase.cjs
  - sdk/src/query/state-document.ts
  - sdk/src/query/state.ts
  - sdk/src/query/init-complex.ts
  - sdk/src/query/helpers.ts
  - sdk/src/query/roadmap.ts
  - sdk/src/query/phase-lifecycle.ts
tech-stack:
  added: []
  patterns:
    - "Single-source TS transpiled to a committed CJS twin via ts.transpileModule with a freshness gate"
    - "Index-preserving fence mask so scan indices still address the original content"
key-files:
  created:
    - sdk/scripts/gen-state-document.mjs
    - tests/state-field-line-anchor.test.cjs
    - tests/state-document-generated-fresh.test.cjs
    - tests/decimal-phase-order-init.test.cjs
    - tests/roadmap-analyze-line-anchor.test.cjs
    - tests/phase-complete-lowest-successor.test.cjs
  modified:
    - sdk/src/query/state-document.ts
    - sdk/src/query/state.ts
    - sdk/src/query/init-complex.ts
    - sdk/src/query/helpers.ts
    - sdk/src/query/roadmap.ts
    - sdk/src/query/phase-lifecycle.ts
    - bin/lib/state-document.generated.cjs
    - bin/lib/state.cjs
    - bin/lib/init.cjs
    - bin/lib/core.cjs
    - bin/lib/roadmap.cjs
    - bin/lib/phase.cjs
    - sdk/package.json
    - .github/workflows/check-drift.yml
decisions:
  - "Used String.fromCharCode(0x2014) instead of a raw \\u2014 source escape so the literal dash stays out of source and out of the generated CJS while the runtime value still matches legacy template text"
  - "Kept the phase-complete fix scoped to the ROADMAP-only fallback (not the primary filesystem scan) to preserve the reported number spelling on aligned projects"
metrics:
  duration: ~65m
  completed: 2026-09-20
---

# Quick 260920-mb0: Port 4 upstream gsd-core v1.12 to v1.14 fixes Summary

Ported four Claude-relevant correctness fixes from upstream gsd-core into both the CJS (`bin/lib/*.cjs`) and SDK (`sdk/src/**`) twins, with regression tests, a new committed single-source generator for the STATE.md document module, a rebuilt SDK, and a regenerated `dist/bm`. No version bump, no CHANGELOG entry (v4.8.0 is cut separately).

## The four ports (upstream PR references)

1. **STATE.md bold and plain field anchoring** (upstream open-gsd/gsd-core PRs 4021, 4453, 4474, 4510). This is the same data-loss family as the earlier #32 fix but on functions that fix never touched. `stateReplaceField` used `\s*` in both the bold and plain patterns, which spans newlines and can overwrite the line after an empty field; neither the bold read nor the bold write was line-anchored, so a prose lookalike (`... **Status:** ...` mid-sentence) could win. Both `stateExtractField` and `stateReplaceField` now anchor to line start (multiline `^`) with same-line `[ \t]*` only, and the write inserts a single space when the captured prefix has none so an empty `**Status:**` row becomes `**Status:** value`. The `state get` bold reader in `bin/lib/state.cjs` and `sdk/src/query/state.ts` is anchored the same way.

2. **Decimal phase-id ordering** (upstream PR 4110). Both init sort sites in `bin/lib/init.cjs` and `sdk/src/query/init-complex.ts` now use `comparePhaseNum` instead of `parseInt`, so 7.2 sorts before 7.10 and the frontier / next_phase is the lowest pending phase.

3. **Analyze regex anchoring plus fenced-block mask** (upstream PR 4578). Added an index-preserving `maskFencedBlocks` helper (identical body in `bin/lib/core.cjs` and `sdk/src/query/helpers.ts`). `roadmap analyze` now scans a fence-masked copy of the milestone content with line-anchored phase and checklist patterns, while all body slicing (goal/mode/depends extraction, section boundaries) stays on the original content. The mask replaces every non-newline character inside a fence with a space, preserving total length and every newline offset, so match indices found on the masked copy still address the original text.

4. **next_phase lowest-successor** (upstream PR 3852). The ROADMAP-only fallback in `bin/lib/phase.cjs` and `sdk/src/query/phase-lifecycle.ts` now selects the numerically lowest successor with `comparePhaseNum` (no break-on-first), so an out-of-order ROADMAP (headings 1, 3, 2) advances to 2 rather than 3. The primary filesystem-scan path is untouched.

## Generator rationale

No generator existed. The header of `bin/lib/state-document.generated.cjs` said `Regenerate: cd sdk && npm run gen:state-document`, but no such script or file existed anywhere in the tree; the committed CJS was a hand-synced, lagging copy (7 exports; missing the four template-default exports present in the `.ts`). This task added `sdk/scripts/gen-state-document.mjs` (transpiles the `.ts` with `ts.transpileModule`, CommonJS/ES2022, `removeComments: false`, LF newlines, and an ASCII header) plus the `gen:state-document` npm script, and regenerated the CJS twin from the single TypeScript source. The regenerated file now carries all eleven exports and an `__esModule` marker. A freshness test (`tests/state-document-generated-fresh.test.cjs`) regenerates to a temp path and byte-compares to the committed file, and confirms `--check` exits 0.

## Design notes

- **Fence mask is scan-only and index-preserving.** Callers slice the original `content` at indices discovered on the masked copy; goldens are unaffected.
- **Phase-complete scope decision.** Upstream 3852 went ROADMAP-first; we kept the triage scope (fallback only) because a ROADMAP-first rewrite would change the reported number spelling (padded directory token vs ROADMAP number) on every aligned project.
- **No smart-entry surface in our tree.** `grep -n smart bin/lib/init.cjs` returns nothing, so only the two parseInt sort sites needed the decimal comparator.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Escaped the em-dash with String.fromCharCode instead of a raw \\u2014 source escape**
- **Found during:** Task 1
- **Issue:** The plan asked to express the U+2014 in `KNOWN_TEMPLATE_DEFAULTS` as a JavaScript `—` escape. Writing that escape through the editor's JSON-encoded parameter was ambiguous: a single escape decoded to the literal em-dash byte (non-ASCII in source), and a doubled escape produced a real two-backslash literal (runtime value `—` instead of the em-dash), which would break matching legacy template text.
- **Fix:** Built the string as `` `Phase complete ${String.fromCharCode(0x2014)} ready for verification` ``. Source stays pure ASCII, the transpiled CJS stays pure ASCII, and the runtime value is the em-dash, so it still matches legacy STATE.md text. Verified: no non-ASCII bytes in either `state-document.ts` or the generated CJS, and the runtime set entry equals `Phase complete <em-dash> ready for verification`.
- **Files modified:** sdk/src/query/state-document.ts (and the regenerated bin/lib/state-document.generated.cjs)
- **Commit:** 5370be1

## Assumption Drift (advisory)

- **Decimal-ordering fixture uses roadmap-only completion, not disk-dir completion.** Planned assumption: mark phases 7 and 7.1 complete via `[x]` checkboxes with all five phases scaffolded on disk. Actual: the disk-dir status path derives status from `scanPhasePlans` and ignores ROADMAP checkboxes for scaffolded dirs, so checkbox completion only applies to unscaffolded phases. The tests scaffold only the pending phases (7.2, 7.10, 8) on disk and leave 7 and 7.1 as roadmap-only complete. Why it matters: the reader should know the fixture proves ordering + next_phase, and that reported phase numbers are zero-padded (`07.2`), so the assertions strip a leading zero before comparing to `7.2`.

## Mandatory final gate output (real)

### 1. #32-class proof, both twins

CJS (`bin/lib/state-document.generated.cjs`), inline check printed `cjs ok`:
- Empty `**Status:**` immediately followed by `**Progress:** 3/10 total_phases`: after `stateReplaceField(..., 'Status', 'Ready')` the following `**Progress:**` line SURVIVES and the field row becomes `**Status:** Ready`.
- A mid-line `**Status:**` in prose is NOT matched by `stateExtractField` (returns null) and is NOT overwritten by the write.
- Plain empty `Status:` write keeps the next `next: keep` line.

Built SDK (`sdk/dist/query/state-document.js`), inline check printed `sdk ok` on the same empty-field-plus-data-line and prose-lookalike fixture.

### 2. Decimal ordering, both twins

- CJS `init progress`: `numbers: ["07","07.1","07.2","07.10","08"]` (07.2 before 07.10), `next_phase: 07.2`.
- Built SDK `query init.progress`: `ITEM2 numbers: ["7","7.1","7.2","7.10","8"] next: 7.2`.

### 3. Fenced heading not counted, both twins

- CJS `roadmap analyze`: `phase_count: 2`, `numbers: ["1","2"]`, `missing_phase_details: null` (the fenced `### Phase 3:`, blockquoted `### Phase 4:`, prose `### Phase 5:`, and fenced `- [ ] **Phase 6: Fake**` are all ignored; goals for 1 and 2 unchanged).
- Built SDK `query roadmap.analyze`: `ITEM3 phase_count: 2 numbers: ["1","2"] missing: null`.

### 4. Out-of-order roadmap yields lowest successor, both twins

- CJS `phase complete 1` on headings 1, 3, 2 (plus a 999.1 backlog): `next_phase` `2`; a second fixture 1, 3, 2.1, 2 also yields `2`; the 999.1 backlog never wins.
- Built SDK `query phase.complete 1`: `ITEM4 next_phase: "2"`.

### 5. Generator freshness

`cd sdk && npm run gen:state-document` then `git diff --exit-code -- bin/lib/state-document.generated.cjs` is clean (generator idempotent). `tests/state-document-generated-fresh.test.cjs` passes (regenerate-to-temp byte-compare, plus `--check` exits 0).

### 6. Full test battery

- CJS battery: `diff cjs-baseline.txt cjs-after.txt` shows NO DIFF. Only the two pre-existing baseline failures remain (`context-monitor-hook-event`, `version-command`); zero new.
- SDK unit: `Test Files 129 passed (129) / Tests 1908 passed (1908)`.
- SDK integration: `Tests 14 failed | 72 passed | 13 skipped`. The 14 failing test names are identical to the Task 1 baseline set (`comm -13` shows zero new); the ~14 golden read-only-parity baseline did not grow and no golden was regenerated.

### 7. dist/bm regeneration

The five new files (generator + five test files) are tracked, so `git ls-files` and `bin/build-bm.cjs` (which copies via `git ls-files`) see them. `node bin/build-bm.cjs` then `node bin/build-bm.cjs --check` both PASS (`bm drift check: PASS`); `tests/bm-parity.test.cjs` and `tests/build-bm-drift.test.cjs` pass. All five new files are present under `dist/bm/`, and the generated CJS in `dist/bm/bin/lib/state-document.generated.cjs` is pure ASCII.

### 8. Hygiene over added diff lines

`git diff -U0 b38017b..HEAD -- bin/lib sdk/src tests sdk/scripts` added lines: no `#[0-9]{4}`, no em/en-dash bytes, no forbidden word. HYGIENE CLEAN. No version/CHANGELOG diff. No agent-name regressions in touched test files.

## Commits

- `5370be1` fix(state): line-anchor STATE.md field grammar and add the generated-module generator
- `b5d0716` fix(phases): decimal-aware init ordering, fence-masked analyze scans, lowest-successor fallback
- `d8a5263` chore(build): rebuild SDK and dist/bm, wire the five new guard tests into CI

## Self-Check: PASSED

All six created files and the regenerated CJS twin exist on disk; all three commit hashes are present in git history.
