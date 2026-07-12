---
phase: 15-buildomator-identity-and-communications
plan: 01
subsystem: docs
tags: [readme, branding, buildomator, migration, bm-transform]

# Dependency graph
requires:
  - phase: 13-buildomator-plugin
    provides: bm byte-transform (build-bm.cjs) and /bm: command surface
  - phase: 14-backward-compatibility-and-coexistence
    provides: /gsd: -> /bm: deprecation nudge (date aligned elsewhere in this phase)
provides:
  - Rebranded README.md presenting the project as Buildomator
  - /bm: documented as the primary command surface in README source
  - "Migrating from /gsd:" section naming the 2026-10-01 v5.0 retirement
  - buildomator.com brand/docs links in README
  - Buildomator header logo asset (assets/buildomator-logo-big.png)
  - README Plugin version line bumped to 4.1.0
affects: [15-02, 15-03, 15-04, 15-05, marketplace, plugin.json, changelog, bm-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy A prose engineering: identity/retirement sentences use bare-word gsd (no colon) so the bm byte-transform leaves them correct in both packages"

key-files:
  created:
    - assets/buildomator-logo-big.png
  modified:
    - README.md

key-decisions:
  - "Command examples authored directly as /bm: in source (not relied on the byte-transform), per the plan transform_note and D-04"
  - "Migration/identity/retirement sentences written with bare-word gsd so they read correctly in both the gsd and bm packages (Strategy A)"
  - "Kept the /gsd- -> /gsd:<skill> namespace-rewrite descriptions and upstream pause-work references accurate rather than blindly flipping them to /bm:"

patterns-established:
  - "Transform-safe prose: bare-word gsd for identity sentences, literal /bm: only for runnable command examples"

requirements-completed: [BRAND-01, BRAND-02]

# Metrics
duration: ~20min
completed: 2026-07-12
---

# Phase 15 Plan 01: README Buildomator Rebrand Summary

**README.md rebranded to Buildomator: new header logo, Buildomator H1/intro, /bm: command examples throughout, a "Migrating from /gsd:" section naming the 2026-10-01 v5.0 retirement, buildomator.com links, and the Plugin version line bumped to 4.1.0.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-12
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Copied the Buildomator header logo from the read-only source into `assets/` and repointed the README header `<img>` (the source directory was never written to).
- Rebranded the H1 to "Buildomator for Claude Code", rewrote the intro to name Buildomator and drop AI-marketing tells, and bumped the stale `4.0.1` version line to `4.1.0`.
- Converted every runnable `/gsd:` command example in the README source to `/bm:` and added a person-written "Migrating from /gsd:" section that states the 1:1 mapping, the through-4.x coexistence, and the 2026-10-01 v5.0 retirement using transform-safe bare-word `gsd`.
- Wired `https://buildomator.com` into the header logo link and an intro docs line.

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy logo + swap README header image** - `0cc226a` (feat)
2. **Task 2: Rebrand H1, intro, and Plugin version line** - `e72258b` (feat)
3. **Task 3: /bm: command examples, migration section, buildomator.com links** - `91bebd8` (feat)

## Files Created/Modified
- `assets/buildomator-logo-big.png` - Buildomator header logo (2466x1470), copied byte-for-byte from the read-only source.
- `README.md` - Full Buildomator rebrand of brand-name prose and command examples; new migration section; buildomator.com links; version line 4.1.0.

## Decisions Made
- **Command examples authored as literal `/bm:`** in the source, per the plan's transform_note and D-04, rather than depending on the bm byte-transform to flip `/gsd:` examples. The authored README itself now documents `/bm:` as primary.
- **Bare-word `gsd` for identity/retirement sentences** (Strategy A). The migration section body contains no `gsd:`-with-colon token, so the byte-transform leaves it correct in the generated bm package. Only the section heading `## Migrating from /gsd:` carries a colon (flips to `/bm:` in bm, which is acceptable and covered by the plan 15-05 human read).
- **Preserved factual accuracy of non-example references.** The blunt `/gsd:` -> `/bm:` sweep initially over-converted three `/gsd:<skill>` namespace-form illustrations (functional descriptions of the `rewrite-command-namespace.cjs` colon-namespace behavior) and two references to upstream GSD's `pause-work`. These were corrected: the `<skill>` illustrations were restored to `/gsd:<skill>` (accurate, and outside the verify's `/gsd:[a-z]` pattern), and the two upstream references were reworded to the bare command name `pause-work` (bm is not upstream). Functional identifiers (`gsd-sdk`, `gsd-plugin`, cache paths, filenames) were left untouched per D-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a stray em-dash on the /bm:version note (CLAUDE.md compliance)**
- **Found during:** Task 3 (command-example conversion)
- **Issue:** Line 110 (a "What's New" bullet I was already editing to convert `/gsd:version` -> `/bm:version`) contained an em-dash, which violates the global no-em-dash rule.
- **Fix:** Replaced the em-dash with a comma on that line.
- **Files modified:** README.md
- **Verification:** `grep -nP '[\x{2014}\x{2013}]' README.md` returns no matches.
- **Committed in:** `91bebd8` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 CLAUDE.md-compliance bug on a line already being edited).
**Impact on plan:** Minimal. The fix was on a line already in scope for the /bm: conversion. No scope creep.

## Issues Encountered
- A one-shot `sed 's|/gsd:|/bm:|'` sweep is too blunt: it flips functional namespace-form illustrations and upstream references that should stay accurate. Resolved by restricting the sweep to `/gsd:[a-z<]` and then hand-correcting the three namespace illustrations and two upstream `pause-work` references (see Decisions). The plan's strict verify (`/gsd:[a-z]` must be absent outside the migration section) still passes.

## Verification Results
- Plan verify (all three tasks) passes: H1 == "# Buildomator for Claude Code"; version line `4.1.0`; header src == `assets/buildomator-logo-big.png` (old `gsd-plugin-logo.png` src gone); "## Migrating from /gsd:" present with `2026-10-01`; at least one `/bm:` example; no `/gsd:[a-z]` outside the migration section; `buildomator.com` links present.
- No em-dashes/en-dashes, no "canonical" anywhere in README.
- open-gsd/get-shit-done-redux provenance link retained; functional identifiers unchanged.
- Read-only source `/Users/jnuyens/src/buildomator.com/buildomator-logo-big.png` unmodified (mtime unchanged).
- Migration section body is transform-safe (no `gsd:`-with-colon token).

## Notes for Downstream Plans
- The README is gsd SOURCE that flows through `bin/build-bm.cjs`. `dist/bm/` is now STALE relative to these README edits and must be regenerated (`node bin/build-bm.cjs`) and re-committed by the plan that owns the transform/version work (15-03 per RESEARCH). A human read of `dist/bm/README.md` (migration section) is the required semantic gate (plan 15-05).
- `plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, and the Phase 14 nudge date string are out of scope for this plan (owned by other plans in the phase).

## Next Phase Readiness
- README half of BRAND-01 (Buildomator identity, /bm: documented) and BRAND-02 (buildomator.com in README links) delivered.
- Ready for the metadata/manifest and CHANGELOG plans, plus the dist/bm regeneration and the bm-parity/semantic gates.

## Self-Check: PASSED

- FOUND: assets/buildomator-logo-big.png
- FOUND: .planning/phases/15-buildomator-identity-and-communications/15-01-SUMMARY.md
- FOUND commits: 0cc226a, e72258b, 91bebd8, 84df92a

---
*Phase: 15-buildomator-identity-and-communications*
*Completed: 2026-07-12*
