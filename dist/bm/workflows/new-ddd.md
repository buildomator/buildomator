<purpose>
Documentation-Driven Development (DDD) mode for `/bm:new-project`. Research, write user-facing docs as the spec, have the user validate the docs, then derive phases from doc sections rather than from REQ-ID clusters.

Minimal sketch (v2.44.0): per-phase doc-sync automation and docs-aware verification are held for a future release. Manual doc updates during execution are expected; the DDD model is encoded in the project-initialization sequence and the roadmapper's source-of-truth choice.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting. In particular, load `workflows/new-project.md` since this workflow delegates many shared steps to it.
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names, do not fall back to 'general-purpose'):
- gsd:gsd-project-researcher, Researches project-level technical decisions
- gsd:gsd-research-synthesizer, Synthesizes findings from parallel research agents
- gsd:gsd-roadmapper, Creates phased execution roadmaps (accepts SPEC.md input when `mode: ddd`)
</available_agent_types>

<process>

## 1. Setup

**Do exactly as in `workflows/new-project.md` Step 1 (Setup).** Load init JSON, agent skill payloads, detect runtime, validate `agents_installed`. No DDD-specific changes here.

Set `DDD_MODE=true` for the remainder of this workflow. This flag is the single signal that propagates DDD branching through the rest of the steps.

## 2. Questioning

**Do exactly as in `workflows/new-project.md` Step 2 (Questioning).** Deep context gathering, granularity / git / agents config, project name / type / audience.

One DDD-specific addition during questioning: ask the user to confirm the user-facing surface that SPEC.md will describe. For example:

- CLI: "What commands and flags will users type?"
- Library / SDK: "What API surface will consumers import?"
- API: "What endpoints and request / response shapes will clients call?"
- Plugin system: "What extension points will plugin authors implement?"

The answer determines SPEC.md's structure in Step 6.

## 3. Brownfield Mapping (optional)

**Do exactly as in `workflows/new-project.md` Step 3 (Brownfield Mapping).** If the project has existing code and the user opts in, run `/bm:map-codebase` first. No DDD-specific changes.

## 4. Config Capture

**Do exactly as in `workflows/new-project.md` Step 4 (Config Capture)**, with one change: when writing `.planning/config.json` via `gsd-sdk query config-new-project`, include `"mode": "ddd"` in the top-level config. This marker signals downstream workflows (notably the roadmapper and any future docs-sync workflow) that this project uses DDD mode.

If the SDK schema does not yet accept `"mode": "ddd"`, write it anyway; downstream consumers should ignore unrecognized mode values rather than error. Track this as a downstream SDK schema-update task for the next plugin release.

## 5. Research

**Do exactly as in `workflows/new-project.md` Steps 6 and 7 (parallel research and synthesis).** Spawn `gsd-project-researcher` agents in parallel, then `gsd-research-synthesizer`. No DDD-specific changes.

Research output at `.planning/research/SUMMARY.md` will inform Step 6 (SPEC.md drafting). In particular, the synthesizer's "Implications for Roadmap" section should be reframed during Step 6 as "Implications for the user-facing surface", what should the docs cover, what should they elide.

## 6. SPEC.md Drafting (NEW, replaces Step 8 requirements gathering)

Write `docs/SPEC.md` as the canonical user-facing documentation. This document is the spec, every later phase implements a section or chapter of this document.

**Structure of SPEC.md** (adjust headings to the project shape from Step 2):

```markdown
# {Project Name}

> {One-line value proposition: what this is, who it's for}

<!-- DDD-SPEC: this document is the canonical spec for the project.
     Each phase in ROADMAP.md implements one or more sections below.
     When implementation diverges, update this document and re-validate. -->

## What It Is
{One paragraph: the project's purpose and shape}

## Who It's For
{Target audience, primary use cases}

## Quick Start
{Smallest possible end-to-end example: install, run, see result}

## {Surface Section, e.g. "Commands", "API Reference", "Endpoints", "Extension Points"}
{Detailed reference for the user-facing surface from the Step 2 questioning}

## Concepts
{Mental model: terminology, data shapes, key invariants users need to understand}

## Configuration
{Settings, environment variables, config files}

## Examples
{2-4 worked examples for common workflows}

## Limits and Non-Goals
{What this project will NOT do; out-of-scope deliberately}

## Roadmap (forward-looking, optional)
{If v1 vs v2 distinctions matter, sketch them here}
```

