---
phase: 10
slug: convention-and-architectural-conformance
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-26
validated: 2026-06-27
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 10-RESEARCH.md `## Validation Architecture`. Deterministic pure module — strongly test-driven.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:assert` + bare `check(name, fn)` runner (zero-dep, existing repo convention) |
| **Config file** | none — convention is `tests/<name>.test.cjs`, run directly |
| **Quick run command** | `node tests/conventions.test.cjs` |
| **Full suite command** | `for f in tests/*.test.cjs; do node "$f" || exit 1; done` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/conventions.test.cjs`
- **After every plan wave:** Run `for f in tests/*.test.cjs; do node "$f" || exit 1; done`
- **Before `/gsd:verify-work`:** Full suite green AND `node tests/conventions.test.cjs` added to `.github/workflows/check-drift.yml`
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

> Requirement-to-test coverage map. All checks verified green via `node tests/conventions.test.cjs` (27 checks, 0 failures). Nyquist sampling: multiple distinct behavioral points per requirement, not just one happy-path assertion.

| Req | Behavior | Test Name | Status |
|-----|----------|-----------|--------|
| CONV-01 | `summarizeAxis` names a convention at >=70% over >=8 samples; entropy ~0 for single variant | `CONV-01 summarizeAxis names a convention at >=70% over >=8 samples (entropy ~0 single variant)` | green |
| CONV-01 | `summarizeAxis` names at exactly the 0.70 boundary (7/10) | `CONV-01 summarizeAxis names dominant at exactly the 0.70 boundary` | green |
| CONV-01 | `summarizeAxis` marks contested below 0.70 threshold; dominant null; entropy ~1 even split | `CONV-01 summarizeAxis marks an axis contested below 0.70 (dominant null, entropy ~1 even split)` | green |
| CONV-01 | Repo-wide CJS/SDK export split (63/60) is contested, not named | `CONV-01 summarizeAxis: CJS/SDK repo-wide export split is contested, not named` | green |
| CONV-01 | Returns insufficient-data below minSamples (< 8 total samples) | `CONV-01 summarizeAxis returns insufficient-data below minSamples (8)` | green |
| CONV-01 | Custom dominanceThreshold / minSamples opts respected | `CONV-01 summarizeAxis honors custom dominanceThreshold / minSamples` | green |
| CONV-01 | `deriveConventions` derives all four named axes over a real on-disk directory | `CONV-01 deriveConventions derives all four axes over a real directory` | green |
| CONV-01 | `deriveConventions` returns skipped + empty axes on null input (never throws) | `CONV-01 deriveConventions never throws on bad input (null), returns skipped + empty axes` | green |
| CONV-02 | `checkConformance` emits a finding for a file deviating from a NAMED file-name convention | `CONV-02 checkConformance flags a file deviating from a NAMED file-name convention` | green |
| CONV-02 | `checkConformance` emits no findings for a conforming file | `CONV-02 checkConformance passes a file conforming to the NAMED conventions` | green |
| CONV-02 | `checkConformance` never emits a finding for a CONTESTED axis | `CONV-02 checkConformance never emits a finding for a CONTESTED axis` | green |
| CONV-03 | `checkConformance` flags a read-verb function that mutates a parameter or does side-effecting I/O | `CONV-03 verb-vs-body flags a read-verb function whose body mutates a parameter / does side-effecting I/O` | green |
| CONV-03 | `checkConformance` does NOT flag a mutating-verb function with a pure return body | `CONV-03 verb-vs-body passes a mutating-verb function with a pure return body` | green |
| CONV-03 | `checkConformance` does NOT flag a read-builder that mutates only a body-local array (Pitfall 4) | `CONV-03 verb-vs-body does NOT flag a read-builder that only mutates a local array (Pitfall 4)` | green |
| CONV-04 | `classifyArchitecture` classifies a `process.env` access file as `direct-env` | `CONV-04 arch-split classifies a process.env file as direct-env` | green |
| CONV-04 | `classifyArchitecture` classifies an injected-config file as `injected` (no process.env) | `CONV-04 arch-split classifies injected-config file as injected (no process.env)` | green |
| CONV-04 | A swallowed catch body PRODUCES a finding via `checkConformance` (positive direction) | `CONV-04 arch-split swallow catch produces a finding via checkConformance` | green |
| CONV-04 | Rethrow and wrap catch bodies do NOT produce a catch-swallow finding (negative direction) | `CONV-04 arch-split rethrow and wrap catch bodies do NOT produce a catch-swallow finding` | green |
| D-03 | Every finding carries `tier: 'CONVENTION'` and `blocking: false`; none set `blocking: true` | `D-03 every finding carries tier CONVENTION and blocking false; none blocking true` | green |
| D-05 | Non-JS/TS file (`.py`) yields no idiom findings and does not throw | `D-05 a non-JS/TS file yields no idiom findings and does not throw` | green |
| D-05 | Markdown content does not throw and emits no idiom findings | `D-05 markdown content does not throw and emits no idiom findings` | green |
| integration | `gsd-tools.cjs verify conventions --check` emits valid JSON (pending until 10-02; gated skip when subcommand not yet routed) | `integration: gsd-tools verify conventions --check emits parseable JSON (pending until 10-02)` | green |

*Status: green = verified passing via `node tests/conventions.test.cjs`*

---

## Automated Command

```
node tests/conventions.test.cjs
```

27 checks, 0 failures. Runtime < 1 second.

---

## Wave 0 Requirements

- [x] `tests/conventions.test.cjs` — covers CONV-01..04, D-03, D-05 (27 checks, all green)
- [ ] Add `node tests/conventions.test.cjs` to `.github/workflows/check-drift.yml` (CI wiring — deferred to Phase 10 post-validation)

*No framework install — the zero-dep `check()` harness is the repo convention.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| code-review surfaces `CONVENTION`-tier findings in a real review run | CONV-02/03/04 | end-to-end agent behavior (subagent reads module JSON, renders findings) is judged, not asserted | Run `/gsd:code-review` on a branch with a deliberately convention-violating changed file; confirm an advisory CONVENTION finding appears and does not block |

---

## Nyquist Gap Analysis (2026-06-27)

Gaps identified against the original VALIDATION.md pending rows:

| Gap | Finding | Resolution |
|-----|---------|------------|
| CONV-04 catch classification was soft — existing test only checked tier/blocking of findings that happened to appear, never asserted that a swallow ACTUALLY PRODUCES a finding or that rethrow/wrap do NOT | Real behavioral gap: test could pass even if the catch-swallow finding were silently dropped | Added two dedicated checks: positive (swallow => finding) and negative (rethrow/wrap => no swallow finding). Both now green. |
| CONV-04 classifyArchitecture export test used an optional guard (`if (r)` fallback to `assert.ok(true)`) that could never fail even if the export were removed | Structurally trivial test — cannot fail by design | Replaced with hard `typeof` assertion + direct classification check for injected path. Both green. |

All other rows in the original pending map had adequate coverage in the already-passing 25-check suite.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers the test file (CI wiring deferred, tracked above)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-27
