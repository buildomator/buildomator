---
phase: 17-v1-capability-wiring-and-propose-on-fit
verified: 2026-10-06T20:57:14Z
status: passed
score: 5/5 must-haves verified
has_blocking_gaps: false
human_verification_result: passed (17-HUMAN-UAT.md, 2026-10-07 — live accept prompt verified, see notes)
overrides_applied: 0
human_verification:
  - test: "Run a live `/bm:quick` (or `/gsd:quick`) task whose description contains an SEO trigger word (e.g. 'audit my site SEO and fix the sitemap')"
    expected: "The AskUserQuestion accept prompt renders with header 'Catalog skill', shows the candidate's publisher label, SPDX license + one-line obligation, and trust tier (rendered between DATA_START/DATA_END per the reference), offers 'Accept (ephemeral, this task only)' as the first/default option, 'Accept sticky (persist for bm-executor)' second, and 'Skip' third; choosing Skip leaves `.planning/config.json` `agent_skills` unchanged (no insert); choosing Accept inserts ephemerally and the record is released after the executor returns."
    why_human: "The prompt wording, option ordering and DATA boundary rendering are only exercised when Claude Code actually runs the AskUserQuestion tool inside a live quick/discuss-phase session; this cannot be invoked or observed through static grep or the spawned-CLI test harness, which simulates acceptance directly via `--approved` instead of going through the interactive tool. The plan 17-03 author explicitly deferred this check to /bm:verify-work (17-03-SUMMARY.md: 'Not run here (needs a live session)')."
---

# Phase 17: v1 Capability Wiring and Propose-on-Fit Verification Report

**Phase Goal:** Wire the v1 craft capabilities and the fit-based proposal so a task entering a domain surfaces the right candidate.
**Verified:** 2026-10-06T20:57:14Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|------------|----------|
| 1 | SEO and DuckDB are cataloged and insertable through the Phase 16 gate | VERIFIED | `sdk/shared/craft-skill-catalog.json` carries both `seo-audit` (coreyhaines31/marketingskills, MIT, tier A) and `duckdb-query` (duckdb/duckdb-skills, MIT, tier B). `node tests/craft-skill-insertion.test.cjs` (30/30 pass) exercises insert/approve/release for both seeds including the SEO end-to-end chain and the pre-existing DuckDB cases; `node tests/craft-skill-catalog.test.cjs` (37/37) and `node tests/skill-trust-gate.test.cjs` (40/40) pass against the committed catalog. |
| 2 | A document deliverable routes to Claude Code's built-in first-party doc skills, not cataloged, no license exposure | VERIFIED | `agents/bm-executor.md` `<project_context>` carries a "Document deliverables" paragraph (docx/pdf/pptx -> built-in Skill tool, no catalog, no gate, no license surface). `workflows/discuss-phase.md` `propose_craft_skill` step sets `DOC_DELIVERABLE=true` and skips the catalog lookup for document scopes; `workflows/discuss-phase/templates/context.md` carries the conditional `<specifics>` line. `references/craft-skill-propose-on-fit.md` "Document deliverables" section states the same contract. No `craft-skill` token appears in any `skills/*/SKILL.md` (guard-enforced). |
| 3 | Propose-on-fit surfaces a candidate on trigger match and injects nothing until accepted; shown end-to-end for at least one domain | VERIFIED (mechanics) / HUMAN NEEDED (interactive UI) | All three surfaces (`discuss-phase.md`, `quick.md`, `autonomous.md`) call `bm-sdk query craft-skill.match "<scope>"` at the per-task scope point only (verified by direct grep + the propose-on-fit-guard ordering checks). `tests/craft-skill-insertion.test.cjs` proves the full SEO chain through the real spawned CLI: match surfaces `seo-audit`, an unapproved insert returns `needs_approval:true` and writes nothing, the approved insert lands in `agent_skills.bm-executor`, the `agent-skills bm-executor` reader returns it while the `bm-planner` reader does not, and `release --id` clears it and stamps `released_at`. The actual interactive `AskUserQuestion` prompt (wording, option order, DATA boundary rendering) is not exercised by any automated test — it requires a live session. See Human Verification below. |

