---
phase: 10-convention-and-architectural-conformance
plan: 02
subsystem: verify-cli
tags: [conventions, verify-subcommand, cli-wiring, ci]
requires:
  - "bin/lib/conventions.cjs (deriveConventions / checkConformance from 10-01)"
provides:
  - "gsd-tools.cjs verify conventions --derive|--check JSON subcommand"
  - "verify.conventions registered in TS manifest + hand-synced .cjs alias map"
  - "conventions CI job gating tests/conventions.test.cjs"
affects:
  - "bin/lib/verify.cjs"
  - "bin/lib/verify-command-router.cjs"
  - "sdk/src/query/command-manifest.verify.ts"
  - "bin/lib/command-aliases.generated.cjs"
  - "bin/gsd-tools.cjs"
  - ".github/workflows/check-drift.yml"
tech-stack:
  added: []
  patterns:
    - "never-exit-nonzero subcommand contract (mirrors cmdVerifyCodebaseDrift)"
    - "dual hand-sync of TS manifest + .cjs alias map (generator does not emit the .cjs)"
key-files:
  created: []
  modified:
    - "bin/lib/verify.cjs"
    - "bin/lib/verify-command-router.cjs"
    - "sdk/src/query/command-manifest.verify.ts"
    - "bin/lib/command-aliases.generated.cjs"
    - "bin/gsd-tools.cjs"
    - ".github/workflows/check-drift.yml"
decisions:
  - "Derive the conformance contract from the directories the --check files live in, so a file is judged against its surrounding corpus rather than only itself"
  - "Added a bounded collectConventionCorpus walker in verify.cjs (the module takes a file list; the CLI must build the corpus); skips node_modules/.git/dist/build/coverage and dot-dirs, 5000-dir budget"
metrics:
  duration: "~12m"
  completed: "2026-06-26"
  tasks: 2
  files: 6
---

# Phase 10 Plan 02: Wire verify conventions JSON subcommand Summary

Wired `bin/lib/conventions.cjs` into a `gsd-tools.cjs verify conventions --derive|--check` JSON subcommand reachable from subagent Bash, registered it in both source-of-truth lists (TS manifest + hand-synced `.cjs` alias map), and gated `tests/conventions.test.cjs` in CI — flipping its integration assertion from pending to green.

## What Was Built

**Task 1 — handler + router branch (commit 81eaba7):**
- `cmdVerifyConventions(cwd, opts, raw)` in `bin/lib/verify.cjs`, mirroring `cmdVerifyCodebaseDrift`'s never-exit-nonzero contract. Two modes:
  - `--derive --scope <dir>` → builds a corpus via a new bounded `collectConventionCorpus` walker, calls `deriveConventions`, emits `{ mode:'derive', axes, skipped }`.
  - `--check --files a,b,c` → splits the CSV, runs it through the module's `sanitizePaths` (T-10-04 / V5), reads each file, derives the contract from the changed files' surrounding directories, calls `checkConformance`, emits `{ mode:'check', findings, skipped }`.
  - Every failure / usage / bad-input path emits `{ skipped:true, reason }` via `output()` and returns — never `error()` (which would `process.exit(1)`), so the review/plan gate can never fail the phase (T-10-05).
- `conventions` dispatch branch in `bin/lib/verify-command-router.cjs` parsing `--derive/--check/--scope/--files` into opts. This hardcoded branch is what makes the subcommand reachable in the flat layout.
- One usage line added to the `gsd-tools.cjs` help comment (the `case 'verify':` body already delegates wholesale to `routeVerifyCommand` — untouched).

**Task 2 — registration + CI (commit 764d822):**
- `verify.conventions` manifest entry in `sdk/src/query/command-manifest.verify.ts`.
- Matching `verify.conventions` block hand-synced directly into `VERIFY_COMMAND_ALIASES` in `bin/lib/command-aliases.generated.cjs` (the repo's generator does not emit this `.cjs` in the flat layout — this dual hand-sync IS the CJS↔SDK contested-source split this milestone surfaces, T-10-06). This feeds `VERIFY_SUBCOMMANDS`.
- A `conventions` job in `.github/workflows/check-drift.yml` mirroring `mcp-stdio-framing` (checkout@v4 + setup-node@v4 node 22, `node tests/conventions.test.cjs`, no `npm ci` — zero-dep).
- Ran `node tests/conventions.test.cjs`: exits 0 and the previously-pending integration assertion now routes through Task 1's branch, gets parseable JSON, and reaches the `JSON.parse` success path.

## Verification Results

- `verify conventions --check --files bin/lib/conventions.cjs` → parseable JSON, `findings:[]`, no `blocking:true`.
- `verify conventions --derive --scope bin/lib` → JSON with `axes` length 4.
- `verify conventions` (no flags) → `{skipped:true,reason:...}`, exit 0.
- `grep -c cmdVerifyConventions bin/lib/verify.cjs` = 2 (definition + export).
- `VERIFY_SUBCOMMANDS.includes('conventions')` → true.
- `grep verify.conventions` succeeds in both the TS manifest and the `.cjs` alias map.
- `node tests/conventions.test.cjs` → all 24 checks pass; integration assertion no longer pending.
- CI job present (`grep conventions.test.cjs check-drift.yml`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a corpus walker the plan assumed but did not specify**
- **Found during:** Task 1
- **Issue:** The module's `deriveConventions(files, ...)` and `checkConformance(changedFiles, derived)` take an explicit file list / source objects; they do not walk a `--scope` directory. The plan's `--derive --scope <dir>` and the "derive the contract" semantics for `--check` require a corpus, but no corpus-collection helper existed.
- **Fix:** Added a bounded `collectConventionCorpus(root, cwd)` in `verify.cjs` — a non-recursive stack walk that collects repo-relative `.c/m?[jt]sx?` source paths, skips `node_modules/.git/dist/build/coverage` and dot-dirs, and is capped at a 5000-directory budget (DoS-bounded). For `--check`, the contract is derived from the directories the changed files live in (so a file is judged against its surrounding corpus). All paths still flow through the module's `sanitizePaths`.
- **Files modified:** `bin/lib/verify.cjs`
- **Commit:** 81eaba7

## Threat Mitigations Applied

- **T-10-04 (Tampering, path args):** `--files` CSV and `--scope` run through the module's `sanitizePaths` (SAFE_PATH_RE) before any read; absolute/traversal paths rejected.
- **T-10-05 (DoS, gate failure):** Never-exit-nonzero contract — every failure path emits `{skipped:true,reason}` and returns 0; `output()` (not `error()`) used throughout.
- **T-10-06 (Tampering, manifest drift):** `verify.conventions` added to BOTH the TS manifest and the hand-synced `.cjs` alias map.
- **T-10-SC (package supply chain):** Zero packages installed; CI job runs without `npm ci`.

## Known Stubs

None.

## Self-Check: PASSED

- bin/lib/verify.cjs — FOUND (cmdVerifyConventions defined + exported)
- bin/lib/verify-command-router.cjs — FOUND (conventions branch)
- sdk/src/query/command-manifest.verify.ts — FOUND (verify.conventions)
- bin/lib/command-aliases.generated.cjs — FOUND (verify.conventions)
- .github/workflows/check-drift.yml — FOUND (conventions job)
- Commit 81eaba7 — present
- Commit 764d822 — present
