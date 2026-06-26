---
phase: 10-convention-and-architectural-conformance
fixed_at: 2026-06-26T17:57:19Z
review_path: .planning/phases/10-convention-and-architectural-conformance/10-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
test_status: green
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-06-26T17:57:19Z
**Source review:** .planning/phases/10-convention-and-architectural-conformance/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 warning, 5 info)
- Fixed: 7
- Skipped: 1

**Test status after fixes:** all `tests/*.test.cjs` pass (29 suites green), including the new WR-01 length-preservation assertion. The two public functions (`deriveConventions`, `checkConformance`) still never throw; all findings remain `tier:'CONVENTION', blocking:false`; no non-builtin runtime dependency was added.

## Fixed Issues

### WR-01: `blankSpans` writes past the end of its output buffer on a trailing backslash

**Files modified:** `bin/lib/conventions.cjs`, `tests/conventions.test.cjs`
**Commit:** a6726bc
**Applied fix:** Guarded the escape look-ahead write at all three literal scanners (string, template, regex) so `out[i + 1] = ' '` only runs when `i + 1 < n`. This restores the documented length-preservation invariant for sources ending in `\`. Added a regression test asserting `blankSpans(s).length === s.length` for `"abc\`, `` `abc\ ``, and `/abc\`.

### WR-02: `cmdVerifyConventions --check` silently derives an empty contract on walk failure

**Files modified:** `bin/lib/verify.cjs`
**Commit:** f84be26
**Applied fix:** Track failed scope-dir walks with a `corpusDirsFailed` counter (still never throwing — the `catch` keeps the run advisory) and surface it in the emitted JSON as `corpus_dirs_failed`, plus a `reason: 'partial-corpus'` when any walk failed and the module did not already set a reason. A caller can now distinguish "no findings because conformant" from "no findings because the corpus could not be read." Verified the subcommand still emits parseable JSON.

### WR-03: template-literal `${...}` interpolations are blanked and invisible to idiom checks

**Files modified:** `bin/lib/conventions.cjs`
**Commit:** 2eb0cfa
**Applied fix:** Adopted review option (a), acceptable for v1: documented the false-negative explicitly as a "Known limitation" in the module header (live code inside a template interpolation is blanked, producing silent under-reporting, not a false positive). No behavior change.

### IN-01: test claims "five named functions" but the module exports eight

**Files modified:** `tests/conventions.test.cjs`
**Commit:** 4e085f7
**Applied fix:** Renamed the check to "exports the public functions" and asserted all eight exported names (`deriveConventions`, `checkConformance`, `summarizeAxis`, `classifyCasing`, `sanitizePaths`, `classifyArchitecture`, `extractIdentifiers`, `blankSpans`), so accidental removal of the three internal exports is now caught.

### IN-02: dead `body` slice in `classifyArchitecture`

**Files modified:** `bin/lib/conventions.cjs`
**Commit:** dd699ed
**Applied fix:** Deleted the unused `const body = src.slice(...)` and its `void body;` marker; only `blankedBody` is consumed. Left `void arch.envStyle;` (line ~549) untouched — its inline comment documents a deliberately-deferred per-file env flag, so removing it would change documented intent (see skipped note below).

### IN-03: `summarizeAxis` `contested` axis sets `dominant: null` but leaves `share`/`variants` populated

**Files modified:** `bin/lib/conventions.cjs`
**Commit:** 95f9d9a
**Applied fix:** Documented on the `summarizeAxis` JSDoc that `dominant` is only meaningful when `status === 'named'`, and that consumers must gate on status before comparing against `dominant`. Adopted the documentation option rather than reshaping the return value, to avoid changing the contract any current consumer depends on.

### IN-05: export/import axes are per-file boolean votes, so the 8-sample gate means "8 files"

**Files modified:** `bin/lib/conventions.cjs`
**Commit:** f052171
**Applied fix:** Documented the per-file-vote semantics inline in `observeFile`: each direction votes `= 1` per file regardless of occurrence count, so with `minSamples=8` these two axes need 8+ files in scope to be named, and a `--check` on one changed file never names them. Adopted the documentation option; the per-file weighting is a deliberate design choice (stops one large file dominating).

## Skipped Issues

### IN-04: convention-derivation Bash one-liner resolves `CLAUDE_PLUGIN_ROOT` via an unquoted glob

**File:** `agents/gsd-pattern-mapper.md:151`, `agents/gsd-code-reviewer.md:97`, `workflows/code-review.md:336`
**Reason:** skipped — requires maintainer judgment. The finding itself offers two mutually-exclusive resolutions: align all three sites to the `${CLAUDE_PLUGIN_ROOT:-.../current}` form, OR confirm the `gsd/*/` glob + `sort -V` form is the intended new convention and update the memory note. The glob form is used consistently across all three files (agents + workflow), so it may be a deliberate pattern; choosing the resolver form and reconciling it with the "Plugin path-form convention" memory note is a behavior/convention decision better left to the maintainer rather than auto-applied. No source code touched.

---

_Fixed: 2026-06-26T17:57:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
