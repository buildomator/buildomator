---
phase: 13
slug: buildomator-plugin
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
---

# Phase 13 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Zero-dep Node harness: `node:assert` + bare `check(name, fn)` runner + `process.exit(1)` footer (mirrors `tests/build-bm-drift.test.cjs`) |
| **Config file** | none (tests are standalone executables) |
| **Quick run command** | `node tests/build-bm-drift.test.cjs` |
| **Full suite command** | `node tests/bm-transform.test.cjs && node tests/build-bm-drift.test.cjs && node tests/bm-parity.test.cjs && node bin/build-bm.cjs --check` |
| **Estimated runtime** | ~15 seconds (each integration case regenerates dist/bm into a temp dir) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/build-bm-drift.test.cjs` plus the task's own test file
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green locally AND `bm-build-drift` + `bm-package-smoke` CI jobs green
- **Max feedback latency:** 30 seconds locally

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | BM-02, BM-03 | T-13-01 | Anchored rewrite spares gsd://, gsd-* filenames, cache literals, GSD: stderr | unit (tests-first) | `node tests/bm-transform.test.cjs` | ❌ W0 (created RED-first in this task) | ⬜ pending |
| 13-01-02 | 01 | 1 | BM-02, BM-03 | T-13-02, T-13-03 | Transform single-sourced inside generate(); --check regenerates through identical logic | integration | `node tests/build-bm-drift.test.cjs && node bin/build-bm.cjs --check` | ⚠️ extends existing drift test | ⬜ pending |
| 13-02-01 | 02 | 2 | BM-01, BM-02 | T-13-03 | Full inventory census + zero /gsd: leak scan + byte-parity via --check | integration (tests-first) | `node tests/bm-parity.test.cjs` | ❌ W0 (created RED-first in this task) | ⬜ pending |
| 13-02-02 | 02 | 2 | BM-01, BM-03 | T-13-03, T-13-04, T-13-05 | CI gate blocks stale dist; dual hook tripwire; MCP tool/resource lists deep-equal | integration (CI + local run of step scripts) | local execution of the new smoke assertions + `node tests/bm-parity.test.cjs` | ⚠️ extends existing CI jobs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 test gaps land inside their owning tasks, tests-first (RED before implementation):

- [ ] `tests/bm-transform.test.cjs` - unit stubs for BM-02/BM-03 (rewriteCommandRefs coverage + sparing, stampHookFallback exact-literal) - task 13-01-01, written before the helper module
- [ ] `tests/build-bm-drift.test.cjs` widening - mcpServers assertions flip to the bm key; whitelist walk compares text files to the transform of source; hooks.json case compares to the stamped source - task 13-01-02, same commit as the build change
- [ ] `tests/bm-parity.test.cjs` - inventory + zero-leak + --check gate - task 13-02-01, written RED before the dist regeneration
- [ ] MCP tools/resources comparison + hook-fallback assertion smoke steps - task 13-02-02

No framework install needed: existing zero-dep harness covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification. (Optional post-release spot check: install the bm plugin in Claude Code and run one `/bm:` command; not required for phase acceptance, which is CI.)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-06
