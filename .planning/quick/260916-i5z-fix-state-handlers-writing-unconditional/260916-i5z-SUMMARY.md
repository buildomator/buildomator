---
phase: quick-260916-i5z
plan: 01
subsystem: state-mutation
tags: [state, data-integrity, cjs-sdk-twins, regex, idempotency]
requires: []
provides: ["write-only-what-you-parsed invariant in both STATE.md writer twins"]
affects: [bin/lib/state.cjs, sdk/src/query/state-mutation.ts, dist/bm]
tech-stack:
  added: []
  patterns: ["null-sentinel transform result", "identical-bytes write skip", "horizontal-whitespace end-of-line-anchored progress patterns"]
key-files:
  created:
    - tests/state-write-only-parsed.test.cjs
  modified:
    - bin/lib/state.cjs
    - sdk/src/query/state-mutation.ts
    - sdk/src/query/state-mutation.test.ts
    - sdk/dist (rebuilt)
    - dist/bm (regenerated)
decisions:
  - "null sentinel (not input-identity) is the active fix; identical-bytes skip is a defensive backstop"
metrics:
  duration: ~30m
  completed: 2026-09-16
---

# Quick 260916-i5z: Fix STATE.md handlers writing unconditionally Summary

Upstream issue reference: **issue #9** family (write-only-what-you-parsed / executor-authored preservation). Both STATE.md writer twins now refuse to touch the file when a transform parsed nothing, and `update-progress` can no longer reach into the frontmatter `progress:` block.

## What changed

Restored the "write only what you parsed" invariant across the CJS twin (`bin/lib/state.cjs`) and the SDK twin (`sdk/src/query/state-mutation.ts`), plus regression coverage in both suites, a rebuilt `sdk/dist`, and a regenerated `dist/bm`.

## Per-twin root cause (they are NOT the same pattern)

- **CJS (`bin/lib/state.cjs`)**: the `update-progress` transform received the FULL file content, so the plain-progress regex `/^(Progress:\s*).*/im` matched the frontmatter `progress:` key first (case-insensitive), the greedy `\s*` crossed the newline into the block, and `.*` deleted the `total_phases` line beneath it, while the human-readable body `Progress:` bar was left untouched. Separately, `advance-plan` returned `content` on the parse-error path, so the shared writer still ran `syncStateFrontmatter` (which rebuilds counters from disk and stamps a fresh `last_updated`) and rewrote the file, corrupting a curated `total_phases: 30` down to a disk-derived value.
- **SDK (`sdk/src/query/state-mutation.ts`)**: its writer already strips frontmatter before the modifier, so the regex never saw the frontmatter block. The real SDK defect was the UNCONDITIONAL WRITE: on a null/no-match/parse-error result the modifier returned the input body, the writer still ran `syncStateFrontmatter`, `normalizeMd`, and `writeFile`, rewriting the file (fresh `last_updated`, rebuilt counters) while the handler reported `error` / `updated:false`.

## The shared fix (null sentinel) and a rejected alternative

The active fix is an explicit `null` sentinel: a transform/modifier returning `null` means "nothing parsed, do not write", and each writer returns BEFORE `syncStateFrontmatter` and before the disk write. This is kept distinct from the legitimate issue-9 path where a modifier returns an unchanged BODY STRING (not null) so `syncStateFrontmatter` can still rebuild stale frontmatter (`stateSyncFrontmatter` / `runModifier`). That path is untouched.

An "input byte-identical means skip" rule was deliberately NOT added to the SDK writer, because `stateSyncFrontmatter` legitimately calls the writer with a modifier that returns the body unchanged specifically to force a frontmatter rebuild; an input-identity skip would break that. Instead both writers add an OUTPUT identical-bytes skip (`serialized === on-disk`), which can never lose a legitimate change. Note this idempotency backstop rarely fires in practice: `buildStateFrontmatter` stamps a fresh `last_updated` on every resync, so the serialized output almost always differs from disk. The `null` sentinel is what actually protects the parse-error and no-match paths.

The regex tightening (`[ \t]*` + `$` end-of-line anchor under `/im`) is a real fix for the CJS body-slice matching and defense-in-depth for the SDK; it was applied to both twins. In CJS the transform additionally confines matching to `stripFrontmatter(content)` and reassembles `head + newBody`, so the frontmatter `progress:` block is unreachable by the regex.

Exit codes and JSON result shapes were left unchanged in both twins (the CJS `advance-plan` error path still exits via `output(...)` as before; `update-progress` still returns `updated:false` with reason `Progress field not found in STATE.md`). The zero-plan no-op guard and the issue-9 executor-authored Status/Last-Activity preservation logic were not disturbed.

## Verification (real output pasted)

### Gate 1 + 2 + 3 — CJS twin (inline)
```
F1 CJS: error reported, bytes and mtime unchanged
F2 CJS: body 50%, total_phases and completed_plans survive
F2b CJS: frontmatter-only progress is a byte-identical no-op
happy CJS: advanced to 3 of 3
```

### Gate 1 + 2 + 3 — SDK built dist (inline)
```
type widened OK
dist [ \t]* count: 4
F1 SDK: error reported, bytes and mtime unchanged
F2 SDK: body 50%, total_phases survives
F2b SDK: frontmatter-only progress is a byte-identical no-op
happy SDK: advanced to 3 of 3
```

### Regression harnesses
```
node tests/state-write-only-parsed.test.cjs -> All state-write-only-parsed tests passed (4 checks)
node tests/progress-and-frontier.test.cjs  -> All progress-and-frontier tests passed
SDK unit (state-mutation.test.ts): 64 tests passed (includes 'write only what you parsed' block)
SDK full unit project: Test Files 129 passed, Tests 1892 passed
```

### Gate 4 — CJS battery + integration
```
CJS battery: zero new failures (2 baseline fails remain)
  FAIL tests/context-monitor-hook-event.test.cjs   (pre-existing baseline)
  FAIL tests/version-command.test.cjs              (pre-existing baseline)
integration: strict subset (14 before, 14 after)
```

### Gate 5 — build-bm
```
node bin/build-bm.cjs        -> ok
node bin/build-bm.cjs --check -> bm drift check: PASS (committed dist/bm matches a fresh build). (exit 0)
dist/bm/bin/lib/state.cjs carries the [ \t]* pattern
dist/bm/tests/state-write-only-parsed.test.cjs exists
```

### Gate 6 — hygiene
```
added lines scanned: 281 (bin/lib + sdk/src + tests, base..HEAD plus working tree)
hygiene clean: no #NNN issue refs, no U+2014/U+2013, no banned word
no planning files staged
```

## Deviations from Plan

None functional. Baseline capture: the plan's `--outputFile="../$Q/..."` relative form failed to produce the integration JSON when run through the harness subshell; captured the baseline with an absolute `--outputFile` path instead (same 14-line known baseline). This is a GSD-internal mechanics adjustment, not a product change.

## Commits

- `b1c9929` fix(state): CJS twin null-transform writer + body-only update-progress patterns + regression harness
- `d07f54c` fix(state): SDK twin null-modifier writers + patterns + vitest coverage + rebuilt sdk/dist
- `dd34deb` chore(bm): regenerate dist/bm

## Self-Check: PASSED
- tests/state-write-only-parsed.test.cjs exists and exits 0
- bin/lib/state.cjs, sdk/src/query/state-mutation.ts, sdk/src/query/state-mutation.test.ts modified and committed
- sdk/dist and dist/bm rebuilt and committed; build-bm --check PASS
- commits b1c9929, d07f54c, dd34deb present in git log
