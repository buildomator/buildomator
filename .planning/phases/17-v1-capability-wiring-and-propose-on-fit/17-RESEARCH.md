# Phase 17: v1 Capability Wiring and Propose-on-Fit - Research

**Researched:** 2026-10-06
**Domain:** Wiring Phase 16 craft-skill machinery (catalog + trust gate + scoped insert) into three workflow surfaces, plus a new deterministic `match` subcommand in both twins.
**Confidence:** HIGH (every code surface read directly in-repo; the only non-code claim is the built-in doc-skill availability, which is already a locked project decision)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fire points (where a candidate surfaces)**
- **D-01:** Propose-on-fit wires into `discuss-phase`, `quick`, and `autonomous`. `plan-phase` and `execute-phase` are NOT wired in v1.
- **D-02:** Per-task check at the moment scope is known. Never a startup cost, never a per-turn cost. No injection, no catalog read at session start.

**Match method**
- **D-03:** Two-signal match. The deterministic `CRAFT_SKILL_TRIGGER_INDEX` cheaply pre-filters the catalog; the model then judges relevance only, never safety.
- **D-04:** Expose the pre-filter as a command (e.g. `craft-skill match <scope-text>`) in both twins. Returns candidate ids + metadata; the workflow/model applies the relevance judgment and the accept flow.
- **D-05:** "High-confidence match" = both signals agree: a trigger-index hit AND the model judges the candidate relevant. This threshold is what the autonomous auto-insert keys off.

**Accept UX (interactive: discuss-phase, quick)**
- **D-06:** Single accept prompt per candidate. Shows publisher label, SPDX license + one-line obligation summary, trust tier; on accept inserts the skill **ephemeral** into the target agent type. Sticky is a secondary opt-in, not the default.
- **D-07:** Nothing is injected until the user accepts in interactive modes. The structural trust gate from Phase 16 still runs on insert regardless.

**Autonomous policy (founder decision — scoped refinement of CAT-02)**
- **D-08:** In `/autonomous` a high-confidence match (D-05) **auto-inserts** rather than stalling or logging. Deliberate founder override of CAT-02's "nothing injected until the user accepts", scoped to autonomous mode only. Interactive modes keep the accept prompt.
- **D-09:** Auto-insert stays bounded by the Phase 16 structural trust gate — only auto-inserts when the gate passes (publisher allowlisted, OSI-permissive license, pinned commit, no unreviewed bundled `scripts/`) and the insertion is **ephemeral**. A candidate the gate would flag (copyleft/source-available) or block is never auto-inserted; it degrades to a logged notice. The model still never vouches for safety.
- **D-10:** Every autonomous auto-insert is recorded (the Phase 16 `.planning` pin record plus a line in the run output).
- **NOTE for planner/verifier:** D-08 intentionally diverges from literal CAT-02 for autonomous mode. REQUIREMENTS.md CAT-02 may want an addendum noting the exception so the milestone audit does not read it as a regression. Flag this, do not silently contradict the requirement.

**Document-deliverable routing (CAT-06)**
- **D-11:** Passive routing. When a scope is a document deliverable, the workflow notes that the built-in Claude Code doc skills (docx/pdf/pptx) should be used, relying on the executor already having them. No catalog entry, no trust gate, no license surface.
- **D-12:** A note in scope / executor guidance, NOT a second propose-on-fit mechanism. Built-in doc skills are first-party and always available; nothing to gate or accept.

### Claude's Discretion
- Exact CLI flag/subcommand shape for the match command and its JSON output schema.
- Exact wording of the accept prompt and the autonomous run-log notice lines.
- How the two-signal match is threaded through each workflow file, as long as the behavior holds.
- Which single domain (SEO or DuckDB) the end-to-end proof demonstrates.

### Deferred Ideas (OUT OF SCOPE)
- Propose-on-fit at `plan-phase` / `execute-phase` time (D-01).
- Agent Skills spec upstream watch + SKILL.md conformance gate — Phase 18 (CAT-07, CAT-08).
- Additional catalog entries beyond the two v1 seeds.
- An opt-in config flag to let autonomous auto-accept flagged (copyleft/source-available) licenses — intentionally excluded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-02 | Propose on fit: when a phase/quick-task scope matches a catalog trigger, surface the candidate(s); model decides relevance only; nothing injected until accept. | New `craft-skill match` command (deterministic trigger pre-filter over `CRAFT_SKILL_TRIGGER_INDEX`) + accept flow threaded into discuss-phase/quick/autonomous. Insert path (`insertCraftSkill`) already exists and is gated. D-08 refines CAT-02 for autonomous. |
| CAT-06 | v1 capabilities: SEO + DuckDB cataloged craft skills; document generation uses built-in first-party doc skills (not cataloged, no license exposure). | Both seeds already present in `sdk/shared/craft-skill-catalog.json` (verified). This phase proves insertability end-to-end + adds the passive doc-routing note. No new catalog entries. |
</phase_requirements>

## Summary

