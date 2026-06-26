---
phase: 10-convention-and-architectural-conformance
verified: 2026-06-26T00:00:00Z
status: passed
score: 12/12 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
human_verification_resolved: "2026-06-26 — both items PASSED via UAT; see 10-HUMAN-UAT.md (10-UAT-REVIEW.md, 10-UAT-PATTERNS.md)"
human_verification:
  - test: "Run a real /gsd:code-review on a branch containing a deliberately convention-violating changed JS/TS file"
    expected: "An advisory CONVENTION-tier finding appears in REVIEW.md (states deviation + derived convention + suggested fix) and does NOT block or gate the review"
    why_human: "End-to-end requires the reviewer subagent to actually run, parse the JSON, and emit into REVIEW.md at the live CONVENTION tier — the agent-orchestration path cannot be exercised by grep/CLI alone (VALIDATION.md phase-gate UAT)"
  - test: "Run gsd-pattern-mapper on the repo and inspect the resulting PATTERNS.md"
    expected: "An additive ## Conventions section appears with the 4-axis table (Dominant/Share/Entropy/Status) and a Contested hotspots note naming the CJS<->SDK dual resolver; the existing analog-mapping output is unchanged (D-02)"
    why_human: "The mapper writing the section into PATTERNS.md is an agent-orchestration step; only the derive subcommand it calls and the markdown instruction are programmatically verifiable"
---

# Phase 10: Convention and Architectural Conformance Verification Report

