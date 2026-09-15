---
phase: quick-260915-su7
plan: 01
subsystem: maintenance
tags: [ratchet, drift, docs, ci, pre-commit]
requires: [bin/maintenance/check-user-docs-jargon.cjs, tests/drift-baseline.json, bin/build-bm.cjs]
provides: [check-user-docs-prose.cjs, user_docs_prose-baseline, user-docs-prose.test.cjs, prose-ci-job, prose-pre-commit-block]
affects: [dist/bm]
key-files:
  created:
    - bin/maintenance/check-user-docs-prose.cjs
    - tests/user-docs-prose.test.cjs
  modified:
    - tests/drift-baseline.json
    - bin/maintenance/pre-commit-drift-baseline.sh
    - .github/workflows/check-drift.yml
    - dist/bm (regenerated)
metrics:
  completed: 2026-09-15
  tasks: 3
---

# Quick 260915-su7: STE-subset prose ratchet for plugin user docs Summary

A second counts-based ratchet over README.md and CHANGELOG.md that fails pre-commit and CI when em/en dashes, eight marketing filler words, or six cliche openers grow above a baseline captured from the real files. Sibling of the existing jargon ratchet in shape, wiring, and test style.

## What shipped

- `bin/maintenance/check-user-docs-prose.cjs`: counts em_en_dash (U+2014/U+2013), marketing_words (seamless, robust, leverage, ensure, systematic, powerful, elevate, delve and inflections), and cliche_openers (six fixed phrases). Strips fenced code blocks, word-bounded high-precision patterns, `--dry` / `--write-baseline`, repo-root guard, exit 0/1/2. The non-ASCII code points are built at runtime with `String.fromCharCode` so no literal dash or curly quote appears in the source.
- `tests/drift-baseline.json`: gained a `user_docs_prose` section; the pre-existing `file_layout` section survived byte-for-byte.
- `tests/user-docs-prose.test.cjs`: six sandbox discrimination checks (clean PASS, dash FAIL, word FAIL, cliche FAIL, fence-strip PASS, baseline-merge).
- `bin/maintenance/pre-commit-drift-baseline.sh`: PROSE_SCRIPT block mirroring the JARGON_SCRIPT block, no auto-regen.
- `.github/workflows/check-drift.yml`: `user-docs-prose` job with two run steps.
- `dist/bm`: regenerated so all of the above land in the generated bm package.

## Baseline captured (via --write-baseline against the real docs)

| Category | Count | Source |
|----------|-------|--------|
| em_en_dash | 155 | all from CHANGELOG.md (README.md = 0) |
| marketing_words | 4 | README.md 1 + CHANGELOG.md 3 |
| cliche_openers | 0 | none |

The 155 historical CHANGELOG em-dashes are frozen in place, not rewritten. The ratchet only fails on growth; each future cleanup that lowers a count can be locked in with `--write-baseline`.

## Commits

- `d74a51e` feat(maintenance): add prose ratchet checker over README and CHANGELOG
- `b99f308` test(maintenance): wire prose ratchet into discrimination test, pre-commit hook, and CI
- `9d8f2f5` feat(maintenance): add user-docs prose ratchet (STE-inspired anti-slop gate over README and CHANGELOG)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Escape-encoding of U+2014/U+2013 in source**
- **Found during:** Task 3 hygiene gate (first run).
- **Issue:** The initial source used JavaScript `—` / `–` escapes as the plan directed, but the file-writing pipeline collapses a `\uXXXX` sequence into the actual character before it reaches disk. That planted literal em/en dashes in `check-user-docs-prose.cjs` and `tests/user-docs-prose.test.cjs`, which the Task 3 hygiene grep correctly caught.
- **Fix:** Rebuilt the code points at runtime with `String.fromCharCode(0x2014)` / `0x2013` / `0x2019`, so the source stays pure ASCII (no backslash-u, no literal dash, no curly quote) while behavior is identical. Verified with a `perl -CSD` scan of both files (empty). Rebuilt the Task 1 and Task 2 commits (mixed reset to the base SHA, recommit with corrected content) so the committed history at HEAD carries no literal dashes and the `base..HEAD` hygiene window is clean.
- **Files modified:** bin/maintenance/check-user-docs-prose.cjs, tests/user-docs-prose.test.cjs
- **Commits:** d74a51e, b99f308

## Mandatory final gate (real output)

1. Real-docs checker exits 0, Status: PASS (aggregate em_en_dash 155 baseline 155, marketing_words 4 baseline 4, cliche_openers 0 baseline 0). rc=0.
2. Slop doc with an em-dash, a banned word, and a cliche opener BOTH outside and inside a ``` fence exits 1 and names each category at count 1 (`em_en_dash 1 > 0`, `marketing_words 1 > 0`, `cliche_openers 1 > 0`), proving fence stripping. rc=1.
3. Run from a non-repo-root dir: `error: run from repo root (expected .git/ and skills/)`, rc=2.
4. `node tests/user-docs-prose.test.cjs`: 6/6 checks passed, rc=0.
5. Full CJS battery: only the two pre-existing failures (context-monitor-hook-event, version-command); zero new.
6. `node bin/build-bm.cjs` then `--check`: `bm drift check: PASS (committed dist/bm matches a fresh build).` The checker's dist copy is byte-identical (cmp) and the test, hook, workflow, and user_docs_prose baseline are all present in dist/bm.
7. Hygiene gate over base..HEAD plus working tree scanned 433 added lines (bin/maintenance + tests + .github); all three greps (issue/PR refs, literal U+2014/U+2013, "canonical") returned empty.

## Self-Check: PASSED

- FOUND: bin/maintenance/check-user-docs-prose.cjs
- FOUND: tests/user-docs-prose.test.cjs
- FOUND: dist/bm/bin/maintenance/check-user-docs-prose.cjs
- FOUND: commits d74a51e, b99f308, 9d8f2f5