Phase 16 already shipped the entire mechanism: the catalog JSON with both v1 seeds, the two-axis trust gate, the deterministic trigger index, and the scoped `craft-skill list|assess|insert|release` surface in both twins (CJS `bin/lib/craft-skill-insert.cjs` + SDK `sdk/src/query/craft-skill.ts`). **Nothing calls any of it yet** — verified by grep: zero references to `craft-skill` in `workflows/` or `skills/`. Phase 17 is pure wiring plus one new deterministic command.

The work has three strands: (1) add a `match <scope-text>` subcommand to both twins that reads `CRAFT_SKILL_TRIGGER_INDEX`, returns the shortlisted candidate ids + the metadata the accept prompt needs (reusing `assessEntry`), and ships with a CJS/SDK parity test; (2) thread a propose-on-fit step into `discuss-phase`, `quick`, and `autonomous` at the point each surface knows the task scope — interactive accept for discuss/quick (D-06/D-07), high-confidence auto-insert bounded by the gate for autonomous (D-08/D-09/D-10); (3) add the passive document-deliverable routing note (D-11/D-12) as executor guidance, not a new mechanism.

**Primary recommendation:** Build `match` as a thin deterministic pre-filter in both twins (substring test of each lowercased trigger against the lowercased scope text, returning candidate ids plus `assessEntry` output), register it in `command-static-catalog-domain.ts` and the CJS `cmdCraftSkill` switch exactly like `list`/`assess`, and keep all per-surface propose-on-fit prose in a single lazy-loaded `references/craft-skill-propose-on-fit.md` that the three surfaces reference (discuss-phase.md is at 495 lines and uses progressive disclosure — inline bloat is not viable). Wire **both** insert (before the executor is spawned) and release (after it completes) — Phase 16 built release but nothing calls it, and "ephemeral removed after the task" depends on the release call existing.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deterministic trigger pre-filter (`match`) | CLI tooling (both twins: `bin/lib/*.cjs` + `sdk/src/query/*.ts`) | — | Must be reproducible and testable (D-04); lives beside the existing catalog/insert surface, not in a workflow. |
| Relevance judgment | Model (inside the workflow) | — | D-03: the model decides relevance only, never safety. Not code. |
| Safety/license gate | CLI tooling (`skill-trust-gate.cjs` / `.ts`, via `assessEntry`) | — | Phase 16 structural gate; the model never vouches. Reused unchanged. |
| Accept prompt + accept decision | Workflow surface (discuss-phase/quick) + user | CLI (`insert --approved`) | D-06/D-07: interactive, user-gated; the insert writes config + pin record. |
| Autonomous auto-insert decision | Workflow surface (autonomous.md) | CLI (`insert --approved`, gate via `assessEntry.verdict`) | D-08/D-09: workflow checks `verdict === 'allow'` before auto-inserting; insert itself only refuses `block`. |
| Scoped insertion + pin record | CLI tooling (`insertCraftSkill`) | config (`agent_skills.<agent>`) | Phase 16 path, reused as-is. |
| Ephemeral release after task | Workflow surface (quick/execute, autonomous) | CLI (`release --agent`) | Must be newly wired; release exists but is uncalled. |
| Document-deliverable routing | Executor guidance (passive note) | — | D-11/D-12: no mechanism, no catalog, no gate. |

## Phase 16 Code Surfaces (concrete signatures this phase calls into)

### Catalog JSON — `sdk/shared/craft-skill-catalog.json`
- `version: 1`, `licensePolicy` (allow/flagCopyleft/flagSourceAvailable/block arrays + `obligations` map keyed by SPDX id), `publishers` map, `skills` map. [VERIFIED: read in-repo]
- **Both v1 seeds are already present** (CAT-06): `seo-audit` (domain `seo`, publisher `coreyhaines31`, MIT, trust_tier **A**, `bundles_scripts: false`, `target_agents: ["bm-executor"]`) and `duckdb-query` (domain `data`, publisher `duckdb`, MIT, trust_tier **B**, `bundles_scripts: false`, declares `tooling: [{duckdb CLI, MIT}]`, `target_agents: ["bm-executor"]`). [VERIFIED: read in-repo]
- Per-entry `obligations` strings exist on both seeds ("Keep the copyright and permission notice..."). `licensePolicy.obligations` also carries the full SPDX→obligation map. The accept prompt (D-06) reads these directly — no new copy. [VERIFIED]
- Both seeds assess to **verdict `allow`** (MIT is in `allow`; seo-audit tier A passes; duckdb-query tier B declares tooling so it clears the `tier-b-undeclared-execution` check; its one tooling dep is MIT so no `tooling-license-blocked`). Confirmed by reading the gate logic against the entries. [VERIFIED]

