---
quick_id: 260718-vhs
title: Triage upstream gsd-core 1.7.0 Claude-relevant PRs
date: 2026-07-18
---

# Upstream gsd-core v1.7.0 — sync triage (Claude-relevant PRs)

Follow-up to `260701-gbo` (which pre-flagged 1.7.0-rc.1 as "grab the correctness/UX
wins when 1.7 is stable"). v1.7.0 shipped 2026-07-15. Our last synced provenance is
gsd-core 1.6.1.

**Scope.** v1.7.0 is large but mostly multi-runtime (ADR-1239 host integration:
OpenCode, pi, VS Code, ZCode, Antigravity; Gemini-CLI sunset; SLURM external-job;
portability AST rules). All of that is out of scope for a Claude-Code-only fork. This
triage covers only the Claude-relevant subset (6 fixes + 7 features).

**Method.** Upstream PR diffs are not fetchable (open-gsd/gsd-core is private;
get-shit-done-redux@v1.7.0 is a squashed mirror). Each candidate was assessed from its
release-note description against our fork's current code (file:line evidence below).
Diff-level confirmation is still needed before porting the ADAPT items.

## Verdict table

| PR | Area | Verdict | Effort | Risk | Twins |
|----|------|---------|--------|------|-------|
| #2018 | applySurface empty-manifest guard | ADOPT | S | low | CJS only |
| #1581 | config-set Infinity/project_code coercion | ADOPT | S | low | both |
| #1988 | stray *-SUMMARY.md inflates completion count | ADOPT | M | low | both |
| #1154+#1820 | honest verifier abstain + spec-optional rail | ADAPT | S-M | low | agents md |
| #1779 | valid YAML for unsafe scalars | ADAPT | M | med | both |
| #1561 | assumption-delta advisory checkpoint | ADAPT | M | low-med | agents/wf |
| #2022 | gate checkbox on verification passed | ADAPT* | M-L | med | both |
| #1729 | phase header pre-colon parenthetical | ADAPT | M-L | med | both |
| #1866 | agent self-load of agent_skills | ADAPT (opt) | M | med | both |
| #1787 | /gsd:next smart-entry menu | SKIP | — | — | — |
| #1855 | Claude marketplace manifest | ALREADY-HAVE | — | — | — |
| #2002+#2036 | self-healing runtime build | SKIP | — | — | — |
| #1143 | claude-orchestration (Workflow backend) | SKIP (spike) | — | — | — |

\* #2022 needs a design call, see below.

---

## Fixes

### #1988 — exclude stray non-plan *-SUMMARY.md from phase completion count — ADOPT
Remediation/gap-closure summaries (`30-FIX-CR02-SUMMARY.md`, `30-GAPCLOSURE-SUMMARY.md`)
are counted raw and can flip a phase to Complete. Bug present: `bin/lib/plan-scan.cjs:62`
(`isRootSummaryFile`) + `:120-121` (raw `summaryCount = summaryFiles.length`), feeding
`bin/lib/roadmap.cjs:260` completion; same raw-count in `bin/lib/phase.cjs:315,373`. SDK
twins `sdk/src/query/plan-scan.ts:29`, `phase.ts:70,289`. Fix = pair each summary to a
real PLAN before counting (upstream `countMatchedSummaries` helper), one shared spot per
twin, wired through every `scanPhasePlans` consumer. No conflict with our 4.1.2 audit-open
work (different file). Golden fixtures with a stray summary needed (`plan-scan.test.ts` +
`roadmap.update-plan-progress` golden).

### #2018 — applySurface empty manifest no longer deletes gsd-* agents — ADOPT
`bin/lib/surface.cjs:264-273` `_syncGsdDir` unlinks any `gsd-*` dest not in `stagedFiles`;
an empty/unresolvable manifest stages nothing, so every `gsd-*` agent is deleted. No guard
at `applySurface` (`:213`) or `_syncGsdDir`. CJS ONLY (no SDK twin). Pure defensive guard:
skip the prune loop when the manifest is empty/null/no-files/unresolvable-root. Port
upstream's `tests/surface-empty-manifest-agents.test.cjs`.

### #2022 — gate update-plan-progress checkbox on verification passed — ADAPT (design call)
Bug present both twins: `bin/lib/roadmap.cjs:369` `isComplete = summaryCount >= planCount`
(ticks at `:416-421`, no verify gate); SDK `roadmap-update-plan-progress.ts:75,122-132`.
BUT the upstream fix's premise does not hold here: our `cmdPhaseComplete`
(`bin/lib/phase.cjs:1085-1125`) also does NOT gate on passed verification, it warns and
proceeds. We have no `readVerificationStatus` helper. So we'd build the gate from scratch,
and adopting it only in `update-plan-progress` makes it stricter than our own
`phase.complete` (internal inconsistency). **Decision needed:** (a) adopt the
verification-first completion contract in BOTH `update-plan-progress` and `cmdPhaseComplete`,
or (b) skip until we decide to move off our "warn, don't block" completion model. Leans
defer. Companion: upstream #2030, leans on verify-work state contract #2025/#1921.

### #1779 — emit valid YAML for unsafe scalars in reconstructFrontmatter — ADAPT
Bug both twins. `bin/lib/frontmatter.cjs:133,148,170,173-180` and
`sdk/src/query/frontmatter-mutation.ts:83-88,115-117` only guard on `:`/`#` (+ leading
`[`/`{`). Two real gaps: (1) quoted values are wrapped `"${sv}"` with no escaping of
embedded `"`/`\` (`a "b": c` → invalid YAML); (2) leading indicators
(`- ? @ ` ! & * % | >`, leading/trailing space) and reserved words (`yes/no/on/off/null/~`)
emitted bare. Golden coverage exists (`frontmatter-mutation.test.ts:60-70`,
`golden-integration-covered.ts`) — must update expectations and keep the twins byte-identical.
CJS inlines quoting 4x while SDK factored `needsQuoting()`/`serializeArray()`; port without
letting them diverge.

