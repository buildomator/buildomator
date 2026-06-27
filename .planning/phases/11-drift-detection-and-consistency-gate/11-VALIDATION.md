---
phase: 11
slug: drift-detection-and-consistency-gate
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-27
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
| **Full suite command** | `node tests/semantic-dup.test.cjs && node tests/phantom-scaffolding.test.cjs && node tests/drift-allowlist.test.cjs` |
| **Estimated runtime** | ~5 seconds (zero-dep, in-process) |

---

## Sampling Rate

- **After every task commit:** Run the relevant single detector test (`node tests/<detector>.test.cjs`)
- **After every plan wave:** Run the full detector suite + `node bin/gsd-tools.cjs verify drift --scope . --json` smoke
- **Before `/gsd:verify-work`:** Full suite green + `.github/workflows/check-drift.yml` `drift-detectors` job green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | DRIFT-05 | T-11-02/03 | RED scaffold: detector never throws; deterministic; cross-file guards | unit | `node tests/semantic-dup.test.cjs; test $? -ne 0` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | DRIFT-05 | T-11-01/02/03/04 | path-safety + blankSpans + MAX_SCAN_BYTES + never-throw; no Math.random | unit | `node tests/semantic-dup.test.cjs` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | DRIFT-05 | T-11-02 | detector runs bounded on real ~440-file repo without throwing | smoke | `node -e "const v=require('./bin/lib/verify.cjs');const d=require('./bin/lib/semantic-dup.cjs');const c=v.collectConventionCorpus(process.cwd(),process.cwd());const r=d.detect(c,{cwd:process.cwd()});if(r.skipped)throw 0;console.log('pairs',r.pairs.length)"` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | DRIFT-03 | T-11-01/03 | allowlist loader never throws; suppression auditable not dropped | unit | `node tests/drift-allowlist.test.cjs` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | DRIFT-05 | T-11-02/03/04 | phantom covers ESM+CJS imports; TODO-in-string not flagged (blankSpans); D-09 noise absent | unit | `node tests/phantom-scaffolding.test.cjs` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 1 | DRIFT-01 | T-11-05/06/07 | watch never fails cron; scoped @vibedrift/cli; no runtime invoke | smoke | `bash -n bin/check-vibedrift-release.sh && test -x bin/check-vibedrift-release.sh && grep -q "@vibedrift/cli" bin/check-vibedrift-release.sh` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 1 | DRIFT-01 | — | README documents second-upstream watch | doc-check | `grep -qi vibedrift README.md` | ✅ | ⬜ pending |
| 11-03-03 | 03 | 1 | DRIFT-01 | T-11-05 | maintainer installs/seeds cron (or defers) | manual | human-check (checkpoint) | n/a | ⬜ pending |
| 11-04-01 | 04 | 2 | DRIFT-04/05 | T-11-01/03/08 | verify drift emits valid JSON, exits 0; --fail-on-score is only non-zero path | integration | `node bin/gsd-tools.cjs verify drift --scope . --json` (parse + exit 0); `... --fail-on-score 999` exits 1 | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 2 | DRIFT-01 | T-11-09 | CJS<->SDK parity for verify.drift + 2 config keys; dist rebuilt | parity | `cd sdk && npm run check:alias-drift`; grep keys in both schemas | ❌ W0 | ⬜ pending |
| 11-04-03 | 04 | 2 | DRIFT-05 | T-11-SC | zero-dep CI job runs all 3 detector tests (no npm ci) | ci | `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/check-drift.yml'))"` + grep drift-detectors | ❌ W0 | ⬜ pending |
| 11-05-01 | 05 | 3 | DRIFT-04 | T-11-01/10 | --drift prints ranked markdown + suppressed section, no agent | doc+e2e | `grep -q -- --drift workflows/scan.md`; `gsd-tools verify drift --scope . --top 20 --json` valid | ❌ W0 | ⬜ pending |
| 11-05-02 | 05 | 3 | DRIFT-02 | T-11-08/10 | §5.6 gate OFF by default, warn-first, never-block-unless-explicit; allowlist suppresses dual resolver | doc+e2e | `grep -q "Drift Integrity Gate" workflows/audit-milestone.md && grep -q drift_gate workflows/audit-milestone.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/semantic-dup.test.cjs` — DRIFT-05 (MinHash+LCS flagging, MIN_BODY_TOKENS/same-file/ratio guards, determinism, never-throw, suppression hand-off, D-09 noise-exclusion) — created RED in 11-01-01
- [ ] `tests/phantom-scaffolding.test.cjs` — DRIFT-05 (CRUD-export-never-routed across ESM+CJS, placeholder, TODO-in-string safety, D-09) — created in 11-02-02
- [ ] `tests/drift-allowlist.test.cjs` — DRIFT-03 (loader never-throw + symmetric pair suppression auditability) — created in 11-02-01
- [ ] CJS<->SDK parity for `verify.drift` + the two config keys — exercised via `cd sdk && npm run check:alias-drift` (existing script) in 11-04-02; no NEW parity test file needed (the alias-drift script + manual schema grep cover it; the repo has no config-schema parity test file)
- [ ] Calibration pass (not a test) — 11-01-03 runs the detector on gsd-plugin, tunes thresholds, confirms dual-resolver suppressed and top-N signal-rich
- [ ] `.github/workflows/check-drift.yml` — `drift-detectors` job running the three new tests with no `npm ci` — added in 11-04-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VibeDrift watch cron install + seed | DRIFT-01 | Touches the maintainer's machine state (crontab, live cron copy, home-dir seed file); no CLI substitute (memory `260608-vk9`) | Checkpoint 11-03-03: seed `~/.vibedrift-last-known-version`, copy script to `~/claude-code-gsd/`, add crontab entry, dry-run for exit=0 no-mail |

---

## Validation Sign-Off

- [x] All tasks have `<automated>`/`<human-check>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the human-action checkpoint is manual, isolated)
- [x] Wave 0 covers all MISSING references (3 test files + CI job + calibration)
- [x] No watch-mode flags
- [x] Feedback latency < 11s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-27
