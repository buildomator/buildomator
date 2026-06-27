---
phase: 11-drift-detection-and-consistency-gate
reviewed: 2026-06-27T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - bin/lib/semantic-dup.cjs
  - bin/lib/phantom-scaffolding.cjs
  - bin/lib/drift-allowlist.cjs
  - bin/lib/verify.cjs
  - bin/lib/verify-command-router.cjs
  - bin/lib/config-schema.cjs
  - bin/lib/command-aliases.generated.cjs
  - sdk/src/query/verify.ts
  - sdk/src/query/command-family-handlers.ts
  - sdk/src/query/command-manifest.verify.ts
  - sdk/src/query/config-schema.ts
  - sdk/src/query/command-aliases.generated.ts
  - bin/check-vibedrift-release.sh
  - .github/workflows/check-drift.yml
  - workflows/scan.md
  - workflows/audit-milestone.md
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** deep (cross-file, CJS/SDK parity, contract tracing)
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 11 ships four libraries (semantic-dup, phantom-scaffolding, drift-allowlist, cmdVerifyDrift), a cron notifier script, CI workflow additions, and consumer wiring in two workflow files. The never-throw / exit-0 contract is structurally sound: all public entry points have top-level try/catch and return `{ skipped:true, reason }` on any failure. The MinHash+LCS pipeline is deterministic (PERM_SEEDS verified all-nonzero, no Math.random). The globMatch implementations are safe against injection via the escape-first strategy.

Two issues are blocking before this ships:

1. The drift JSON payload uses `counts.structuralDup` / `counts.phantom` / top-level `suppressed`, but `workflows/scan.md` and `workflows/audit-milestone.md` reference the non-existent keys `counts.findings` and `counts.suppressed`. Any workflow that parses the JSON output verbatim will silently get `undefined` for both values.

2. The SDK `config-schema.ts` is missing the `fable` tier from the `model_profile_overrides` dynamic pattern. The CJS pattern accepts `fable|opus|sonnet|haiku`; the SDK only accepts `opus|sonnet|haiku`. A `config-set model_profile_overrides.claude.fable haiku` call that routes through the SDK resolver will be rejected while the CJS resolver accepts it -- silent per-resolver divergence.

The remaining findings are warnings (dead code, unimplemented feature, missing CI guard) and nits (style, no-op expressions).

---

## Narrative Findings (AI reviewer)

### Blocking

#### BL-01: Drift JSON payload keys `counts.findings` and `counts.suppressed` do not exist

**Files:**
- `workflows/scan.md:63,82`
- `workflows/audit-milestone.md:193,194`

**Issue:** `cmdVerifyDrift` emits this shape:

```json
{
  "skipped": false,
  "score": 95,
  "findings": [...],
  "suppressed": [...],
  "counts": { "structuralDup": 0, "phantom": 0, "conventionAxes": 3 }
}
```

`scan.md` line 63 uses `{counts.findings}` and line 82 tests `if counts.suppressed is 0`. `audit-milestone.md` lines 193-194 write `{counts.findings}` and `{counts.suppressed}` into the YAML block. Neither key exists. The top-level `suppressed` array is the correct source for the count; `counts` has no `findings` or `suppressed` subkeys.

**Fix:** In both workflow files replace:
- `{counts.findings}` with `{findings.length}` (or the pre-computed total before any `--top` slice: `counts.structuralDup + counts.phantom`)
- `{counts.suppressed}` with `{suppressed.length}`
- `if counts.suppressed is 0` with `if suppressed.length === 0`

In `audit-milestone.md` lines 193-194:
```yaml
findings_count: {findings.length}
suppressed_count: {suppressed.length}
```

---

#### BL-02: `fable` tier missing from SDK `model_profile_overrides` dynamic pattern

**File:** `sdk/src/query/config-schema.ts:135-137`

**Issue:** CJS (`bin/lib/config-schema.cjs:112-113`) accepts:
```
/^model_profile_overrides\.[a-zA-Z0-9_-]+\.(fable|opus|sonnet|haiku)$/
```

SDK (`sdk/src/query/config-schema.ts:135`) accepts:
```
/^model_profile_overrides\.[a-zA-Z0-9_-]+\.(opus|sonnet|haiku)$/
```

`fable` is absent. A call that uses the SDK resolver path to set `model_profile_overrides.<runtime>.fable` will be rejected as invalid while the CJS resolver accepts it. The SDK docstring (`config-schema.ts:9-13`) explicitly requires these to be set-equal and states a parity test enforces this -- but no such test exists (see WR-04).