### #1729 — resolve phase headers with a pre-colon parenthetical tag — ADAPT
`### Phase 12 (Rebranding): Name` breaks parsing. Distributed fragility: CJS
`phase.cjs:221`, `roadmap.cjs:66,543`, `core.cjs:1181`; SDK `phase-ready.ts:35`,
`progress.ts:205`, `validate.ts:216`, `state.ts:49`, many in `phase-lifecycle*.ts`. Shared
`phaseMarkdownRegexSource()` (`core.cjs:776`) only builds the numeric token; each call site
appends the `:` boundary, so ~4 CJS + 10+ SDK regexes each need a `(?:\s*\([^)\n]*\))?`
insert. Lower urgency: our own writers emit the parenthetical POST-colon
(`phase.cjs:819`), so we don't self-generate the failing form — driven by externally
authored/imported roadmaps. Best done by centralizing the colon boundary into
`phaseMarkdownRegexSource` (avoids whack-a-mole; aligns with the transform-fragility lesson).

### #1581 — config-set no longer coerces Infinity / project_code — ADOPT
Bug both twins, identical: `bin/lib/config.cjs:418` (`!isNaN(value)` → `Number(value)`) and
`sdk/src/query/config-mutation.ts:210`. `Number("Infinity")` passes `!isNaN`, coerces to
`Infinity`, persists as `null` (silent data loss). String-typed `project_code`
(`config-schema.cjs:76`) with a numeric-looking value (`007`) coerces to `7`. Fix = use
`Number.isFinite` instead of `!isNaN` + a string carve-out for `project_code` (and other
string keys) keyed off the path in `configSet` (SDK `parseConfigValue` is key-context-free,
so the carve-out lives in `configSet`, not `parseConfigValue`). Golden-covered
(`golden-integration-covered.ts:8`); keep twins lock-step, rebuild `sdk/dist`.

---

## Features

### #1154 + #1820 — honest verifier (abstain) + spec-optional predicate rail — ADAPT (strongest)
Our verifier taxonomy is VERIFIED/FAILED/UNCERTAIN, where UNCERTAIN conflates "can't check
at runtime" with "spec never defined this" (`agents/gsd-verifier.md:34-36,167-171`). No
`insufficient_spec`/abstain concept, no "backstop truth" or "probe predicate" anywhere.
#1154 splits the honest "abstaining because the spec is silent" out of UNCERTAIN (better
signal on the escalation gate); #1820 has the planner author probe predicates into
`must_haves` when the SPEC omits them (fewer non-inferable truths at verify). Pure agent
markdown/prompt change, no dual-runtime code. Add `insufficient_spec` as a SUB-reason of
UNCERTAIN → WARNING (not a 4th top-level status, to avoid churning `verify.*` consumers and
the verdict legend). Keep the "never downgrade FAILED to UNCERTAIN when absence is
observable" guard (`gsd-verifier.md:29`); #1820 must respect "must_haves must NOT reduce
scope" (`:151`).

