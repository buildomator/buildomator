<purpose>
Documentation-Driven Development (DDD) mode for `/gsd:new-project`. Research, write user-facing docs as the spec, have the user validate the docs, then derive phases from doc sections rather than from REQ-ID clusters.

This is a minimal sketch (v2.44.0). Per-phase doc-sync automation and docs-aware verification are held for a future release. For this release, manual doc updates during execution are expected; the DDD model is encoded primarily in the project-initialization sequence and the roadmapper's source-of-truth choice.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting. In particular, load `workflows/new-project.md` since this workflow delegates many shared steps to it.
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names, do not fall back to 'general-purpose'):
- gsd-project-researcher, Researches project-level technical decisions
- gsd-research-synthesizer, Synthesizes findings from parallel research agents
- gsd-roadmapper, Creates phased execution roadmaps (accepts DOCS.md input when `mode: ddd`)
</available_agent_types>

<process>

## 1. Setup

**Do exactly as in `workflows/new-project.md` Step 1 (Setup).** Load init JSON, agent skill payloads, detect runtime, validate `agents_installed`. No DDD-specific changes here.

Set `DDD_MODE=true` for the remainder of this workflow. This flag is the single signal that propagates DDD branching through the rest of the steps.

## 2. Questioning

**Do exactly as in `workflows/new-project.md` Step 2 (Questioning).** Deep context gathering, granularity / git / agents config, project name / type / audience.

One DDD-specific addition during questioning: ask the user to confirm the user-facing surface that DOCS.md will describe. For example:

- CLI: "What commands and flags will users type?"
- Library / SDK: "What API surface will consumers import?"
- API: "What endpoints and request / response shapes will clients call?"
- Plugin system: "What extension points will plugin authors implement?"

The answer determines DOCS.md's structure in Step 6.

## 3. Brownfield Mapping (optional)

**Do exactly as in `workflows/new-project.md` Step 3 (Brownfield Mapping).** If the project has existing code and the user opts in, run `/gsd:map-codebase` first. No DDD-specific changes.

## 4. Config Capture

**Do exactly as in `workflows/new-project.md` Step 4 (Config Capture)**, with one change: when writing `.planning/config.json` via `gsd-sdk query config-new-project`, include `"mode": "ddd"` in the top-level config. This marker signals downstream workflows (notably the roadmapper and any future docs-sync workflow) that this project uses DDD mode.

If the SDK schema does not yet accept `"mode": "ddd"`, write it anyway as a known-unknown, downstream consumers should ignore unrecognized mode values rather than error. Track this as a downstream SDK schema-update task to be picked up in the next plugin release.

## 5. Research

**Do exactly as in `workflows/new-project.md` Steps 6 and 7 (parallel research and synthesis).** Spawn `gsd-project-researcher` agents in parallel, then `gsd-research-synthesizer`. No DDD-specific changes.

Research output at `.planning/research/SUMMARY.md` will inform Step 6 (DOCS.md drafting). In particular, the synthesizer's "Implications for Roadmap" section should be reframed during Step 6 as "Implications for the user-facing surface", what should the docs cover, what should they elide.

## 6. DOCS.md Drafting (NEW, replaces Step 8 requirements gathering)

Write `.planning/DOCS.md` as the canonical user-facing documentation. This document is the spec, every later phase implements a section or chapter of this document.

**Structure of DOCS.md** (adjust headings to the project shape from Step 2):

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

Given the context already in scope (questioning answers, research summary), the orchestrator drafts DOCS.md directly using the `Write` tool. No subagent is needed for the minimal sketch; the context budget is acceptable because:

1. The questioning + research output is already loaded for STATE.md / PROJECT.md generation.
2. Writing DOCS.md is one focused task with a known structure.
3. Avoiding a subagent skips a spawn + return-message roundtrip.

If context pressure becomes a problem in practice (e.g. for very large research synthesis), a dedicated `gsd-ddd-docs-writer` agent can be introduced in a follow-up release.

**Quality bar for DOCS.md (orchestrator self-check before presenting):**

