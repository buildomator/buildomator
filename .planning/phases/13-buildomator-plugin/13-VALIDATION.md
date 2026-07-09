---
phase: 13
slug: buildomator-plugin
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
updated: 2026-07-09
---

# Phase 13 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 13-01 and 13-02 shipped; 13-03 and 13-04 are the gap-closure plans that close the
> code-review findings (CR-01/CR-02) and the D-08 namespace-rewrite widening.

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
| 13-01-01 | 01 | 1 | BM-02, BM-03 | T-13-01 | Anchored rewrite spares gsd://, gsd-* filenames, cache literals, GSD: stderr | unit (tests-first) | `node tests/bm-transform.test.cjs` | ✅ shipped | ✅ shipped |
| 13-01-02 | 01 | 1 | BM-02, BM-03 | T-13-02, T-13-03 | Transform single-sourced inside generate(); --check regenerates through identical logic | integration | `node tests/build-bm-drift.test.cjs && node bin/build-bm.cjs --check` | ✅ shipped | ✅ shipped |
| 13-02-01 | 02 | 2 | BM-01, BM-02 | T-13-03 | Full inventory census + zero /gsd: leak scan + byte-parity via --check | integration (tests-first) | `node tests/bm-parity.test.cjs` | ✅ shipped | ✅ shipped |
| 13-02-02 | 02 | 2 | BM-01, BM-03 | T-13-03, T-13-04, T-13-05 | CI gate blocks stale dist; dual hook tripwire; MCP tool/resource lists deep-equal | integration (CI + local run of step scripts) | local execution of the new smoke assertions + `node tests/bm-parity.test.cjs` | ✅ shipped | ✅ shipped |
| 13-03-01 | 03 | 1 | BM-02, BM-03 | T-13-03-01 | Broadened gsd:(?!/) rewrite flips agent refs + frontmatter, spares gsd://; /gsd[:-] sanitizer literal flips to /bm[:-]; idempotent | unit (tests-first, RED before GREEN) | `node tests/bm-transform.test.cjs` | ⚠️ extends existing unit test | ⬜ pending |
| 13-03-02 | 03 | 1 | BM-02, BM-03 | T-13-03-02, T-13-03-03, T-13-03-04 | Hook stamp on all text files except STAMP_EXCLUDE; COMMAND_REWRITE_EXCLUDE spares server.cjs (D-05) + CHANGELOG.md (IN-01) + bm-parity fixtures; drift test mirrors both sets | integration | `node bin/build-bm.cjs --check && node tests/build-bm-drift.test.cjs && cmp mcp/server.cjs dist/bm/mcp/server.cjs && cmp CHANGELOG.md dist/bm/CHANGELOG.md` | ⚠️ extends existing drift test | ⬜ pending |
| 13-04-01 | 04 | 2 | BM-01, BM-02, BM-03 | T-13-04-01 | Fail-closed census: per-class raw-text detector (no pre-strip) flags each of 4 planted classes; allow-listed-only clean; real dist/bm scan (minus STAMP_EXCLUDE, incl. server.cjs) zero | integration (tests-first, RED proof) | `node tests/bm-parity.test.cjs` | ⚠️ extends existing parity test | ⬜ pending |
| 13-04-02 | 04 | 2 | BM-01, BM-03 | T-13-04-02, T-13-04-03 | BM_DIST_DIR isolates the tamper case to a temp copy (WR-01); install-smoke.yml carries no plan id (WR-04) | integration | `node tests/build-bm-drift.test.cjs && node tests/bm-parity.test.cjs && node bin/build-bm.cjs --check` | ⚠️ extends existing drift test + CI file | ⬜ pending |

*Status: ⬜ pending · ✅ green/shipped · ❌ red · ⚠️ flaky/extends-existing*

---

## Wave 0 Requirements

Wave 0 test gaps land inside their owning tasks, tests-first (RED before implementation). The
13-01/13-02 scaffolds shipped; the gap-closure plans extend those same files:

- [x] `tests/bm-transform.test.cjs` - unit stubs for the initial rewrite/stamp (shipped in 13-01-01)
- [x] `tests/build-bm-drift.test.cjs` widening - mcpServers bm key, whitelist walk vs transform (shipped in 13-01-02)
- [x] `tests/bm-parity.test.cjs` - inventory + zero-leak + --check gate (shipped in 13-02-01)
- [ ] `tests/bm-transform.test.cjs` D-08 cases - broadened gsd:(?!/) scope (agent refs, frontmatter), /gsd[:-] sanitizer literal, idempotence; obsolete bare-gsd-sparing case removed - task 13-03-01, RED before the helper change
- [ ] `tests/build-bm-drift.test.cjs` mirror update - import shared STAMP_EXCLUDE + COMMAND_REWRITE_EXCLUDE; expectedText applies command rewrite unless COMMAND_REWRITE_EXCLUDE then stamp unless STAMP_EXCLUDE - task 13-03-02, same commit as the build change
- [ ] `tests/bm-parity.test.cjs` fail-closed census - per-class raw-text detectViolations + positive-control unit (4 classes flagged, allow-listed-only clean) + real dist/bm scan skipping STAMP_EXCLUDE; blanket /gsd: grep case removed - task 13-04-01, RED proof before the census wiring
- [ ] `tests/build-bm-drift.test.cjs` tamper-isolation - BM_DIST_DIR temp-copy rewrite so the committed tree is never mutated - task 13-04-02

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

**Approval:** approved 2026-07-06; gap-closure map refreshed for 13-03/13-04 on 2026-07-09
</content>
