# Quick 260920-r94: Per-language import-habit drift axis - Research

**Researched:** 2026-09-20
**Domain:** Native drift detection (Buildomator conventions engine, CJS-only)
**Confidence:** HIGH (all plug-in points read directly from source; regex packs are language-anchored and testable)

## Summary

Buildomator's native drift engine (`bin/lib/conventions.cjs`) already has every structural
primitive VibeDrift's richer import-habit axis needs: independent per-axis majority vote,
normalized-entropy + dominance + min-sample gating, directory scoping (`opts.scope`), and
non-app-file exclusion (`isNonAppPath`). The existing `import-style` axis is a single
JS/TS module-system signal (require vs import). Adding per-language habit dimensions is
purely additive: register new axis names, teach `observeFile` to detect them by file
extension, and add per-axis flagging blocks to `checkConformance`. No composite score
exists anywhere, so VibeDrift's "no score/trend across a coverage change" guard is a
non-issue for us (confirmed at code level: `deriveConventions` returns an independent
per-axis array, `checkConformance` emits independent findings).

The one plug-in point outside `conventions.cjs`: the CLI corpus collector
`collectConventionCorpus` in `bin/lib/verify.cjs:1538` only globs JS/TS files, so it must
be widened to `.go/.py/.rs` or the new axes never receive any files to vote on.

**Primary recommendation:** Ship a 4-dimension first cut that is reliably regex-detectable
without a real parser: `py-wildcard-import`, `py-import-relativity`, `rust-glob-import`,
`go-import-ordering`. Keep the existing `import-style` (cjs/esm) axis unchanged and
orthogonal. Defer parser-dependent dimensions (Rust path-style, Rust use-grouping, Go
3-way stdlib/third/local block classification).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IH-01 | Register per-language import-habit axes in the vote engine | §1 plug-in points (AXES :44, obs/tallies init) |
| IH-02 | Detect each dimension per file by regex + extension dispatch | §2 rule packs |
| IH-03 | Flag deviations in `checkConformance`, respecting NAMED-only + isNonAppPath | §1 checkConformance wiring |
| IH-04 | Prove vote + flag on a fixture corpus | §4 verification |

## 1. Our plug-in points (read from source, with line numbers)

All references are `bin/lib/conventions.cjs` unless noted.

### What already exists (no work needed)

- **Per-axis independence.** `AXES` (`:44`) is iterated generically in `deriveConventions`
  (`:363`) to build tallies, and each axis is summarized independently by `summarizeAxis`
  (`:291` via the `.map` at `:371`). Every added axis is voted and gated on its own.
- **The named / contested / insufficient-data gate.** `summarizeAxis` (`:291`) computes
  normalized Shannon entropy, dominance share (`domN/total`), and applies
  `minSamples=8` + `dominanceThreshold=0.70` (`:292-293`). It is variant-agnostic: it
  works on any `{ variant: count }` object, so new axes need zero changes here.
- **Directory scoping.** `deriveConventions` filters `list` by `opts.scope` (`:339-342`),
  so each dimension is voted within its subtree. Already the VibeDrift "scope each vote to
  its directory" guard.
- **Non-app-file exclusion.** `isNonAppPath` (`:98`) is applied in derivation (`:343`) and
  in conformance (`:522`), covering `tests?/`, `specs?/`, `fixtures?/`, `.test.`/`.spec.`
  basenames, etc. This covers file-level test exclusion (but NOT an inline Rust
  `#[cfg(test)] mod tests` inside an app file - handled by a regex guard in §2).
- **No composite score.** There is no scoring or trend anywhere. `deriveConventions`
  returns `{ skipped, axes: [...] }`; `checkConformance` returns `{ skipped, findings: [...] }`.
  Confirmed the VibeDrift "do not draw a score/trend across the coverage change" caveat is
  a non-issue for our port.

### What must change

**(a) Axis registration - `AXES` (`:44`).**
Append the new axis names, e.g.:
`'py-wildcard-import', 'py-import-relativity', 'rust-glob-import', 'go-import-ordering'`.
Because `deriveConventions` iterates `AXES` at `:363`, registration alone wires tally +
summarize for each new axis.

