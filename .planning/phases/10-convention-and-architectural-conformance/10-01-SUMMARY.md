---
phase: 10-convention-and-architectural-conformance
plan: 01
subsystem: testing
tags: [conventions, code-review, drift, entropy, regex, cjs, zero-dep]

# Dependency graph
requires: []
provides:
  - "bin/lib/conventions.cjs — single source of truth (D-04) for convention derivation + conformance"
  - "deriveConventions(files, opts): 4-axis majority-vote (file-name/identifier casing, export/import style) with normalized Shannon entropy + 0.70/min-8 gate (CONV-01)"
  - "checkConformance(changedFiles, derived): named-only per-file findings (CONV-02), verb-vs-body (CONV-03), architectural-split catch classification (CONV-04), all CONVENTION-tier/non-blocking (D-03), JS/TS-only idiom checks (D-05)"
  - "tests/conventions.test.cjs — zero-dep unit + integration suite (CONV-01..04, D-03, D-05)"
  - "Exported internals: summarizeAxis, classifyCasing, sanitizePaths, classifyArchitecture, extractIdentifiers, blankSpans"
affects: [10-02-subcommand-wiring, 10-03-agents-workflow, phase-11-drift-detection]

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependency — Node built-ins only (hard milestone constraint)
  patterns:
    - "Never-throw pure bin/lib module (validate -> try/catch -> skipped() with emptied success-path fields), mirrored from drift.cjs"
    - "Frozen {re,label} classifier table + first-match classify (CASING_RULES), mirrored from schema-detect.cjs"
    - "String/template/regex/comment blanking pre-pass before brace-counting / identifier extraction (Pitfall 2)"
    - "Normalized Shannon entropy H_norm = -Σ p·log(p)/log(n) + dominance share as the named/contested decision"

key-files:
  created:
    - bin/lib/conventions.cjs
    - tests/conventions.test.cjs
  modified: []

key-decisions:
  - "Identifier-casing axis tallies functions + classes (not const/let) — value declarations mix styles too much to be a clean axis"
  - "Conformance skips class names against a camel function axis (classes are conventionally Pascal regardless)"
  - "CONV-04 ships conservatively: per-file env-split flag deferred to corpus-level (mapper); only swallowed catches surface as a per-file finding"
  - "verb-vs-body flags ONLY the read-verb + mutation direction; ignores local-array mutation (Pitfall 4) by tracking body-local declarations"

patterns-established:
  - "CONVENTION tier is always blocking:false — invert schema-detect.cjs's blocking:true gate"
  - "deriveConventions accepts opts.sources ({path: src}) so derivation is testable without disk I/O"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04]

# Metrics
duration: ~12min
completed: 2026-06-26
---

# Phase 10 Plan 01: Conventions Derivation + Conformance Module Summary

**Zero-dep CJS module deriving file-name/identifier casing + export/import style by majority vote with normalized Shannon entropy, plus per-file CONVENTION-tier conformance, verb-vs-body intent, and catch-handling checks that never block.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files created:** 2

## Accomplishments

- `bin/lib/conventions.cjs`: the single source of truth (D-04) both gsd-pattern-mapper and gsd-code-reviewer will call — no second extraction implementation.
- `deriveConventions`: tallies four axes over a corpus, runs each through `summarizeAxis` (normalized entropy + 0.70 dominance / 8-sample gate), returns named / contested / insufficient-data per axis (CONV-01). The intentional CJS/SDK export split correctly reads as *contested*, not named.
- `checkConformance`: emits findings only against **named** axes (contested + insufficient-data never flagged — CONV-02), runs verb-vs-body (CONV-03) and architectural-split (CONV-04) JS/TS rule packs, skips idiom checks on non-JS/TS files (D-05).
- Every finding is `{ tier:'CONVENTION', blocking:false, ... }` (D-03); both public functions never throw; reused `SAFE_PATH_RE`/`sanitizePaths` from drift.cjs (T-10-01).
- 25 zero-dep checks green; integration assertion gated as known-pending until 10-02 wires the subcommand.