**Phase Goal:** Stop a new file from introducing cross-session convention/architectural drift, using a deterministic convention-derivation + conformance-checking module surfaced through gsd-pattern-mapper (PATTERNS.md Conventions section) and gsd-code-reviewer (advisory CONVENTION tier with conformance / verb-vs-body / architectural-split checks).
**Verified:** 2026-06-26T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | deriveConventions derives 4 axes by majority vote; names an axis at >=70% over >=8 samples | ✓ VERIFIED | `--derive --scope bin/lib` returns 4 axes: file-name-casing, identifier-casing, export-style, import-style. In-process snake corpus → identifier-casing status=named, dominant=snake, share=1 |
| 2   | deriveConventions returns contested when dominant share < 70% (CJS/SDK export split) | ✓ VERIFIED | Real bin/lib(CJS)+sdk/src(ESM) corpus → export-style status=contested, dominant=null, share=0.69, total=221 |
| 3   | deriveConventions returns insufficient-data below minSamples | ✓ VERIFIED | Test suite asserts insufficient-data path; export/import axes on <8-file scopes return insufficient-data (IN-05) |
| 4   | checkConformance flags a deviating file, passes a conforming one (CONV-02) | ✓ VERIFIED | camelCase fn in a snake_case named corpus → 2 CONVENTION findings ("identifier casing is camel"); conformer produces no identifier-casing finding |
| 5   | checkConformance never flags a contested axis | ✓ VERIFIED | 50/50 cjs/esm corpus → export-style contested; changed file with `export const z` → 0 export-axis findings |
| 6   | verb-vs-body flags read-verb + mutation; passes mutating-verb + pure body (CONV-03) | ✓ VERIFIED | `getThing(arr){arr.push(9)}` → 1 finding "read-verb function getThing mutates"; test asserts mutating-verb pure body + local-array Pitfall-4 pass |
| 7   | architectural-split classifies direct-env vs injected, catch swallow/rethrow/wrap (CONV-04) | ✓ VERIFIED | classifyArchitecture("process.env.TOKEN; try{}catch(e){}") → {envStyle:"direct-env", catchStyles:[{style:"swallow"}]} |
| 8   | Every finding tier CONVENTION + blocking:false; none blocking:true (D-03) | ✓ VERIFIED | All in-process + CLI findings carry tier CONVENTION blocking:false; bad-input + non-JS produce 0 blocking findings; test suite asserts no blocking:true |
| 9   | Non-JS/TS input skips idiom checks gracefully, never throws (D-05) | ✓ VERIFIED | .py + markdown inputs → 0 idiom findings, no throw (test + direct probe) |
| 10  | Both public functions never throw; bad input → skipped result w/ emptied fields | ✓ VERIFIED | deriveConventions(null) → {skipped:true, axes:[]}; checkConformance(null/garbage) → no throw, findings:[] |
| 11  | verify conventions subcommand reachable, JSON contract, never exits non-zero | ✓ VERIFIED | --derive/--check emit parseable JSON; no-flags → skipped JSON exit 0; CJS router branch routes (line 27) |
| 12  | Markdown layer: mapper writes ## Conventions; reviewer has CONVENTION tier + 3 standalone checks + --check invocation; workflow wired | ✓ VERIFIED | pattern-mapper Step 5.5 (--derive + ## Conventions + 70% + CJS<->SDK note); reviewer tier line :31 + --check :98 + standalone/skip :93/:100; code-review.md :336 self-invoke note |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `bin/lib/conventions.cjs` | derive+conformance single source of truth, >=200 lines | ✓ VERIFIED | 581 lines; exports all 5 required (+3 internals); zero non-builtin requires; never-throws |
| `tests/conventions.test.cjs` | zero-dep unit+integration, >=80 lines | ✓ VERIFIED | 307 lines; suite exits 0 ("all checks passed"); integration assertion flipped green (no longer pending) |
| `bin/lib/verify.cjs` | cmdVerifyConventions handler | ✓ VERIFIED | def+export (count 2); lazy require('./conventions.cjs') at :1420 |
| `bin/lib/verify-command-router.cjs` | conventions dispatch branch | ✓ VERIFIED | `else if (subcommand === 'conventions')` at :27 |
| `sdk/src/query/command-manifest.verify.ts` | verify.conventions entry | ✓ VERIFIED | entry at :15 (TS source); see Anti-Patterns re: dist build lag (non-blocking) |
| `bin/lib/command-aliases.generated.cjs` | hand-synced alias entry | ✓ VERIFIED | verify.conventions block :243-247; VERIFY_SUBCOMMANDS.includes('conventions')=true |
| `.github/workflows/check-drift.yml` | conventions CI job | ✓ VERIFIED | `run: node tests/conventions.test.cjs` at :64 |
| `agents/gsd-pattern-mapper.md` | derive step + Conventions section | ✓ VERIFIED | Step 5.5 :147-157, --derive invocation :153 |
| `agents/gsd-code-reviewer.md` | CONVENTION tier + 3 checks | ✓ VERIFIED | tier :31, check block :91-100, --check invocation :98 |
| `workflows/code-review.md` | review-path wiring note | ✓ VERIFIED | self-invoke note :336 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| tests/conventions.test.cjs | conventions.cjs | require | ✓ WIRED | suite requires + exercises module; 24+ checks green |
| verify-command-router.cjs | cmdVerifyConventions | conventions branch | ✓ WIRED | :27 branch → verify.cmdVerifyConventions |
| verify.cjs handler | conventions.cjs | lazy require + output JSON | ✓ WIRED | :1420 require; emits {mode, axes/findings, skipped} |
| TS manifest | alias map .cjs | dual hand-sync | ✓ WIRED | both contain verify.conventions; dual-sync is the intended CJS<->SDK split |
| pattern-mapper | verify conventions --derive | Bash | ✓ WIRED | :153 invocation, subcommand returns 4 axes |
| code-reviewer | verify conventions --check | Bash | ✓ WIRED | :98 invocation, subcommand returns findings |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Test suite | `node tests/conventions.test.cjs` | "all checks passed", exit 0 | ✓ PASS |
| Derive 4 axes | `verify conventions --derive --scope bin/lib` | mode=derive, axes=4 named correctly | ✓ PASS |
| Check conforming | `verify conventions --check --files bin/lib/conventions.cjs` | findings=0, any-blocking=false | ✓ PASS |
| Never exit non-zero | `verify conventions` (no flags) | exit 0 | ✓ PASS |
| Flag deviating file | in-process snake corpus + camel changed file | 2 CONVENTION findings | ✓ PASS |
| Contested guard | 50/50 corpus + export changed file | 0 export-axis findings | ✓ PASS |
| Verb-vs-body | getThing(arr){arr.push} | 1 finding | ✓ PASS |
| Arch-split | process.env + empty catch | direct-env + swallow | ✓ PASS |
| Entropy signal | summarizeAxis single vs even | 0 vs 1 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CONV-01 | 10-01/02/03 | pattern-mapper Conventions section, majority vote + entropy | ✓ SATISFIED | 4-axis derivation + entropy (0/1) + mapper Step 5.5 writes section; live derive returns named/contested axes |
| CONV-02 | 10-01/02/03 | code-review flags deviating file, passes conforming | ✓ SATISFIED | checkConformance flags camel-in-snake (2 findings), contested-skip guard works; reviewer --check wired |
| CONV-03 | 10-01/02/03 | verb-vs-body intent check | ✓ SATISFIED | getThing+push flagged; mutating-verb pure-body + Pitfall-4 local-array pass |
| CONV-04 | 10-01/02/03 | architectural-split, no new runtime dep, existing review path | ✓ SATISFIED | classifyArchitecture direct-env + catch taxonomy; zero non-builtin requires; reviewer self-invokes in review path |

