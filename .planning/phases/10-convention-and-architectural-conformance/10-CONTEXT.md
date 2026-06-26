# Phase 10: Convention and Architectural Conformance - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Stop a *new or changed* file from introducing cross-session convention/architectural drift, using
the conventions the codebase already exhibits (derived by majority vote, not hardcoded). This is
the **prevention** track. Two agents change:
- `gsd-pattern-mapper` gains a derived **Conventions** section in PATTERNS.md.
- `gsd-code-reviewer` gains three new **advisory** checks on changed files: convention conformance,
  verb-vs-body intent, and architectural-pattern split.

Repo-wide *detection*, the optional VibeDrift gate, `/gsd:scan --drift`, the intentional-dup
allowlist, and semantic (Type-4) duplication are **Phase 11** — out of scope here.

Requirements covered: CONV-01, CONV-02, CONV-03, CONV-04.
</domain>

<decisions>
## Implementation Decisions

### Convention derivation (CONV-01)
- **D-01:** `gsd-pattern-mapper` derives four axes by majority vote: identifier casing, file-name
  casing, export style, and import style. Emit a **named convention only when one variant clearly
  dominates (~>=70%)**. Below that threshold (near-even split / high entropy), emit
  "no dominant convention (high entropy) - author's choice" AND list the axis as a **contested
  hotspot** so the planner/reviewer know it is already inconsistent (hands Phase 11 a head start
  without doing repo-wide detection here).
