# VibeDrift second-upstream scan (261026)

READ-ONLY scan of VibeDrift (github VibeDrift/VibeDrift, npm @vibedrift/cli)
releases against our native drift port. VibeDrift is a SECOND upstream: we never
install or run it, we port drift/integrity heuristics natively. This scan covers
everything between the last watch point (v0.20.0 idea baseline, see
vibedrift-scan-260822.md) and the current latest, v0.21.7 (2026-10-06). No
product code was edited.

## Summary

- Releases scanned: 11 (v0.20.1, v0.20.2, v0.20.3, v0.21.0, v0.21.1, v0.21.2,
  v0.21.3, v0.21.4, v0.21.5, v0.21.6, v0.21.7).
- NEW PORT-CANDIDATE heuristics: 2 (1 confirmed high value, 1 borderline/park).
- Already-covered: 5. NA (VibeDrift-runtime-specific / out of scope): the large
  majority.
- The release line in this window is dominated by Drift Sessions productization
  (multi-repo session ownership, a Bash PostToolUse hook, recheck-session, a
  person-answers-a-flag loop, mid-turn answer delivery), Claude Code plugin
  packaging, and score-honesty work (monotone scoring, SCORING_VERSION v18,
  privacy/secret-masking of uploads). None of that is a portable batch heuristic
  for us. Two detection-accuracy fixes do touch logic we ported.

## Native port modules (what we already do)

- `bin/lib/conventions.cjs` (CONV-01..04): file-name casing, identifier casing,
  export style, import style, PLUS the per-language import-habit axes now wired
  in (py-wildcard-import, py-import-relativity, rust-glob-import,
  go-import-ordering). Entropy + 0.70 dominance / 8-sample gate per axis.
  `isNonAppPath` excludes test/spec/seed/script/fixture/scratch on whole path
  segments. Directory scoping via `opts.scope`. Note: `extractIdentifiers`
  (line 232) only matches JS/TS `function`/`const`/`class` keywords, so Python
  identifiers never enter the casing vote.
- `bin/lib/semantic-dup.cjs` (DRIFT-05 layer 3): MinHash + LCS structural
  near-clone detector, ported verbatim from vibedrift@0.14.4 constants.
  `extractFunctions` skips `constructor` + callback-arg phantoms (260902).
- `bin/lib/phantom-scaffolding.cjs` (DRIFT-05 layer 2): phantom-export +
  placeholder-stub detection; reuses `conventions.blankSpans` so `export`/TODO
  inside strings/comments is never matched.
- `bin/lib/drift.cjs` (DRIFT-01..04): structural drift vs STRUCTURE.md.

## NEW PORT-CANDIDATE heuristics