**(b) Tally/obs key initialization - two hardcoded literals.**
`observeFile` initializes `obs` with the four axis keys hardcoded (`:241`), and
`deriveConventions` initializes `tallies` with the same four keys hardcoded (`:346`). The
tally loop at `:363-367` does `Object.entries(obs[axis])`; if `obs[axis]` is undefined for a
newly-registered axis it throws. Recommended minimal refactor: derive both objects from
`AXES`, e.g. `const obs = Object.fromEntries(AXES.map((a) => [a, {}]));`. This removes the
drift risk of three separate lists and makes future axes a one-line `AXES` edit. Do this in
the same task that adds the axes.

**(c) Per-file detection - `observeFile` (`:238-274`).**
Add an extension dispatch. The current body always writes `file-name-casing` (language
agnostic, `:244-245`) and then the JS-oriented identifier/export/import observations
(`:249-271`). Add, after those:
```
const ext = path.extname(file).toLowerCase();
if (ext === '.py')  observePythonImports(src, obs);
if (ext === '.rs')  observeRustImports(src, obs);
if (ext === '.go')  observeGoImports(src, obs);
```
Each helper writes `obs[axisName][variant] = 1` (per-file vote, matching the existing
export/import `=1` convention at `:264-271`) or writes nothing when the file has no import
of that kind (abstention). A `.py` file never touches the Rust/Go axes; those keys stay `{}`
and contribute nothing to the tally, so language scoping is automatic (an axis is only
"named" if 8+ files of that language, in scope, voted).

Note on the `=1` per-file vote (documented at `:256-261`): `minSamples=8` therefore means
8+ FILES of that language in scope, not 8 occurrences. Small dirs stay `insufficient-data`,
which is the safe (silent) default for an advisory-only feature. A single `--check` on one
changed file can never name a new axis, exactly as with export/import today.

**(d) Conformance flagging - `checkConformance` (`:509-612`).**
`named` is already built generically from every NAMED axis (`:513-514`), so the derived
contract carries the new axes for free. But the action code is per-axis and hardcoded, and
there is a JS/TS gate at `:540` (`if (!JS_TS_RE.test(file)) continue;`) that short-circuits
everything after `file-name-casing` for non-JS/TS files. The new language packs must run
BEFORE that `continue`. Recommended structure: right after the `file-name-casing` block
(ends `:537`) and before `:540`, add extension-dispatched blocks:
```
const ext = path.extname(file).toLowerCase();
if (ext === '.py') { /* flag py-wildcard-import, py-import-relativity if named */ }
if (ext === '.rs') { /* flag rust-glob-import if named */ }
if (ext === '.go') { /* flag go-import-ordering if named */ }
```
Each block mirrors the existing export-style pattern (`:564-577`): read the file's variant,
and if `got && got !== named[axis].dominant`, push a `finding(...)` (tier CONVENTION,
`blocking:false`) via the existing `finding` helper (`:496`). Only NAMED axes are in
`named`, so contested / insufficient-data axes are skipped automatically (the CONV-02 rule).
`isNonAppPath` is already applied at `:522`, so test/fixture files are never flagged.

**(e) CLI corpus collector - `bin/lib/verify.cjs:1538` (`collectConventionCorpus`).**
`SRC_RE = /\.(c|m)?[jt]sx?$/` (line 1539) globs JS/TS only. It feeds both `--derive`
(`:1465`) and `--check` (`:1501`). Widen it to include `.go`, `.py`, `.rs` (e.g.
`/\.(c|m)?[jt]sx?$|\.(go|py|rs)$/`) or the new axes receive zero files and stay permanently
`insufficient-data` in real runs. This is the only required change outside `conventions.cjs`.

**Confirmed:** per-dimension independence, directory scope, isNonAppPath exclusion, and the
absence of any composite score all already exist. The new work is (a) axis names, (b) an
obs/tallies init generalization, (c) `observeFile` language dispatch, (d) `checkConformance`
language dispatch, (e) the verify.cjs corpus glob.

## 2. Per-language rule packs (regex / heuristic per dimension)