**Fix:** In `sdk/src/query/config-schema.ts` update the pattern and source:
```ts
{
  source: '^model_profile_overrides\\.[a-zA-Z0-9_-]+\\.(fable|opus|sonnet|haiku)$',
  description: 'model_profile_overrides.<runtime>.<fable|opus|sonnet|haiku>',
  test: (k) => /^model_profile_overrides\.[a-zA-Z0-9_-]+\.(fable|opus|sonnet|haiku)$/.test(k),
},
```

---

### Warnings

#### WR-01: `.vibedriftignore` ignore list is loaded but never applied

**Files:**
- `bin/lib/drift-allowlist.cjs:104-132` (loads `ignore` list)
- `bin/lib/verify.cjs:1593` (passes `allow` to semantic-dup only)
- `bin/lib/semantic-dup.cjs:389-390` (reads `allow.pairs`, never `allow.ignore`)
- `bin/lib/phantom-scaffolding.cjs` (never receives `allow` at all)

**Issue:** `load()` reads `.vibedriftignore` into `allow.ignore`, the docstring describes it as "portable path exclusions", and the `opts.allow` JSDoc in `semantic-dup.cjs:24` lists `ignore:[]` as part of the shape. But no code ever reads `allow.ignore`. The corpus is never filtered by it. Users who populate `.vibedriftignore` expecting file exclusions get silently no-op'd.

**Fix:** Either (a) apply `allow.ignore` as a corpus pre-filter in `cmdVerifyDrift` before calling the three detectors, using the same `globMatch` that exists in `drift-allowlist.cjs`:

```js
// After loading allow and before building corpus:
const corpus = (await collectConventionCorpus(root, cwd)).filter(
  rel => !allow.ignore.some(pat => globMatch(pat, rel))
);
```

Or (b) if the feature is intentionally deferred, remove `ignore` from the returned object and the JSDoc to avoid misleading callers.

---

#### WR-02: `METHOD_RE` is declared but never added to `patterns` -- class methods silently skipped

**File:** `bin/lib/semantic-dup.cjs:283,285-289`

**Issue:** `extractFunctions` defines four regex patterns but only three are added to `patterns`:

```js
const METHOD_RE = /\b([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;  // line 283, DECLARED

const patterns = [
  { re: NAMED_FN_RE, priority: 1 },
  { re: VAR_FN_RE, priority: 2 },
  { re: ARROW_FN_RE, priority: 3 },
  // METHOD_RE is NOT here
];
```

`METHOD_RE` is assigned and never referenced again. Class methods like `doSomething(a, b) { ... }` are invisible to the semantic-dup detector. This is not a crash risk but silently reduces detection coverage. The comment on line 282 says "not constructors for simplicity" as if it was included but only constructors excluded -- that is misleading given the entire pattern is dead.