**Score:** 3/3 ROADMAP criteria mechanically verified; the interactive-UI portion of criterion 3 is deferred to human verification (not a failure — it is unverifiable by static/automated means).

### Plan-Level Must-Haves (merged from all 5 plan frontmatters)

| # | Truth | Status | Evidence |
|---|---|------------|----------|
| 4 | `craft-skill match` returns identical, correctly-shaped JSON in both twins (CJS and SDK) | VERIFIED | `node tests/craft-skill-sdk-parity.test.cjs` passes 10 checks including 4 `match` cases (SEO, DuckDB, no-hit, shell-metachar data-only) with `assert.deepStrictEqual` across twins. |
| 5 | Shared propose-on-fit reference is the single source of truth, wired into all three surfaces with no drift | VERIFIED | `node tests/craft-skill-propose-on-fit-guard.test.cjs` passes 16 static checks (headings/tokens in the reference; `craft-skill.match`/no-insert in discuss-phase; chain.md insert+release; quick ordering; autonomous allow-gate + no-sticky + ordering; executor doc note; no SKILL.md/hooks `craft-skill` token). Mutation test (recorded in 17-05-SUMMARY.md) proves the guard trips on a dropped gate token. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/lib/craft-skill-insert.cjs` | `matchCraftSkills` + `case 'match'` | VERIFIED | Present; `node tests/craft-skill-insertion.test.cjs` exercises it directly via spawned CLI. |
| `sdk/src/query/craft-skill.ts` | `matchCraftSkills` + `craftSkillMatch` handler, typed | VERIFIED | Present; `cd sdk && npx vitest run --project unit src/query/craft-skill.test.ts` -> 23/23 passed. |
| `sdk/src/query/command-static-catalog-domain.ts` | registry rows for `craft-skill.match` / `craft-skill match` | VERIFIED | Confirmed via SDK unit registry assertion (23 tests pass, includes registry case) and parity test exercising `sdk/dist/cli.js`. |
| `references/craft-skill-propose-on-fit.md` | full shared procedure, 60-130 lines | VERIFIED | 94 lines; contains all 8 required headings and every literal token the guard checks (`verdict === 'allow'`, `DATA_START`/`DATA_END`, `docx`/`pdf`/`pptx`, etc.); zero em/en-dashes; zero vendoring markers (`node tests/craft-skill-no-vendoring.test.cjs` 8/8 pass). |
| `agents/bm-executor.md` | document-deliverable routing note in `<project_context>` | VERIFIED | Paragraph present, no GSD bookkeeping tokens, no em-dash. |
| `workflows/discuss-phase.md` | `propose_craft_skill` step, progressive-disclosure row | VERIFIED | Step present between `analyze_phase` and `present_gray_areas`; file is 504 lines (<=505 budget); `craft-skill.insert` count is 0 (discuss-phase never inserts). |
| `workflows/discuss-phase/templates/context.md` | conditional `### Craft skills` subsection | VERIFIED | Present with `CS-01` placeholder and omit-if-none wording. |
| `workflows/discuss-phase/modes/chain.md` | in-session insert + release on the explicit chain | VERIFIED | Contains `craft-skill.insert`, `--approved`, `craft-skill.release --agent bm-executor --id`, ordered before the plan-phase dispatch. |
| `workflows/quick.md` | Step 2.1 propose + re-capture, Step 6.1 release | VERIFIED | Both steps present at correct line positions; ordering (match < recapture < release < Step 6.25) confirmed by guard test. |
| `workflows/autonomous.md` | 3b.5 auto-insert with allow gate, release in 3d | VERIFIED | Present; `verdict === 'allow'` literal present; `--sticky` absent; ordering (match < execute dispatch; release after 3d) confirmed. |
| `tests/craft-skill-propose-on-fit-guard.test.cjs` | static wiring guard, >=60 lines, in CI | VERIFIED | 16 checks, wired into `.github/workflows/check-drift.yml` directly after the parity step. |
| `sdk/dist/query/craft-skill.js`, `dist/bm` | committed build artifacts carry `craftSkillMatch` | VERIFIED | `grep -c craftSkillMatch sdk/dist/query/craft-skill.js` and the `dist/bm` copy both >=1; `node bin/build-bm.cjs --check` prints `bm drift check: PASS` on the current tree (re-run live during this verification, not just trusted from SUMMARY). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/lib/craft-skill-insert.cjs` | `CRAFT_SKILL_TRIGGER_INDEX` | `loadCatalogViews` | VERIFIED | Exercised by passing `match` tests. |
| `sdk/src/query/command-static-catalog-domain.ts` | `craft-skill.ts craftSkillMatch` | import + registry tuple | VERIFIED | SDK registry test passes; parity test runs `sdk/dist/cli.js query craft-skill.match`. |
| `workflows/quick.md` | `AGENT_SKILLS_EXECUTOR` capture | re-capture after insert | VERIFIED | `craft-skill.match` index precedes the last `AGENT_SKILLS_EXECUTOR=...` capture index (guard-checked ordering). |
| `workflows/autonomous.md` | `Skill(skill="gsd-execute-phase")` dispatch | 3b.5 runs before dispatch; release in 3d after wait | VERIFIED | Ordering confirmed by direct grep of line positions and the guard test. |
| `references/craft-skill-propose-on-fit.md` | three surfaces | lazy `@`/Read-only load when candidates non-empty | VERIFIED | All three workflow files reference `craft-skill-propose-on-fit.md` by path. |

### Behavioral Spot-Checks (re-run live during this verification)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CJS/SDK twins, catalog, trust gate | `node tests/craft-skill-catalog.test.cjs` | 37/37 passed | PASS |
| Structural trust gate | `node tests/skill-trust-gate.test.cjs` | 40/40 passed | PASS |
| Insertion spec incl. SEO e2e chain | `node tests/craft-skill-insertion.test.cjs` | 30/30 passed | PASS |
| No vendoring of third-party skill bodies | `node tests/craft-skill-no-vendoring.test.cjs` | 8/8 passed | PASS |
| CJS/SDK parity incl. `match` | `node tests/craft-skill-sdk-parity.test.cjs` | all checks passed, 10 `ok -` lines | PASS |
| Static wiring guard (ratchet) | `node tests/craft-skill-propose-on-fit-guard.test.cjs` | 16 `ok -` lines, all passed | PASS |
| SDK unit coverage for `craft-skill.ts` | `cd sdk && npx vitest run --project unit src/query/craft-skill.test.ts` | 23/23 passed | PASS |
| Build artifact drift | `node bin/build-bm.cjs --check` | `bm drift check: PASS (committed dist/bm matches a fresh build).` | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CAT-02 | 17-01, 17-02, 17-03, 17-04, 17-05 | Propose on fit: surface candidate(s) on trigger match, model judges relevance only, nothing injected until accept; autonomous refinement (allow-only, ephemeral, auto-insert) | SATISFIED | All 3 surfaces wired; REQUIREMENTS.md CAT-02 carries the "Autonomous refinement (Phase 17, D-08)" sub-bullet without altering the original "Nothing is injected until the user accepts" sentence (`grep -c` confirms both present). |
| CAT-06 | 17-02, 17-03, 17-04, 17-05 | v1 capabilities: SEO + DuckDB seeded, document generation routed to built-in doc skills | SATISFIED | Both seeds cataloged and insertable (see Truth 1); doc routing wired in executor + discuss-phase (see Truth 2); REQUIREMENTS.md CAT-06 line updated to "(Delivered: Phase 17, SEO seed wired propose-on-fit end to end; document deliverables routed to the built-in doc skills.)" |

No orphaned requirements: `grep -n "Phase 17"` in REQUIREMENTS.md only matches CAT-02 and CAT-06, both of which are declared in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

None blocking. Scanned all phase-modified product/workflow/test files (`references/craft-skill-propose-on-fit.md`, `bin/lib/craft-skill-insert.cjs`, `sdk/src/query/craft-skill.ts`, `workflows/discuss-phase.md`, `workflows/discuss-phase/modes/chain.md`, `workflows/discuss-phase/templates/context.md`, `workflows/quick.md`, `workflows/autonomous.md`, `agents/bm-executor.md`, `tests/craft-skill-propose-on-fit-guard.test.cjs`, `tests/craft-skill-insertion.test.cjs`, `tests/craft-skill-sdk-parity.test.cjs`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/em-dashes: no unreferenced debt markers found. Matches found were either pre-existing unrelated features (`cross_reference_todos` step, `mktemp ...XXXXXX` templates) or the anti-pattern detector's own documentation line in `agents/bm-executor.md` listing the strings it scans for (not a debt marker itself).

The code-review report (`17-REVIEW.md`, advisory, not a blocking gate per this phase's own convention) found 3 warnings, all pre-existing from Phase 16 and not introduced by Phase 17:
- WR-01: CJS `insert`/`release`/`list`/`assess`/`match` accept a value-less flag (e.g. `--agent` with no value) as the literal string `"true"` instead of rejecting it, unlike the SDK twin which coerces to `undefined`. Reachable only via a malformed CLI invocation, not through any of the three wired workflows (which always pass well-formed `--agent bm-executor --location <checkout>`).
- WR-02: SDK `pins.json` writes are not wrapped in the planning lock the CJS twin uses, a concurrency robustness gap under simultaneous `insert`/`release`.
- WR-03: `release` mutates a once-read in-memory `pins` object rather than re-reading fresh inside the lock, a TOCTOU asymmetry versus `insert`.

These are legitimate findings worth a follow-up but do not block the Phase 17 goal (wiring the three surfaces to the already-built Phase 16 primitives) since none are reachable through the documented, well-formed command lines the workflows emit.

### Human Verification Required

### 1. Live interactive accept prompt (quick / discuss-phase)

**Test:** Run a live quick task (or discuss-phase) whose task description/domain boundary contains a catalog trigger word, e.g. "Audit my site SEO and fix the sitemap".
**Expected:** The `AskUserQuestion` prompt appears with header `Catalog skill`; the question body renders the candidate's `prompt` lines (summary, `Publisher:`, `License:`, `Obligations:`, `Trust tier:`, `Pin:`, `Verdict:`) between `DATA_START`/`DATA_END`; the line "Insert into bm-executor for this task? Nothing is written until you accept." appears; options are, in order, `Accept (ephemeral, this task only)` (default), `Accept sticky (persist for bm-executor)`, `Skip`. Choosing `Skip` leaves `.planning/config.json` `agent_skills` unchanged. Choosing an accept option inserts ephemerally, the executor receives the skill, and the record is released after the executor returns.
**Why human:** This exercises Claude Code's actual `AskUserQuestion` tool rendering inside a live session. No static grep or spawned-CLI test can invoke or observe this tool; the automated SEO end-to-end test in `tests/craft-skill-insertion.test.cjs` deliberately simulates the "accept" step by passing `--approved` directly to the CLI, bypassing the interactive prompt entirely. This was explicitly flagged as deferred by the plan 17-03 executor itself (`17-03-SUMMARY.md`: "Not run here (needs a live session) ... Recorded for /bm:verify-work").

### Gaps Summary

No blocking gaps. All 5 ROADMAP/plan must-haves are mechanically verified against the actual codebase (not just SUMMARY.md claims): both seeds are cataloged and insertable, document deliverables route to built-in skills with no catalog/license exposure, and all three surfaces (discuss-phase, quick, autonomous) call `craft-skill.match` at the correct per-task point, inject nothing before accept (interactive) or the allow-gate (autonomous), and release correctly afterward. Every automated gate claimed in the SUMMARYs was independently re-run during this verification and passed: `craft-skill-catalog` (37/37), `skill-trust-gate` (40/40), `craft-skill-insertion` (30/30, including the SEO end-to-end chain), `craft-skill-no-vendoring` (8/8), `craft-skill-sdk-parity` (all pass), `craft-skill-propose-on-fit-guard` (16/16), the SDK vitest unit file for `craft-skill.test.ts` (23/23), and `node bin/build-bm.cjs --check` (PASS on the committed tree).

The one gap is not a code gap: the interactive `AskUserQuestion` accept-prompt behavior (wording, option order, DATA-boundary rendering, and the Skip-leaves-config-unchanged property) is real, specified behavior that can only be confirmed by running a live session — it was never claimed to be automatically tested, and the plan's own authors flagged it for human verification. This routes the phase to `human_needed` rather than `passed`, per the verification decision tree (human verification items present, even with a full must-have score).

---

_Verified: 2026-10-06T20:57:14Z_
_Verifier: Claude (gsd-verifier)_
