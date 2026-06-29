---
quick_id: 260629-rrr
status: complete
date: 2026-06-29
---

# Quick Task 260629-rrr — Summary

Ported gsd-core 1.6 #1520: fixed the BSD/macOS mktemp suffix collision.

## Shipped (commit e93417c)

- 5 callsites moved X's to the end (dropped cosmetic `.json`/`.md`):
  `workflows/execute-phase.md` (wave manifest), `workflows/quick.md` (quick
  worktree manifest), `workflows/ship.md` (PR body), `workflows/profile-user.md`
  (answers + analysis). All temp files are referenced by variable, so no
  consumer depended on the extension (verified by grep before editing).
- `tests/mktemp-portable.test.cjs` (new) — regression guard scanning workflows/
  + bin/ for a suffix after trailing X's; self-tests the detector both ways.
- `.github/workflows/check-drift.yml` — guard added to the `drift-detectors` job.

## Verified

- Empirical root cause: `mktemp /tmp/x-XXXXXX.json` on this macOS returned the
  path with `XXXXXX` literal (collision); `-XXXXXX` (no suffix) expands correctly.
- Test passes; deliberate re-break exits 1; no suffixed mktemp remains.

## Notes

- These are upstream-synced workflow files, but this mirrors upstream's own
  #1520 fix, so a future gsd-core sync converges rather than conflicts.
- Remaining 1.6 candidates (verify-then-pick): #1572 must_haves preservation,
  #1445/#1532/#1534 bundle. #1369 wave-base mostly already present. See survey
  260629-rcy.