### Catalog loader + views — `bin/lib/craft-skill-catalog.cjs` (SDK twin `sdk/src/craft-skill-catalog.ts`)
- `loadCraftSkillCatalog(overridePath?)` → validated catalog (fail-closed; `GSD_CRAFT_SKILL_CATALOG` env override honored ahead of layout paths). [VERIFIED]
- `deriveCatalogViews(cat)` → `{ CRAFT_SKILLS_BY_ID, CRAFT_SKILL_TRIGGER_INDEX, PUBLISHER_ALLOWLIST }`. [VERIFIED]
- **`CRAFT_SKILL_TRIGGER_INDEX` exact shape:** `Record<string, string[]>` — a lowercased-trigger-string → **sorted array of skill ids** map (a set is accumulated then `[...ids].sort()`). It is NOT a skill-id→triggers map; it is trigger→ids. Example built from the current catalog:
  ```json
  {
    "seo": ["seo-audit"], "search ranking": ["seo-audit"], "meta tags": ["seo-audit"],
    "core web vitals": ["seo-audit"], "indexing": ["seo-audit"], "sitemap": ["seo-audit"],
    "technical seo": ["seo-audit"],
    "duckdb": ["duckdb-query"], "sql over files": ["duckdb-query"], "parquet": ["duckdb-query"],
    "csv analysis": ["duckdb-query"], "query data files": ["duckdb-query"], "ad-hoc sql": ["duckdb-query"]
  }
  ```
  The `match` command iterates this map's keys and tests each against the scope text. [VERIFIED]
- Module is a singleton: it loads the committed catalog at require/import time and exports both the derived views and the derivation function (so `match` can re-derive from a `--catalog` override for tests). [VERIFIED]

### Insert / trust-gate path — `bin/lib/craft-skill-insert.cjs` (SDK twin `sdk/src/query/craft-skill.ts`)
- `cmdCraftSkill(cwd, args, raw)` dispatches a `switch (sub)` over **`list | assess | insert | release`**. The new `match` case is added here. The default case prints `Usage: craft-skill <list|assess|insert|release> [args]` — update it to include `match`. [VERIFIED]
- `parseFlags(args)` → `{ positional, flags }` (a `--flag value` / boolean `--flag` splitter). Reuse for `match`. [VERIFIED]
- `insertCraftSkill(cwd, { id, agent, location, sticky, approved, catalog })`:
  - Returns `error(...)` if `id|agent|location` missing. [VERIFIED]
  - Runs `assessEntry(entry, cat)`; **refuses only when `assessment.verdict === 'block'`** (`ERROR_REASON.SECURITY_SCAN_FAILED`). A `flag` verdict is NOT refused by insert. [VERIFIED — load-bearing for D-09]
  - If `!approved` and no prior approval record at the same pinned commit → returns `{ inserted: false, needs_approval: true, verdict, assessment, prompt }` (no write). [VERIFIED]
  - With `--approved` (or a prior approval): resolves `--location` to a local `SKILL.md`, checks frontmatter `name` === `entry.skill_name`, verifies local git HEAD === `pinned_commit` (a non-git dir is accepted with `pin_verified:false`), hashes the SKILL.md, writes a 19-key pin record to `.planning/craft-skills/pins.json`, and adds the entry to `config.agent_skills.<agent>` via `setConfigValue`. Returns `{ inserted: true, id, agent, entry, mode, pinned_commit, pin_verified, record_id, prompt }`. [VERIFIED]
  - `mode` = `sticky ? 'sticky' : 'ephemeral'` (ephemeral default). [VERIFIED]
- `releaseCraftSkills(cwd, { agent, id, includeSticky, all })`: removes matching non-released records' entries from `config.agent_skills.<agent>` and stamps `released_at`. **By default releases only `ephemeral` records** (`!includeSticky && r.mode !== 'ephemeral'` → skip). Returns `{ released: [...recordIds], remaining }`. [VERIFIED]
- CJS flags accepted by `insert`: `--agent`, `--location`, `--sticky`, `--approved`, `--catalog`. By `release`: `--agent`, `--id`, `--include-sticky`, `--all`. [VERIFIED]

### Trust-gate render — `bin/lib/skill-trust-gate.cjs` (SDK twin `sdk/src/skill-trust-gate.ts`)
- `assessEntry(entry, cat)` → `{ id, verdict, safety, license, tooling, scripts_banned, publisher, pinned_commit, source, skill_path, trust_tier, prompt }` where `verdict ∈ 'allow' | 'flag' | 'block'` and `prompt` is a `string[]` of ready-to-show lines:
  ```
  <id>: <summary>
  Publisher: <publisher.label>            (or "NOT ON ALLOWLIST (<id>)")
  License: <spdx> (<category>, <verdict>)
  Obligations: <obligation line>
  Tooling: <name> <license> (<verdict>)   (one per tooling dep)
  Trust tier: <tier>; bundled scripts: <none|reviewed at pin|unreviewed|BANNED, do not execute>
  Pin: <source> @ <commit> (<skill_path>)
  Finding: <message>                       (one per safety finding)
  Verdict: <verdict>
  ```
  This `prompt` array is exactly what the D-06 accept prompt should render. `renderAssessment(a)` joins it with newlines. [VERIFIED]

### Dispatch — `bin/gsd-tools.cjs` case `'craft-skill'` (line ~685)
- `case 'craft-skill': craftSkill.cmdCraftSkill(cwd, args, raw); break;` — the whole subcommand set is handled inside `cmdCraftSkill`, so adding `match` needs **no change here**. [VERIFIED]
- The top-level `TOP_LEVEL_USAGE` string (line ~372) already lists `craft-skill`; no change needed (it lists top-level commands, not subcommands). [VERIFIED]

