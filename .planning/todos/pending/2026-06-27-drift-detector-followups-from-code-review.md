---
created: 2026-06-27T01:40:00.000Z
title: Drift detector follow-ups from Phase 11 code review
area: tooling
files:
  - bin/lib/semantic-dup.cjs
  - bin/lib/drift-allowlist.cjs
  - sdk/src/query/config-schema.ts
  - bin/lib/config-schema.cjs
---

## Problem

Phase 11 code review (11-REVIEW.md) surfaced non-blocking items deferred out of the phase. The phase goal was met and verified (5/5); these are quality/coverage follow-ups. The one in-phase correctness bug (consumer workflows referenced `counts.findings`/`counts.suppressed` which do not exist) and the blocking glob-suppression bug were both fixed during execution.

Deferred items:

1. **CJS/SDK config-schema parity for `fable` tier (pre-existing).** `bin/lib/config-schema.cjs` accepts `model_profile_overrides.<runtime>.(fable|opus|sonnet|haiku)` but `sdk/src/query/config-schema.ts` only accepts `(opus|sonnet|haiku)`. Setting a fable override via the SDK resolver is rejected while CJS accepts it. Predates Phase 11 (the v3.4.7 Fable work was CJS-only). See [[reference_model_resolver_single_source]].

2. **Missing config-schema SDK parity test.** `tests/config-schema-sdk-parity.test.cjs` is referenced in docstrings but does not exist. A real parity guard would have caught item 1. Alias parity is covered (`sdk/scripts/check-command-aliases-fresh.mjs`), but config-key parity is not.

3. **`.vibedriftignore` ignore list is loaded but never applied (WR-01).** `drift-allowlist.cjs` loads `ignore`, but only `allow.pairs` is consumed by `semantic-dup`. Users populating `.vibedriftignore` for corpus exclusions get nothing. Either wire `ignore` into corpus collection or drop the file + its docs.

4. **`METHOD_RE` dead in `semantic-dup.cjs` `extractFunctions` (WR-02).** The regex is declared but not added to `patterns`, so class methods are invisible to the structural-dup detector, silently reducing coverage.

5. **Nits:** no-op ternary in `phantom-scaffolding.cjs` (`blankSpans ? 512*1024 : 512*1024`); blocking `readFileSync` inside `async verifySummary` in `sdk/src/query/verify.ts`; `deriveConventions` corpus scan in `cmdVerifyDrift` whose result only counts axes (potentially redundant full scan).

## Solution

TBD. Items 1+2 belong together (add fable to the SDK pattern AND add the parity test that enforces it). Items 3+4 are coverage completion for the detectors. Nits are low priority. Review source: `.planning/phases/11-drift-detection-and-consistency-gate/11-REVIEW.md`.