All four requirement IDs declared in all three plan frontmatters; all map to verified behavior. No orphaned requirements (REQUIREMENTS.md maps only CONV-01..04 to Phase 10).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| bin/lib/conventions.cjs | 139,150,163 | WR-01: blankSpans writes 1 char past output on a trailing-backslash literal (length-preservation invariant violated) | ⚠️ Warning | Reproduced empirically (+1 char). Only triggers when an UNTERMINATED literal is the file's LAST token, so nothing follows to misreport. checkConformance does NOT throw on such input (never-throw contract holds). Does not undermine any CONV must_have. Advisory fix recommended (guard `if (i+1 < n)`). |
| sdk/src/query/command-manifest.verify.ts | 15 | verify.conventions in TS source but NOT in built sdk/dist manifest (sibling entries are) | ⚠️ Warning | Agent goal path invokes via `node bin/gsd-tools.cjs verify conventions` (CJS router, verified working) — NOT via gsd-sdk query. Plan 10-02 explicitly states routing is the CJS router branch; the manifest "only feeds VERIFY_SUBCOMMANDS". No plan task required a dist rebuild. Non-blocking; recommend rebuilding sdk/dist for `gsd-sdk query verify.conventions` discovery parity. |
| bin/lib/conventions.cjs | 356,364,549 | IN-02: `void body` / `void arch.envStyle` dead assignments | ℹ️ Info | Intentional computed-but-deferred markers; cosmetic. |
| tests/conventions.test.cjs | 33-37 | IN-01: "five named functions" label but 8 exported | ℹ️ Info | Test asserts the 5 required; 3 internals untested but consumed elsewhere. Cosmetic. |

No debt markers (TBD/FIXME/XXX) found in phase deliverables — the FIXME/XXX matches in gsd-code-reviewer.md are the reviewer's own debt-scanning grep PATTERNS, not debt. No BLOCKER-class anti-patterns.

### Human Verification Required

#### 1. Live /gsd:code-review on a convention-violating file

**Test:** Run a real `/gsd:code-review` on a branch with a deliberately convention-violating changed JS/TS file.
**Expected:** An advisory CONVENTION-tier finding appears in REVIEW.md (deviation + derived convention + fix) and does NOT block or gate the review.
**Why human:** The reviewer subagent must actually run, call the subcommand, parse JSON, and emit into REVIEW.md at the live tier — the agent-orchestration path cannot be exercised by grep/CLI alone. This is the VALIDATION.md phase-gate UAT.

#### 2. Live gsd-pattern-mapper PATTERNS.md write

**Test:** Run gsd-pattern-mapper and inspect PATTERNS.md.
**Expected:** Additive `## Conventions` section with the 4-axis table + Contested hotspots note naming the CJS<->SDK resolver; existing analog-mapping output unchanged (D-02).
**Why human:** The mapper writing the section is an agent-orchestration step; only the derive subcommand and the markdown instruction are programmatically verifiable.

### Gaps Summary

No goal-blocking gaps. All 12 must-have truths, all 10 artifacts, all 6 key links, and all 4 requirements (CONV-01..04) are verified against the actual codebase — not merely against SUMMARY claims. The deterministic module is real (581 lines, zero-dep, never-throws), the subcommand routes and emits the documented JSON contract, conformance genuinely flags deviating code while never flagging contested axes (the real-repo CJS/SDK export split reads as contested at 0.69), and the markdown layer wires both consuming agents and the review workflow to the same single source of truth.

Two non-blocking warnings: (WR-01) a confirmed but narrow lexer invariant bug in blankSpans that only triggers on a trailing-backslash literal as the final file token and does not break any CONV behavior or the never-throw contract; and a stale sdk/dist manifest where verify.conventions is in the TS source but not the built artifact — irrelevant to the agent CJS invocation path the goal depends on. Both are recommend-fix items, not blockers.

Status is human_needed because the end-to-end agent-orchestration UAT (a live /gsd:code-review surfacing a non-blocking CONVENTION finding, and the mapper writing the PATTERNS.md section) requires a human run that grep/CLI cannot substitute — this is the VALIDATION.md phase-gate check. All automated evidence passes.

---

_Verified: 2026-06-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
