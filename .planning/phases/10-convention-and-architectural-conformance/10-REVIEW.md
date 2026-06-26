---
phase: 10-convention-and-architectural-conformance
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - bin/lib/conventions.cjs
  - bin/lib/verify.cjs
  - bin/lib/verify-command-router.cjs
  - bin/gsd-tools.cjs
  - bin/lib/command-aliases.generated.cjs
  - sdk/src/query/command-manifest.verify.ts
  - tests/conventions.test.cjs
  - agents/gsd-pattern-mapper.md
  - agents/gsd-code-reviewer.md
  - workflows/code-review.md
  - .github/workflows/check-drift.yml
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 10 convention-derivation + conformance subsystem: the shared deterministic
module (`bin/lib/conventions.cjs`), its CLI wrapper (`cmdVerifyConventions` in `verify.cjs`),
the verify router, generated aliases, the SDK manifest, the test harness, the two agent specs,
the code-review workflow, and the CI job.

The architecture is sound: pure functions, never-throw contracts honored everywhere I traced,
input sanitization copied verbatim from the audited `drift.cjs`, and the advisory `CONVENTION`
tier is correctly non-blocking throughout. The test suite passes and the `verify conventions`
subcommand is correctly routed and emits parseable JSON.

No BLOCKER-class security or data-loss defects were found. The notable issue is a real
correctness bug in `blankSpans` (the lexical pre-pass that underpins every idiom check): it
can grow its output by one character, violating the documented length-preservation invariant
and desynchronizing the index-based brace matcher and line-number reporter. The remaining
findings are robustness gaps and documentation/consistency drift.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `blankSpans` writes past the end of its output buffer on a trailing backslash, breaking the length-preservation invariant

**File:** `bin/lib/conventions.cjs:139, 150, 163`
**Issue:** `blankSpans` allocates `out = new Array(n)` and documents that it preserves length
("preserving length and newlines"). Inside the string, template, and regex literal scanners,
an escape is handled with:

```js
if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
```

