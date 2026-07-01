---
quick_id: 260701-wxe
status: complete
date: 2026-07-01
---

# Quick Task 260701-wxe — Summary

Re-enable the Claude Fable 5 tier through its redeploy free-usage window, shipped to all users as 4.0.4.

## What changed
- Verified live (WebFetch): Claude Fable 5 was **redeployed 2026-07-01**, included in plan usage only **through 2026-07-07** (usage-credit-gated after). See [[feedback_verify_model_ids_live]].
- Bumped `FABLE_SUNSET_DATE` `2026-06-12` -> `2026-07-07` in BOTH resolvers: `bin/lib/core.cjs` (CJS) + `sdk/src/query/config-query.ts` (SDK), rebuilt `sdk/dist`.
- Effect: quality-profile heaviest agents resolve to `claude-fable-5` again through 2026-07-07, then auto-downgrade to `opus` on 2026-07-08. No manual revert; the per-project `fable` knob (`fable.mode`/`fable.until`) still overrides.
- Updated `tests/fable-sunset.test.cjs` (cutoff constant + date model + CJS/SDK parity guard) to the new window.

## Verification
- `fableAvailable(now)` = true today; `applyFableSunset('fable')` = `fable` (not downgraded).
- fable-sunset + fable-tier tests green; node CJS suite 38/38; SDK config-query 24/24; full SDK unit suite green; verify drift/conventions + version-alignment + mktemp guards pass.

## Released
4.0.4 (both manifests + CHANGELOG), tag v4.0.4.
