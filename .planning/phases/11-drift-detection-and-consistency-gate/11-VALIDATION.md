---
phase: 11
slug: drift-detection-and-consistency-gate
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
validated: 2026-06-27
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Zero-dep CJS harness — `node:assert` + a bare `check(name, fn)` runner + `process.exit(1)` footer (mirrors `tests/conventions.test.cjs`) |
| **Config file** | none — each test file is self-contained, run directly by `node` |
| **Quick run command** | `node tests/<detector>.test.cjs` (per detector under test) |
| **Full suite command** | `node tests/semantic-dup.test.cjs && node tests/phantom-scaffolding.test.cjs && node tests/drift-allowlist.test.cjs && node tests/config-schema-sdk-parity.test.cjs && node tests/verify-drift-integration.test.cjs` |
| **Estimated runtime** | ~35 seconds (integration test spawns child processes for CLI verification) |

---

## Sampling Rate

- **After every task commit:** Run the relevant single detector test (`node tests/<detector>.test.cjs`)
- **After every plan wave:** Run the full detector suite + `node bin/gsd-tools.cjs verify drift --scope . --json` smoke
- **Before `/gsd:verify-work`:** Full suite green + `.github/workflows/check-drift.yml` `drift-detectors` job green
- **Max feedback latency:** ~35 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | DRIFT-05 | T-11-02/03 | RED scaffold: detector never throws; deterministic; cross-file guards | unit | `node tests/semantic-dup.test.cjs` | tests/semantic-dup.test.cjs | green |
| 11-01-02 | 01 | 1 | DRIFT-05 | T-11-01/02/03/04 | path-safety + blankSpans + MAX_SCAN_BYTES + never-throw; no Math.random | unit | `node tests/semantic-dup.test.cjs` | tests/semantic-dup.test.cjs | green |
| 11-01-03 | 01 | 1 | DRIFT-05 | T-11-02 | detector runs bounded on real corpus without throwing | smoke | `node bin/gsd-tools.cjs verify drift --scope . --json` (parse + exit 0) | tests/verify-drift-integration.test.cjs | green |
| 11-02-01 | 02 | 1 | DRIFT-03 | T-11-01/03 | allowlist loader never throws; suppression auditable not dropped | unit | `node tests/drift-allowlist.test.cjs` | tests/drift-allowlist.test.cjs | green |
| 11-02-02 | 02 | 1 | DRIFT-05 | T-11-02/03/04 | phantom covers ESM+CJS imports; TODO-in-string not flagged (blankSpans); D-09 noise absent | unit | `node tests/phantom-scaffolding.test.cjs` | tests/phantom-scaffolding.test.cjs | green |
| 11-03-01 | 03 | 1 | DRIFT-01 | T-11-05/06/07 | watch never fails cron; scoped @vibedrift/cli; no runtime invoke | integration | `node tests/verify-drift-integration.test.cjs` | tests/verify-drift-integration.test.cjs | green |
| 11-03-02 | 03 | 1 | DRIFT-01 | — | README documents second-upstream watch | doc-check | `node tests/verify-drift-integration.test.cjs` | tests/verify-drift-integration.test.cjs | green |
| 11-03-03 | 03 | 1 | DRIFT-01 | T-11-05 | maintainer installs/seeds cron (or defers) | manual | human-check (checkpoint) | n/a | manual |
| 11-04-01 | 04 | 2 | DRIFT-04/05 | T-11-01/03/08 | verify drift emits valid JSON, exits 0; --fail-on-score is only non-zero path | integration | `node tests/verify-drift-integration.test.cjs` | tests/verify-drift-integration.test.cjs | green |
| 11-04-02 | 04 | 2 | DRIFT-01 | T-11-09 | CJS<->SDK parity for 2 config keys | parity | `node tests/config-schema-sdk-parity.test.cjs` | tests/config-schema-sdk-parity.test.cjs | green |
| 11-04-03 | 04 | 2 | DRIFT-05 | T-11-SC | zero-dep CI job runs all detector tests | ci | `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/check-drift.yml'))"` | .github/workflows/check-drift.yml | green |
| 11-05-01 | 05 | 3 | DRIFT-04 | T-11-01/10 | --drift flag in scan.md; verify drift valid JSON | doc+integration | `node tests/verify-drift-integration.test.cjs` | tests/verify-drift-integration.test.cjs | green |
| 11-05-02 | 05 | 3 | DRIFT-02 | T-11-08/10 | §5.6 gate OFF by default, warn-first, never-block-unless-explicit | doc+integration | `node tests/verify-drift-integration.test.cjs` | tests/verify-drift-integration.test.cjs | green |