### #1561 — assumption-delta advisory checkpoint — ADAPT
Pieces exist (assumptions captured up front via `gsd-assumptions-analyzer.md` /
`discuss-phase-assumptions.md`; deviations logged at `gsd-executor.md:141-239`), but no
execution-time comparison of live vs planned assumptions raising an advisory when they
diverge. Fits the fork's ethos IF strictly advisory. Hard constraint: must NOT be a
blocking pause (collides with `feedback_autonomous_no_kickoff_confirm` and
`feedback_no_mechanics_scope_questions`). Wire as a logged notice / deviation-style surface;
auto-mode must treat it as auto-continue; must not create a new HANDOFF/resume path
(executors return checkpoints, aren't resumed — `gsd-executor.md:108`).

### #1866 — agent-side self-load of configured agent_skills — ADAPT (optional)
Today the orchestrator queries `gsd-sdk query agent-skills <slug>` and injects an
`<agent_skills>` block (`plan-phase.md:42-44,500,886,1210,1327`; `docs-update.md:19` +8
more). Self-load would strip that plumbing (fits "minimize workflow tokens") but the agent
still needs its slug, so the orchestrator still passes something — real gain is
centralization, not tokens. Touches CJS `init.cjs` + SDK `skills.ts` (patch-inventory
surface) and the `resolveWithinBase`/`global:` security logic. Contract test
`workflow-agent-skills-consistency.test.ts` guards the current model. Working, tested,
marginal payoff — adopt only bundled with a broader agent-spawn refactor.

### #1787 — /gsd:next smart-entry menu — SKIP
Naming collision is the whole story. Upstream `/gsd:next` = a state-aware menu
(`smart-entry.md` + `smart-entry.cts` classifier, 11 situations, AskUserQuestion). Upstream's
advancement ENGINE is `/gsd:progress --next` (`next.md`). In OUR fork `/gsd:next` IS the
engine (`workflows/next.md`), and ours is AHEAD of upstream's (fork-only Route 0.5
partial-UAT invariant `:177`, spike/sketch notices `:203`). The off-path/menu role is
already covered by `/gsd:do` (freeform intent router) + `/gsd:progress`. Importing #1787
verbatim forces a rename and engine-vs-menu confusion, and the Claude-only lens strips its
bulk (multi-runtime probe + `--text` fallback). Only borrowable nugget: a state-driven
menu needing no typed intent — a tiny optional bolt-on to `/gsd:do`, not an import. Do NOT
drop upstream's next.md over ours (regresses Route 0.5 + notices).

### #1855 — Claude plugin marketplace manifest — ALREADY-HAVE
We ship a richer two-plugin `.claude-plugin/marketplace.json` (`gsd` + `bm`, v4.1.2, full
metadata). Upstream's is a minimal single-plugin `gsd-core` manifest — strictly behind us.
Only cosmetic gap: `owner.url` / per-plugin `author.url` (not load-bearing). Sync note:
upstream's manifest uses name `gsd-core`; ours `gsd-plugin` with two plugins — a naive sync
must not clobber our two-plugin block (on the patches-to-preserve list).

### #2002 + #2036 — self-healing runtime build for marketplace installs — SKIP
Heals the case where upstream gitignores compiled `./lib` and a marketplace install never
runs `build:lib`. Cannot occur in our fork: we COMMIT the built runtime (tracked:
`bin/lib/*.cjs` 73 files, `sdk/dist/` 656, `dist/bm/` 1514). A flat/marketplace checkout
gets a working runtime with no tsc, no typescript dep, no build-lock race. Our commit-the-dist
model is more robust for this channel. The real obligation is a discipline, not a port:
committed `bin/lib` + `sdk/dist` + `dist/bm` must be regenerated on every release.
**On-target adaptation of #2002's intent (fork-native, not an upstream port):** extend our
`bin/build-bm.cjs --check` dist-parity guard to also assert `bin/lib` and `sdk/dist` match a
fresh build (upstream's healer only covers `bin/lib` anyway, so it wouldn't even serve our
dual resolver).

### #1143 — claude-orchestration capability (Workflow backend) — SKIP (spike first)
We already reasoned about this exact angle: `references/ultracode-mode.md:8-12` — "a signal,
not a mechanism. A plugin cannot trigger Claude Code's multi-agent Workflow orchestration on
the user's behalf." The deeper-orchestration space is covered by the ultracode signal +
the ultraplan cloud path (`/gsd:ultraplan-phase`). Upstream's "capability" is multi-runtime
scaffolding; our `capability`-named code is unrelated query-policy plumbing
(`query-policy-capability.ts`). Diff not fetchable to confirm whether #1143 is (a) a restated
signal or (b) a real plugin-driven Workflow backend. If (b), it would invalidate our
ultracode-mode premise and merit revisiting — worth ONE focused spike before dismissing.
Default SKIP.

---

## Recommended porting plan

**Tier 1 — clean picks, ship as one small correctness release (low risk):**
- #2018 (S, CJS-only agent-delete guard)
- #1581 (S, config data-loss guard)
- #1988 (M, completion-count correctness)
- #1154+#1820 (S-M, prompt-only verifier honesty)

**Tier 2 — ADAPT with care (own commits, golden fixtures):**
- #1779 (YAML scalar safety)
- #1561 (advisory assumption-delta, strictly non-blocking)

**Tier 3 — design decision / deferred (see upstream-deferred.md):**
- #2022 (needs verification-first-completion decision)
- #1729 (do when centralizing `phaseMarkdownRegexSource`)
- #1866 (optional; bundle with a spawn refactor)

**SKIP (documented in upstream-deferred.md):**
- #1787 (name collision; ours ahead; optional /gsd:do menu nugget)
- #1855 (already have; optional url cosmetics)
- #2002/#2036 (we commit dist; adaptation = extend dist parity check)
- #1143 (spike vs ultracode-mode before revisiting)

Tier 1 is the natural next porting phase. Nothing here blocks anything; all optional.
