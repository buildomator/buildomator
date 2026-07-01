---
quick_id: 260701-gzj
status: complete
date: 2026-07-01
---

# Quick Task 260701-gzj — Summary

Cherry-picked the two worthwhile gsd-core 1.6.1 correctness fixes; deliberately
skipped the third (bad model id). Commit e93417c... err, code commit `1298162`.

## Shipped (commit 1298162)

- **#1580 — sentinel exclusion.** `roadmap analyze` now skips Phase 0 / Phase 999
  in the phase loop and the missing-details check, in BOTH resolvers
  (`sdk/src/query/roadmap.ts` + `bin/lib/roadmap.cjs`). The milestone-complete
  *guard* the upstream PR also touched does not exist in our code, so that half
  was a genuine no-op (not ported).
- **#1591 — checkbox phase detection.** The `phase.complete` isLastPhase fallback
  regex now matches heading, checkbox, and bold-checkbox forms
  (`- [ ] **Phase N: Name**`), so a later phase living only inside a
  `<details>`-wrapped checklist no longer triggers a false "Milestone complete".
  Ported to `sdk/src/query/phase-lifecycle.ts` + `bin/lib/phase.cjs` (only the
  fallback pattern; sibling patterns untouched).
- **Parity fix.** The SDK phase scan now skips `999.x` backlog dirs, matching the
  CJS which already did (closed a pre-existing CJS/SDK asymmetry).
- `sdk/dist` rebuilt (tsc + esbuild). New regression tests in
  `roadmap.test.ts` (sentinel) and `phase-lifecycle.test.ts` (#1591 bold-checkbox).

## Skipped (with cause)

- **#1847 — Sonnet -> `claude-sonnet-5`.** NOT a real released model (current
  Sonnet is `claude-sonnet-4-6`, verified against the claude-api catalog).
  Porting it would point our CJS+SDK resolvers at a nonexistent model and 404
  every Sonnet-profile spawn. Revisit only if `claude-sonnet-5` actually ships.

## Verified

- Full SDK unit suite: 1815 tests / 128 files, all pass (2 new).
- Functional smoke test: both resolvers exclude 999 from `roadmap.analyze`
  (phases, next_phase, missing-details).
- Regex proof: new pattern matches all four phase forms; old missed the
  checkbox/bold-checkbox ones.
- `sdk/dist/cli.js` confirmed to contain both fixes.