*Status: ⬜ pending · green · ❌ red · ⚠️ flaky*

---

## Requirement Coverage Map

### DRIFT-01: 100% native detection; VibeDrift as idea-only second upstream

| Check | File | Assertions |
|-------|------|------------|
| Script exists and is executable | `verify-drift-integration.test.cjs` | fs.statSync mode & execBits |
| Uses scoped `@vibedrift/cli` (never bare) | `verify-drift-integration.test.cjs` | src.includes('@vibedrift/cli') |
| Does NOT invoke gsd-tools or gsd-sdk at runtime | `verify-drift-integration.test.cjs` | !src.includes('gsd-tools verify'), !src.includes('gsd-sdk') |
| Passes `bash -n` syntax check | `verify-drift-integration.test.cjs` | execFileSync bash -n |
| README documents VibeDrift as second upstream (never invoked) | `verify-drift-integration.test.cjs` | regex check on README content |
| CJS/SDK config parity (detect subcommand keys present in both resolvers) | `config-schema-sdk-parity.test.cjs` | VALID_CONFIG_KEYS + RUNTIME_STATE_KEYS set comparison |

**Verdict: FILLED** — 6 distinct checks, covers the "never invoked at runtime" invariant, script structure, and documentation.

### DRIFT-02: opt-in OFF-by-default gate; warn-first; --fail-on-score is only hard exit

| Check | File | Assertions |
|-------|------|------------|
| audit-milestone.md has "Drift Integrity Gate" section | `verify-drift-integration.test.cjs` | src.includes check |
| Gate controlled by `workflow.drift_gate` config key | `verify-drift-integration.test.cjs` | src.includes('drift_gate') |
| Gate documented OFF by default | `verify-drift-integration.test.cjs` | regex: "OFF by default", "default false" |
| `--fail-on-score` described as hard-exit escalation, milestone never blocked otherwise | `verify-drift-integration.test.cjs` | includes check + "Never blocks" regex |
| `cmdVerifyDrift` without failOnScore exits 0 (no default block) | `verify-drift-integration.test.cjs` | execFileSync exit code assertion |
| `cmdVerifyDrift` with `--fail-on-score -1` exits 0 (threshold below score floor) | `verify-drift-integration.test.cjs` | execFileSync exit code assertion |

**Verdict: FILLED** — positive and negative exit-code paths, off-by-default doc check.

### DRIFT-03: committed allowlist, pair suppression auditable, not dropped

| Check | File | Assertions |
|-------|------|------------|
| `load()` never throws on missing file | `drift-allowlist.test.cjs` | returns {pairs:[],ignore:[]} |
| `load()` never throws on malformed JSON | `drift-allowlist.test.cjs` | returns {pairs:[],ignore:[]} |
| `isSuppressed()` matches a->b direction | `drift-allowlist.test.cjs` | {suppressed:true, reason} |
| `isSuppressed()` matches b->a symmetric direction | `drift-allowlist.test.cjs` | {suppressed:true, reason} |
| `isSuppressed()` non-matching pair returns {suppressed:false} | `drift-allowlist.test.cjs` | strictEqual false |
| Committed `.gsd/drift-allowlist.json` contains bin/lib<->sdk/src pair with reason | `drift-allowlist.test.cjs` | JSON.parse + hasPair check |
| Suppressed pair appears in `suppressed[]`, not `pairs[]`, in detect() output | `semantic-dup.test.cjs` | suppressed.length >= 1 + pairs not containing suppressed key |
| Reason field present on suppressed entries | `semantic-dup.test.cjs` | typeof s.reason === 'string' && length > 0 |
| `**` glob suppresses pair nested more than one directory deep | `semantic-dup.test.cjs` | bin/lib/dup-a.cjs <-> sdk/src/query/dup-b.ts suppressed |
| `isIgnored()` glob excludes matching file only | `drift-allowlist.test.cjs` | true/false pair |
| `isIgnored()` bare directory name excludes nested paths | `drift-allowlist.test.cjs` | vendor/lib/x.cjs matched |