When a backslash is the final character of the source (an unterminated literal ending in `\`),
`i === n - 1`, so `out[i + 1]` writes to `out[n]` — one slot past the allocated length. The
returned string is then `n + 1` characters long. Confirmed empirically:

- `const x = "abc\` → src length 15, blanked length 16
- `x = /abc\` (regex) → src 9, blanked 10
- `` `abc\ `` (template) → src 5, blanked 6

Because every downstream consumer (`verbBodyViolations`, `classifyArchitecture`,
`extractIdentifiers`, `lineOf`, `src.indexOf`) computes positions by indexing the *original*
`src` while scanning the *blanked* string, any length divergence desynchronizes the
brace-balance matcher and the reported line numbers for content following the offending
literal. The practical blast radius is limited (the defect only triggers when the literal is
the last token, so usually nothing follows it), but it is a genuine invariant violation in the
foundational lexer that every idiom check depends on, and a malformed/truncated source file is
exactly the kind of input an advisory tool will be handed.
**Fix:** Guard the look-ahead write against EOF:

```js
if (src[i] === '\\') {
  out[i] = ' ';
  if (i + 1 < n) out[i + 1] = ' ';
  i += 2;
  continue;
}
```

Apply the same guard at all three escape-handling sites (lines 139, 150, 163). Consider adding
a test asserting `blankSpans(s).length === s.length` for inputs ending in `"\`, `` `\ ``, and
`/\`.

### WR-02: `cmdVerifyConventions --check` re-walks the full directory subtree per changed file with no walk cap propagated, and silently derives an empty contract on walk failure

**File:** `bin/lib/verify.cjs:1474-1483`
**Issue:** In `--check` mode the contract is derived by collecting `collectConventionCorpus`
for the `path.posix.dirname` of every changed file:

```js
const scopeDirs = new Set(changedFiles.map((c) => path.posix.dirname(...)));
const corpus = [];
for (const dir of scopeDirs) {
  try { corpus.push(...collectConventionCorpus(path.resolve(cwd, dir), cwd)); }
  catch { /* ignore an unreadable scope dir */ }
}
const derived = conventions.deriveConventions(corpus.length ? corpus : changedFiles.map((c) => c.file), { cwd });
```

Two robustness gaps:
1. `collectConventionCorpus` walks recursively from each scope dir with its own internal
   `budget = 5000`, but the budget is per-invocation. With many changed files spread across
   directories, the corpus can balloon and the same files get re-read by
   `deriveConventions`. More importantly, dirname-scoping silently changes the conformance
   semantics: a file in `bin/lib/` is judged against *all of `bin/lib/` recursively*, not its
   own neighbors — fine by design, but undocumented at this call site.
2. The `catch {}` swallows every walk error and contributes nothing to `corpus`. If *all*
   scope dirs are unreadable, the fallback derives from `changedFiles.map((c) => c.file)`
   (the changed files alone), which can never reach the 8-sample gate for export/import axes
   (one sample per file), so the contract quietly degrades to `insufficient-data` and emits no
   findings — indistinguishable from "everything conforms." This is the project's own
   `error-swallowing-empty-sentinel` anti-pattern that `verify.cjs:935` elsewhere explicitly
   avoids.
**Fix:** This is advisory-tier so it must not throw, but it should be observable. Track whether
any scope-dir walk failed and surface it in the emitted JSON (e.g.
`reason: 'partial-corpus'` or a `corpus_dirs_failed` count) so a caller can tell "no findings
because conformant" apart from "no findings because the corpus could not be read."

### WR-03: `blankSpans` template-literal scanner does not handle `${...}` interpolations, so code inside template expressions is blanked and invisible to all idiom checks

**File:** `bin/lib/conventions.cjs:146-156`
**Issue:** The comment is candid about this ("does not handle nested ${} braces precisely;
blanks whole span"), but the consequence is a correctness gap, not just imprecision: any
function call, assignment, or `process.env` access written inside a template interpolation
(``const x = `${obj.y = 1}` `` or `` `${process.env.TOKEN}` ``) is replaced with spaces and
therefore never seen by `verbBodyViolations` or `classifyArchitecture`. In a codebase that uses
template literals for shell-command projection (which this repo does — `shell-command-projection.cjs`),
mutations and direct-env reads embedded in interpolations are systematically missed. For an
advisory tier this is an accepted trade-off, but it should be a documented known-limitation in
the module header alongside the other caveats, because it produces *false negatives* (silent
under-reporting), which is the failure mode hardest to notice.
**Fix:** Either (a) document the false-negative explicitly in the module header's Design notes,
or (b) handle `${` by recursing into the interpolation as live code (track brace depth and only
blank the literal text segments). Option (a) is acceptable for v1; option (b) closes the gap.

## Info

### IN-01: Test header and assertion claim "five named functions" but the module exports eight

**File:** `tests/conventions.test.cjs:33-37`
**Issue:** The check is named `'exports the five named functions'` and the module/test comments
reference "five," but `module.exports` (`conventions.cjs:570-581`) exposes eight functions
(`deriveConventions`, `checkConformance`, `summarizeAxis`, `classifyCasing`, `sanitizePaths`,
`classifyArchitecture`, `extractIdentifiers`, `blankSpans`). The test only asserts the first
five exist, so it will not catch an accidental removal of the three internal exports that the
verify subcommand and other tests rely on.
**Fix:** Rename to "the public functions" and either assert all eight exported names or add the
three internals to the asserted list.

### IN-02: `void body` / `void arch.envStyle` dead assignments

**File:** `bin/lib/conventions.cjs:356, 364, 549`
**Issue:** `classifyArchitecture` computes `const body = src.slice(...)` then `void body;`
(line 356/364) — the value is extracted and immediately discarded; only `blankedBody` is used.
Similarly `void arch.envStyle;` (line 549) computes and discards the env classification. These
are intentional "computed-but-deferred" markers, but they read as dead code and the `body`
slice is pure overhead.
**Fix:** Delete the unused `body` slice in `classifyArchitecture` (only `blankedBody` is
consumed). Keep `arch.envStyle` only if the deferred per-file env flag is genuinely coming in a
follow-up; otherwise drop the classification call too.

### IN-03: `summarizeAxis` `contested` axis sets `dominant: null` but leaves `share`/`variants` populated — callers must not read `dominant`

**File:** `bin/lib/conventions.cjs:261-269`
**Issue:** For a contested axis, `dominant` is `null` while `share` still holds the (sub-0.70)
top share. `checkConformance` correctly only consults axes whose `status === 'named'`, so this
is safe today, but any future consumer that reads `axis.dominant` without first checking
`status` will compare against `null` and silently flag everything (`got !== null` is almost
always true). The contract is implicit.
**Fix:** Document on the function (and in the agent specs that parse the JSON) that `dominant`
is only meaningful when `status === 'named'`; consider omitting `share`/`variants` from
contested results, or add an explicit `usable: status === 'named'` flag.

### IN-04: Convention-derivation Bash one-liner in agents resolves `CLAUDE_PLUGIN_ROOT` via an unquoted glob that can mis-sort versions

**File:** `agents/gsd-pattern-mapper.md:151`, `agents/gsd-code-reviewer.md:97`
**Issue:** Both agents resolve the plugin root with
`$(ls -d "$HOME/.claude/plugins/cache/gsd-plugin/gsd/"*/ 2>/dev/null|sort -V|tail -1)`.
The workflow's own resolver (`workflows/code-review.md:336`) uses the same form, but the memory
note "Plugin path-form convention" prescribes the
`${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/` resolver form for
paths the agent reads/execs. The two agents and the workflow use a `gsd/*/` glob + `sort -V`
fallback instead of the `current` symlink, which diverges from the documented convention and
will pick the lexically/semver-highest cached version rather than the active one — a subtle
mismatch if multiple versions are cached.
**Fix:** Align the fallback with the documented resolver form
(`${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}`) across both agents
and the workflow, or confirm the `gsd/*/` glob form is the intended new convention and update
the memory note.

### IN-05: `deriveConventions` export/import axes are effectively per-file boolean votes, so the 8-sample gate means "8 files," not "8 occurrences"

**File:** `bin/lib/conventions.cjs:221-230, 245-251`
**Issue:** `observeFile` records export/import style as `= 1` per direction per file (a file
that does 30 `require()` calls still contributes `cjs: 1`). With `minSamples = 8`, the export
and import axes therefore require at least eight files in scope before they can be named — a
single large file with overwhelming evidence is `insufficient-data`. This is a defensible
design choice (avoids one file dominating), but it is undocumented and surprising: a `--check`
on one changed file will never produce an export/import finding regardless of how unambiguous
the surrounding corpus is, unless the corpus has 8+ files. The test corpus
(`deriveConventions(['drift.cjs','schema-detect.cjs','conventions.cjs'])`, 3 files) can never
name these two axes, which is why the test only asserts the status is *one of*
named/contested/insufficient-data rather than a concrete value.
**Fix:** Document the per-file-vote semantics for the export/import axes in the module header so
operators understand why small scopes yield `insufficient-data`, or weight these axes by
occurrence count if finer resolution is wanted.

---

_Reviewed: 2026-06-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
