---
phase: 15-buildomator-identity-and-communications
plan: 02
subsystem: manifest-and-communications
tags: [rebrand, buildomator, changelog, marketplace]
requires:
  - Phase 13 bm marketplace entry + displayName
  - Phase 14 deprecation nudge mechanism
provides:
  - Buildomator-worded plugin.json (v4.1.0, buildomator.com links)
  - Buildomator marketplace catalog blurb + primary bm entry + legacy gsd entry
  - CHANGELOG [4.1.0] rebrand + migration entry
  - deprecation nudge string naming 2026-10-01
affects:
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - CHANGELOG.md
  - bin/gsd-tools.cjs
tech-stack:
  added: []
  patterns:
    - Keep a Changelog with gsd-core provenance line per entry
    - marketplace two-entry presentation (primary bm, legacy gsd)
key-files:
  created: []
  modified:
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - CHANGELOG.md
    - bin/gsd-tools.cjs
decisions:
  - D-01 retirement date 2026-10-01 stated in CHANGELOG + marketplace legacy entry + nudge string
  - D-02 homepage + repository point at buildomator.com in plugin.json and both marketplace entries
  - D-03 source fields left unchanged (./ and ./dist/bm)
  - D-07 bm entry is primary (use /bm:)
  - D-08 gsd entry is legacy alias, displayName "Buildomator (legacy /gsd:)"
  - D-09 gsd plugin.json description flips to Buildomator-worded, name gsd + gsd keyword kept
  - D-11 version bumped to 4.1.0
metrics:
  duration: ~2min
  completed: 2026-07-12
---

# Phase 15 Plan 02: Buildomator Manifest and Communications Summary

Rebranded the plugin manifest, marketplace catalog, and CHANGELOG to Buildomator at 4.1.0 with buildomator.com links, and aligned the deprecation nudge to the 2026-10-01 retirement date.

## What Was Built

**Task 1 -- plugin.json (commit 0608312):** Description now names Buildomator and describes the plugin plainly (planning, execution, verification, MCP-backed project state). Added a `homepage` field and set both `homepage` and `repository` to `https://buildomator.com`. Bumped `version` to `4.1.0`. Kept `name: "gsd"` and the `gsd` keyword for machine identity and discoverability. author/license/mcpServers untouched.

**Task 2 -- marketplace.json (commit 697101b):** Rewrote the top-level `metadata.description` to name Buildomator. The `bm` entry leads as primary ("use /bm:", "the plugin to install") with `displayName: "Buildomator"`. The `gsd` entry is now the legacy alias: `displayName: "Buildomator (legacy /gsd:)"`, description explains it is the same Buildomator plugin under the original `/gsd:` prefix, working through the whole 4.x line and retiring at v5.0 on 2026-10-01, with new users pointed at Buildomator. Both entries: `version` 4.1.0, `homepage`/`repository` at buildomator.com. `source` fields (`./`, `./dist/bm`) left unchanged per D-03.

**Task 3 -- CHANGELOG.md + nudge (commit 1a156ef):** Promoted the empty `[Unreleased]` to `## [4.1.0] - 2026-07-12` (empty `[Unreleased]` kept above it). The entry explains the rebrand, the additive strategy (`/bm:` added while `/gsd:` is fully retained through 4.x with no re-enable and no disruption), and states `/gsd:` retires at v5.0 on 2026-10-01. Carries a gsd-core provenance line matching prior entries. In `bin/gsd-tools.cjs` the nudge string retirement clause now reads "...retires at v5.0 on 2026-10-01." (string only; the `hookIdentity === 'gsd'` guard and the BM-NUDGE-START/END sentinels are unchanged).

## Verification

- plugin.json: node require passes; name gsd, version 4.1.0, homepage/repository buildomator.com, description contains Buildomator, gsd keyword kept, no dashes/"canonical".
- marketplace.json: node require passes; metadata + both entries name Buildomator; versions 4.1.0; links buildomator.com; displayNames correct; sources unchanged; gsd description names 2026-10-01; no dashes/"canonical".
- CHANGELOG + nudge: `## [4.1.0]` present, 2026-10-01 present, nudge string names 2026-10-01, BM-NUDGE sentinels intact, `node -c bin/gsd-tools.cjs` parses; new CHANGELOG prose has no dashes/"canonical".

## Deviations from Plan

None - plan executed exactly as written.

## Notes for Downstream

- The bm-package build transform (`bin/build-bm.cjs`) and its drift/parity gate are validated in plan 15-04, not here. Per the plan's transform_note, plugin.json's source description is overwritten by `stampBmManifest` (fixed in plan 15-03), so the Buildomator-worded gsd description with `/gsd:` context does not leak into the bm package. `syncMarketplaceVersions` (plan 15-04) rewrites both entries' `version` from plugin.json, so 4.1.0 here is consistent.
- README rebrand + logo asset (BRAND-01 README half, D-04/D-05/D-06) are handled by the sibling wave plan, not this one.

## Self-Check: PASSED

- FOUND: .claude-plugin/plugin.json (modified, valid JSON, 4.1.0)
- FOUND: .claude-plugin/marketplace.json (modified, valid JSON, both entries 4.1.0)
- FOUND: CHANGELOG.md ([4.1.0] entry present)
- FOUND: bin/gsd-tools.cjs (nudge date aligned, parses)
- FOUND commit 0608312 (Task 1)
- FOUND commit 697101b (Task 2)
- FOUND commit 1a156ef (Task 3)