### SDK query registration — `sdk/src/query/command-static-catalog-domain.ts`
- Craft-skill handlers are registered as registry-only entries (no manifest row), both dotted and spaced forms:
  ```
  ['craft-skill.list', craftSkillList], ['craft-skill list', craftSkillList],
  ['craft-skill.assess', craftSkillAssess], ['craft-skill assess', craftSkillAssess],
  ['craft-skill.insert', craftSkillInsert], ['craft-skill insert', craftSkillInsert],
  ['craft-skill.release', craftSkillRelease], ['craft-skill release', craftSkillRelease],
  ```
  Add `['craft-skill.match', craftSkillMatch]` and `['craft-skill match', craftSkillMatch]` here, importing `craftSkillMatch` from `./craft-skill.js`. [VERIFIED]
- `sdk/src/query/QUERY-HANDLERS.md` documents craft-skill as "Registry-only, no manifest row" — add `craft-skill.match` to that note. [VERIFIED]

### Existing parity test — `tests/craft-skill-sdk-parity.test.cjs`
- Spawns BOTH real entry points (`bin/gsd-tools.cjs <args>` for CJS, `node sdk/dist/cli.js query <args>` for SDK), compares observable output + on-disk effect. Covers `list`, `assess` (per seed id), and the two-skill `release` case. Uses `--catalog <committed catalog>` and an isolated `CLAUDE_CONFIG_DIR`. [VERIFIED]
- **Add a `match` case** following the same `runTwin('cjs'|'sdk', root, ['craft-skill','match', '<scope>', '--catalog', COMMITTED_CATALOG])` pattern, asserting `assert.deepStrictEqual(cjs, sdk)` on the candidate output. Requires the built `sdk/dist/cli.js`. [VERIFIED pattern]

## Standard Stack

No external packages. This phase edits in-repo tooling only. [VERIFIED: grep — no new deps]

| Surface | File(s) to edit |
|---------|-----------------|
| `match` command (CJS) | `bin/lib/craft-skill-insert.cjs` (new `matchCraftSkill` fn + `case 'match'` + export + usage string) |
| `match` command (SDK twin) | `sdk/src/query/craft-skill.ts` (new `matchCraftSkill` + `craftSkillMatch` handler) |
| SDK registration | `sdk/src/query/command-static-catalog-domain.ts` + `sdk/src/query/QUERY-HANDLERS.md` |
| Propose-on-fit prose (shared) | new `references/craft-skill-propose-on-fit.md` |
| discuss-phase surface | `workflows/discuss-phase.md` (lazy-load the reference at a new step) |
| quick surface | `workflows/quick.md` (+ `skills/quick/SKILL.md` objective note) |
| autonomous surface | `workflows/autonomous.md` (+ `skills/autonomous/SKILL.md` objective note) |
| doc-routing note | `agents/bm-executor.md` guidance + the shared reference |
| parity test | `tests/craft-skill-sdk-parity.test.cjs` (add `match` case) |
| CI | `.github/workflows/check-drift.yml` (parity step already present; add a step only if a new standalone match test file is created) |
| rebuild | `npm --prefix sdk run build` → `git add sdk/dist` → `node bin/build-bm.cjs` → `node bin/build-bm.cjs --check` |

**Package Legitimacy Audit:** Not applicable — this phase installs no external packages.

## Recommended `match` command shape (Claude's discretion — this is a recommendation)

Deterministic, no model, no network, no file reads (same discipline as the gate):

```
craft-skill match "<scope text>" [--catalog <path>]
```

Algorithm:
1. `loadCraftSkillCatalog(catalog)` + `deriveCatalogViews` → `CRAFT_SKILL_TRIGGER_INDEX` + `CRAFT_SKILLS_BY_ID`.
2. Lowercase the scope text once.
3. For each trigger key in the index, if `scopeLower.includes(trigger)`, collect the mapped ids and remember which trigger matched.
4. For each unique candidate id, build a result row from `CRAFT_SKILLS_BY_ID[id]` + `assessEntry(entry, cat)`:
   ```json
   {
     "scope": "<original scope text>",
     "candidates": [
       {
         "id": "duckdb-query",
         "domain": "data",
         "matched_triggers": ["duckdb", "parquet"],
         "publisher_label": "published by the DuckDB Foundation",
         "license": "MIT",
         "obligations": "Keep the copyright and permission notice ...",
         "trust_tier": "B",
         "verdict": "allow",
         "summary": "DuckDB query skill: ...",
         "target_agents": ["bm-executor"]
       }
     ]
   }
   ```
   Empty `candidates` when no trigger hits (the common case — D-02 cheap pre-filter).

Including `verdict` in the output lets the workflow/model avoid a second `assess` round-trip and lets autonomous key its D-09 gate check directly off `verdict === 'allow'`.

**Why substring, not fuzzy:** keeps the signal reproducible and parity-testable (D-04). The model's relevance judgment (D-03) is the second signal that compensates for a scope wording the triggers do not literally contain. Documented as a pitfall below.

## Architecture Patterns

### System flow (propose-on-fit, one surface)