**How to write it inline (orchestrator):**

Using the context already in scope (questioning answers, research summary), the orchestrator drafts SPEC.md directly with the `Write` tool. No subagent for the minimal sketch. A dedicated `gsd-ddd-docs-writer` agent can be introduced later if context pressure becomes a problem on large projects.

**Quality bar for SPEC.md (orchestrator self-check before presenting):**

- Every user-facing capability described above is concrete enough that a competent implementer (Claude in execute-phase) could build it without re-asking the user.
- Every section header maps cleanly to a buildable scope (no section that's pure prose with no implementable surface).
- The Quick Start section, if literally followed by a future user, would work after the project is built.
- No section has the shape of a "GSD maintenance phase" placeholder (see v2.43.12 anti-thin-phase guidance in `gsd-roadmapper`).

**CRITICAL: Role separation between PROJECT.md and `docs/SPEC.md`**

PROJECT.md and SPEC.md are both initialized for DDD-mode projects, but they serve different audiences and have different scope rules. Keep them strictly separate; do not let GSD-internal language leak into SPEC.md.

| Aspect | PROJECT.md | `docs/SPEC.md` |
|---|---|---|
| Audience | GSD agents (planner, executor, verifier, roadmapper) and the user as project owner | Eventual users of the built software |
| Lives at | `.planning/PROJECT.md` (GSD-internal) | `docs/SPEC.md` (user-facing, ships with the project) |
| Can mention phases, plans, roadmap, GSD agents | YES, this is the right place for "Phase 1 will ship X", decisions log, constraints for planner | NO, never. Users do not care about GSD internals |
| Can mention internal architecture decisions, trade-offs | YES, this is the right place for "we chose Rust because Y" or in-scope vs out-of-scope reasoning | YES but only when user-relevant ("SQLite under the hood" is fine if users might care; "we chose SQLite because the planner agent flagged Postgres as overkill" is internal) |
| Can mention REQ-IDs, traceability tables, audit gates | YES, this is the right place for the requirements log | NO, REQ-IDs are GSD-internal naming |
| Talks in terms of | The project (intent, decisions, constraints, internal roadmap structure) | The product (what users can do, how they use it, what to expect) |
| When in doubt | Put it in PROJECT.md (low risk: agents read both) | If a sentence would read awkwardly in the project's eventual README, it belongs in PROJECT.md, not SPEC.md |

**Heuristic for the orchestrator drafting SPEC.md:** would a real user reading the file recognize it as the project's documentation, with no awareness that GSD was used to build it? If any sentence breaks that frame ("Phase 3 implements this", "Per the planner agent's decision...", "Roadmap-aligned with REQ-AUTH-02"), move it to PROJECT.md instead.

**Heuristic for the orchestrator drafting PROJECT.md:** PROJECT.md is the place to record the things SPEC.md must NOT say, including internal decisions, phase-level intent, agent-facing constraints, and the v1/v2 scoping that determines which capabilities go in this milestone vs. later ones.

## 7. User Validates SPEC.md (NEW)

Present SPEC.md to the user for validation before any phase work begins.

```
GSD > DOCS-DRIVEN DEVELOPMENT > SPEC.md DRAFTED

SPEC.md is the spec for this project. Every phase will implement a
section of this document. Please read it before approving, feedback
now is much cheaper than feedback after the roadmap is locked.

Path: docs/SPEC.md
Sections: {N} top-level, {M} total subsections
Length: {X} lines / {Y} words

What's next?
```

**Auto-approve gate (non-critical artifact):**

SPEC.md drafts are non-critical: the artifact lives on disk, can be revised by re-invoking the workflow, no destructive action is taken here, and the user can intervene later. These prompts auto-approve by default to avoid blocking AFK users.

```bash
AUTO_APPROVE=$(gsd-sdk query config-get workflow.auto_approve_non_critical --default true)
```

**If `AUTO_APPROVE` is `true`:** Skip the approval prompt. Log the auto-decision:

```bash
TS=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
mkdir -p .planning
if [ ! -f .planning/AUTO-DECISIONS.md ]; then
  cat > .planning/AUTO-DECISIONS.md <<EOF
# Auto-Decisions Log

GSD workflows logged these decisions as auto-approved (config: \`workflow.auto_approve_non_critical=true\`).
To require interactive approval on these prompts, set \`workflow.auto_approve_non_critical=false\` in \`.planning/config.json\`.

## Decisions Log

| Timestamp | Workflow | Decision | Artifact |
|---|---|---|---|
EOF
fi
echo "| ${TS} | /bm:new-ddd | Auto-approved SPEC.md draft | docs/SPEC.md |" >> .planning/AUTO-DECISIONS.md
```

Emit: `▶ Auto-approved SPEC.md draft (workflow.auto_approve_non_critical=true). Logged to .planning/AUTO-DECISIONS.md. Set the config to false to require interactive approval.`

Then continue to Step 8 (REQUIREMENTS.md generation).

**If `AUTO_APPROVE` is `false`:** Use AskUserQuestion:

```
AskUserQuestion(
  header: "SPEC.md Approval",
  question: "Approve SPEC.md as the spec for this project?",
  options: [
    { label: "Approve (Recommended)", description: "SPEC.md is locked; proceed to roadmap generation." },
    { label: "Request revision", description: "Provide feedback; orchestrator revises SPEC.md and re-presents." },
    { label: "Edit manually", description: "Pause workflow so user can edit SPEC.md directly; re-invoke /bm:new-ddd to resume from this point." }
  ]
)
```

**If "Request revision":** capture the user's feedback inline (freeform), apply targeted edits to SPEC.md (use `Edit` tool, not rewrite), re-present this approval prompt. Cap at 3 revision rounds before falling through to "Edit manually."

**If "Edit manually":** pause workflow. User edits SPEC.md, then re-invokes `/bm:new-ddd` (which resumes from this validation step since SPEC.md exists and PROJECT.md is in place).

**If "Approve":** commit SPEC.md and continue:

```bash
gsd-sdk query commit "docs(ddd): lock SPEC.md as v1 spec" --files docs/SPEC.md
```

## 8. Generate Thin REQUIREMENTS.md (traceability shell)

Several downstream workflows (notably `/bm:plan-phase` and `/bm:ship`) reference REQUIREMENTS.md for traceability tables and PR-body content. Generating a thin REQUIREMENTS.md from SPEC.md keeps those workflows working without changes.

For each major section in SPEC.md (each H2 heading), create one REQ-ID with the form `DOC-{NN}` and a description that points back to the SPEC.md section:

```markdown
## v1 Requirements (DDD mode: derived from SPEC.md)

| REQ-ID | Description | Source |
|--------|-------------|--------|
| DOC-01 | Implementation matches SPEC.md ## What It Is | SPEC.md#what-it-is |
| DOC-02 | Implementation matches SPEC.md ## Quick Start | SPEC.md#quick-start |
| DOC-03 | Implementation matches SPEC.md ## Commands | SPEC.md#commands |
| ...    | ... | ... |
```

This is the minimum-viable bridge for downstream workflows. A future release may auto-decompose H2 sections into finer-grained REQ-IDs (one per command, endpoint, etc.) once usage patterns are clearer.

```bash
gsd-sdk query commit "docs(ddd): derive REQUIREMENTS.md from SPEC.md sections" --files .planning/REQUIREMENTS.md
```

## 9. Spawn gsd-roadmapper (DDD mode)

**Do as in `workflows/new-project.md` Step 8 (roadmapper spawn)**, with these changes:

1. The spawn prompt explicitly tells the roadmapper that this project is in DDD mode:

```markdown
**Mode:** Documentation-Driven Development (DDD).
**Primary spec:** docs/SPEC.md (read this first; it is the authoritative source of truth for what the project does).
**Requirements:** .planning/REQUIREMENTS.md (thin traceability shell derived from SPEC.md H2 sections).

Derive phases from SPEC.md sections rather than from REQ-ID clusters. Each phase should implement one coherent section (or a small group of related sections) of SPEC.md. Phase success criteria should be observable from SPEC.md, "after this phase, the section X of SPEC.md is a true description of the implementation."
```

2. The roadmapper agent's existing anti-thin-phase guidance (v2.43.12) applies as-is and is especially aligned with DDD: if a candidate phase has no clear SPEC.md section anchor, it is probably a thin phase and should be folded into a neighbor.

3. Pass the granularity setting from config.json as in standard new-project. The tighter Standard 4-6 default (v2.43.12) is the right baseline for DDD too.

After the roadmapper returns:

```bash
gsd-sdk query commit "docs(ddd): create roadmap from SPEC.md (${N} phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 10. STATE.md DDD Marker

After the roadmapper has written STATE.md, append a `## Mode` section near the top:

```markdown
## Mode

Documentation-Driven Development (DDD).

Primary spec: `docs/SPEC.md`
Phase derivation: SPEC.md sections (not REQ-ID clusters)
Validation: implementation matches SPEC.md (per-phase doc-sync automation held for a future release; expect manual SPEC.md updates during execution when implementation diverges)
```

This marker is read by future workflows that need to behave differently under DDD (held for v2.45.x and later).

```bash
gsd-sdk query commit "docs(ddd): mark project as DDD mode in STATE.md" --files .planning/STATE.md
```

## 11. Next Up Block

**Do as in `workflows/new-project.md` final Next Up block**, with one DDD-specific addition: include a callout that SPEC.md is the canonical spec and that the user should update it whenever execution diverges.

```
GSD > PROJECT INITIALIZED (DDD MODE)

SPEC.md is the spec. Each phase implements a section.
When implementation diverges, update SPEC.md and re-validate.

▶ Next: /bm:plan-phase 1
```

</process>

<success_criteria>
- [ ] `--auto` flag handled identically to new-project
- [ ] `agents_installed` validated; missing-agent warning surfaced if applicable
- [ ] Questioning includes the user-facing-surface confirmation (Step 2 addition)
- [ ] Brownfield mapping offered (same as new-project)
- [ ] `.planning/config.json` written with `mode: ddd`
- [ ] Research run (parallel) and synthesized
- [ ] SPEC.md drafted inline by orchestrator following the structure template above
- [ ] SPEC.md presented to user for validation (Approve / Request revision / Edit manually)
- [ ] SPEC.md committed only after approval
- [ ] REQUIREMENTS.md generated as a thin traceability shell derived from SPEC.md H2 sections
- [ ] `gsd-roadmapper` spawned with DDD-mode prompt directing it to derive phases from SPEC.md
- [ ] ROADMAP.md, STATE.md, REQUIREMENTS.md committed
- [ ] STATE.md has a `## Mode` section marking the project as DDD
- [ ] Next Up block emitted with the DOCS-update reminder
</success_criteria>

<notes_for_future_releases>

**Held for a future release (intentionally NOT in v2.44.0):**

- **Per-phase doc-sync workflow.** A `/bm:docs-sync <phase>` step invoked between `execute-phase` and `verify-work` that detects implementation-vs-SPEC.md drift and updates SPEC.md sections that changed. Currently the user is expected to update SPEC.md manually during execution.
- **Docs-aware verification.** A `gsd-docs-checker` agent (or extension of `gsd-verifier`) that confirms the implementation actually matches the corresponding SPEC.md section, not just that tests pass.
- **SPEC.md drift detection in `/bm:next`.** A check that warns if SPEC.md has been edited since the last phase's verification, prompting re-approval.
- **Auto-decomposition of SPEC.md into fine-grained REQ-IDs.** Currently REQUIREMENTS.md gets one DOC-NN per H2 section. A richer mapping (one REQ-ID per command, endpoint, extension point, etc.) would improve traceability in larger projects.
- **`gsd-ddd-docs-writer` subagent.** If inline orchestrator drafting becomes context-pressure problematic on large projects, extract SPEC.md generation to a dedicated agent.

These items are tracked for v2.45.x and beyond. Use the v2.44.0 release in real projects first to inform which of these is highest-leverage.

</notes_for_future_releases>