**Verdict: FILLED** — covers loader robustness, symmetric suppression, auditable hand-off, and gitignore-style ignore.

### DRIFT-04: /gsd:scan --drift produces ranked report; verify drift is the engine

| Check | File | Assertions |
|-------|------|------------|
| `scan.md` documents `--drift` flag | `verify-drift-integration.test.cjs` | includes check |
| `scan.md` references `verify drift` command | `verify-drift-integration.test.cjs` | includes check |
| `verify drift --json` emits valid JSON with skipped/score/findings/suppressed/counts | `verify-drift-integration.test.cjs` | JSON.parse + field presence |
| `verify drift` exits 0 without `--fail-on-score` | `verify-drift-integration.test.cjs` | execFileSync no throw |
| `verify drift --fail-on-score 999` exits 1 when score < 999 | `verify-drift-integration.test.cjs` | exit code === 1 |
| `verify drift --fail-on-score -1` exits 0 (score >= 0 always clears) | `verify-drift-integration.test.cjs` | execFileSync no throw |
| Unsafe scope (`../../../etc`) emits `skipped:true`, exits 0 | `verify-drift-integration.test.cjs` | skipped === true, no throw |

**Verdict: FILLED** — positive JSON shape, exit-code gate positive/negative/edge, doc check, safe-fail on path traversal.

### DRIFT-05: native detection (MinHash+LCS + phantom/placeholder + conventions reuse)

| Check | File | Assertions |
|-------|------|------------|
| Cross-file near-clone flagged (similarity >= 0.7) | `semantic-dup.test.cjs` | pairs.length >= 1, pair.similarity >= 0.7 |
| MIN_BODY_TOKENS guard skips tiny functions | `semantic-dup.test.cjs` | tiny-helper.cjs never in pairs |
| Same-file pair never emitted | `semantic-dup.test.cjs` | pairs.length === 0 on same-file corpus |
| Determinism: two detect() calls produce identical pairs | `semantic-dup.test.cjs` | deepStrictEqual normalized |
| null input -> {skipped:true, reason, pairs:[], suppressed:[]} | `semantic-dup.test.cjs` | field presence + types |
| Nonexistent file does not throw | `semantic-dup.test.cjs` | threw === false |
| Binary/garbage content does not throw | `semantic-dup.test.cjs` | threw === false |
| `lcsSimilarity`: identical -> 1 | `semantic-dup.test.cjs` | strictEqual 1 |
| `lcsSimilarity`: 0 when length ratio < 0.5 | `semantic-dup.test.cjs` | strictEqual 0 |
| `lcsSimilarity`: 0 for empty inputs | `semantic-dup.test.cjs` | strictEqual 0 |
| `lcsSimilarity`: similar sequences -> (0,1) | `semantic-dup.test.cjs` | ok(sim > 0 && sim < 1) |
| `buildShingles`: length - size + 1 shingles | `semantic-dup.test.cjs` | strictEqual expected count |
| `buildShingles`: single shingle when tokens < size | `semantic-dup.test.cjs` | length === 1, typeof string |
| `minHashSignature`: deterministic (same input = same output) | `semantic-dup.test.cjs` | deepStrictEqual |
| `minHashSignature`: returns Uint32Array of length 128 | `semantic-dup.test.cjs` | instanceof + length |
| Class method near-clones detected (METHOD_RE) | `semantic-dup.test.cjs` | pairs.length >= 1 |
| CRUD export never imported -> phantom-export finding | `phantom-scaffolding.test.cjs` | findings filter by kind |
| CRUD export imported via ESM -> NOT flagged | `phantom-scaffolding.test.cjs` | findings.length === 0 |
| CRUD export imported via CJS require -> NOT flagged | `phantom-scaffolding.test.cjs` | findings.length === 0 |
| Non-CRUD unused export -> NOT flagged (D-09 noise exclusion) | `phantom-scaffolding.test.cjs` | findings.length === 0 |
| `return null + // TODO` -> placeholder-stub | `phantom-scaffolding.test.cjs` | stubs.length > 0 |
| `return {} + /* FIXME */` -> placeholder-stub | `phantom-scaffolding.test.cjs` | stubs.length > 0 |
| Real return value, no TODO -> NOT flagged | `phantom-scaffolding.test.cjs` | stubs.length === 0 |
| TODO inside string literal -> NOT flagged (blankSpans) | `phantom-scaffolding.test.cjs` | stubs.length === 0 |
| D-09: no lineCount/unreachable/unusedExport/commentDensity in result | `semantic-dup.test.cjs` | noise field check on result and pairs |

