---
phase: 12-two-plugin-build-foundation
verified: 2026-07-04T00:00:00Z
status: passed
score: 7/7
has_blocking_gaps: false
overrides_applied: 0
re_verification: false
---

# Phase 12: Two-Plugin Build Foundation Verification Report

**Phase Goal:** One build step produces both the `bm` and `gsd` plugin packages from a single source, released in lockstep, with the repo/cache identity and hook paths verified unaffected by the new dual-package arrangement
**Verified:** 2026-07-04
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Running the build step produces two complete plugin directories (one `name: bm`, one `name: gsd`) from a single shared source with no manual per-package editing | VERIFIED | `node bin/build-bm.cjs` exits 0; root plugin.json name=gsd, dist/bm plugin.json name=bm, displayName=Buildomator; drift test passes all 18 checks including whitelist walk |
| 2 | SC2: Both `plugin.json` and `marketplace.json` carry the same version number for both packages after a release run | VERIFIED | All four version sites at 4.0.4: root plugin.json, dist/bm plugin.json, gsd marketplace entry, bm marketplace entry. `check-version-alignment.cjs` exits 0 and reports "PASS -- versions aligned"; `collectVersionMismatches` flags any divergence |
| 3 | SC3: `CLAUDE_PLUGIN_ROOT` resolves correctly and hook scripts execute without path errors when repo/cache id remains `gsd-plugin` | VERIFIED | SessionStart hook run with `CLAUDE_PLUGIN_ROOT=dist/bm` + planted tripwire at only gsd cache candidate exits 0 with empty stderr; primary path wins, fallback never fires; CI `bm-package-smoke` job encodes same tripwire proof |
| 4 | SC4: The two packages never drift -- the build step is the only place where plugin identity (`name`) diverges | VERIFIED | Only name/displayName/description differ between root and dist/bm plugin.json (confirmed by diff script); `build-bm.cjs --check` exits 0 on committed tree, exits 1 on any tampered byte (tested); CI `bm-build-drift` job enforces this on every push |
| 5 | PLAN 12-01 T1: `--check` mode exits 1 on drift, exits 0 on clean committed tree | VERIFIED | `node bin/build-bm.cjs --check` exits 0 locally; drift test case "after tampering exits 1 and rebuild restores 0" passes |
| 6 | PLAN 12-01 T2: dist/bm contains no .git, .planning, .claude, node_modules, scratchpad, nested dist | VERIFIED | `git ls-files dist/bm | grep -Ec '(\.planning|\.git|node_modules|scratchpad)' = 0`; no dist/bm/dist/ entries; `dist/bm/.claude-plugin/marketplace.json` also absent (root file owns both entries) |
| 7 | PLAN 12-02 T2: RELEASING.md documents dual-package release with known-limitation note | VERIFIED | RELEASING.md contains build:bm step, check:bm-drift pre-tag command, names both CI jobs as gates, "Known limitation" section with Phase 13/14 deferral; zero em-dashes |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/build-bm.cjs` | generate-and-stamp build with --check; exports `stampBmManifest`, `shouldExclude` | VERIFIED | 223 lines (>80 min); both exports confirmed `function`; shebang, 'use strict', Node built-ins only |
| `tests/build-bm-drift.test.cjs` | zero-dep unit + integration tests for stamp, exclude, drift | VERIFIED | 232 lines (>60 min); 18 tests all passing; covers unit helpers + integration build/whitelist-walk/--check |
| `.claude-plugin/marketplace.json` | two plugin entries: gsd (source ./) and bm (source ./dist/bm) | VERIFIED | marketplace name stays "gsd-plugin"; gsd entry source="./"; bm entry source="./dist/bm", displayName="Buildomator"; both at version 4.0.4 |
| `dist/bm/.claude-plugin/plugin.json` | committed generated bm manifest with name "bm" | VERIFIED | name=bm, version=4.0.4, displayName=Buildomator; `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` exits 0 |
| `bin/maintenance/check-version-alignment.cjs` | version parity check extended to every marketplace entry plus dist/bm | VERIFIED | `collectVersionMismatches` exported and tested; reads dist/bm manifest null-tolerant; all 16 test cases pass |
| `tests/version-alignment.test.cjs` | extended with multi-site parity cases | VERIFIED | 16 test cases pass; includes lagging-bm-marketplace, lagging-dist-bm-manifest, null-tolerant cases |
| `package.json` | build:bm, check:bm-drift, validate:bm-plugin scripts | VERIFIED | All three scripts present and correct |
| `.github/workflows/check-drift.yml` | bm-build-drift job | VERIFIED | Job exists with 4 steps: drift test, --check, validate bm manifest, version-alignment; node 22 |
| `.github/workflows/install-smoke.yml` | bm-package-smoke job | VERIFIED | Job exists with manifest sanity, gsd-sdk --version, state.load query, tripwire-fallback hook proof, cache-id invariant; gsd job unchanged |
| `RELEASING.md` | dual-package release steps and hook-fallback known limitation | VERIFIED | All required content present; no em-dashes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.claude-plugin/marketplace.json` | `dist/bm` | bm plugin entry source path | VERIFIED | `"source": "./dist/bm"` present at line-level |
| `bin/build-bm.cjs` | `.claude-plugin/plugin.json` | single-source version + identity read | VERIFIED | `readFileSync('.claude-plugin/plugin.json')` at line 113 |
| `tests/build-bm-drift.test.cjs` | `bin/build-bm.cjs` | require of exported pure helpers | VERIFIED | `require('../bin/build-bm.cjs')` at line 25 |
| `.github/workflows/check-drift.yml` | `bin/build-bm.cjs` | regenerate-and-diff CI step | VERIFIED | `node bin/build-bm.cjs --check` at line 141 |
| `.github/workflows/install-smoke.yml` | `dist/bm/hooks/hooks.json` | extracted hook command with CLAUDE_PLUGIN_ROOT=dist/bm | VERIFIED | `require("...dist/bm/hooks/hooks.json").hooks.SessionStart[0].hooks[0].command` at line 176 |

