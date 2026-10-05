# Phase 16 plan-check notes (2026-10-05)

Verdict: PASSED. 0 blockers, 3 non-blocking warnings. The checker verified every
interface claim against the live repo (setConfigValue not yet exported,
loadTrustedGlobalRoots/resolveWithinBase module-private, cited lines/signatures real,
no phantom APIs).

## Carry-forward to Phase 17 (hard prerequisites)

- **W1 Cross-twin round-trip test.** Both twins independently implement the 19-key pin
  record and the `agent_skills.<agent>` write, but only read-only ops (list/assess) get a
  CLI-level cross-twin parity check in 16-05. Phase 17 MUST add a stateful round-trip test:
  insert via `gsd-tools.cjs craft-skill insert`, release via `bm-sdk query
  craft-skill.release` (and the reverse), asserting state consistency. The stateful path
  is exercised end-to-end once Phase 17 wires insertion into workflows, so the test lands
  there.
- **W2 `--approved` human gate.** Phase 16 ships the mechanism (approval remembered per
  id+pin; block verdicts refuse unconditionally) but nothing here stops an autonomous
  caller passing `--approved` directly (disclosed in threat model T-16-15). Phase 17 MUST
  wire `--approved` behind a real human confirmation step in the propose-on-fit workflow,
  as a hard requirement, not an afterthought.

## Execution note (W3)

A few tasks (16-01 T1, 16-03 T1/T3, 16-04 T1/T3) are information-dense (15-20+ structural
rules in one action). Within thresholds, so no pre-split. If any single plan fails
verification during execution, split that task rather than re-running the whole plan.
