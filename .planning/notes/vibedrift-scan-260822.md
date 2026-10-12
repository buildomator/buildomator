# VibeDrift second-upstream scan (260822)

Read-only scan of VibeDrift (github VibeDrift/VibeDrift) releases against our
native drift port. VibeDrift is a SECOND upstream: we never install or run it,
we port drift/integrity heuristics natively. Native port advanced to the v0.20.0
idea baseline for the rows dispositioned below (see the 260902 update); future
scans start after v0.20.0. Watch pin at v0.14.0; VibeDrift now at v0.20.0
(2026-08-19).

## Summary

- Releases scanned: 17 (v0.15.0 through v0.20.0, including all v0.16.x, v0.17.x,
  v0.18.x, v0.19.x point releases).
- PORT-CANDIDATE heuristics: 4 (2 high value, 1 moderate/large, 1 borderline).
- Most releases since our baseline are infra: Drift Sessions productization
  (v0.17.0-v0.19.x MCP hooks, trial meters, dashboard file-name opt-in, upload
  privacy), scoring/report honesty (cross-version delta suppression, N/A
  categories, advisory tiers), and auth-drift language-coverage expansion. None
  of that is a portable heuristic for us.

## Native port modules (what we already do)

- `bin/lib/conventions.cjs` (CONV-01..04): 4-axis convention derivation
  (file-name casing, identifier casing, export style, import style) with
  entropy + 0.70 dominance / 8-sample gate; per-file conformance findings;
  verb-vs-body intent; architectural-split (env + catch style). Directory
  scoping already available via `opts.scope`.
- `bin/lib/semantic-dup.cjs` (DRIFT-05): MinHash + LCS structural near-clone
  detector, ported from vibedrift@0.14.4 constants.
- `bin/lib/drift.cjs` (DRIFT-01..04): structural drift (new_dir, barrel,
  migration, route) vs STRUCTURE.md.

## PORT-CANDIDATE heuristics

| VibeDrift | Heuristic (one line) | What our port needs | Current gap |
|---|---|---|---|
| v0.20.0 | Do not judge tests/seeds/scripts/scratch against application conventions | Add an exclusion glob list (test/spec, seeds, scripts, fixtures, scratch) to `deriveConventions` (vote) and `checkConformance` (flag) in `conventions.cjs` | No exclusion anywhere in `conventions.cjs`; every file passed is voted and flagged, so test files skew the derived convention and get flagged against app rules. VibeDrift's own audit found this the single biggest in-loop false-positive source. |
| v0.20.0 | Drop phantom / boilerplate function shapes from the duplicate index (class constructors, callback-arg captures) | In `extractFunctions` (`semantic-dup.cjs`): exclude `constructor`; fix the callback-arg false capture where `test("x", function (a) { ... })` indexes a phantom function named after the callee | Confirmed live: our `METHOD_RE` captures both `constructor` and `test` as functions. DI-shaped constructors are byte-identical across classes (VibeDrift: 80 of 214 false dup findings from constructors alone); callback captures inflate the function-count denominator. |
| v0.18.0 | Import-habit drift as its own axis: grouping/ordering, absolute-vs-relative, wildcard/glob imports, voted independently and directory-scoped | New import axis in `conventions.cjs` beyond the current cjs-vs-esm module-system detection; ideally per-language (Go/Python/Rust habits) | Our `import-style` axis is only require-vs-import (module system), JS/TS only. No ordering/grouping/relative-path/wildcard signal. Larger effort; genuinely new idea vs baseline. |
| v0.20.0 | Duplicate similarity keeps data-path chain members literal (rename only the chain head) | In `normalizeTokens` (`semantic-dup.cjs`): keep identifier-chain members literal instead of collapsing every property access to VAR | Borderline. Our detector is intentionally Type-2/3 tolerant (renamed identifiers should collide). VibeDrift's refinement stops `schema.reports` vs `schema.users` from normalizing identically, reducing over-match on data-access code. Optional precision tweak; partly at odds with our rename-insensitive design intent. |

## Considered but NOT port-worthy (NA)