General guidance: do NOT reuse `blankSpans` (`:149`) for these packs. It is JS-tuned (it
knows `//`, `/* */`, backtick, and JS regex literals) and does not understand Python `#`
comments or triple-quoted strings. Import statements live at module top and are almost never
inside strings, so operate line-anchored on the raw source (`^\s*...`) and skip lines whose
first non-space char is a comment marker for that language. This is simpler and correct per
language.

Voting model for every dimension: one vote per file (`=1`), abstain (write nothing) when the
file has no import of that kind.

### Go (`.go`)

Go imports are either a single `import "path"` or a block `import ( ... )`.

- **`go-import-ordering` (SHIP - high confidence).** gofmt sorts import paths ascending
  within each blank-line-separated group. Extract the `import (` ... `)` span
  (`/import\s*\(([\s\S]*?)\)/`), split into groups on blank lines, pull the quoted paths per
  group (`/"([^"]+)"/g`), and compare each group to its sorted copy.
  - Variants: `sorted` (every group ascending) vs `unsorted`.
  - Abstain: no multi-import block, or every group has <2 paths.
  - Deterministic and parser-free; this is the strongest Go signal.
- **`go-import-grouping` (DEFER the 3-way; optional 2-way).** The idiomatic
  stdlib / third-party / local three-block split needs the module path from `go.mod` to
  tell local from third-party (both are dotted paths). Regex can reliably tell stdlib
  (no dot before the first `/`, e.g. `"fmt"`, `"net/http"`) from non-stdlib (dotted, e.g.
  `"github.com/..."`). A safe 2-way dimension is `stdlib-first` (all no-dot imports precede
  the first dotted import) vs `mixed`. Ship only if the first cut proves stable; the full
  stdlib/third/local grouping is parser/config work and is deferred.

Guard: strip `//` and `/* */` before matching; Go raw strings use backticks but import paths
are always double-quoted so this is safe.

### Python (`.py`)

- **`py-wildcard-import` (SHIP - high confidence).** `from x import *`.
  - Regex: `^\s*from\s+\S+\s+import\s+\*`.
  - Variants: `wildcard` (>=1 star import) vs `explicit` (has `from ... import name` but no
    star).
  - Abstain: file has no `from ... import` statement.
- **`py-import-relativity` (SHIP - high confidence).** relative (`from .x import`,
  `from ..x import`) vs absolute (`from pkg import`, `import pkg`).
  - Relative regex: `^\s*from\s+\.+\w`. Absolute-from regex: `^\s*from\s+[A-Za-z_]`.
    Plain-import regex: `^\s*import\s+[A-Za-z_]`.
  - Variants: `relative` (file has >=1 relative import) vs `absolute` (file has only
    non-relative imports).
  - Abstain: file has no imports.

Guard: ignore lines whose first non-space char is `#`; ignore anything inside a
triple-quoted block (rare for import-looking text - a line-anchored `^from`/`^import` at
column start is a strong enough signal to accept the small false-positive risk for an
advisory-only check; note it and move on).

### Rust (`.rs`)

