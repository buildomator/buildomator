---
phase: 19-decision-reconciliation-guard
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - .github/workflows/check-drift.yml
  - bin/gsd-tools.cjs
  - bin/lib/command-aliases.generated.cjs
  - bin/lib/config-schema.cjs
  - bin/lib/reconcile.cjs
  - bin/lib/state.cjs
  - hooks/gsd-reconcile-sweep.js
  - hooks/hooks.json
  - references/decision-reconciliation.md
  - sdk/src/query/check-decision-coverage.ts
  - sdk/src/query/command-aliases.generated.ts
  - sdk/src/query/command-manifest.non-family.ts
  - sdk/src/query/command-static-catalog-foundation.ts
  - sdk/src/query/config-schema.ts
  - sdk/src/query/reconcile.test.ts
  - sdk/src/query/reconcile.ts
  - sdk/src/query/state-mutation.reconcile.test.ts
  - sdk/src/query/state-mutation.ts
  - skills/reconcile/SKILL.md
  - tests/reconcile-capture-parity.test.cjs
  - tests/reconcile-sdk-parity.test.cjs
  - workflows/execute-plan.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The Decision Reconciliation Guard ships a mechanical retrieval/ledger/pending engine
(`reconcile.ts` / `reconcile.cjs`) plus a capture-time directive wired into
`state.add-decision`, a SessionStart sweep hook, an on-demand `/reconcile` skill, the
agent-procedure reference, config keys, alias/manifest wiring, and CI.

The two reconcile twins (`sdk/src/query/reconcile.ts` and `bin/lib/reconcile.cjs`) were
compared function by function and are **behaviorally identical**: same normalization, hash,
stemming, candidate retrieval, safety gate, ledger/pending semantics, and output key order.
No divergence in the reconcile engine itself. The engine is read/data-only (no shell, no eval,
decision and rule text used only for matching/hashing), so no injection surface was found.

The defects below are in the surfaces that consume the engine, not the engine core. The most
substantive is that the pending record drops the safety-gate verdict (`autoRewritable` /
`surfaceReason`), so the drain path (`/reconcile` skill and session-start sweep) cannot tell a
surface-only candidate from a rewritable one using the pending record alone. Two further
warnings cover a twin divergence on the no-Decisions-section path that the new parity test does
not exercise, and an inaccurate coexistence claim in the hooks.json description.

## Warnings

### WR-01: Pending record drops the safety-gate verdict, weakening the drain path

**File:** `bin/lib/reconcile.cjs:258-268` and `sdk/src/query/reconcile.ts:290-300` (and `skills/reconcile/SKILL.md:14-20`)
**Issue:** `reconcilePending` stores each candidate as `{ file, ruleText }` only — it drops
`autoRewritable` and `surfaceReason` that `findCandidates` computed:

```js
candidates: findCandidates(cwd, d).map((c) => ({ file: c.file, ruleText: c.ruleText })),
```

The `/reconcile` skill drains `.planning/reconcile-pending.json` and, per its process, judges
each entry and proposes a rewrite. It never re-runs `reconcile.candidates <hash>`, so from the
pending record alone it cannot know a candidate was marked surface-only
(`autoRewritable: false`) because the rule sits in an `@`-include line or inside an
auto-managed do-not-edit block. The reference (`references/decision-reconciliation.md:36-38`)
and the skill step 6 both say surface-only rules must be reported and never edited, but the skill
can only apply the weaker file-name check (`CLAUDE.md`/`PROJECT.md`), which still passes for an
`@`-include or managed-block line inside those two files. The human confirm in the skill is the
only remaining backstop, so this is a safety-gate degradation rather than silent data loss.
**Fix:** carry the verdict into the pending record and have the skill honor it, e.g. store
`candidates: findCandidates(...).map((c) => ({ file: c.file, ruleText: c.ruleText, autoRewritable: c.autoRewritable, surfaceReason: c.surfaceReason }))` in both twins (keep them byte-identical and update the two parity fixtures), then in `SKILL.md` step 6 skip any candidate with `autoRewritable: false`. Alternatively, instruct the skill to call `reconcile.candidates <hash>` per entry before proposing a rewrite.

### WR-02: add-decision twins diverge when STATE.md has no Decisions section; new parity test does not cover it

**File:** `bin/lib/state.cjs:482-515` vs `sdk/src/query/state-mutation.ts:873-892`
**Issue:** The reconcile directive now rides on `state.add-decision`, but the two add-decision
twins behave differently when STATE.md has no `## Decisions` section:
- CJS (`cmdStateAddDecision`) DWIM-creates the section, sets `created: true`, and always reaches
  the reconcile attach, so `added: true` plus a possible `reconcile` field.
- SDK (`stateAddDecision`) has no DWIM branch: it returns `{ added: false, reason: 'Decisions section not found in STATE.md' }` and never computes a reconcile directive.

`tests/reconcile-capture-parity.test.cjs` asserts the twins are field-identical, but both of its
fixtures (`enrolment-clear`, `no-candidate`) already contain a Decisions section, so the
divergence — and the CJS-only `created` field — is never exercised. The DWIM gap predates this
phase, but the new capture-time reconcile path and the "twins are field-identical" parity test
make it newly relevant: on a section-less STATE.md the capture-time reconcile feature silently
fires in CJS and does nothing in the SDK.
**Fix:** either add the DWIM auto-create branch to `stateAddDecision` (mirroring CJS, including
the `created` field and the post-create reconcile attach) so the twins match, or add a
section-less fixture to the capture-parity test and reconcile whichever behavior is intended.
Prefer making the SDK match CJS so the committed `sdk/dist/cli.js` and the CJS twin agree.