- Auth / Security Consistency check and its language expansion (v0.15.0 Express
  `.all()`/Flask methods; v0.16.0 Python/Go/Rust + cross-file guards + "unsure,
  double check"; v0.16.1 Go Fiber/Gorilla). Pre-baseline feature, deliberately
  outside our native scope; the releases are coverage expansions, not a new
  idea. We port conventions + structural clones + structure drift, not route
  auth scanning.
- Data-access / ORM classifier false-positive fixes (v0.19.5 Ent regex anchor,
  handler path by segment, route registrations not read as ORM). We have no
  ORM/data-access classifier to fix.
- Drift Sessions and MCP query plumbing: `watch-session`, `vibedrift enable`,
  in-loop advisory picking (v0.19.3), session re-check resolution (v0.19.6
  shingle-containment resolve, v0.20.0 moved-function suppression), MCP
  `validate_change`/`find_similar_function` signature-strip (v0.19.6). We have
  no sessions or MCP server; these are runtime plumbing, not batch heuristics.
- Reporting/scoring honesty (v0.16.2 delta suppression, v0.16.3 "what it
  measured", v0.18.1 upload privacy, v0.19.x trial/dashboard). We compute no
  composite score or cross-version delta.
- String-before-comment tokenization (v0.20.0): already correct in our
  single-pass `blankSpans` (a string literal is consumed whole before any `//`
  is treated as a comment).
- Directory-scoped conventions (v0.20.0): already available in our port via
  `deriveConventions(files, { scope })`. VibeDrift's v0.20.0 change fixed THEIR
  repo-wide baseline collapse; our port was scope-capable from the start.
- Locale-independent ordering (v0.20.0): minor. `drift.cjs` sorts output with
  `localeCompare`, but we do not diff scores across machines, so no false delta.
  `semantic-dup.cjs` already uses plain string compare.

## 260902 update

Native port advanced from the v0.14.0 idea baseline to v0.20.0 for the rows
below, via quick task 260902-0o5. Per-candidate ledger:

- Candidate 1 (v0.20.0, exclude tests/seeds/scripts/scratch from convention
  judgement): PORTED. `bin/lib/conventions.cjs` grew an `isNonAppPath` helper
  (frozen segment + `.test.`/`.spec.` basename patterns) wired into the
  `deriveConventions` vote filter and the `checkConformance` per-file skip.
  Regressions: a snake-named test-file majority no longer flips the file-name
  casing axis (kebab survives), a non-app file yields zero findings while the
  same source in-app still flags, plus an accept/reject path table.
- Candidate 2 (v0.20.0, drop constructor + callback-arg phantoms from the dup
  index): PORTED, confirmed live first. A `detect()` probe over a two-file
  corpus (callback wrapper + DI constructor) produced two phantom pairs at
  similarity 1.0 (`test` and `constructor`). `extractFunctions` in
  `bin/lib/semantic-dup.cjs` now skips `methodLike` matches named `constructor`
  or whose argument segment is call-shaped (carries a quote or `function`).
  Regression: the phantom corpus now yields zero pairs; control: identical real
  class methods across two files still pair.
- Candidate 3 (v0.18.0, import-habit drift as a per-language axis): DEFERRED.
  Scoped from the v0.18.0 release notes: independently-voted, directory-scoped
  per-language sub-signals (Go grouping/gofmt ordering, Python
  absolute-vs-relative + wildcard, Rust glob/intra-crate path/use-grouping;
  JS/TS module system unchanged). Phase-sized (new rule packs + per-dimension
  vote wiring + language dispatch), not a quick-task add. Captured in
  `.planning/todos/pending/2026-09-02-import-habit-drift-axis-per-language.md`.
- Candidate 4 (v0.20.0, keep data-path chain members literal in
  `normalizeTokens`): NOT TAKEN this pass. Borderline and partly at odds with
  our deliberate rename-insensitive (Type-2/3) design intent; left on the table
  for a future precision review, not scheduled.

New idea baseline: v0.20.0 for the rows above. Future scans start after v0.20.0.

## Watch pin recommendation

The two high-value candidates (test/seed exclusion, and dropping
constructor/callback phantom index entries) are real precision improvements
worth a small native phase; the import-axis candidate is a larger optional
enhancement. None are urgent and none block advancing the watch. Recommend:
advance the release-watch acknowledgement to v0.20.0 (update the maintainer's
`~/.vibedrift-last-known-version` / `bin/check-vibedrift-release.sh` baseline
awareness), and schedule the 4 candidates as a future DRIFT precision phase
rather than treating this as watch-only.
