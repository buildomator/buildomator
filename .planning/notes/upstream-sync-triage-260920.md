# Upstream sync-triage (gsd-core v1.12.0 + v1.13.0 + v1.14.0)

Opened 2026-09-20. READ-ONLY inbound triage. Prior sync ported the Claude-relevant set through v1.11.0 (shipped in plugin v4.5.6, ten fixes; see `.planning/notes/upstream-sync-triage-260822.md` and CHANGELOG 4.5.6). This pass covers everything NEW since v1.11.0: releases v1.12.0 (2026-08-30), v1.13.0 (2026-09-06), v1.14.0 (2026-09-14). No code changed. An agent-name migration (gsd-<role> to bm-<role>) is in flight in the tree; nothing here touches those files.

## Wave summary

Roughly 370 merged PRs across the three releases. The overwhelming majority are multi-runtime host work (Codex/Cursor/Kimi/Trae/Pi/Gemini/zcode/OpenCode/antigravity/Windows), upstream CI/coverage/lint/npm plumbing, or fixes to subsystems this Claude-only subset never ported (state-transaction/open()-rebuild() machinery #3871/#3872/#3873, vendored js-yaml #3881, exit-code registry #3905/#3906, dispatch-identity owner, deferred-items span walk, broken-windows ledger, quick-batch, parallel reviewer lanes, materialization primitives). Verdict spread on the items actually assessed against logic we carry:

- **APPLICABLE: 6 PRs (4 distinct fixes).** Ranked table below. One is a data-loss-family cluster; three are cheap hardening.
- **ALREADY-COVERED: 6** verified against our code (#4078, #4053, #4488, #4192, #4129/#4094 partial, #4213).
- **DEFERRED-REVISIT: 2** prior-triage carry-overs that got a cleaner upstream fix worth a look later (#2868 -> #3684, #3350 -> #3701).
- **NA-RUNTIME / NA-INFRA / NA-MISSING: ~355** discarded by title or after a quick map.

The STATE.md string module is single-source: `bin/lib/state-document.generated.cjs` is generated from `sdk/src/query/state-document.ts` (`cd sdk && npm run gen:state-document`), so that cluster is one edit plus regen, not two hand-synced twins. The other three fixes are two-twin (CJS `bin/lib/*.cjs` + SDK `sdk/src/**`). Every code port still needs an sdk rebuild + `dist/bm` regen + `build-bm --check`; the bm drift gate is colon-only and will not catch a one-twin miss, so the SDK unit tests are the real guard.

## APPLICABLE shortlist (ranked by correctness severity)

| # | upstream | what | our-tree file(s) | why it matters |
|---|----------|------|------------------|----------------|
| 1 | #4010 (PR 4021) + #4243 (PR 4453, PR 4474) + #4481 (PR 4510) | anchor STATE.md bold field read/write to line start and confine the write to same-line whitespace | `sdk/src/query/state-document.ts` -> regen `bin/lib/state-document.generated.cjs` (`stateReplaceField` L40-51, `stateExtractField` L29-38) | HIGH, data-loss family (same class as #32 / plugin v4.7.1, but a different function that #32 never touched). `stateReplaceField`'s bold pattern `(\*\*field:\*\*\s*)(.*)` uses `\s*`, which spans newlines: replacing an empty field (`**Status:**\n<next line>`) consumes the newline and overwrites the following line. Neither the bold read nor the bold write is line-anchored (`i` flag, no `^...m`), so a mid-line `**Field:**` mention in prose can be matched instead of the real field row. Single source + regen. |
| 2 | #4023 (PR 4110) | preserve decimal phase ids in init progress ordering and smart-entry output | `bin/lib/init.cjs:1414-1419` and `:1490`; SDK `init-complex.ts` | MEDIUM. Both sorts use `parseInt(id,10)`, so decimal ids (`7.1`,`7.2`,`7.10`, and inserted phases like `72.1` that our tree supports) collapse to the integer part and order wrong in `init.progress` and smart-entry. `comparePhaseNum` (core.cjs:836) is already decimal-aware and is what phase.cjs uses; init should call it too. Both twins. |
| 3 | #4478 (PR 4578) | anchor the analyze phase-heading and checklist regexes to line start | `bin/lib/roadmap.cjs:207` (phasePattern) and `:324` (checklistPattern); SDK `roadmap.ts` | LOW hardening. Both patterns are `/gi` without `^...m`, so a `## Phase N:` inside a fenced code block or blockquote is counted, inflating `phase_count`. The `[A-Za-z]?`-leading id part is our earlier #3036 port; only the line-anchor is missing. Both twins. |
| 4 | #3701 (PR 3852) | next_phase roadmap fallback selects the numerically lowest successor | `bin/lib/phase.cjs:1319-1330` (cmdPhaseComplete ROADMAP fallback); SDK `phase-lifecycle.ts` | LOW. The filesystem scan sorts dirs (L1293) and correctly picks the lowest successor, but the ROADMAP-only fallback walks document order and breaks on the first heading with `comparePhaseNum > current`, so an out-of-order roadmap yields the wrong next phase. Sort the fallback matches too. Also a cleaner partial for the long-deferred #3350. Both twins. |

Optional / very low value:
- **#3741 (PR 3950)** anchor the loose plan-scan PLAN token. `bin/lib/plan-scan.cjs` `isFlatPlan` (L74-79) returns true for any `.md` whose name merely *contains* `PLAN` (`/PLAN/i`), so a stray `EXPLANATION.md` or `REPLAN.md` in a phase plans dir counts as a plan and skews `planCount`/progress. Real but rare given where these files live. Fold in with the batch if touching plan-scan; otherwise skip.

## Verified ALREADY-COVERED (do not re-triage)

- **#4078** (phase.complete next-phase cascade reads dash-grammar checkbox rows): our fallback phasePattern (phase.cjs:1319) already matches `-\s*\[[ xX]\]` dash-checkbox and bold-checkbox forms via the #1591 port. No port.
- **#4053** (quote decimal-shaped frontmatter scalars for spec YAML readers): our `needsQuoting` (frontmatter.cjs:54) deliberately leaves numeric-looking strings bare because our reader never type-coerces (documented at the function), and we ship no js-yaml (upstream vendored it in #3881, which is why they now need the quoting). No exposure for a Claude-only, string-parser plugin.
- **#4488** (report state update as successful when the value is already correct): `stateReplaceField` re-emits identical content and returns a truthy result, so an already-correct write reports success. Cannot reproduce.
- **#4192** (honor explicit model pins on the claude runtime): our resolver is Claude-native and honors `model_overrides` directly; the upstream defect was a multi-runtime pin-dropping path we never had.
- **#4129 / #4094** (progress ratchet; withhold counters under a milestone-unbounded guard): partially covered. `shouldPreserveExistingProgress` + `existingProgressExceedsDerived` (state-document.generated.cjs:23-27,102-113) already keep a higher existing counter over a lower derived one, and the zero-plan no-op (state.cjs:419, our #3233 port) already guards the empty-milestone case. The remaining "milestone-unbounded" concept is upstream-specific; no clean port.
- **#4213** (keep STATE.md progress surfaces synchronized): our `syncStateFrontmatter` already reconciles the body Progress line with the frontmatter block; the #32 / v4.7.1 work hardened this surface. No additional port.

## Deferred-revisit (prior-triage carry-overs, cleaner upstream fix now exists)

- **#2868 resume a stranded phase** (was: workflow-prose adaptation in the 260822 triage). Upstream **#3684 (PR 3814)** "resume verified-unmarked phases at update_roadmap" is a more targeted take. Still workflow-prose (`workflows/execute-phase.md`), not a clean CLI port. Revisit if a release has room.
- **#3350 lowest outstanding phase** (deferred as "needs native reimpl"). Upstream **#3701 (PR 3852)** is a cleaner but narrower fix (lowest *successor*, not lowest *outstanding*); it is item 4 above and covers the common case. The full "lowest outstanding across the milestone" behavior still needs native work; treat #3701 as the pragmatic close and keep the broader #3350 parked.
- **#2648 phase.complete superseded/retired-plan marker**: no cleaner upstream fix appeared. #3685 (report phase-complete write flags from the transaction) rides the state-transaction machinery we never ported. Keep parked; still needs a `superseded` marker designed into plan-scan.

## Dropped as NA-RUNTIME / NA-INFRA / NA-MISSING

~355 PRs, not enumerated. Categories: multi-runtime host adapters and Windows path/temp-sweep work; installer/config-home/atomic-write plumbing; CI shard/coverage-merge/npm-audit/stryker/eslint housekeeping; ADR-gate, docs-INVENTORY, changeset, back-merge, guard-ledger bookkeeping; and fixes to subsystems this subset never ported: state-transaction snapshot/open()/rebuild() (#3871/#3872/#3873/#3685), vendored js-yaml (#3881/#4053), exit-code registry and terminators (#3904/#3905/#3906/#3910), dispatch-identity owner (#4594), deferred-items span walk (#3781/#3702), broken-windows/WINDOWS.md ledger (#3780/#4487), quick-batch (#3675/#3676/#3677), parallel reviewer lanes and review-dispositions ledger (#3034/#3806), materialization primitives, and the bracket-id read path epic #612 (#2761/#3641) which is an upstream phase-id convention we do not carry.

## Recommendation

Only one item is genuinely worth porting: the **STATE.md anchoring cluster (#4010 + #4243 + #4481)** — it is the same data-loss family as the #32 fix, sits in a single generated source, and covers a function #32 never touched. Fold in **#4023** (decimal ordering; `comparePhaseNum` already exists, small change) in the same batch, and opportunistically take **#4478** and **#3701** (cheap regex/sort hardening) if the diff is already open in those files. Skip #3741 unless plan-scan is being touched anyway. Net: 1 must-port, 1 should-port, 2 nice-to-have, in one release. Everything else is NA or already covered.

Context: [[project_upstream_switch_2026_05]], [[reference_model_resolver_single_source]] (two hand-synced twins; state-document is single-source generated), [[reference_buildomator_transform_fragility]] (colon-only drift gate), prior triage `.planning/notes/upstream-sync-triage-260822.md`, STATE.md data-loss history in CHANGELOG 4.7.1 (#32).
