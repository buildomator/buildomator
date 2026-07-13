---
phase: 15-buildomator-identity-and-communications
plan: 05
subsystem: branding
tags: [branding, human-verify, checkpoint, bm-build, prose]
requires:
  - phase: 15-buildomator-identity-and-communications
    provides: rebranded README (15-01), rebranded manifest/marketplace/CHANGELOG (15-02), fixed bm description (15-03), regenerated dist/bm (15-04)
provides: [human-signoff, corrected-migration-heading, dash-free-manifest-descriptions]
affects:
  - README.md
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - bin/build-bm.cjs
  - tests/build-bm-drift.test.cjs
  - dist/bm
tech-stack:
  added: []
  patterns:
    - "migration-section heading uses bare gsd (no colon) so the /gsd: -> /bm: rewrite leaves it correct in both packages"
decisions:
  - "Migration heading reworded from '## Migrating from /gsd:' to '## Migrating from gsd' so the transform stops producing the nonsensical '## Migrating from /bm:' in dist/bm"
  - "All user-facing manifest/marketplace descriptions use a colon instead of the ' -- ' em-dash substitute"
metrics:
  duration: "~10m"
  completed: 2026-07-13
requirements: [BRAND-01, BRAND-03]
---

# Phase 15 Plan 05: Human Prose Sign-off Summary

Final human-verification checkpoint for the Buildomator rebrand. A person read the
generated bm migration prose, the manifest descriptions, the rendered README, and the
four retirement sentences. The read surfaced one gate-clean defect (threat T-15-12),
which was corrected at source and the dist/bm package regenerated.

## What Was Verified

- **Rebranded source README** confirmed correct: H1 `Buildomator for Claude Code`,
  header logo wired to buildomator.com, `Plugin version: 4.1.0`, `/bm:` command
  examples, and a migration section that reads person-written (no em-dashes, no
  "canonical", no AI-marketing tells).
- **CHANGELOG [4.1.0]** confirmed: explains the rebrand, the additive `/bm:` +
  retained `/gsd:` strategy, and the v5.0 retirement on 2026-10-01.
- **Four retirement sentences** (CHANGELOG, README, marketplace.json, gsd-tools.cjs)
  confirmed consistent: all state v5.0 on 2026-10-01.

## Defect Found and Fixed (T-15-12)

The source README heading `## Migrating from /gsd:` was mechanically rewritten by the
`/gsd: -> /bm:` transform into `## Migrating from /bm:` in dist/bm/README.md — a
wrong-but-clean heading (you do not migrate from /bm: to /bm:) that the parity/census
gate cannot catch because it flags only leaked `/gsd:` tokens, not nonsensical prose.
This is the exact class the human-read checkpoint exists to catch.

Fix (applied to source, then dist/bm regenerated via `bin/build-bm.cjs`):
- `README.md`: heading reworded to `## Migrating from gsd`. Bare `gsd` (no colon) is
  not touched by the command-ref rewrite, so the heading now reads correctly in both
  the gsd README and the generated bm README.

While in the file, the ` -- ` em-dash substitute was removed from every user-facing
manifest description (per house style, user-facing copy avoids em-dashes and their
substitutes):
- `.claude-plugin/plugin.json` description → colon form.
- `bin/build-bm.cjs` `stampBmManifest` bm description → colon form.
- `tests/build-bm-drift.test.cjs` assertion updated to match the new bm description.
- `.claude-plugin/marketplace.json` metadata + bm-entry descriptions → colon form.

## Verification

- `node bin/build-bm.cjs && node bin/build-bm.cjs --check` → PASS (committed dist/bm
  is the byte-exact transform of source).
- `node tests/build-bm-drift.test.cjs` → all pass.
- `node tests/bm-parity.test.cjs` → skill/full inventory + fail-closed gsd-leak census
  + --check all pass.
- `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` → valid: bm@4.1.0.
- `node bin/maintenance/check-version-alignment.cjs` → 4.1.0 aligned.
- `node tests/version-alignment.test.cjs` → pass.
- `grep '^## Migrating' dist/bm/README.md` → `## Migrating from gsd`.
- bm manifest description confirmed dash-free.

## Deviations from Plan

The plan specified that any prose problem be routed back through plans 15-01/15-02 and
dist/bm regenerated via 15-04. Because the fix was surgical (one heading token plus the
em-dash substitutes) and the session was resuming this checkpoint directly, the source
edits were applied in place and dist/bm regenerated with the same `bin/build-bm.cjs`
path 15-04 uses, followed by the full 15-04 gate suite. The routing intent (fix at
source, regenerate, re-run every gate) was honored; the mechanics were inlined.

## Pre-existing Items Noted (Out of Scope)

Several ` -- ` ASCII double-hyphens remain in the README body/attribution lines and one
CHANGELOG `npx ... --` (a literal shell argument separator). These pre-date the rebrand
and are not the Unicode em/en-dashes house style bans; left untouched. Flagged for a
possible separate style pass.

## Threat Surface

Closes T-15-12 (wrong-but-clean migration prose reaching bm users) and T-15-13
(inconsistent retirement wording) via the human read. No new security surface.