| VibeDrift | Heuristic (one line) | What our port needs | Current gap |
|---|---|---|---|
| v0.21.7 (#88) | The duplicate extractor must read typed functions: return-type annotations, typed arrows, generics, typed Python signatures | In `semantic-dup.cjs` `extractFunctions`: allow an optional `: Type` (and generic `<...>`) between the parameter list and the `{`/`=>`, ideally route all tiers through one shared extractor | CONFIRMED live. All four regexes (`NAMED_FN_RE`, `VAR_FN_RE`, `ARROW_FN_RE`, `METHOD_RE`) require `\)\s*\{` or `\)\s*=>\s*\{`, so `function f(): Foo {`, `const f = (x: T): Foo => {`, and `function f<T>(` match ZERO times. The near-clone detector silently under-reports on TypeScript. VibeDrift says the pair count rises "sometimes sharply" once typed functions are compared. Highest-value new candidate given the TS/Claude-heavy ecosystem; small surgical fix. |
| v0.20.2 | Loosen the Code DNA LCS length gate so it stops zeroing real near-dupes (VibeDrift: pairs up to 0.645 similarity were discarded) | Re-examine the `< 0.5` early-out in `lcsSimilarity` and the `< 0.6` token-length-ratio guard in `findDuplicatePairs` against VibeDrift's actual 0.20.2 diff | Borderline. We ported these ratio guards verbatim from 0.14.4. A pair at token-ratio ~0.55 could still reach final similarity ~0.71 (>= our 0.7 `FLAG_THRESHOLD`) yet is zeroed before LCS runs. The exact "0.645" figure is tied to THEIR threshold, not ours, so this needs their source diff to port precisely. Low priority; park. |

## Already covered (no action)

- Phantom-scaffolding AST-grounding (v0.20.1, #107): VibeDrift moved export
  detection off a regex that matched `export` inside string literals/comments and
  onto the parsed syntax tree. Our `phantom-scaffolding.cjs` and `semantic-dup`
  already run `conventions.blankSpans` first, so exports inside strings/comments
  are blanked before matching. Covered without needing a full AST.
- Non-app path matched on repo-relative, not absolute (v0.21.5, #105): the
  VibeDrift bug excluded a whole repo cloned under a folder named `examples/`,
  `tests/`, etc. because it matched the absolute on-disk path. Our `isNonAppPath`
  operates on cwd-relative paths and `sanitizePaths` drops any absolute path, so a
  parent directory name can never disqualify files. We also do not list
  `examples`/`demos` as excluded segments at all.
- Single all-lowercase word ambiguity (v0.20.2): VibeDrift stopped counting a
  lone lowercase word (`main`, `run`, `config`) as camelCase because, once Python
  function names entered the vote, it flipped whole Python projects to a camelCase
  "majority". Cannot bite us: `extractIdentifiers` only matches JS/TS
  `function`/`const`/`class` keywords, so Python function names never vote. In a
  JS/TS context, single-lowercase -> camel is the correct call and is a documented
  design choice (CASING_RULES ordering comment).
- Directory-scope fallback when the index is too large (v0.21.0): their in-loop
  check falls back to the edited file's own directory above 2,000 indexed
  functions. Our modules are already scope-capable (`opts.scope`); also an
  orchestration concern, not a batch-heuristic gap.
- Mixed import style scored by deviating-file count (v0.20.1, #108): we flag per
  deviating file already and compute no composite score, so the "count feeds the
  score with diminishing returns" refinement has no analog to fix.

## Considered but NOT port-worthy (NA)

- All Drift Sessions runtime work: session overlay index, stale-baseline Stop
  rebuild, the Bash PostToolUse hook, `recheck-session` (v0.20.3); multi-repo
  session ownership, per-repo consent, dashboard repo identity, "unchecked edit
  says why" (v0.21.0); `vibedrift respond`, mid-turn and SessionStart answer
  delivery, queued-answer file naming, live once-a-minute upload (v0.21.1 through
  v0.21.4). We have no sessions, no MCP server, no dashboard.
- Claude Code plugin packaging: plugin.json/marketplace.json, `/vibedrift:setup`,
  plugin-shipped hooks (v0.20.1, v0.20.3). We have our own plugin.
- Score honesty / scoring: v0.20.1 score refinement, v0.20.2 monotone scoring +
  grade table + SCORING_VERSION v18, cache/baseline version bumps. We compute no
  composite Vibe Drift Score or cross-version delta.
- Product privacy/security: CSV formula-injection neutralisation, loopback-only
  report server, https-only API URL, MCP write-tool target-dir validation,
  deep-scan upload body stripping (v0.20.2), secret-masking of uploaded finding
  excerpts + footer honesty (v0.21.4). No upload path on our side.
- Detector domains we deliberately do not have: Go named-return unchecked-error,
  Go else-if cognitive complexity, mock/todo implementation-gap escalation, the
  auth / Security Consistency lane, raw-SQL / ORM drift classification, taint
  sanitiser/sink anchoring (v0.20.2). Out of native scope.
- File-discovery concerns upstream of our pure modules (they take a
  caller-provided cwd-relative corpus): bundle/long-line file skip judged per file
  (v0.21.5 #110), nested `.gitignore`/`.vibedriftignore` honored git-style
  (v0.21.5 #111), skipping build folders while walking for ignore files
  (v0.21.6), `--format json` warning parity. If we ever build a standalone
  scanner front-end these matter; they are not gaps in `conventions.cjs` /
  `semantic-dup.cjs` / `drift.cjs` as called today.
- Robustness/plumbing: degradedAnalyzers (one analyzer crash no longer aborts the
  scan), telemetry-beacon timeout, malformed API URL no longer crashes a scan,
  atomic sidecar writes (v0.20.2/v0.20.3). Runtime concerns, not heuristics.

## Prior parked candidates (status carried over)

From the 260822/260902 ledger: candidates 1 (test/seed exclusion) and 2
(constructor + callback phantom drop) are PORTED and live. Candidate 3
(import-habit drift per-language axis) is now PORTED too (the AXES list carries
py-wildcard-import, py-import-relativity, rust-glob-import, go-import-ordering).
Candidate 4 (keep data-path chain members literal in `normalizeTokens`) remains
NOT TAKEN, borderline, still parkable.

## Verdict / watch-pin recommendation

- One new candidate is worth acting on soon: the v0.21.7 typed-function
  extraction gap (#88) is a confirmed correctness hole that makes our near-clone
  detector silently under-report on TypeScript. It is a small, surgical change
  (tolerate an optional `: Type` / generic segment before the brace, ideally by
  routing all tiers through one shared extractor). Recommend bundling it with the
  still-parked candidate 4 (normalizeTokens precision) as a small DRIFT precision
  pass rather than a standalone release.
- The v0.20.2 LCS length-gate item is borderline; park until the typed-function
  work is scheduled, and pull VibeDrift's actual 0.20.2 Code DNA diff then.
- Everything else is already covered or VibeDrift-runtime-specific (sessions,
  dashboard, scoring, uploads, Claude Code plugin). Nothing blocks advancing the
  watch.
- New idea baseline: v0.21.7. Future scans start after v0.21.7. Advance the
  release-watch acknowledgement (bin/check-vibedrift-release.sh baseline /
  `~/.vibedrift-last-known-version`) to v0.21.7.

## Baseline advanced

The v0.21.7 #88 typed-function extraction fix shipped in plugin 5.0.4. The LCS
length-gate item (v0.20.2) stays parked until the Code DNA diff is pulled. The
idea baseline is now v0.21.7, and the local watch file
(`~/.vibedrift-last-known-version`) reads 0.21.7 so the release watcher stops
re-alerting on this window.