## Task Commits

1. **Task 1: Write failing tests (Wave 0 scaffold)** - `0cea9a5` (test) — RED: `node tests/conventions.test.cjs` exited non-zero (module absent).
2. **Task 2: Implement bin/lib/conventions.cjs** - `7785e76` (feat) — GREEN: all 25 unit checks pass.

_TDD gate sequence verified in git log: test(10-01) -> feat(10-01). No REFACTOR commit needed (code clean, tests green)._

## Files Created/Modified

- `bin/lib/conventions.cjs` - deriveConventions + checkConformance + exported internals (summarizeAxis, classifyCasing, sanitizePaths, classifyArchitecture, extractIdentifiers, blankSpans). Pure, never-throws, zero runtime deps.
- `tests/conventions.test.cjs` - zero-dep harness (node:assert + bare check() + process.exit(1) footer) covering CONV-01..04, D-03, D-05, never-throw paths, and the pending gsd-tools integration spawn.

## Decisions Made

- **Identifier-casing axis = functions + classes only.** const/let value declarations mix casing styles (UPPER_SNAKE constants vs camel locals) and would muddy the axis; functions+classes carry the real naming signal.
- **Class names exempt from a camel function axis in conformance.** Classes are conventionally Pascal regardless of the function-casing convention, so flagging them would be noise.
- **CONV-04 shipped conservatively (Pattern 7).** The DI-vs-env split is a corpus-level signal (deferred to the mapper's report); per-file, only a clearly *swallowed* catch surfaces as a finding. This minimizes false positives on the least-precise check, as RESEARCH advised.
- **verb-vs-body restricted to the read-verb + mutation direction.** Body-local declarations are tracked so a read-builder that only mutates a freshly-declared local array is not flagged (Pitfall 4). The benign reverse direction (mutating verb + pure body) is never flagged.
- **`deriveConventions` accepts `opts.sources`** ({path: src}) so the derivation core is unit-testable without disk I/O while production still reads from the sanitized file list.

## Deviations from Plan

None - plan executed exactly as written. The plan granted Discretion over the verb/catch taxonomies and exposed-internals set; the chosen taxonomies follow RESEARCH §Pattern 6/7 verbatim and the export set is a superset of the required five (added classifyArchitecture / extractIdentifiers / blankSpans for the 10-02 subcommand and tests).

## Issues Encountered

None. The BSD/ugrep `-E` lookahead in the plan's zero-dep acceptance probe is unsupported on this platform; verified the constraint via a node script instead (only `node:fs` + `node:path` required).

## TDD Gate Compliance

- RED gate: `test(10-01)` commit `0cea9a5` — failing test committed before the module existed.
- GREEN gate: `feat(10-01)` commit `7785e76` — module implemented, all unit checks pass.
- REFACTOR: not needed (no cleanup pass produced changes).

## Known Stubs

None. The module is fully wired against in-memory and real-file inputs. The only deferred surface is the per-file env-split *finding* in CONV-04 (intentionally corpus-level per RESEARCH Pattern 7) — documented above, not a stub.

## Next Phase Readiness

- Module + tests are the Wave 1 foundation. Plan 10-02 wires the `verify conventions` subcommand (router + manifest + generated alias + CI job); the integration assertion in the test will go from pending to asserting valid JSON once 10-02 lands.
- Plan 10-03 wires the two agents (pattern-mapper Step 5.5, code-reviewer CONVENTION tier) to call this module via Bash.
- No blockers.

## Self-Check: PASSED

- FOUND: bin/lib/conventions.cjs
- FOUND: tests/conventions.test.cjs
- FOUND: .planning/phases/10-convention-and-architectural-conformance/10-01-SUMMARY.md
- FOUND commit: 0cea9a5 (test RED)
- FOUND commit: 7785e76 (feat GREEN)
- FOUND commit: 7dab124 (docs SUMMARY)

---
*Phase: 10-convention-and-architectural-conformance*
*Completed: 2026-06-26*
