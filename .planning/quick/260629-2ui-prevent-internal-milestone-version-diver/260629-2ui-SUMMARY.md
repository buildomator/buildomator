---
quick_id: 260629-2ui
status: complete
date: 2026-06-29
---

# Quick Task 260629-2ui — Summary

Added a durable guardrail preventing the internal milestone version from
diverging from the actual product version.

## Shipped

- `bin/maintenance/check-version-alignment.cjs` (new) — version-alignment
  detector. Milestone major must equal plugin major (current line) or plugin
  major + 1 (next major in progress); also asserts plugin.json/marketplace.json
  parity. SKIPs gracefully with no manifest/milestone (general). Override via
  `VERSION_ALIGNMENT_ALLOW=1` / `.version-alignment-allow`.
- `tests/version-alignment.test.cjs` (new) — 10 zero-dep unit checks.
- `bin/maintenance/check-drift.cjs` (mod) — registered as the 4th detector;
  hardcoded "3" counts made count-driven.
- `.github/workflows/check-drift.yml` (mod) — new `version-alignment` CI job
  (runs the unit test + the detector).

## Verified

- Unit test: all pass.
- Detector on live repo: PASS (milestone v4.1 ↔ plugin 4.0.1).
- Divergent scenario (v1.3 vs 4.0.1): exits 1 with remediation message.

## Notes

- All four touched files are plugin-native (not synced from upstream), so no
  upstream-sync patch-inventory entry is needed.
- Scope was kept to the detection guard. An optional future follow-up: have
  `new-milestone` Step 3 suggest the next milestone version from the product
  manifest at the source (adds upstream-sync burden; the CI guard already
  catches divergence loudly).
