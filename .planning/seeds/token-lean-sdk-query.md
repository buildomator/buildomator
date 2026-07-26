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

Two pieces, both native (no RTK dependency, helps every caller):

1. **Compact / field-projected output** on `gsd-sdk query`: drop pretty-printing
   and unused fields for the hot readers. Static call-sites point at the likely
   heaviest: `config-get`, `commit`, `init.phase-op`, `roadmap.get-phase`,
   `resolve-model`, `state.load`.
2. **Short-lived per-session cache** for the deterministic reads (`config-get`,
   `resolve-model`) that re-query identical inputs many times per session.

Must land in BOTH resolver twins (bin/lib CJS + sdk/src SDK) and stay
byte-identical where golden/parity-covered; regen dist/bm + `--check`.

To size it we want the per-`<namespace>.<key>` distribution inside the 1,419
(requested from ogaude on #27) so the compact/cache work targets the actual hot
readers, not guesses.

Why a seed not a todo: pair it with the `gsd-sdk` -> `bm-sdk` rename (aliased,
`gsd-sdk` kept working, drop at v5.0 on 2026-10-01, per the `/gsd:` -> `/bm:`
retirement). Both touch the same command surface, so doing them together at the
v5.0 boundary is one migration instead of two. Don't ship as a 4.x point release.

Context: issue #27 (RTK companion, no-bundle stance holds);
[[minimize-gsd-plumbing-interactions]].