**Verdict: FILLED** — 25 distinct behavioral checks across the three detection layers.

---

## Gap Analysis

This section records what was originally pending (Wave 0 / file-missing) and how each gap was closed.

### Pre-validation gaps (all closed 2026-06-27)

| Gap | Original Status | Resolution |
|-----|-----------------|------------|
| `tests/semantic-dup.test.cjs` missing | "File Exists: no (W0)" | File delivered with 20 checks covering DRIFT-05 + DRIFT-03 hand-off |
| `tests/phantom-scaffolding.test.cjs` missing | "File Exists: no (W0)" | File delivered with 16 checks covering DRIFT-05 phantom + placeholder |
| `tests/drift-allowlist.test.cjs` missing | "File Exists: no (W0)" | File delivered with 13 checks covering DRIFT-03 |
| `tests/config-schema-sdk-parity.test.cjs` missing (described in plan as "no NEW file needed") | — | File delivered with 3 checks covering CJS/SDK key parity |
| DRIFT-01/02/04 had no node-runnable test (only CI inline bash commands) | Tasks 11-03-01, 11-04-01, 11-05-01/02 "File Exists: no (W0)" | `tests/verify-drift-integration.test.cjs` created with 15 checks |
| `.github/workflows/check-drift.yml` missing `drift-detectors` job | "File Exists: no (W0)" | CI file delivered; `drift-detectors` job present and verified |

### Soft-test audit

No `assert.ok(true)` fallbacks or unguarded `if (x)` elision patterns found. All assertions will fail when the implementation violates them. Two previously-attempted tests (stdout capture) were adjusted from process.stdout.write interception to child-process invocation because `core.cjs output()` uses `fs.writeSync(fd=1)` which bypasses the write intercept.

---

## Wave 0 Requirements

- [x] `tests/semantic-dup.test.cjs` — DRIFT-05 (MinHash+LCS flagging, MIN_BODY_TOKENS/same-file/ratio guards, determinism, never-throw, suppression hand-off, D-09 noise-exclusion, class-method extraction)
- [x] `tests/phantom-scaffolding.test.cjs` — DRIFT-05 (CRUD-export-never-routed across ESM+CJS, placeholder, TODO-in-string safety, D-09)
- [x] `tests/drift-allowlist.test.cjs` — DRIFT-03 (loader never-throw + symmetric pair suppression auditability + isIgnored)
- [x] `tests/config-schema-sdk-parity.test.cjs` — DRIFT-01/DRIFT-04 (CJS/SDK key parity for the two new config keys)
- [x] `tests/verify-drift-integration.test.cjs` — DRIFT-01/DRIFT-02/DRIFT-04 (no-runtime-invoke, off-by-default gate, fail-on-score CLI integration)
- [x] `.github/workflows/check-drift.yml` — `drift-detectors` job running all detector tests + config parity + smoke test (no `npm ci`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VibeDrift watch cron install + seed | DRIFT-01 | Touches the maintainer's machine state (crontab, live cron copy, home-dir seed file); no CLI substitute | Checkpoint 11-03-03: seed `~/.vibedrift-last-known-version`, copy script to `~/claude-code-gsd/`, add crontab entry, dry-run for exit=0 no-mail |

---

## Validation Sign-Off

- [x] All tasks have automated verify or explicit manual checkpoint
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the cron-install checkpoint is manual, isolated)
- [x] Wave 0 requirements all satisfied: 5 test files + CI job
- [x] No watch-mode flags in any test
- [x] Full suite command green: all 54 checks across 5 test files pass
- [x] Soft-test audit complete: no trivially-passing assertions found
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter
- [x] `status: validated` set in frontmatter

**Approval:** validated 2026-06-27