- **D-02:** The derived conventions are written as a new **Conventions** section in PATTERNS.md
  (additive; pattern-mapper's existing analog-mapping output is unchanged).

### Finding severity / framing (CONV-02, CONV-03, CONV-04)
- **D-03:** `gsd-code-reviewer` gets a **new advisory tier `CONVENTION`**, ranked below WARNING,
  that **never blocks and never gates a merge**. Each finding states: the deviation, the derived
  convention it violates, and a suggested fix (recommend-fix framing). All three new checks
  (conformance, verb-vs-body, architectural-split) report at this tier. BLOCKER/WARNING semantics
  are untouched, so consistency nits never drown out real bugs.

### Review coupling (CONV-02)
- **D-04:** Convention derivation lives in a **single shared deterministic module** (in `bin/lib`,
  CJS) that is the one source of truth. `gsd-pattern-mapper` calls it to write the PATTERNS.md
  Conventions section; `gsd-code-reviewer` calls it **directly at review time** so code-review
  stays standalone (no dependency on plan-phase / pattern-mapper having run). **Phase 11's native
  fallback reuses the same module** (the roadmap's "build once in Phase 10" note). No duplicated
  extraction logic - which would itself be the CJS<->SDK duplication this milestone targets.

### Language coverage (CONV-04)
- **D-05:** **Language-agnostic architecture, JS/TS rule packs first.** Extraction is a pluggable
  layer (tree-sitter-style) so adding a language = new grammar + rule pack, no rewrite. The
  universally-generalizable convention axes (**file-name casing**, **identifier casing**) run
  language-agnostically. The idiom-specific checks (**verb-vs-body**, **architectural-split**:
  DI-vs-env access, error swallow/throw/wrap) ship as **JS/TS rule packs** in v1.3; on a language
  with no rule pack they **skip gracefully** rather than guess and emit noise. Covers
  `.cjs/.js/.mjs/.ts/.tsx` (the repo's actual stack and where VibeDrift's heuristics are proven).

### Todo cross-reference
- **D-06 [informational]:** The two low-confidence todo matches (`auto-accept-recommended-default-prompts`,
  `collapse-plan-phase-upstream-gates`) are **NOT folded** - both are keyword coincidences about
  prompt UX / plan-phase gates, unrelated to consistency drift. Left in pending/ for their own work.
  Negative decision (nothing to implement) - not a tracked plan requirement.

### Claude's Discretion
- Exact dominance threshold (start ~70%, tune on first run against this repo's CJS/SDK halves).
- The verb taxonomy for verb-vs-body (e.g. read-only: get/list/find/read/is/has; mutating:
  set/update/create/delete/save/write) - cherry-pick from VibeDrift's heuristic, confirm in research.
- The architectural-pattern catalog (which DI-vs-env and error-handling idioms to detect).
- Exact placement/format of the Conventions section in PATTERNS.md and the module's file name.
- The entropy metric formula used to decide "dominant vs contested."
</decisions>

<specifics>
## Specific Ideas

- "Investigate how the inspirational project does it, prefer language-agnostic if feasible" - the
  finding (D-05) is that VibeDrift is TS/Node-focused; language-agnosticism is feasible for the
  extraction architecture and the casing axes, not for the idiom checks (which degrade to noise
  without per-language rules). Decision honors the preference where it is real.
- The contested-hotspot output (D-01) should make the **CJS<->SDK dual resolver** visible as the
  prototype "intentional, contested" split - it is the running example throughout this milestone.
- Findings must use **recommend-fix framing**, never a blocking gate or a "(Recommended)"
  rubber-stamp prompt (consistent with prior project steers).
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Phase requirements and scope
- `.planning/REQUIREMENTS.md` - CONV-01..04 definitions and the milestone framing.
- `.planning/milestones/v1.3-ROADMAP.md` - Phase 10 goal, scope, success criteria, and the
  "build the convention-extraction once in Phase 10, reuse in Phase 11" dependency note.

### Heuristics to cherry-pick (the inspirational project)
- `.planning/milestones/v1.3-vibedrift-evaluation.md` - the differentiated findings to port
  (majority-vote convention derivation + entropy, verb-vs-body, architectural split), the **noise
  to suppress** (50-line opinions, unreachable-after-return, unused-export false positives), and
  the intentional-dup caveat (~38% of gsd-plugin dup findings were the deliberate CJS<->SDK resolver).
- `.planning/milestones/v1.3-semantic-dup-research.md` - mostly Phase 11 (Type-4 duplication), but
  the **extraction tooling** guidance is relevant here: `web-tree-sitter` (WASM, multi-language) +
  JS/TS grammars, function-level granularity, markdown out of scope, exclusion globs
  (`tests/**`, `dist/`, `sdk/dist/`, `*.generated.*`).

### Files modified by this phase
- `agents/gsd-pattern-mapper.md` - add the Conventions-section step + output format.
- `agents/gsd-code-reviewer.md` - add the CONVENTION advisory tier + the three checks to the
  `<adversarial_stance>` classification block and `<depth_levels>`.
- `workflows/code-review.md` - wire the shared module call into the review path.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-pattern-mapper` execution flow (`agents/gsd-pattern-mapper.md`): Step 5 "Identify Shared
  Patterns" -> Step 6 "Write PATTERNS.md". The Conventions section slots in as a new step before
  the write; the agent already does Glob/Grep codebase scans the derivation can build on.
- `gsd-code-reviewer` finding classification (`agents/gsd-code-reviewer.md` `<adversarial_stance>`):
  today BLOCKER/WARNING only. The new `CONVENTION` tier is added here. `<depth_levels>` already has
  language-aware, per-language check lists - the natural home for the JS/TS rule packs.
- `workflows/code-review.md` already passes an explicit changed-`files` list to the reviewer -
  the conformance check scopes to exactly those changed files.

### Established Patterns
- Deterministic helpers live in `bin/lib/*.cjs` (CommonJS) - the shared convention-derivation
  module (D-04) follows this convention. The TS SDK (`sdk/src`) mirrors some of these; whether the
  module needs a CJS+SDK twin depends on whether the SDK review path needs it (research question).
- The **CJS (`bin/lib/*.cjs`) <-> SDK (`sdk/src/**`) dual resolver** is the known *intentional*
  duplication and the prototype contested-hotspot example.
- `.planning/codebase/*.md` maps are STALE (they describe a different TS/Bun/React codebase) -
  derive conventions from the real repo, do not trust those maps.

### Integration Points
- New `bin/lib` convention-derivation module (one source of truth).
- `gsd-pattern-mapper` -> writes Conventions section into `{phase}-PATTERNS.md`.
- `gsd-code-reviewer` -> calls the module + emits `CONVENTION`-tier findings into `{phase}-REVIEW.md`.
</code_context>

<deferred>
## Deferred Ideas

- Repo-wide drift sweep, optional **VibeDrift external gate**, `/gsd:scan --drift`, the
  intentional-dup **allowlist** (`.semdup-allow.json`), and the `audit-milestone` pre-1.0 gate ->
  **Phase 11** (DRIFT-01..05).
- **Semantic (Type-4) duplication detection** (embeddings / web-tree-sitter pipeline) -> Phase 11
  native fallback / later.
- **Consistency-relative security** (VibeDrift finding: "N mutating routes lack auth while the
  codebase uses auth elsewhere") - interesting but not scoped to v1.3; note for a future milestone.
- **Markdown / workflow instruction-duplication** detection - different problem, out of scope.
- Adding non-JS/TS rule packs (Python, Go, etc.) - architecture supports it (D-05), packs deferred.

### Reviewed Todos (not folded)
- `auto-accept-recommended-default-prompts.md` - prompt-UX work, different scope.
- `collapse-plan-phase-upstream-gates.md` - plan-phase gate chaining, different scope.
</deferred>

---

*Phase: 10-convention-and-architectural-conformance*
*Context gathered: 2026-06-26*