### Data-Flow Trace (Level 4)

Build scripts and CI tooling only - no dynamic data-rendering components. Data flow is deterministic script execution rather than state rendering. Level 4 not applicable.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `bin/build-bm.cjs --check` exits 0 on committed tree | `node bin/build-bm.cjs --check` | "bm drift check: PASS" exit 0 | PASS |
| All drift tests pass | `node tests/build-bm-drift.test.cjs` | 18/18 ok, "All build-bm-drift tests passed" exit 0 | PASS |
| Version-alignment tests pass | `node tests/version-alignment.test.cjs` | 16/16 ok, "All version-alignment tests passed" exit 0 | PASS |
| Version-alignment check on 4-site live tree | `node bin/maintenance/check-version-alignment.cjs` | "PASS -- versions aligned" exit 0 | PASS |
| bm plugin.json validates | `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` | "Plugin manifest valid: bm@4.0.4" exit 0 | PASS |
| SessionStart hook resolves via CLAUDE_PLUGIN_ROOT, tripwire never fires | extracted hook command + planted tripwire | exit 0, empty stderr, no FALLBACK-FIRED | PASS |
| Full test suite (40 tests) - no regressions | `for t in tests/*.test.cjs; do node "$t"; done` | All 40 suites pass | PASS |
| dist/bm committed (>100 tracked files) | `git ls-files dist/bm | wc -l` | 1500 | PASS |
| Only identity fields differ between gsd and bm manifests | node diff script | SC4 PASS: only stamped identity fields differ | PASS |

### Probe Execution

No probe scripts declared. All behavioral checks covered by spot-checks above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUILD-01 | 12-01-PLAN.md | A build step generates both `bm` and `gsd` plugin packages from one source | SATISFIED | `bin/build-bm.cjs` copies tracked source, stamps only name/displayName/description; --check drift gate; 1500 committed files in dist/bm |
| BUILD-02 | 12-01-PLAN.md, 12-02-PLAN.md | Release process publishes both plugins with versions in lockstep | SATISFIED | Single-source version from plugin.json propagates to all 4 sites via build; RELEASING.md documents the process; CI bm-build-drift job enforces it on every push |
| BUILD-03 | 12-02-PLAN.md | Repo/cache id stays `gsd-plugin`; `CLAUDE_PLUGIN_ROOT` and hook resolution verified unaffected | SATISFIED | marketplace name stays "gsd-plugin"; hook tripwire test proves primary-path-wins; bm-package-smoke CI job encodes this assertion permanently |

All three phase requirements (BUILD-01, BUILD-02, BUILD-03) are SATISFIED. No orphaned requirements: the REQUIREMENTS.md traceability table maps exactly these three requirements to Phase 12.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | - |

No TBD/FIXME/XXX/em-dashes found in any file modified by this phase. No stubs, placeholders, or return-null patterns. The one known limitation (dist/bm hooks.json retains the gsd cache fallback path) is intentional, documented in RELEASING.md, and explicitly deferred to Phase 13/14 -- it is not a code debt marker.

### Human Verification Required

None. All phase success criteria are fully verifiable programmatically:

- SC1 (two packages from one source): verified by running the build and inspecting outputs
- SC2 (version lockstep): verified by reading all four manifest files and running the alignment check
- SC3 (CLAUDE_PLUGIN_ROOT resolution): verified by the tripwire spot-check (hook exits 0, fallback never fires)
- SC4 (build is only divergence point): verified by diff script and --check exits 0 on committed tree

The CI jobs (bm-build-drift, bm-package-smoke) provide the same assertions on every future push, making ongoing human review unnecessary.

### Gaps Summary

No gaps. All seven observable truths are VERIFIED, all ten required artifacts pass all levels of verification, all five key links are WIRED, all three requirement IDs (BUILD-01, BUILD-02, BUILD-03) are SATISFIED, and the full 40-test local suite is green with no regressions.

The one planned deviation from the literal plan text - dist/ exclusion added to check-file-layout.cjs and rewrite-command-namespace.cjs - was a necessary and auto-fixed consistency fix (the generated tree would have falsely inflated the drift counts). It is documented in the SUMMARY and does not affect any success criterion.

---

_Verified: 2026-07-04_
_Verifier: Claude (gsd-verifier)_
