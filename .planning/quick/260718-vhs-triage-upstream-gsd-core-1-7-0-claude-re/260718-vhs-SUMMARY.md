---
quick_id: 260718-vhs
status: complete
date: 2026-07-18
---

# Quick Task 260718-vhs — Summary

Sync triage of upstream gsd-core v1.7.0 (shipped 2026-07-15) against our fork
(provenance gsd-core 1.6.1). Follow-up to `260701-gbo`. Full per-PR assessment in
`260718-vhs-FINDINGS.md`. No code changed — this is a survey/triage.

## Result: 13 Claude-relevant candidates triaged

- **ADOPT (3):** #2018 (empty-manifest agent-delete guard, S), #1581 (config-set
  Infinity/project_code coercion, S), #1988 (stray *-SUMMARY.md inflates completion
  count, M). No conflict with our 4.1.2 audit-open work.
- **ADAPT (5):** #1154+#1820 (honest-verifier abstain + spec-optional rail — strongest,
  prompt-only), #1779 (valid YAML for unsafe scalars), #1561 (advisory assumption-delta),
  #1729 (phase-header pre-colon parenthetical), #1866 (agent self-load skills, optional).
- **Design decision (1):** #2022 (gate checkbox on verification passed) — upstream's
  premise doesn't hold here; our completion is "warn, don't block." Needs a call on
  whether to adopt verification-first completion in BOTH update-plan-progress AND
  cmdPhaseComplete, else skip. Leans defer.
- **SKIP (4):** #1787 (/gsd:next name collision, ours is ahead), #1855 (ALREADY-HAVE,
  richer two-plugin manifest), #2002/#2036 (we commit dist; failure mode can't occur),
  #1143 (contradicts our ultracode-mode "signal not mechanism" finding; spike first).

The rest of v1.7.0 (ADR-1239 multi-runtime, portability AST rules, SLURM, Gemini sunset)
is out of scope for a Claude-only fork.

## Recommended next step

Tier 1 porting phase = the four clean picks (#2018, #1581, #1988, #1154+#1820) as one
small correctness release. Tier 2 (#1779, #1561) as follow-ups. Tier 3 deferred with
exact actions recorded in `.planning/upstream-deferred.md`.

## Fork-native follow-up surfaced (not an upstream port)

#2002's intent → extend `bin/build-bm.cjs --check` dist-parity guard to also assert
`bin/lib` and `sdk/dist` match a fresh build, guarding the mirror-image "stale committed
runtime" failure on marketplace installs.
