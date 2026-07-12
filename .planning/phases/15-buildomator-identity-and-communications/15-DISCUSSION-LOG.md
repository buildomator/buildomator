# Phase 15: Buildomator Identity and Communications - Discussion Log

> **Audit trail only.** Not consumed by planning, research, or execution agents.
> Decisions live in CONTEXT.md — this log preserves how they were reached.

**Date:** 2026-07-12
**Phase:** 15-buildomator-identity-and-communications
**Mode:** discuss (default)
**Areas discussed:** all 4 selected

## Area selection

Presented 4 gray areas; user selected all four and added the fact that
**buildomator.com is a separate repo** (so this phase only links to it, does not build it).

## Area 1 — /gsd: retirement commitment

- Options presented: version-boundary + soft floor (recommended) / hard calendar date /
  version-boundary only.
- User decision: **hard calendar date, 2026-10-01** (via free-text note).
- Result: D-01. Date stated identically in CHANGELOG, README migration section, marketplace
  legacy entry, and the Phase 14 nudge string.

## Area 2 — buildomator.com wiring

- Options presented: homepage=buildomator.com / repo=GitHub (recommended) / everything to
  buildomator.com / README links only.
- User decision: **everything to buildomator.com** (homepage AND repository fields).
- Result: D-02, D-03. Marketplace `source` fields kept unchanged (functional install paths);
  repo/cache id stays gsd-plugin; the VCS-URL-vs-brand-domain tradeoff on `repository` accepted.

## Area 3 — README primary-surface framing

- Options presented: full rebrand /bm: primary (recommended) / brand headline keep /gsd: /
  full rebrand + new logo asset.
- User decision: **full rebrand + new logo asset**.
- Follow-up (logo source): user pointed to `/Users/jnuyens/src/buildomator.com` (read-only).
- Result: D-04, D-05, D-06. Copy a logo from the website repo into `assets/`; keep functional
  identifiers unchanged.

## Area 4 — two-plugin naming clarity

- Options presented: bm=primary / gsd=legacy alias (recommended) / both just "Buildomator" /
  leave gsd entry gsd-worded.
- User decision: **bm=primary, gsd=legacy alias** ("Buildomator (legacy /gsd:)").
- Result: D-07, D-08, D-09. Both descriptions say Buildomator; gsd plugin.json description also
  flips; `name: "gsd"` and the gsd keyword retained.

## Deferred ideas surfaced

- Authored-identity flip and `/gsd:` removal — v5.0.
- buildomator.com site build — separate repo, out of scope.

## Claude's discretion recorded

- Exact logo file + header width; README H1 wording/ordering; exact CHANGELOG + marketplace prose.
