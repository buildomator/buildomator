---
quick_id: 260629-rrr
title: Fix BSD/macOS mktemp suffix collision (gsd-core 1.6 #1520)
area: workflows/ci
date: 2026-06-29
---

# Quick Task 260629-rrr

## Problem

macOS `/usr/bin/mktemp` only expands the trailing run of `X`s when they are the
last characters of the template. Our workflows use `mktemp ...-XXXXXX.json|.md`
(suffix after the X's), so on macOS the X's stay literal → concurrent callers
collide on a single path. Empirically confirmed in survey 260629-rcy (gsd-core
1.6 #1520). 5 callsites; 2 are parallel-wave worktree manifests.

## Solution

Move the X's to the end (drop the cosmetic extension) at all 5 callsites; the
temp files are referenced by variable, never by extension. Add a regression
guard + wire into CI.

### Tasks

1. Fix 5 callsites: `execute-phase.md`, `quick.md`, `ship.md`,
   `profile-user.md` (x2).
2. `tests/mktemp-portable.test.cjs` — scans workflows/ + bin/ for a suffix after
   trailing X's; fails if any reappear. Wired into the `drift-detectors` CI job.

## Verification

- `node tests/mktemp-portable.test.cjs` → pass; deliberate re-break → exit 1.
- `grep mktemp ...XXXXXX.ext` over repo → none remaining.
