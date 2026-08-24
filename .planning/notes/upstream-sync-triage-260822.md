# Upstream sync-triage (gsd-core v1.10.0 + v1.11.0)

Opened 2026-08-22. Filters the two new upstream releases since our last sync (v4.5.4/v4.5.5 ported the 1.8.0-1.9.x Claude-relevant set). READ-ONLY analysis; inbound port only. v1.10.0 bundles the 2026-08-06 wave (mostly already-ported or already-dropped), v1.11.0 is the 1.10-to-1.11 wave.

## Wave summary

Roughly 220 merged PRs across the two releases. The overwhelming majority do not touch logic this Claude-only port carries. Verdict spread on the items assessed:

- **APPLICABLE: 13** (11 solid + 2 low-value optional). Ranked table below.
- **ALREADY-PORTED: 4** (#2786, #2825, #2843, #1995/#3021 in v4.5.4).
- **ALREADY-COVERED: 8** verified against our code (#3345/#3459, #3052, #3497, #2528, #3569, #2956, #3204, #2947, plus #3033 from prior triage and #3498 escapeRegex, #2962/#3300 nullglob).
- **NA-RUNTIME / NA-INFRA / NA-MISSING: ~190** discarded by title or after a quick map (Codex/Cursor/Kimi/Trae/Pi/Gemini/zcode/VS Code/OpenCode/Windows-shim runtimes; CI/changelog/ADR/lint/npm-tarball/coverage/back-merge plumbing; and fixes to subsystems we never ported such as the #3180 roadmap-parser single-owner refactor, ADR-1230 applyStatePreservation, ADR-2782 review-lane-descriptor, verification-ledger, plan-dependency-graph halt-propagation, deferred-items, WINDOWS.md broken-windows ledger, materialization primitives).

Both twins are hand-synced (not generated). The bm drift gate is colon-only and will NOT catch a one-twin miss; the SDK unit tests are the real guard. Every code port needs an sdk rebuild + `dist/bm` regen + `build-bm --check`.

## APPLICABLE shortlist (ranked by correctness severity)

| # | upstream | what | our-tree file(s) | why it matters |
|---|----------|------|------------------|----------------|
| 1 | #2648 (PR 2953) | phase.complete fail-closed when non-retired plans lack summaries | `bin/lib/phase.cjs` cmdPhaseComplete (1101+), SDK `phase-lifecycle.ts` | HIGH. A phase can close "complete" with unexecuted plans (silent scope loss); we write summaryCount/planCount regardless. Larger port: needs a `superseded`/retired marker we lack in plan-scan. |
| 2 | #3213 (PR 3368) | segment-boundary membership for letter-named phase dirs | `bin/lib/core.cjs:1938` (getMilestonePhaseFilter), SDK `state.ts:72` | Greedy `^([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)` swallows the whole slug, so `A-tool-output-contract` never matches milestone id `a`; letter-named dirs (ADR-612 Phase A..L, a shape we support) silently drop out and milestone counts are fabricated. Both twins. |
| 3 | #3163 (PR 3400) | scope add-phase insertion to the current milestone | `bin/lib/phase.cjs:671,745`, SDK `phase-lifecycle.ts:192,312` | Whole-file `lastIndexOf('\n---')` puts a new `### Phase N:` under an archived/backlog phase on a long roadmap. Adapt existing `replaceInCurrentMilestone` (core.cjs:1190). Decimal-insert path is already anchored, leave it. |
| 4 | #2977 (PR 3076) | tolerate a leading UTF-8 BOM before the frontmatter fence | `bin/lib/frontmatter.cjs:98`, SDK `frontmatter.ts:195` | A U+FEFF BOM at byte 0 breaks the `^---` fence match; parse collapses to `{}` and every frontmatter field silently vanishes (summary/plan scans, syncStateFrontmatter round-trips). One-line strip per twin. |
| 5 | #3170 (PR 3401) | anchor milestone one-liner extraction to a summary-shaped heading | `bin/lib/core.cjs:1682` (extractOneLinerFromBody), SDK `phase-lifecycle-policy.ts:54` + `summary.ts:30` | First-heading-first-bold heuristic writes a rule-list or deviation-note heading verbatim into MILESTONES.md accomplishments (milestone.cjs:140) and one_liner (commands.cjs:466). Two SDK copies. |
| 6 | #3233 (PR 3375) | no-op state update-progress when milestone scan finds zero plans | `bin/lib/state.cjs:414`, SDK `state-mutation.ts:699` | After milestone archive (phases dir empty) totalPlans=0 forces `percent=0` and unconditionally rewrites the Progress line, turning a shipped `100%` into `0%`. Clean early-return no-op fix. |
| 7 | #2868 (PR 3041) | resume a phase stranded between its last plan and verification | `workflows/execute-phase.md:319` | A phase interrupted after its final SUMMARY but before verify_phase_goal cannot be resumed (re-run no-ops before the verifier). Workflow-prose adaptation, not a clean CLI port. |
| 8 | #3581 (PR 3603) | derive init.progress next_phase from roadmap order, not artifact presence | `bin/lib/init.cjs:1457`, SDK `init-complex.ts:420` | An out-of-order artifact dir (e.g. a phase-9 UAT dir while roadmap phase 8 is pending) claims next_phase and skips 8, so init.progress disagrees with roadmap.analyze. Derive frontier from roadmap, artifacts as corroboration. |
| 9 | #3151/#3425 (PR 3425) | stop emitting effort: into skill frontmatter (prompt-cache invalidation) | `skills/progress/SKILL.md:5`, `skills/stats/SKILL.md:4`, `skills/version/SKILL.md:4` | Claude reads SKILL.md `effort:` as output_config.effort; whenever the session baseline differs from the static `low`, invoking the skill flips it and invalidates the prompt cache at both scope boundaries. Reverses our earlier deliberate effort:low adoption (see below). Strip all three. dist/bm regen only. |
| 10 | #2483/#2493 (PR 2493) | stop the claude reviewer lane inheriting CLAUDE.md + auto-memory | `workflows/review.md:197,199` | Our two `claude -p -` reviewer invocations inherit the user/project CLAUDE.md + auto-memory, so the claude lane reviews on different input than the gemini/codex/opencode lanes (defeats independent review + token cost). We never took the ADR-2782 descriptor machinery; the port is a 2-line env prefix `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` on both. |
| 11 | #3225 (PR 3371) | guard W006/W007 + consistency loops with a sentinel predicate | `bin/lib/verify.cjs:510-523,849-865`, SDK `validate.ts:243-247,658-665` | A 999.x backlog or 0.x draft dir on disk (conventions we use) that is not in the current-milestone roadmap fires a spurious `W007: Phase 999 exists on disk but not in ROADMAP.md` and flips status to degraded every run. Cosmetic but noisy. Both twins. |
| 12 | #3036 (PR 3117) | accept non-numeric-leading phase ids in roadmap.analyze | `bin/lib/roadmap.cjs:207`, SDK `roadmap.ts:393` | The analyze heading regex requires a digit-leading id, so a project using letter-prefixed custom ids (`B7`, which our resolver otherwise handles) gets phase_count:0 from analyze while other verbs resolve fine. Niche. Both twins. |
| 13 | #3350 (PR 3482) | prefer lowest outstanding phase over positional next in phase complete | `bin/lib/phase.cjs:1300`, SDK `phase-lifecycle.ts` | Next-phase scan breaks on the first higher unchecked phase and never considers a lower-numbered outstanding one. Rare; upstream references the #2028 stage-3 machinery we never took, so needs native re-implementation, not a cherry-pick. Low value. |

Optional / defer (real but very low value):
- **#3257 (PR 3387)** preserve full-line frontmatter comments through parse->reconstruct. Real latent gap (`state.cjs` syncStateFrontmatter erases authored `#` comment lines) but GSD artifacts rarely carry them and the fix is a Symbol-keyed comment channel; CJS-only (SDK has no reconstruct path). Port only if comment-bearing frontmatter ever matters.

## Verified ALREADY-COVERED / ALREADY-PORTED (do not re-triage)

- **#3345 / #3459** (blocked summaries not counted complete): our status-aware `INCOMPLETE_SUMMARY_STATUSES` already includes `blocked` (plan-scan.cjs:24-42, plan-scan.ts:12-30); index side excludes them too (phase.cjs:392-397,544-546). No port.
- **#3052** (preserve last_activity_desc): our buildStateFrontmatter is frontmatter-first (state.cjs:664), existing desc already wins over stale body. Defect cannot reproduce.
- **#3497** (unescape double-quoted scalars): we already carry unescapeDoubleQuoted in both twins (frontmatter.cjs:69-80, frontmatter.ts:68-79) from the #1779 port; writer only emits `\\`/`\"`, so reader/writer stay symmetric.
- **#3498** (escapeRegex fallback below Node 24): our escapeRegex is a manual `.replace()` (core.cjs:770, helpers.ts, state-document.ts), never used RegExp.escape. No exposure.
- **#2528** (digit-leading phase dirs): our extractPhaseToken uses dot-based sub-phase grammar (core.cjs:873-884); hyphens are always name separators, the `10-24` welding bug cannot occur.
- **#3569** (stats heading digit-required): our cmdStats regex (commands.cjs:910) already requires `\d+`. Never had the loose pattern here.
- **#2956** (scope Phase extraction to Current Position): our read is frontmatter-first (state.cjs:656) with the distinct `Current Phase:` label; writes already scope to `## Current Position`. Bare-`Phase:` overwrite cannot reproduce.
- **#3204** (milestone sectioning vocabulary): we have no hasMilestoneSectioning; total_phases uses `Math.max(phaseDirs.length, phaseCount)` (state.cjs:830, core.cjs:1954) so it never shrinks. Part of the #3180 refactor we never took.
- **#2947** (preserve preamble phase details): our extractCurrentMilestone concatenates preamble + section and counts `### Phase N:` over the whole result (core.cjs:1864), so early-heading phases are still counted.
- **#3033** (zero-plan split-parent checkbox), **#2667** (Windows .cmd), **#2788** (Gaps Found recovery): recorded dropped in the 260807 triage; unchanged.
- **#2962 / #3300** (nullglob for zsh): our for-glob loops guard with `[ -f ] || continue` and Claude's Bash tool runs bash (unmatched glob yields the literal, guard handles it). No exposure.

NA-MISSING that looked Claude-relevant but map to unported subsystems: #2949 (no #2028 stage-3 downward loop), #2830/#2645/#3374/#2969 (state-transition / verification-ledger / dependency-graph machinery), #3116/#3258 (broken-windows ledger, applyStatePreservation), #3428/#3577/#3262 (#3180 roadmap-parser refactor), #3039/#3533 (effort-resolver machinery; and #3151 removes our skill-effort surface entirely, superseding the clamp). #3238 js-yaml bump NA (we bundle no js-yaml).

## Dropped as NA-RUNTIME / NA-INFRA / NA-MISSING

~190 PRs, not enumerated: multi-runtime host adapters (Codex/Cursor/Kimi/Trae/Pi/Gemini/zcode/VS Code/OpenCode) and Windows binary-resolver epic #3411; installer/manifest/config-home plumbing; CI, changelog, ADR-gate, lint, coverage-glob, npm-tarball, back-merge, and test-suite housekeeping; and fixes to features we never ported (reviewer-lane descriptors, materialization primitives, deferred-items, verification ledger, plan-dependency graph, milestone locking, edge-probe coverage, key_links security surface).

## Recommendation

Port a clean batch of the low-risk items: **#2977, #3213, #3163, #3170, #3581, #3233, #3225, #3036** (eight both-twin parsing/routing fixes, all additive or small logic changes) plus the two cheap Claude-specific wins **#3151** and **#2483** (no CJS/SDK twins touched). That is 10 items in one release. Treat **#2648** as a separate follow-up (high value but needs a `superseded`/retired-plan marker designed into plan-scan). Defer **#3350** (needs native reimpl, rare) and **#2868** (workflow-prose) unless a release has room; skip **#3257** until comment-bearing frontmatter matters.

Context: [[project_upstream_switch_2026_05]], [[reference_model_resolver_single_source]] (two hand-synced twins), [[reference_buildomator_transform_fragility]] (colon-only drift gate), prior triage `.planning/notes/upstream-sync-triage-260807.md`.