```
task scope known (phase goal / quick description / autonomous phase goal)
        │
        ▼
craft-skill match "<scope>"  ──► CRAFT_SKILL_TRIGGER_INDEX substring pre-filter (deterministic)
        │                              │
        │                              ▼
        │                         candidates[] (+ assessEntry verdict, obligations, publisher)
        ▼
   candidates empty? ──yes──► do nothing (no injection, no prompt)   [D-02]
        │no
        ▼
   model judges relevance  (D-03: relevance only, never safety)
        │
   ┌────┴─────────────────────────────┐
   │ interactive (discuss/quick)       │ autonomous
   ▼                                   ▼
 show accept prompt (D-06):          high-confidence (verdict==allow AND relevant)?
  publisher + SPDX + obligation        │yes → insert --approved --agent <target> (ephemeral)  [D-08]
  + trust tier                         │      record pin + run-log line                        [D-10]
   │accept        │decline             │no/flag/block → logged notice, NO insert               [D-09]
   ▼              ▼                     ▼
 insert --approved  nothing          execute phase (executor reads agent_skills.<agent>)
 (ephemeral) [D-07]                     │
   │                                    ▼
   ▼                              release --agent <target>  (ephemeral cleared after task)
 executor reads it on spawn
   │
   ▼
 release after task
```

### Insertion point per surface (exact, from reading the files)