**Fix:** Either add `METHOD_RE` to `patterns` (with deduplication handled by the `seen` set that's already in place), or delete the declaration and update the comment:

```js
// Method extraction not implemented; only named functions and
// variable-bound function/arrow expressions are indexed.
```

---

#### WR-03: `tests/config-schema-sdk-parity.test.cjs` referenced in comments but does not exist

**File:** `sdk/src/query/config-schema.ts:10-13`

**Issue:** The SDK file states:

> "MUST stay in sync with the CJS schema — enforced by tests/config-schema-sdk-parity.test.cjs (CI drift guard)."

That test file does not exist in the repository. The analogous `config-schema-docs-parity.test.cjs` (referenced in `bin/lib/config-schema.cjs:8`) also does not exist. BL-02 (the `fable` divergence) was introduced exactly because the claimed CI guard is absent. The `check-drift.yml` workflow does not run either test.

**Fix:** Either create the parity test (compare `VALID_CONFIG_KEYS`, `RUNTIME_STATE_KEYS`, and `DYNAMIC_KEY_PATTERNS[*].source` between the two files and fail if they differ), or remove the false claim from the docstring. The former is strongly preferred to prevent future recurrence of BL-02.

---

#### WR-04: SSH subject line expands `$LATEST` (npm-sourced) before quoting -- injection risk

**File:** `bin/check-vibedrift-release.sh:93`

**Issue:**

```bash
echo "$BODY" | $SSH "$MAIL_HOST" "mail -s 'VibeDrift...: v${LATEST} available ...' $RECIPIENT"
```

`${LATEST}` is expanded locally by the shell *before* being sent to SSH. The remote command string is a double-quoted argument, so single quotes inside it are literal characters that the remote shell parses. If `LATEST` contains a single quote (e.g., `1.0.0'$(rm -rf /)#`) the remote `mail -s '...'` invocation breaks out of its subject string. npm version strings are constrained to semver and are unlikely to contain quotes in practice, but the script already validates that `LATEST` is non-empty (line 29-31) without validating its format.

**Fix:** Validate that `LATEST` matches a semver pattern before using it, or sanitize single quotes:

```bash
# Validate semver format
if ! echo "$LATEST" | grep -Eq '^[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?$'; then
  exit 0
fi
```

This is low severity given it's a personal cron script with a trusted npm registry as the only input source, but it's still a command injection vector.

---

#### WR-05: `VIBEDRIFT_REPO="lalalune/vibecheck"` -- likely wrong GitHub repo

**File:** `bin/check-vibedrift-release.sh:53`

**Issue:** The script fetches GitHub release notes from `lalalune/vibecheck` but the npm package being watched is `@vibedrift/cli`. These may not correspond to the same repository. If the repo is wrong, `$GH api repos/lalalune/vibecheck/releases/tags/v${LATEST}` returns an error, the script falls back to "(No release notes found)", and the email is less useful than intended. This is a silent degradation with no error surfaced.

**Fix:** Verify the correct GitHub repository for `@vibedrift/cli` and update the constant. If the repo is unknown or private, remove the GitHub release-notes fetch block entirely and rely on the npm URL only.

---

### Info / Nits

#### IN-01: Phase-plan tracking codes in production code comments

**Files:**
- `bin/lib/semantic-dup.cjs:2,45` (`Phase 11, plan 11-01`, `T-11-01`, `T-11-03`)
- `bin/lib/phantom-scaffolding.cjs:1,13` (`Phase 11, plan 11-02`, `T-11-04`)
- `bin/lib/drift-allowlist.cjs:1` (`Phase 11, plan 11-02`)
- `bin/lib/verify.cjs:1548,1569,1597` (`Phase-11`, `T-11-01`, `T-11-03`)

**Issue:** Per project conventions, GSD phase numbers and internal plan/task codes should not be embedded in shipped code comments. These make the code harder to read for anyone not familiar with the planning artifacts, and become stale as the code evolves.

**Fix:** Replace with descriptive intent comments. For example:
- `// Reuse sanitizePaths for safety (T-11-01 / V5)` -> `// sanitizePaths rejects path traversal before reads`
- `continue; // one bad file never fails the run (T-11-03)` -> `continue; // per-file read failure is non-fatal`
- File-level `Phase 11, plan 11-02` in the opening docblock -> remove entirely (the module is self-describing)

---

#### IN-02: No-op ternary in `MAX_SCAN_BYTES` definition

**File:** `bin/lib/phantom-scaffolding.cjs:36`

**Issue:**
```js
const MAX_SCAN_BYTES = conventions.blankSpans ? 512 * 1024 : 512 * 1024;
```

Both branches of the ternary return the same value. `conventions.blankSpans` is always a function (never falsy after a successful `require`), so the `else` branch is unreachable. This appears to be a vestigial pattern from an earlier version where the fallback value was different.

**Fix:**
```js
const MAX_SCAN_BYTES = 512 * 1024;
```

---

#### IN-03: `readFileSync` (blocking) used inside `async verifySummary`

**File:** `sdk/src/query/verify.ts:454`

**Issue:** `verifySummary` is an `async` function but uses `readFileSync` at line 454 instead of `await readFile(...)`. All other file reads in the same file use the async version (lines 60, 241, 264, 375). This is inconsistent and blocks the Node event loop during the read, though in this query-handler context the practical impact is minimal.

**Fix:**
```ts
const content = await readFile(fullPath, 'utf-8');
```

---

#### IN-04: `conventions.deriveConventions` called in `cmdVerifyDrift` only to count axes

**File:** `bin/lib/verify.cjs:1616-1622,1680`

**Issue:** `deriveConventions` performs a full corpus scan (the same bounded walk just completed for the two detectors). The result is only used to count axes for an informational field in the output:
```js
const conventionAxes = (!convResult.skipped && Array.isArray(convResult.axes)) ? convResult.axes.length : 0;
```
No convention findings are included in the `rawFindings` array. The call is not harmful (the corpus is the same bounded set, max 5000 files), but it does redundant work.

**Fix:** If convention violations are not intended to contribute to the drift score, replace the `deriveConventions` call with a simpler corpus-size metric or remove it:
```js
const conventionAxes = 0; // convention findings not scored in drift (use verify conventions --check for details)
```
Or add convention findings to `rawFindings` so the expense is justified.

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (adversarial code review)_
_Depth: deep_