- Every user-facing capability described above is concrete enough that a competent implementer (Claude in execute-phase) could build it without re-asking the user.
- Every section header maps cleanly to a buildable scope (no section that's pure prose with no implementable surface).
- The Quick Start section, if literally followed by a future user, would work after the project is built.
- No section has the shape of a "GSD maintenance phase" placeholder (see v2.43.12 anti-thin-phase guidance in `gsd-roadmapper`).

## 7. User Validates DOCS.md (NEW)

Present DOCS.md to the user for validation before any phase work begins.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DOCS-DRIVEN DEVELOPMENT ▸ DOCS.md DRAFTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOCS.md is the spec for this project. Every phase will implement a
section of this document. Please read it before approving, feedback
now is much cheaper than feedback after the roadmap is locked.

Path: .planning/DOCS.md
Sections: {N} top-level, {M} total subsections
Length: {X} lines / {Y} words

What's next?
```

Use AskUserQuestion (or text-mode equivalent for non-Claude runtimes):

```
AskUserQuestion(
  header: "DOCS.md Approval",
  question: "Approve DOCS.md as the spec for this project?",
  options: [
    { label: "Approve (Recommended)", description: "DOCS.md is locked; proceed to roadmap generation." },
    { label: "Request revision", description: "Provide feedback; orchestrator revises DOCS.md and re-presents." },
    { label: "Edit manually", description: "Pause workflow so user can edit DOCS.md directly; re-invoke /gsd:new-ddd to resume from this point." }
  ]
)
```

**If "Request revision":** capture the user's feedback inline (freeform), apply targeted edits to DOCS.md (use `Edit` tool, not rewrite), re-present this approval prompt. Cap at 3 revision rounds before falling through to "Edit manually."

**If "Edit manually":** pause workflow. User edits DOCS.md, then re-invokes `/gsd:new-ddd` (which resumes from this validation step since DOCS.md exists and PROJECT.md is in place).

**If "Approve":** commit DOCS.md and continue:

```bash
gsd-sdk query commit "docs(ddd): lock DOCS.md as v1 spec" --files .planning/DOCS.md
```

## 8. Generate Thin REQUIREMENTS.md (traceability shell)

Several downstream workflows (notably `/gsd:plan-phase` and `/gsd:ship`) reference REQUIREMENTS.md for traceability tables and PR-body content. Generating a thin REQUIREMENTS.md from DOCS.md keeps those workflows working without changes.

For each major section in DOCS.md (each H2 heading), create one REQ-ID with the form `DOC-{NN}` and a description that points back to the DOCS.md section:

```markdown
## v1 Requirements (DDD mode: derived from DOCS.md)

| REQ-ID | Description | Source |
|--------|-------------|--------|
| DOC-01 | Implementation matches DOCS.md ## What It Is | DOCS.md#what-it-is |
| DOC-02 | Implementation matches DOCS.md ## Quick Start | DOCS.md#quick-start |
| DOC-03 | Implementation matches DOCS.md ## Commands | DOCS.md#commands |
| ...    | ... | ... |
```

This is the minimum-viable bridge for downstream workflows. A future release may auto-decompose H2 sections into finer-grained REQ-IDs (one per command, endpoint, etc.) once usage patterns are clearer.

```bash
gsd-sdk query commit "docs(ddd): derive REQUIREMENTS.md from DOCS.md sections" --files .planning/REQUIREMENTS.md
```

## 9. Spawn gsd-roadmapper (DDD mode)

**Do as in `workflows/new-project.md` Step 8 (roadmapper spawn)**, with these changes:

1. The spawn prompt explicitly tells the roadmapper that this project is in DDD mode:

```markdown
**Mode:** Documentation-Driven Development (DDD).
**Primary spec:** .planning/DOCS.md (read this first; it is the authoritative source of truth for what the project does).
**Requirements:** .planning/REQUIREMENTS.md (thin traceability shell derived from DOCS.md H2 sections).

Derive phases from DOCS.md sections rather than from REQ-ID clusters. Each phase should implement one coherent section (or a small group of related sections) of DOCS.md. Phase success criteria should be observable from DOCS.md, "after this phase, the section X of DOCS.md is a true description of the implementation."
```

2. The roadmapper agent's existing anti-thin-phase guidance (v2.43.12) applies as-is and is especially aligned with DDD: if a candidate phase has no clear DOCS.md section anchor, it is probably a thin phase and should be folded into a neighbor.

3. Pass the granularity setting from config.json as in standard new-project. The tighter Standard 4-6 default (v2.43.12) is the right baseline for DDD too.

After the roadmapper returns:

```bash
gsd-sdk query commit "docs(ddd): create roadmap from DOCS.md (${N} phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 10. STATE.md DDD Marker

After the roadmapper has written STATE.md, append a `## Mode` section near the top:

```markdown
## Mode

Documentation-Driven Development (DDD).

Primary spec: `.planning/DOCS.md`
Phase derivation: DOCS.md sections (not REQ-ID clusters)
Validation: implementation matches DOCS.md (per-phase doc-sync automation held for a future release; expect manual DOCS.md updates during execution when implementation diverges)
```

This marker is read by future workflows that need to behave differently under DDD (held for v2.45.x and later).

```bash
gsd-sdk query commit "docs(ddd): mark project as DDD mode in STATE.md" --files .planning/STATE.md
```

## 11. Next Up Block

**Do as in `workflows/new-project.md` final Next Up block**, with one DDD-specific addition: include a callout that DOCS.md is the canonical spec and that the user should update it whenever execution diverges.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT INITIALIZED (DDD MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOCS.md is the spec. Each phase implements a section.
When implementation diverges, update DOCS.md and re-validate.

▶ Next: /gsd:plan-phase 1
```

</process>

<success_criteria>
- [ ] `--auto` flag handled identically to new-project
- [ ] `agents_installed` validated; missing-agent warning surfaced if applicable
- [ ] Questioning includes the user-facing-surface confirmation (Step 2 addition)
- [ ] Brownfield mapping offered (same as new-project)
- [ ] `.planning/config.json` written with `mode: ddd`
- [ ] Research run (parallel) and synthesized
- [ ] DOCS.md drafted inline by orchestrator following the structure template above
- [ ] DOCS.md presented to user for validation (Approve / Request revision / Edit manually)
- [ ] DOCS.md committed only after approval
- [ ] REQUIREMENTS.md generated as a thin traceability shell derived from DOCS.md H2 sections
- [ ] `gsd-roadmapper` spawned with DDD-mode prompt directing it to derive phases from DOCS.md
- [ ] ROADMAP.md, STATE.md, REQUIREMENTS.md committed
- [ ] STATE.md has a `## Mode` section marking the project as DDD
- [ ] Next Up block emitted with the DOCS-update reminder
</success_criteria>

<notes_for_future_releases>

**Held for a future release (intentionally NOT in v2.44.0):**

- **Per-phase doc-sync workflow.** A `/gsd:docs-sync <phase>` step invoked between `execute-phase` and `verify-work` that detects implementation-vs-DOCS.md drift and updates DOCS.md sections that changed. Currently the user is expected to update DOCS.md manually during execution.
- **Docs-aware verification.** A `gsd-docs-checker` agent (or extension of `gsd-verifier`) that confirms the implementation actually matches the corresponding DOCS.md section, not just that tests pass.
- **DOCS.md drift detection in `/gsd:next`.** A check that warns if DOCS.md has been edited since the last phase's verification, prompting re-approval.
- **Auto-decomposition of DOCS.md into fine-grained REQ-IDs.** Currently REQUIREMENTS.md gets one DOC-NN per H2 section. A richer mapping (one REQ-ID per command, endpoint, extension point, etc.) would improve traceability in larger projects.
- **`gsd-ddd-docs-writer` subagent.** If inline orchestrator drafting becomes context-pressure problematic on large projects, extract DOCS.md generation to a dedicated agent.

These items are tracked for v2.45.x and beyond. Use the v2.44.0 release in real projects first to inform which of these is highest-leverage.

</notes_for_future_releases>
