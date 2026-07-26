---
title: Token-lean gsd-sdk query (compact output + per-session cache for deterministic reads)
trigger_condition: when scoping the v5.0 cutover, or when the per-namespace.key query split from issue #27 arrives
planted_date: 2026-07-26
---

# Token-lean sdk query

`gsd-sdk query` is by far the most-run BM command: 1,419 calls / 30d in ogaude's
`rtk discover` data (issue #27), all state/plan lookups of the form
`query <namespace>.<key> "<id>"`. Everything else in their top-20 is RTK's own
alias-bypass instrumentation (`\grep`, `command git`, `rev-parse`,
`symbolic-ref`, `merge-base`), not BM overhead. Verified: our PostToolUse hooks
are node scripts and do not shell git per tool call, so the query path is the
only real lever on our side.

Two pieces, both native (no RTK dependency, helps every caller). Target set is
now CONCRETE, from ogaude's per-namespace.key `rtk discover` data on #27
(1,681 queries / 30d, comment 2026-07-26):

1. **Short-lived per-session cache** for the deterministic reads that re-query
   identical inputs: `config-get` (284, 16.9% - the single biggest), `agent-skills`
   (161), `resolve-model` (24). ~470 calls (~28%) largely served from cache after
   the first call.
2. **Compact / field-projected output** for the large read payloads that must be
   read fresh: `init.*` (276 - `init.plan-phase` 88, `init.quick` 62,
   `init.execute-phase` 55, `init.phase-op` 48; the biggest token bundles),
   `roadmap.get-phase` (75), `state.load` (19).

OUT OF SCOPE (mutations/actions, no output to shrink - neither compact nor RTK
helps): `commit` (218), `worktree.cleanup-wave` (87),
`roadmap.update-plan-progress` (64), `state.begin-phase`/`record-session` (67).
So ~half of the 1,681 is addressable natively; the other half is writes.

Must land in BOTH resolver twins (bin/lib CJS + sdk/src SDK) and stay
byte-identical where golden/parity-covered; regen dist/bm + `--check`.

To size it we want the per-`<namespace>.<key>` distribution inside the 1,419
(requested from ogaude on #27) so the compact/cache work targets the actual hot
readers, not guesses.

Why a seed not a todo: the per-namespace.key split from ogaude is still needed
to target the compact/cache work; ship it once that data lands.

Rename status (decided 2026-07-26, quick 260726-5tt): the `gsd-sdk` -> `bm-sdk`
rename SHIPPED additively in the 4.x line (bm-sdk primary + gsd-sdk working
alias + all internal call sites rewritten). Only the ALIAS REMOVAL is deferred
to v5.0 on 2026-10-01, per the `/gsd:` -> `/bm:` retirement. The compact/cache
work here is independent and no longer coupled to the rename.

Context: issue #27 (RTK companion, no-bundle stance holds);
[[minimize-gsd-plumbing-interactions]].
