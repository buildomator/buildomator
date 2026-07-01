---
quick_id: 260701-gbo
status: complete
date: 2026-07-01
---

# Quick Task 260701-gbo — Summary

Three parallel upstream follow-ups off "check upstream". Details in
`260701-gbo-FINDINGS.md`.

## Shipped

- **VibeDrift watcher fix** (code, commit 1b3dbd7): robust npm resolution in
  `bin/check-vibedrift-release.sh` — the hardcoded `/usr/bin/npm` (absent on
  Homebrew macOS) had frozen the watcher at 0.14.4. Verified; propagated to the
  cron checkout; next `:23` run emails the 0.14.4->0.14.8 catch-up.

## Findings (no code)

- **gsd-core 1.6.1:** two clean ADOPT cherry-picks — #1580 (Phase 0/999 sentinel
  exclusion) and #1591 (checkbox/`<details>` phase-complete detection, hits our
  discoverability gotcha). #1847 (`claude-sonnet-5`) = ADAPT but VERIFY the model
  id is real first. No #1520 companion. Optional small slice; doesn't block v4.1.
- **gsd-core 1.7.0-rc.1:** mostly multi-runtime (ADR-1239) + portability = SKIP.
  Watch ADR-1769 STATE.md refactor vs our #9. A few correctness/UX wins
  (verifier-abstain, assumption-delta, checkbox-list) to grab when 1.7 is stable.

## Open follow-ups (surfaced, not done)

- Reconcile the stale cron checkout (`/Users/jnuyens/claude-code-gsd/`) vs this
  repo — all three watchers run from the old copy.
- Latent: both watchers wedge if the SSH mail send fails (version file advances
  only after mail). npm fix removed the current cause; mail-wedge remains.
- Optional: cherry-pick gsd-core 1.6.1 #1580 + #1591.
