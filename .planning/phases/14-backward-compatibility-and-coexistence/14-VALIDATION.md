---
phase: 14
slug: backward-compatibility-and-coexistence
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 14 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Zero-dependency Node harness (`node:assert` + a `check(name, fn)` / `withTempDir` runner with a failure counter and a `process.exit(1)` footer), mirroring `tests/checkpoint-write-guards.test.cjs` + `tests/bm-parity.test.cjs`. Tests are standalone executable `.cjs` files. CI runs each as its own `run:` step in `check-drift.yml` / `install-smoke.yml`. |
| **Config file** | none - reuse existing `.github/workflows/check-drift.yml` + `install-smoke.yml` jobs |
| **Quick run command** | `node tests/<file>.test.cjs` (the single test touched by the task) |
| **Full suite command** | `node tests/coexist.test.cjs && node tests/hook-single-fire.test.cjs && node tests/handoff-write-lock.test.cjs && node tests/nudge-emission.test.cjs && node bin/build-bm.cjs --check && node tests/bm-parity.test.cjs && node tests/checkpoint-write-guards.test.cjs` |
| **Estimated runtime** | ~30 seconds (spawnSync child processes dominate; no npm ci, no network) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the test the task touches (`node tests/<file>.test.cjs`).
- **After every plan wave:** Run the full suite command (all four coexistence tests + `build-bm --check` + `bm-parity` so nudge suppression cannot break byte-parity).
- **Before `/gsd:verify-work`:** Full suite must be green, plus the `check-drift.yml` and `install-smoke.yml` jobs.
- **Max feedback latency:** ~30 seconds (full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | COMPAT-03 | T-14-05 / T-14-04 | HANDOFF.json write serialized through the O_EXCL lock (no bare writeFileSync); writeCheckpoint never throws | unit | `node -e "const s=require('./bin/lib/state.cjs');require('./bin/lib/checkpoint.cjs');process.exit(typeof s.acquireStateLock==='function'&&typeof s.releaseStateLock==='function'?0:1)"` | ❌ existing files | ✅ green |
| 14-01-02 | 01 | 1 | COMPAT-03 | T-14-05 | Interleaved HANDOFF.json + STATE.md writers leave valid, parseable files; no stale lock left | integration | `node tests/handoff-write-lock.test.cjs` | ❌ W0 | ✅ green |
| 14-02-01 | 02 | 1 | COMPAT-01 / COMPAT-02 | T-14-01 / T-14-06 | Spec (RED): identity, marker lifecycle, malformed session_id rejected, reaper-safe prefix | unit | `node tests/coexist.test.cjs` (RED before 14-02-02) | ❌ W0 | ✅ green |
| 14-02-02 | 02 | 1 | COMPAT-01 / COMPAT-02 | T-14-01 / T-14-02 / T-14-06 | pluginIdentity path-derived; marker traversal-proof; shouldYield no-op for gsd-only session | unit | `node tests/coexist.test.cjs` | ❌ W0 | ✅ green |
| 14-03-01 | 03 | 2 | COMPAT-01 / COMPAT-02 | T-14-06 | Spec (RED): both-active single fire for gsd-tools branches AND run-bash-hook dispatch; SessionStart residual bound | unit | `node tests/hook-single-fire.test.cjs` (RED before 14-03-02) | ❌ W0 | ✅ green |
| 14-03-02 | 03 | 2 | COMPAT-01 / COMPAT-02 | T-14-06 / T-14-12 | Election wired into both dispatch points; gsd copy yields (no checkpoint write, no bash-hook run) under a marker; validate-commit block preserved | unit | `node tests/hook-single-fire.test.cjs && node tests/checkpoint-write-guards.test.cjs` | ❌ W0 | ✅ green |
| 14-03-03 | 03 | 2 | COMPAT-04 | T-14-07 | gsd SessionStart emits a non-blocking, em-dash-free nudge (`/bm:` + v5.0), sentinel-wrapped, exempt from the yield; exit 0 | unit | `printf '{"session_id":"NUDGE1","source":"startup"}' \| node bin/gsd-tools.cjs hook session-start` (asserts `/bm:` + `v5.0`, exit 0) | ✅ existing dispatch | ✅ green |
| 14-04-01 | 04 | 3 | COMPAT-04 | T-14-08 / T-14-09 | suppressNudge line-anchored + SUPPRESS_EXCLUDE self-protection; dist/bm gsd-tools.cjs has no nudge; both dist/bm gsd-tools.cjs and bm-transform.cjs valid JS | unit + drift | `node bin/build-bm.cjs --check && node --check dist/bm/bin/gsd-tools.cjs && node --check dist/bm/bin/lib/bm-transform.cjs` | ❌ existing files | ✅ green |
| 14-04-02 | 04 | 3 | COMPAT-04 | T-14-08 | gsd emits the nudge including under yield; dist/bm carries none; bm-parity intact | unit | `node tests/nudge-emission.test.cjs && node tests/bm-parity.test.cjs` | ❌ W0 | ✅ green |
| 14-05-01 | 05 | 4 | COMPAT-01..04 | T-14-10 | Four coexistence tests run as CI gates on push; existing bm gates preserved; YAML valid | integration (CI) | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/check-drift.yml'))"` + grep count == 4 | ✅ existing workflow | ✅ green |
| 14-05-02 | 05 | 4 | COMPAT-01..04 | T-14-10 / T-14-11 | Package-level single-fire smoke (marker-present yield + no-marker control); VALIDATION.md confirmed | integration (CI) | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/install-smoke.yml'))"` + `grep -Eq "markBmActive\|bm-active\|coexist"` | ✅ existing workflow | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. "File Exists" ❌ W0 = a Wave 0 test file created during execution; ❌ existing files = a modified existing file, no new test file; ✅ = exercises an already-present dispatch/workflow.*

---

## Wave 0 Requirements

- [x] `tests/handoff-write-lock.test.cjs` - interleaved HANDOFF.json + STATE.md write-lock coverage (COMPAT-03)
- [x] `tests/coexist.test.cjs` - identity election + marker lifecycle + malformed-id + reaper-safety (COMPAT-01/02)
- [x] `tests/hook-single-fire.test.cjs` - both-active single fire across both dispatch points + SessionStart residual (COMPAT-02)
- [x] `tests/nudge-emission.test.cjs` - gsd emits (incl. yield) + bm (dist/bm) suppresses (COMPAT-04)
- [x] CI wiring: each new test added as a `run:` step in `check-drift.yml`; `install-smoke.yml` extended with a both-plugins single-fire smoke
- [x] No framework install needed (zero-dep harness already in use)

---

## Manual-Only Verifications

*None. All phase behaviors have automated verification (unit tests, drift gate, and CI smoke). The D-03 first-event SessionStart residual is an accepted, documented behavior, not a manually-verified one.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (four new test files, tracked above)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11 (planning-time population; Status column + `wave_0_complete` finalized during Plan 05 execution)