- **`rust-glob-import` (SHIP - high confidence, with the test-preamble guard).**
  `use x::*;`.
  - Regex: `^\s*(pub\s+)?use\s+[^;]*::\*\s*;`.
  - Variants: `glob` vs `explicit`.
  - Abstain: no `use` statement.
  - **False-positive guard (VibeDrift's example):** `use super::*;` and `use self::*;` are
    the idiomatic test-module preamble (`#[cfg(test)] mod tests { use super::*; }`) inside
    an otherwise-normal app file, which `isNonAppPath` cannot exclude because the file is an
    app file. Exclude `super::*` and `self::*` globs from the vote and from flagging; only
    count `use crate::path::*` and `use external_crate::*` globs. Also skip lines inside a
    `#[cfg(test)]` block if a lightweight scan is cheap; the `super::*`/`self::*` exclusion
    alone catches the common case.
- **`rust-path-style` (DEFER - low signal).** `crate::` vs `super::`/`self::` intra-crate
  references. Both are legitimate and routinely coexist in the same file, so the vote is
  noisy and the flag would be low-value. Defer.
- **`rust-use-grouping` (DEFER - needs cross-line reconstruction).** `use a::{b, c};` vs
  separate `use a::b; use a::c;` lines. Detecting "should have been grouped" requires
  reconstructing shared path prefixes across lines, which is parser-adjacent. Defer.

Guard: strip `//` and `/* */`; Rust raw strings (`r"..."`, `r#"..."#`) do not affect
line-anchored `use` detection.

### JS/TS (`.js/.ts/...`)

Keep the existing `import-style` axis (`:267-271`, cjs vs esm module system) exactly as is.
It already reads CommonJS `require()` alongside ES `import ... from` (`:268-269`). Do NOT
fold JS/TS into the new scheme for the first cut: the module-system signal is already ported
and consumed by the mapper and reviewer. A future `js-import-ordering` dimension is possible
but is out of scope here.

## 3. Scope and sizing

**First cut (ship, all regex-reliable, no parser):**

| Axis | Language | Confidence | Why |
|------|----------|-----------|-----|
| `py-wildcard-import` | Python | HIGH | single anchored regex, unambiguous |
| `py-import-relativity` | Python | HIGH | dot-prefix is a clean discriminator |
| `rust-glob-import` | Rust | HIGH | anchored regex + super/self guard |
| `go-import-ordering` | Go | HIGH | gofmt alphabetical is deterministic |

**Defer (parser or config dependency, or low signal):**

- `go-import-grouping` full stdlib/third-party/local 3-way (needs `go.mod` module path).
  Optional 2-way `stdlib-first` can ship later once the first cut is proven.
- `rust-path-style` (`crate::` vs `super::`/`self::`) - both valid, noisy.
- `rust-use-grouping` - needs cross-line prefix reconstruction.

**Language detection:** by file extension via `path.extname(file)` (`.py`, `.rs`, `.go`,
plus the existing `JS_TS_RE` at `:48`). No content sniffing needed.

**Interaction with the existing `import-style` (cjs/esm) axis:** keep it, unchanged and
orthogonal. The new axes are additive and language-scoped; they never touch JS/TS files. No
folding, no migration.

## 4. Verification approach

Reuse the existing `deriveConventions` / `checkConformance` API with the `opts.sources` map
(in-memory `{ path: src }`, no disk reads) - the exact pattern already used in
`tests/conventions.test.cjs:355-389` (the non-app-vote test). Add cases to that file.

Per dimension, build a fixture corpus and assert vote + flag:

1. **Go ordering.** 8+ `.go` files with alphabetically-sorted import blocks ->
   `deriveConventions` names `go-import-ordering` = `sorted`. Then `checkConformance` on one
   changed `.go` file with an unsorted block -> one finding. Conforming file -> no finding.
2. **Python relativity.** 8+ `.py` files using absolute imports (one changed relative-import
   file) -> axis named `absolute`, the relative file flagged. Mirror with a
   majority-relative corpus.
3. **Python wildcard.** 8+ `.py` files with explicit imports + one `from x import *` ->
   `py-wildcard-import` named `explicit`, the star file flagged.
4. **Rust glob.** 8+ `.rs` files with explicit `use` + one `use crate::foo::*;` -> flagged.
   Then assert a file containing only `use super::*;` is NOT flagged (test-preamble guard).
5. **Insufficient-data safety.** <8 files of a language -> axis `insufficient-data` -> zero
   findings (advisory silence is correct).
6. **Test-file exclusion.** The same bad import under a `tests/` path -> not voted, not
   flagged (`isNonAppPath`), while the identical source at an app path IS flagged (mirrors
   the existing `tests/conventions.test.cjs:378-389` case).
7. **Contested skip.** A near-even split (e.g. 5 sorted / 5 unsorted Go files) -> axis
   `contested`, `dominant: null` -> `checkConformance` emits nothing (CONV-02).

Note the advisory design (already true for casing): in a majority-bad-habit repo, a
"better" file is still flagged as a deviation from the derived majority. That is intended
behavior for a convention-drift tool and should be asserted, not treated as a bug.

## Don't hand-roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Vote gating (entropy/dominance/min-sample) | new thresholds | `summarizeAxis` (`:291`) | already tuned + tested |
| Directory scoping | per-axis scope logic | `opts.scope` (`:339-342`) | already applied uniformly |
| Test/fixture exclusion | per-language skip lists | `isNonAppPath` (`:98`) | one source of truth |
| Full language parsing | Go/Py/Rust parsers | line-anchored regex packs | first cut needs none; parser dims are deferred |

## Common pitfalls

- **Forgetting the verify.cjs corpus glob (`:1539`).** The most likely miss: axes register
  and unit-test green via `opts.sources`, but real CLI runs feed zero Go/Py/Rust files, so
  the axes silently stay `insufficient-data`. Widen `SRC_RE` in the same change.
- **Three drifting key lists.** `AXES` (`:44`), `obs` init (`:241`), `tallies` init
  (`:346`) must agree. Generalize obs/tallies from `AXES` to make future axes a one-line add
  and prevent the `Object.entries(undefined)` throw in the tally loop (`:363`).
- **Running language packs after the JS/TS `continue` (`:540`).** Placing new
  `checkConformance` blocks after that line means they never run for `.go/.py/.rs`. Put them
  before it.
- **Rust test-preamble false positives.** `use super::*;` / `use self::*;` inside app files
  are idiomatic test-module imports; `isNonAppPath` will not catch them. Exclude them from
  the glob vote and flag.
- **Reusing `blankSpans` for non-JS languages.** It does not understand Python `#` or triple
  quotes; use line-anchored regexes instead.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | VibeDrift v0.18.0 treats import habits per-language/independently-voted per the captured scope note | Summary, §2 | Low - we implement to our own engine's shape, not VibeDrift's internals; scope note is the spec |
| A2 | Line-anchored `^from`/`^import`/`^use` false positives inside strings are negligible for advisory tier | §2 | Low - advisory only, never blocks; guarded by comment-marker skipping |

## Environment availability

None required. This is a code + config change to existing CJS modules with Node built-ins
only (`node:fs`, `node:path`), matching the existing `conventions.cjs` design (zero new
runtime dependency). No external packages, so no Package Legitimacy Audit is needed.

## Validation architecture

- **Framework:** the repo's own CJS check harness (`tests/conventions.test.cjs`, plain
  `node` assertions via a local `check(...)` helper). Run: `node tests/conventions.test.cjs`.
