---
phase: 18
slug: agent-skills-spec-upstream-and-skill-md-conformance-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node assertion scripts (no runner), `spawnSync` sandbox pattern (clone of `tests/user-docs-jargon.test.cjs`) |
| **Config file** | none — tests are standalone `.cjs` run via `node tests/<name>.test.cjs` |
| **Quick run command** | `node tests/skill-conformance.test.cjs` |
| **Full suite command** | the individual `node tests/*.cjs` steps in `check-drift.yml` (no `npm test` aggregator exists) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/skill-conformance.test.cjs` (and the gate itself runs via the pre-commit hook)
- **After every plan wave:** Run the new `check-drift.yml` job's steps (`node bin/maintenance/check-skill-conformance.cjs` + the conformance test)
- **Before `/bm:verify-work`:** Gate passes on the real 86 skills, discrimination test green, watch script exits 0 under all three wedge conditions
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-conf-count-ceiling | conformance | — | CAT-08 | — | count <= 90 passes; > 90 hard-fails (exit 1); warn band exits 0 | unit (sandbox) | `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |
| 18-conf-desc-ratchet | conformance | — | CAT-08 | — | description growth past 380-char baseline hard-fails; `--write-baseline` preserves sibling baseline sections | unit (sandbox) | `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |
| 18-conf-frontmatter | conformance | — | CAT-08 | T-18-V5 / — | missing/empty name or description hard-fails (D-03); license/compatibility/metadata never hard-fail (D-04); parse YAML defensively, no eval | unit (sandbox) | `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |
| 18-conf-allowed-tools | conformance | — | CAT-08 | — | all three in-repo `allowed-tools` shapes (list / `[]` / comma-string) pass; only unparseable fails | unit (sandbox) | `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |
| 18-conf-cwd-guard | conformance | — | CAT-08 | — | run from wrong cwd exits 2 (repo-root guard) | unit (sandbox) | `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |
| 18-conf-real-skills | conformance | — | CAT-08 | — | all 86 real `skills/*/SKILL.md` pass the gate (integration) | integration | `node bin/maintenance/check-skill-conformance.cjs` | ❌ W0 | ⬜ pending |
| 18-watch-wedge-guards | watch | — | CAT-07 | T-18-DoS / — | npm absent, network down, and 404 release each exit 0 (never wedge cron) | unit (bash harness) | `node tests/agentskills-watch.test.cjs` or bash harness | ❌ W0 | ⬜ pending |
| 18-trust-gate-shellout | trust-adoption | — | CAT-08 / CAT-03 | T-18-V10 / — | opt-in `npx skills-ref validate` hook is version-pinned, off the runtime path, present in both assess twins (parity) | unit (parity) | existing craft-skill parity test + `node tests/skill-conformance.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/skill-conformance.test.cjs` — sandbox-shaped test covering CAT-08 (clone `tests/user-docs-jargon.test.cjs`): count ceiling warn/fail bands, description ratchet grow-fail, `--write-baseline` section preservation, D-03 hard-fails, D-04 advisory-only, all three allowed-tools shapes, wrong-cwd exit 2
- [ ] `tests/drift-baseline.json` — gains a `skill_conformance` section (captured via `--write-baseline`: count 86, longest description 380)
- [ ] `tests/agentskills-watch.test.cjs` (or a bash harness) — optional CAT-07 wedge-guard coverage (npm absent / network down / 404 release all exit 0)

*The ratchet and test infrastructure are new; everything above is a Wave 0 dependency created inside this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx skills-ref validate` actually runs against a real external candidate | CAT-08 / CAT-03 | Network-dependent and runs unverified third-party code; must stay opt-in and human-triggered, never in automated CI | Manually run the assess path on a sample external SKILL.md dir with the opt-in flag set; confirm the pinned `skills-ref@0.1.5` is invoked and failure is surfaced, not swallowed |
| Pre-commit hook fires the conformance gate on a staged SKILL.md change | CAT-08 | Git hook behavior is environment-specific (requires `install-git-hooks.sh` run) | Stage a SKILL.md with an over-long description, attempt commit, confirm the hook blocks it with a loud-fail message and no auto-regen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
