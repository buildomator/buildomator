# MVP Concepts — index

Cross-reference for the six MVP-related reference files. Each file has a single, narrow purpose. This index exists so future readers (and agents resolving `@`-refs) can find the right file without grepping the directory.

Canonical domain terms for the concepts named below live in [CONTEXT.md](../../CONTEXT.md) under "Domain terms" — start there if you need a precise definition.

## File map

| File | Purpose | Loaded by |
|---|---|---|
| `references/planner-mvp-mode.md` | **Rules.** Vertical-slice planning rules, slice ordering, Walking Skeleton constraints. | `gsd-planner` agent when `MVP_MODE=true` |
| `references/skeleton-template.md` | **Template.** Shape of `SKELETON.md` for new-project Phase 1 under `--mvp`. | `gsd-planner` agent when the Walking Skeleton gate fires |
| `references/user-story-template.md` | **Template.** Format and slot definitions for `As a / I want to / So that`. | `gsd-mvp-phase` workflow during interactive prompting; `gsd-planner` when emitting the `## Phase Goal` header |
| `references/spidr-splitting.md` | **Splitting discipline.** Five-axis decomposition (Spike, Paths, Interfaces, Data, Rules) for stories too large for one phase. | `gsd-mvp-phase` workflow when the user story exceeds size threshold |
| `references/execute-mvp-tdd.md` | **Gate.** MVP+TDD runtime gate semantics: when it fires, what it checks, halt-and-report protocol, end-of-phase blocking escalation, Behavior-Adding Task definition. | `gsd-executor` agent when `MVP_MODE=true && TDD_MODE=true` |
| `references/verify-mvp-mode.md` | **UAT framing.** Three-section UAT structure (user-flow → technical → coverage), anti-patterns, `User Flow Coverage` section in VERIFICATION.md. | `gsd-verifier` agent when the phase under verification has `mode: mvp` |

## Concept-to-file map

If you're looking for the canonical statement of a concept, this is where to find it:

- **MVP Mode resolution chain** — `workflows/plan-phase.md` Step 1 (CLI flag → roadmap → config → false). Mirrored in `execute-phase.md` and `verify-work.md`.
- **`**Mode:** mvp` parser** — `get-shit-done/bin/lib/roadmap.cjs` (`searchPhaseInContent` + `cmdRoadmapAnalyze`). Workflows compare against the parser output, never re-parse.
- **User Story regex** — `/^As a .+, I want to .+, so that .+\.$/` — applied at runtime by `gsd-verifier` (the user-story-format guard) and `gsd-mvp-phase` (interactive validation).
- **Behavior-Adding Task predicate** — `references/execute-mvp-tdd.md` (the canonical three-check definition). Applied at runtime by `gsd-executor`.
- **Walking Skeleton gate condition** — `workflows/plan-phase.md` (Phase 1 + new project + `--mvp` + no prior summaries → emit `SKELETON.md`).
- **MVP+TDD Gate** (RED→GREEN enforcement) — `references/execute-mvp-tdd.md`.
- **MVP-mode UAT framing** (user-flow first, technical deferred) — `references/verify-mvp-mode.md`.
- **Per-phase mode authoring** — `workflows/mvp-phase.md` (writes `**Mode:** mvp` to ROADMAP.md after collecting the user story).
- **Project-wide mode prompt at init** — `workflows/new-project.md` (Vertical MVP vs Horizontal Layers question).

## Interactions worth knowing

- **`--mvp` and `--prd <file>` together on Phase 1.** Both paths converge at the planner spawn. The PRD express path creates `CONTEXT.md` from the PRD file and continues to the research step; the Walking Skeleton gate fires independently when Phase 1 + new project + `--mvp`. The planner therefore receives both `WALKING_SKELETON=true` and PRD-derived context. This is intentional: the PRD informs what the skeleton should prove.
- **`MVP_MODE` is all-or-nothing per phase, not per task.** A phase is either MVP-mode or standard. Mixed-mode phases are not supported (PRD #2826 Q1).
- **`TDD_MODE` is independent of `MVP_MODE`.** TDD can be on without MVP, MVP can be on without TDD. Only the *intersection* (both true) activates the MVP+TDD Gate.
- **The `gsd-roadmapper` agent makes the MVP/standard decision once at project init** based on `PROJECT_MODE`. Per-phase opt-in/out happens later via `/bm:mvp-phase` or `/gsd-edit-phase`.

## Tests

Structural contract tests for each integration site live under `tests/`:

- `plan-phase-mvp-flag.test.cjs` — plan-phase MVP_MODE resolution chain
- `planner-mvp-mode.test.cjs` — gsd-planner agent MVP section
- `mvp-phase-command.test.cjs`, `mvp-phase-integration.test.cjs`, `mvp-phase-spidr.test.cjs` — `/bm:mvp-phase`
- `execute-mvp-tdd-gate.test.cjs`, `executor-mvp-tdd-section.test.cjs` — MVP+TDD Gate
- `verifier-mvp-section.test.cjs`, `verify-mvp-uat.test.cjs` — verifier UAT framing
- `new-project-mvp-prompt.test.cjs` — mode prompt at init
- `progress-mvp-display.test.cjs`, `stats-mvp-display.test.cjs`, `graphify-mvp-viz.test.cjs` — discovery surfaces
