---
quick_id: 260703-2zr
status: complete
date: 2026-07-03
---

# Quick Task 260703-2zr — Summary

Discoverability fix: surface `/gsd:scan --drift` (and other hidden flags) in autocomplete.

## Problem
`/gsd:scan --drift` is fully implemented in `workflows/scan.md` (drift-scan mode, `--top N`, `--fail-on-score N`, mutually exclusive with `--focus`) but was invisible: the `scan` SKILL.md had **no `argument-hint`** at all, so autocomplete showed nothing, and its description mentioned only `--focus`.

## Fix (commit f00ac99)
Added `argument-hint` frontmatter to four arg-taking skills that were missing it, and mentioned `--drift` in scan's description:
- **scan**: `[--focus tech|arch|quality|concerns|tech+arch] | --drift [--top N] [--fail-on-score N]` + `--drift` added to the description line.
- **explore**: `[topic]`
- **workstreams**: `[list|create|switch|status|progress|complete|resume] [args]`
- **next**: `[--force]`

Audited all 23 hint-less skills; the rest genuinely take no user-facing args (help, next-no-args cases, version, stats, etc.). Skipped `review-backlog` (interactive, no positional arg) and `reapply-patches` (`--config-dir` is an internal env override, not a slash arg) as borderline.

No workflow logic changed. Discoverability only.

## Verification
node CJS suite 38/38, `verify conventions` exit 0, `verify drift` exit 0, all four frontmatters parse, no em-dashes introduced.