**quick** (`workflows/quick.md`): scope = the task description, known at **Step 1**. The executor's skills are captured at **Step 2** (`AGENT_SKILLS_EXECUTOR=$(bm-sdk query agent-skills bm-executor)`, line ~124) and the executor is spawned at **Step 6**.
- Thread `match` + accept + `insert` **after Step 1 and before the Step 2 agent-skills capture** (otherwise the captured `AGENT_SKILLS_EXECUTOR` is stale and won't include the just-inserted skill). Alternatively re-capture after insert.
- Thread `release --agent bm-executor` after Step 6 (executor done), e.g. in Step 7. This is the cleanest same-session end-to-end proof (match→accept→insert→execute→release).

**autonomous** (`workflows/autonomous.md`): runs discuss→plan→execute per phase in one run. Phase `goal`/`success_criteria` are stored at `discover_phases` (line ~153); `smart_discuss` (line ~516) is where per-phase scope is elaborated; execute is dispatched at line ~362 (`Skill(skill="gsd-execute-phase", ...)`).
- Thread the auto-insert path after scope is known (after `smart_discuss` / before the execute Skill dispatch): `match` → model relevance → if `verdict === 'allow'` AND relevant → `insert --approved --agent bm-executor` (ephemeral) + emit a run-log line (D-10). Flag/block or not-relevant → a logged notice, no insert (D-09).
- Release after execute returns (before iterating to the next phase).

**discuss-phase** (`workflows/discuss-phase.md`): scope = domain boundary, known after `analyze_phase` (line ~285). **This surface does not spawn an executor** — it only writes CONTEXT.md; execution is a separate later invocation. See Open Questions #1 — this is the single most important planning decision. Recommended: on accept, **record the accepted candidate in CONTEXT.md** (a decision/note the planner and executor consume) rather than an immediate ephemeral insert that would not survive to a separate execute session. An immediate ephemeral insert only reaches an executor when discuss→execute run in one `--chain`/autonomous session.

### Shared prose in a reference, not inline
`workflows/discuss-phase.md` is **495 lines** and already uses `<progressive_disclosure>` to stay within its size budget (it cites `tests/workflow-size-budget.test.cjs`). Put the propose-on-fit procedure in a new `references/craft-skill-propose-on-fit.md` and lazy-load it from a new step in each surface. This also keeps the three surfaces behaviorally identical (one source of truth) and keeps `autonomous.md` (already 783 lines) from growing further.

### Anti-Patterns to Avoid
- **Reading the catalog at session/startup.** Violates D-02. `match` runs only when scope is known.
- **Inlining the propose-on-fit prose into discuss-phase.md.** Breaks the size budget; use the lazy-loaded reference.
- **Relying on insert to reject flagged licenses.** Insert only refuses `block`. Autonomous D-09 must gate on `verdict === 'allow'` itself.
- **Inserting without wiring release.** Ephemeral means nothing if release is never called; "removed after the task" is a new wiring obligation.
- **Re-deriving trigger matching inline in each workflow.** D-04 says expose it as the `match` command; workflows call it, they do not re-implement it.
- **GSD bookkeeping in product code/comments.** No `CAT-02`, phase/wave numbers, or status notes in `bin/lib/*.cjs` or `sdk/src/*.ts` comments (CLAUDE.md generated-code hygiene). Describe behavior only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trigger shortlist | A new index/regex matcher in a workflow | `CRAFT_SKILL_TRIGGER_INDEX` via `match` | Already derived, sorted, deduped, parity-tested. |
| Accept-prompt copy | Hand-written publisher/license lines | `assessEntry(...).prompt` string[] | Ready-to-render, consistent with Phase 16, obligations already sourced. |
| Safety/license decision | Any workflow-level license check | `assessEntry` verdict | The gate is the authority; the model never vouches (D-03). |
| Scoped write + audit | Direct `agent_skills` config edits | `insertCraftSkill` / `releaseCraftSkills` | Pin record, approval lookup, pin verification, atomic writes all handled. |
| Doc generation capability | A catalog entry / gate for docx/pdf/pptx | Built-in first-party doc skills (passive note) | D-11/D-12: first-party, always available, no license surface. |

## Runtime State Inventory

> This is a wiring phase, not a rename/migration, but one runtime-state item matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `.planning/craft-skills/pins.json` — the pin/audit record written by `insert`, released by `release`. Gitignored (under `.planning/`). | No migration; new inserts/releases append/stamp records. Ephemeral records must be released after the task (new wiring). |
| Live service config | `config.agent_skills.<agent>` in `.planning/config.json` — `insert` adds the skill entry here; the executor reads it on spawn. | Insert before spawn, release after. Do not leave stale ephemeral entries. |
| OS-registered state | None — verified; no OS registrations involved. | None |
| Secrets/env vars | `GSD_CRAFT_SKILL_CATALOG` catalog override (used by tests/`--catalog`). Code reads only; unchanged. | None |
| Build artifacts | `sdk/dist/cli.js` (bundled SDK) and `dist/bm` (generated plugin) — both carry the `match` command after rebuild. | Rebuild + stage in order (see State of the Art). |

## Common Pitfalls

### Pitfall 1: Stale agent-skills capture in quick
**What goes wrong:** `quick.md` captures `AGENT_SKILLS_EXECUTOR` at Step 2; an insert done later never reaches the executor.
**How to avoid:** Run match/accept/insert before the Step 2 capture, or re-capture `agent-skills bm-executor` after insert.
**Warning signs:** Executor prompt lacks the accepted skill despite a successful insert + pin record.

### Pitfall 2: discuss-phase ephemeral insert evaporates
**What goes wrong:** An ephemeral insert at discuss time is released (or simply never read) because execution is a separate session.
**How to avoid:** Record the accepted candidate in CONTEXT.md; defer the actual insert to execute time, or only insert-now in chained/autonomous flows. See Open Questions #1.

### Pitfall 3: Autonomous auto-inserting a flagged skill
**What goes wrong:** `insert --approved` accepts a `flag`-verdict (copyleft/source-available) entry; only `block` is refused. Auto-passing `--approved` on a flagged candidate violates D-09.
**How to avoid:** Autonomous gates on `assessEntry.verdict === 'allow'` before inserting; `flag`/`block` → logged notice only.

### Pitfall 4: Insert needs a local checkout at the pinned commit
**What goes wrong:** `insert` requires `--location` pointing at a local `SKILL.md` whose frontmatter `name` matches and whose git HEAD matches `pinned_commit` (non-git dir accepted with `pin_verified:false`). Propose-on-fit surfaces a candidate, but insert cannot run without the skill source present locally.
**How to avoid:** Decide how the skill gets checked out before insert (fetch/clone at pin, or a user-provided path). For the end-to-end proof, a fixture checkout works (the parity test writes a minimal `SKILL.md` in a non-git dir and inserts with `--approved`). See Open Questions #2.

### Pitfall 5: Over-narrow substring pre-filter
**What goes wrong:** A scope like "analyze CSV data" misses the trigger "csv analysis" (word order differs), so no candidate surfaces.
**How to avoid:** Accept this for v1 (the model's relevance signal is secondary, not a rescuer of a missed pre-filter). If coverage matters, the planner may add token-overlap matching inside `match` (still deterministic, still parity-testable) — Claude's discretion. Keep substring as the baseline.

### Pitfall 6: dist regeneration order
**What goes wrong:** `node bin/build-bm.cjs` enumerates source via `git ls-files` (tracked files only). A freshly built but unstaged `sdk/dist/cli.js` is invisible, so `dist/bm` is built from the old bundle and `--check` passes against stale output.
**How to avoid:** `git add sdk/dist` **before** running `build-bm`. (STATE.md Phase 16 P05 decision.)

## Code Examples

### Reading the trigger index (both twins export this)
```js
// Source: bin/lib/craft-skill-catalog.cjs deriveCatalogViews (verified in-repo)
const { loadCraftSkillCatalog, deriveCatalogViews } = require('./craft-skill-catalog.cjs');
const cat = loadCraftSkillCatalog(opts.catalog);
const { CRAFT_SKILL_TRIGGER_INDEX, CRAFT_SKILLS_BY_ID } = deriveCatalogViews(cat);
// CRAFT_SKILL_TRIGGER_INDEX: { "duckdb": ["duckdb-query"], "parquet": ["duckdb-query"], ... }
```

### The accept prompt is already built
```js
// Source: bin/lib/skill-trust-gate.cjs assessEntry (verified in-repo)
const a = assessEntry(CRAFT_SKILLS_BY_ID[id], cat);
// a.verdict -> 'allow' | 'flag' | 'block'
// a.prompt  -> string[] ready to render (publisher, license, obligations, trust tier, pin, findings, verdict)
```

### Accept → insert (interactive)
```bash
# after the user accepts in discuss/quick
bm-sdk query craft-skill.insert <id> --agent bm-executor --location <checkout-path> --approved
# ephemeral by default; add --sticky only on the secondary opt-in
```

### Release after the task
```bash
bm-sdk query craft-skill.release --agent bm-executor   # clears ephemeral records for that agent
```

## State of the Art

| Old (Phase 16) | Now (Phase 17) | Impact |
|----------------|----------------|--------|
| `craft-skill list|assess|insert|release` exist, unused | add `match`; wire all of it into 3 surfaces | First real callers of the Phase 16 surface. |
| Trigger index derived but unused | `match` consumes it as the deterministic pre-filter | D-03/D-04 realized. |
| release built, never called | release wired after each task | "ephemeral removed after task" becomes real. |

**Build/check discipline (exact order):**
1. Edit CJS twin (`bin/lib/craft-skill-insert.cjs`) and SDK twin (`sdk/src/query/craft-skill.ts` + `command-static-catalog-domain.ts` + `QUERY-HANDLERS.md`).
2. `npm --prefix sdk run build` (tsc + esbuild bundle → `sdk/dist/cli.js`).
3. `git add sdk/dist` (stage before building dist/bm — tracked-files enumeration).
4. `node bin/build-bm.cjs` (regenerate `dist/bm`).
5. `node bin/build-bm.cjs --check` → must print `bm drift check: PASS`.
6. Run tests: `node tests/craft-skill-sdk-parity.test.cjs` (+ the other craft-skill tests). SDK test project: `vitest run --project unit` under `sdk/`.

**Deprecated/outdated:** none relevant.

## Validation Architecture

> nyquist_validation is absent from `.planning/config.json` → treated as enabled → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Zero-dep Node `node:assert` harness for CJS twin tests (e.g. `tests/craft-skill-sdk-parity.test.cjs`); Vitest for SDK (`sdk` project `unit`) |
| Config file | `.github/workflows/check-drift.yml` runs the CJS craft-skill tests; `sdk/vitest` for SDK specs |
| Quick run command | `node tests/craft-skill-sdk-parity.test.cjs` |
| Full suite command | the craft-skill test steps in `check-drift.yml` + `npm --prefix sdk test` + `node bin/build-bm.cjs --check` |

### Observable behaviors that MUST be validated
| Req | Behavior | Test Type | Automated Command | Exists? |
|-----|----------|-----------|-------------------|---------|
| CAT-02 | `match <scope>` returns the right candidate ids for an SEO and a DuckDB scope, and `[]` for an unrelated scope | unit (both twins) | add `match` case to `tests/craft-skill-sdk-parity.test.cjs` | ❌ Wave 0 |
| CAT-02 | `match` output is byte-identical across CJS and SDK twins | parity | same file, `assert.deepStrictEqual(cjs, sdk)` | ❌ Wave 0 |
| CAT-02 | End-to-end for one domain: match → accept → `insert --approved` → entry appears in `agent_skills.bm-executor` → `release` clears it | integration | new test or extend the insertion test | ❌ Wave 0 |
| CAT-02/D-07 | Nothing injected until accept (insert without `--approved` returns `needs_approval:true`, writes nothing) | unit | already covered by `tests/craft-skill-insertion.test.cjs`; assert in the new e2e | partial ✅ |
| D-09 | A flag-verdict entry is not auto-inserted by the autonomous path (workflow gates on `verdict==='allow'`) | unit over the gate verdict + a workflow-prose guard test | assert `assessEntry` verdict for a flag fixture; optional prose guard like existing workflow guard tests | ❌ Wave 0 |
| CAT-06/D-11 | Doc-routing note is present in executor guidance / the shared reference | static guard | grep-style guard test (pattern like `tests/*-guard.test.cjs`) | ❌ Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `node tests/craft-skill-sdk-parity.test.cjs` + rebuild `--check`.
- **Per wave merge:** all craft-skill test steps + `npm --prefix sdk test`.
- **Phase gate:** full craft-skill suite green + `node bin/build-bm.cjs --check` PASS before `/bm:verify-work`.

### Wave 0 Gaps
- [ ] `match` case added to `tests/craft-skill-sdk-parity.test.cjs` (covers CAT-02 twin parity).
- [ ] End-to-end match→accept→insert→release proof for one domain (new test or extend `tests/craft-skill-insertion.test.cjs`).
- [ ] Optional static guard asserting the doc-routing note exists.
- [ ] If a standalone match test file is created, add a step to `.github/workflows/check-drift.yml`.

## Security Domain

> security_enforcement absent → enabled by default. This phase adds no auth/network/crypto surface; the Phase 16 structural gate is the relevant control and is reused unchanged.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `match` scope text is used only for lowercase substring comparison against a fixed trigger set — never shell-expanded, never a path, never eval'd. Treat as opaque data (the quick SKILL already mandates DATA boundaries for artifact content). |
| V1/V10 Supply chain / trust | yes | Phase 16 trust gate (`assessEntry`) + publisher allowlist + pinned-commit verification; autonomous auto-insert bounded to `verdict==='allow'` (D-09). No skill bodies vendored. |
| V2/V3/V4/V6 (auth/session/access/crypto) | no | Not touched by this phase. |

### Known threat patterns for this stack
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Scope text injected into a shell/agent prompt | Tampering/Elevation | `match` treats scope as data only; render candidates with data boundaries, never interpolate raw scope into a command. |
| Auto-inserting an unvetted/flagged skill in autonomous | Elevation of privilege | D-09 gate: `verdict==='allow'` + pinned commit + ephemeral; model never vouches. |
| Stale ephemeral skill persisting into unrelated agents/tasks | Information disclosure | Wire `release` after the task; scoped to one agent type via `agent_skills.<agent>`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code ships built-in first-party document skills (docx/pdf/pptx) that are always available with no license surface. | Doc routing (CAT-06/D-11/D-12) | Low — this is already a locked project decision in CONTEXT.md/REQUIREMENTS.md; the phase only adds a passive note. If the built-ins are named/scoped differently, the note's wording (not a mechanism) is adjusted. `[CITED: .planning/REQUIREMENTS.md CAT-06; .planning/.../17-CONTEXT.md D-11]` |
| A2 | `tests/workflow-size-budget.test.cjs` enforces the discuss-phase size budget. | Architecture / reference-file recommendation | Low — discuss-phase.md itself cites this test and is at 495 lines with explicit progressive-disclosure; the recommendation to use a lazy-loaded reference holds regardless of whether the test file is currently present. `[ASSUMED]` |

## Open Questions

1. **discuss-phase accept semantics vs. D-06 "insert ephemeral."** discuss-phase writes CONTEXT.md and does not spawn an executor; execution is a later session. D-06 says accept inserts ephemeral into the target agent type, but an ephemeral insert at discuss time won't survive to a separate execute session.
   - What we know: the insert writes `config.agent_skills.bm-executor`; the executor reads it only when spawned (execute-phase.md:60).
   - Recommendation: in discuss-phase, on accept **record the candidate in CONTEXT.md** (a locked decision/note) and perform the actual ephemeral insert at execute time; perform an immediate ephemeral insert only in chained/autonomous single-session flows. Surface this for a planner/user decision — it is the one genuine behavioral ambiguity.

2. **How the skill source is checked out before insert.** `insert` requires a local `SKILL.md` at `--location` whose git HEAD matches the pinned commit. Propose-on-fit surfaces metadata only; the body is never vendored.
   - Recommendation: decide the checkout mechanism (fetch/clone at the pinned commit into a scratch/global skills dir, then `--location` that path) or document that the user supplies the checkout. For the end-to-end proof, use a fixture checkout (the parity test's pattern: minimal SKILL.md in a non-git dir, `--approved`, `pin_verified:false`).

3. **Where the autonomous run-log notice (D-10) is written.** A line in the run output is clear; confirm whether it should also append to a durable per-run log or rely solely on the pin record.

## Sources

### Primary (HIGH confidence — read in-repo 2026-10-06)
- `sdk/shared/craft-skill-catalog.json` — catalog schema, both seeds, obligations.
- `bin/lib/craft-skill-catalog.cjs` + `sdk/src/craft-skill-catalog.ts` — loader, `deriveCatalogViews`, `CRAFT_SKILL_TRIGGER_INDEX` shape.
- `bin/lib/craft-skill-insert.cjs` + `sdk/src/query/craft-skill.ts` — `cmdCraftSkill` switch, `insertCraftSkill`/`releaseCraftSkills` signatures and verdict handling.
- `bin/lib/skill-trust-gate.cjs` — `assessEntry` verdict + `prompt` shape.
- `bin/gsd-tools.cjs` (case `'craft-skill'`, TOP_LEVEL_USAGE) and `sdk/src/query/command-static-catalog-domain.ts` + `QUERY-HANDLERS.md` — dispatch/registration.
- `tests/craft-skill-sdk-parity.test.cjs` — parity-test pattern; `.github/workflows/check-drift.yml` — CI steps.
- `workflows/discuss-phase.md`, `workflows/quick.md`, `skills/quick/SKILL.md`, `workflows/autonomous.md`, `skills/autonomous/SKILL.md`, `workflows/execute-phase.md` — insertion points and agent-skills read paths.
- `bin/build-bm.cjs`, `package.json`, `sdk/package.json` — build/check discipline.
- `.planning/phases/16-catalog-and-trust-gate-foundation/16-RESEARCH.md`, `.planning/STATE.md` (Phase 16 P05 decision), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`.

### Secondary / project-locked
- `.planning/phases/17-.../17-CONTEXT.md` — D-01..D-12 (verbatim in User Constraints).

## Metadata

**Confidence breakdown:**
- Code surfaces / signatures / shapes: HIGH — read every file directly.
- `match` command recommendation: HIGH on mechanics (reuses verified exports); MEDIUM on exact schema (Claude's discretion).
- Insertion points: HIGH — located exact steps/lines in each workflow.
- Doc-routing availability (A1): MEDIUM — locked project decision, not independently re-verified this session.

**Research date:** 2026-10-06
**Valid until:** ~2026-11-05 (stable in-repo surfaces; re-check if Phase 16 files change before planning).
