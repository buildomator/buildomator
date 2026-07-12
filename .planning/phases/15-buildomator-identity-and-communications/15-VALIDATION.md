---
phase: 15
slug: buildomator-identity-and-communications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. This is a prose/metadata phase: there is no prose unit-test framework. Validation is the existing zero-dep Node gate suite plus targeted manual reads of the generated bm package.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node zero-dep gate suite (Node built-ins + git, no `npm ci`) |
| **Config file** | none — gates are standalone `.cjs` scripts run from repo root |
| **Quick run command** | `node bin/build-bm.cjs && node bin/build-bm.cjs --check` |
| **Full suite command** | `node bin/build-bm.cjs && node tests/build-bm-drift.test.cjs && node bin/build-bm.cjs --check && node tests/bm-parity.test.cjs && node tests/version-alignment.test.cjs && node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node bin/build-bm.cjs --check` (fast: committed dist/bm == fresh build)
- **After every plan wave:** Run the full suite command above
- **Before `/gsd:verify-work`:** Full suite green AND the mandatory manual `dist/bm/README.md` read passes
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| bm transform parity | (build gate) | final | BRAND-01/02 | — | N/A | integration | `node bin/build-bm.cjs && node bin/build-bm.cjs --check` | ✅ | ⬜ pending |
| gsd-leak census clean | (build gate) | final | BRAND-01 | — | N/A | integration | `node tests/bm-parity.test.cjs` | ✅ | ⬜ pending |
| stampBmManifest description | (test edit) | 1 | BRAND-01 | — | N/A | unit | `node tests/build-bm-drift.test.cjs` | ✅ | ⬜ pending |
| retirement date identical (4 files) | — | final | BRAND-03 | — | N/A | grep | `grep -rn "2026-10-01" CHANGELOG.md README.md .claude-plugin/marketplace.json bin/gsd-tools.cjs` | ✅ | ⬜ pending |
| buildomator.com wired | — | final | BRAND-02 | — | N/A | assertion | `node -e "const p=require('./.claude-plugin/plugin.json'); console.log(p.homepage,p.repository)"` | ✅ | ⬜ pending |
| version bumped to 4.1.0 | — | final | BRAND-01 | — | N/A | assertion | `node bin/maintenance/check-version-alignment.cjs && node tests/version-alignment.test.cjs` | ✅ | ⬜ pending |
| bm manifest schema-valid | (build gate) | final | BRAND-01 | — | N/A | schema | `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test-infrastructure Wave 0 gap. The gate suite already exists (`tests/build-bm-drift.test.cjs`, `tests/bm-parity.test.cjs`, `tests/version-alignment.test.cjs`) and runs in CI (`.github/workflows/check-drift.yml`).
- One existing-test edit is required (not new infra): update `tests/build-bm-drift.test.cjs:89-98` to match the changed `stampBmManifest` bm description assertion (see RESEARCH.md finding 2). This edit lands with the `build-bm.cjs` change and must be green before other gates run.

*Existing infrastructure covers all phase requirements once the one assertion edit above lands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated bm prose is correct | BRAND-01 | Semantic correctness of migration prose has no automated gate; the census only catches literal `gsd:` leaks, not wrong-but-clean sentences | Read `dist/bm/README.md` migration section and the bm `plugin.json` description by eye: expect NO "/bm: retires", NO "Buildomator -- Buildomator", NO "(legacy /gsd:)" in the bm manifest. Run: `sed -n '/Migrating/,/^## /p' dist/bm/README.md` and `node -e "console.log(require('./dist/bm/.claude-plugin/plugin.json').description)"` |
| Retirement-date sentences read identically | BRAND-03 | grep proves 4 hits exist; a human must confirm the surrounding sentence wording matches across CHANGELOG, README, marketplace legacy entry, and the nudge string | Eyeball each of the 4 `grep -rn "2026-10-01"` hits for consistent wording |
| Migration story reads like a person wrote it | BRAND-01 | Style rules (no em-dashes, no "canonical", no AI-marketing tells) are not machine-checkable here | Read the README migration section and CHANGELOG [4.1.0] entry |

---

## Validation Sign-Off

- [ ] All tasks map to an automated gate command or a listed manual verification
- [ ] Sampling continuity: gate suite runs after every task/wave (fast, ~15s)
- [ ] Wave 0 covers the one required test-assertion edit
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