### WR-03: hooks.json description calls the reconcile sweep a non-mutating detector

**File:** `hooks/hooks.json:2`
**Issue:** The coexistence rationale lists `gsd-reconcile-sweep.js` among "standalone advisory JS
detectors ... the detectors mutate no shared state ... so double-running under two copies is a
no-op." But `gsd-reconcile-sweep.js:46` calls `reconcile.reconcilePending(...)`, which writes
`.planning/reconcile-pending.json`. The sweep is not elected (it is a standalone hook), so under
two enabled plugin copies it runs twice and both runs do read-modify-write on the same file with
no lock (`writeJsonAtomic` makes each individual write atomic but does not serialize the
read-modify-write pair). Double-running is safe in practice only because the merge is idempotent
and any transient lost update self-heals on the next session sweep — not because the hook
"mutates no shared state." The stated justification is therefore wrong for this hook, which
undermines the single-fire reasoning the description is meant to document.
**Fix:** move `gsd-reconcile-sweep.js` out of the "mutate no shared state" clause and describe it
like the envelope sanitizer: an idempotent writer whose double-run is a no-op because
`reconcilePending` merges by decision hash. If stronger guarantees are wanted, wrap the
read-modify-write in the pending file in a lock.

## Info

### IN-01: reconcile.record and reconcile.pending do not honor the disable flag

**File:** `bin/lib/reconcile.cjs:233-268` and `sdk/src/query/reconcile.ts:265-300`
**Issue:** `reconcileCandidates` and `reconcileSweep` short-circuit with `skipped: true` when
`workflow.decision_reconciliation` is `false`, but `reconcileRecord` and `reconcilePending` have
no `isDisabled` guard and will still write the ledger / pending file when the feature is off.
`references/decision-reconciliation.md:5` states flatly that "The query commands return
`skipped: true` in that case." In normal flow record/pending are only reached after candidates or
the directive surface (both of which are gated), so this is not a live bug and the two twins
agree, but it is inconsistent with the reference and a weaker defense-in-depth than the sibling
commands. **Fix:** add the same `isDisabled` short-circuit to both handlers in both twins, or
soften the reference wording to name only candidates/sweep.

### IN-02: dedup-by-hash can shift which decision counts as "latest"

**File:** `bin/lib/reconcile.cjs:52-71,201-209` and `sdk/src/query/reconcile.ts:69-88,231-239`
**Issue:** `parseDecisionLog` skips any decision whose normalized text hashes to one already seen,
and `reconcileDirectiveForLatest` uses `decisions[decisions.length - 1]`. If a freshly logged
decision normalizes identically to an earlier one, it is deduped out and "latest" resolves to the
earlier occurrence. The directive text is the same, so impact is cosmetic, but the hash reported
to the agent would be the earlier entry's. **Fix:** acceptable as-is; if precise latest tracking
matters, key the dedup on line position as well as hash.

### IN-03: softPhrase is now exported but not consumed outside its module

**File:** `sdk/src/query/check-decision-coverage.ts:88`
**Issue:** This phase exported both `normalizePhrase` and `softPhrase`, but `reconcile.ts` imports
only `normalizePhrase`; `softPhrase` is still used only within `check-decision-coverage.ts`. The
widened visibility is harmless but unnecessary. **Fix:** drop the `export` on `softPhrase` unless
a future consumer is planned.

## Convention

### CN-01: Swallowed catch blocks across the changed state/hook files

**File:** `hooks/gsd-reconcile-sweep.js:30` (new); plus pre-existing occurrences in
`sdk/src/query/state-mutation.ts` (66, 193, 196, 216, 319, 795, 1303, 1452, 1511, 1522),
`bin/lib/state.cjs` (37, 791, 830, 861, 986, 989, 1004, 1362, 1567, 1578, 1665), and
`sdk/src/query/check-decision-coverage.ts:539`
**Deviation:** catch blocks swallow the error (empty / no rethrow).
**Convention:** architectural-split — error handling; swallowed catches hide failures.
**Fix (recommend-fix, non-blocking):** these are the codebase's deliberate graceful-degradation
idiom (tolerate a missing file, a released lock, or absent JSON) and all but the new
`gsd-reconcile-sweep.js:30` predate this phase. Where a swallow is intentional, keep a short
`/* ... */` note (most already do); the new hook catch at line 30 already carries one. No action
required beyond awareness; do not let this gate the merge.

## Set aside (needs ruling)

### SA-01: add-decision writes an em dash separator that the reconcile engine depends on

**Where:** `bin/lib/state.cjs:478`, `sdk/src/query/state-mutation.ts:870`; consumed at
`reconcile.cjs:66-67` / `reconcile.ts:83-84`
**Why excluded:** pre-existing writer behavior, not introduced by this phase; already tracked in
project memory (`state handlers inject em-dashes`).
**Effect if left as is:** `state.add-decision` writes `summary — rationale` with a literal em
dash, and the reconcile engine splits on ` — ` to isolate the summary for stemming. This keeps the
feature working but bakes the em dash (forbidden by the user's global no-dash rule and the project
CLAUDE.md) deeper into the data contract: fixing the writer to use a non-dash separator would now
also require updating the reconcile split and the golden fixtures.
**Needs:** ruling from the developer — migrate the separator (writer + reconcile split + fixtures)
in a dedicated change, or accept the em dash as the on-disk decision-log format.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (bm-code-reviewer)_
_Depth: standard_