- **Full suite:** the project's unit test runner (see `package.json` test scripts) plus
  `build-bm --check` per project conventions.
- **Requirements -> tests:** each dimension in §4 maps to one derive test + one flag test +
  one abstain/contested guard, added to `tests/conventions.test.cjs` using the
  `opts.sources` in-memory corpus pattern (template at `:355-389`).
- **Wave 0 gaps:** none - `tests/conventions.test.cjs` already exists and exercises
  `deriveConventions`/`checkConformance` via `opts.sources`; new cases append to it.

## Sources

### Primary (HIGH)
- `bin/lib/conventions.cjs` (read in full): AXES `:44`, `observeFile` `:238-274`,
  `summarizeAxis` `:291`, `deriveConventions` `:333-376`, `checkConformance` `:509-612`,
  `isNonAppPath` `:98`.
- `bin/lib/verify.cjs`: `collectConventionCorpus` `:1538` (SRC_RE `:1539`), CLI derive/check
  wiring `:1465`, `:1510-1511`.
- `tests/conventions.test.cjs`: API usage + `opts.sources` corpus pattern `:105-389`.

### Secondary (MEDIUM)
- `.planning/todos/pending/2026-09-02-import-habit-drift-axis-per-language.md` (captured
  scope, VibeDrift v0.18.0 release-note summary).

## Metadata

- Standard stack: HIGH - no new deps; extends existing engine.
- Architecture / plug-in points: HIGH - read from source with line numbers.
- Regex rule packs: HIGH for the 4 first-cut dims; deferred dims correctly identified as
  parser-dependent.
- **Research date:** 2026-09-20
- **Valid until:** ~2026-10-20 (stable internal module; re-check line numbers if
  `conventions.cjs` or `verify.cjs` are edited before planning).
