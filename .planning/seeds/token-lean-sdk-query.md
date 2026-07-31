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

   STEP 1 (minify default output) SHIPPED in v4.5.0 (quick 260729-09s): ~15-20%
   byte cut on these bundles, no field loss.

   STEP 2 (field-projection) RE-SCOPED DOWN 2026-07-31: the original "could halve
   the init.* bundles" estimate was WRONG - it was measured in a source checkout
   where `agents_installed:false` made `missing_agents` list all 33 agent names
   (682 bytes, 38% of the bundle). Measured via the INSTALLED plugin,
   `missing_agents` is `[]` and `init.execute-phase` is 1,099 bytes (not 1,781).
   In steady state the bundle is mostly used fields; the genuinely-unused ones are
   small (`project_title`, `*_path`, branch templates, milestone metadata) ~= 15-20%,
   each still needing a full cross-consumer audit (workflows + executor/verifier
   agents + the init handler's own logic - e.g. `missing_agents` is load-bearing
   for the agents-not-installed advisory even though execute-phase.md never greps
   it). So step 2 is MARGINAL: ~15-20% more at real audit + breakage risk. Lean
   PARK unless token pressure is acute; if pursued, caller-driven `--fields` on
   `init.execute-phase` first as a measured pilot. Do NOT chase `missing_agents` -
   it is only fat in the transient agents-not-installed error path.

OUT OF SCOPE (mutations/actions, no output to shrink - neither compact nor RTK
helps): `commit` (218), `worktree.cleanup-wave` (87),
`roadmap.update-plan-progress` (64), `state.begin-phase`/`record-session` (67).
So ~half of the 1,681 is addressable natively; the other half is writes.

Must land in BOTH resolver twins (bin/lib CJS + sdk/src SDK) and stay
byte-identical where golden/parity-covered; regen dist/bm + `--check`.

The per-`<namespace>.<key>` distribution that scopes this arrived (ogaude, #27,
2026-07-26) and is baked into the target set above, so the work is no longer
blocked on data.

Why a seed not a todo: it is worth doing but not urgent; ship when a release
cycle has room. The native path is the better DEFAULT (helps every caller, no
dependency, no breakage) and also makes any RTK handler easier by keeping the
output stable and already-lean.

## Partial / companion RTK (analysis, 2026-07-27)

Question raised: is a "partial RTK integration" a middle path between the
no-bundle decision and the native work above? Grounded answer, from the prior
spikes (quick 260418-s52 analysis + 260418-s8i A/B):

- **There is no safe GSD-side "partial."** RTK is a global PreToolUse hook that
  rewrites bash (`git`/`grep`/`find`/...) across the whole session; it is not a
  library GSD calls. GSD cannot switch it on for "just `bm-sdk query`" - once on,
  it rewrites the `grep`/`find` our own agents run, which is exactly what broke
  `gsd-code-reviewer` and the `find` pipelines in s8i. Any GSD-side enablement IS
  the full-bundle breakage. So the no-bundle decision stands; do NOT bundle or
  enable RTK, even "partially," from GSD.
- **The viable "partial" is an opt-in companion recipe living in the USER's rtk
  config, not ours** - two pieces, neither a GSD dependency:
  1. RTK-side handler for `bm-sdk query` (ogaude's proposed upstream PR); that is
     where the ~1,419-call savings come from. GSD's only job: keep the query
     output stable/deterministic (already JSON) so the handler is reliable.
  2. A documented rtk scoping that EXCLUDES the command shapes that broke s8i
     (the code-reviewer's `grep`/`find`), so rtk optimizes the query surface and
     leaves the agents alone.
- GSD's contribution is docs + a stable query surface, zero dependency, zero
  enablement. Lower leverage than the native compact/cache (rtk-users-only, and
  mostly RTK-side work). Document it only once ogaude actually ships the handler,
  not before. Priority: native first, companion recipe second.

Rename status (decided 2026-07-26, quick 260726-5tt): the `gsd-sdk` -> `bm-sdk`
rename SHIPPED additively in the 4.x line (bm-sdk primary + gsd-sdk working
alias + all internal call sites rewritten). Only the ALIAS REMOVAL is deferred
to v5.0 on 2026-10-01, per the `/gsd:` -> `/bm:` retirement. The compact/cache
work here is independent and no longer coupled to the rename.

Context: issue #27 (RTK companion, no-bundle stance holds);
[[minimize-gsd-plumbing-interactions]].
