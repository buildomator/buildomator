# Phase 18: Agent Skills Spec Upstream and SKILL.md Conformance Gate - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables, both locked by CAT-07 / CAT-08:

1. Track the Agent Skills spec (agentskills.io / `agentskills/agentskills` + skills.sh)
   as a 5th **idea-only** upstream: watch for spec and linter changes, VibeDrift-style.
   Never vendor it, never invoke it on the runtime path.

2. A loud-fail **SKILL.md conformance gate** over the plugin's own skills: validates
   frontmatter against the spec, enforces a description-length cap and a total-skill-count
   ceiling, wired into pre-commit + check-drift.yml. Plus adopting `skills-ref validate`
   so the Phase 16 trust gate can vet external catalog candidates (CAT-03).

Out of scope: the runtime external-skill catalog (propose/assess/install at runtime). That
is a separate feature (seed `jit-external-skill-catalog`, design note
`jit-skill-catalog-design-261003.md`). This phase only produces the validate step that
feeds that feature's trust gate.

</domain>

<decisions>
## Implementation Decisions

### Total-skill-count ceiling
- **D-01:** Soft headroom ceiling. Ceiling set at **90**; current count is **86**.
  The gate warns as the count approaches the ceiling (within the headroom band) and
  hard-fails only when the count would exceed 90. Rationale: keeps a brake on unbounded
  skill growth (the always-on startup token tax) without nagging on every single addition.
- **D-02:** The count is **SKILL.md files, not `skills/*/` subdirectories.** There are 87
  dirs but only 86 contain a SKILL.md; `skills/bundled/` is a bundled-assets directory, not
  a skill. Counting dirs would miscount by one. The gate globs `skills/*/SKILL.md`.

### Frontmatter conformance strictness
- **D-03:** Loud-fail (hard error) only on: missing or empty `name`, missing or empty
  `description`, and malformed `allowed-tools` when present. These are the fields that load
  at startup and carry the token cost.
- **D-04:** The spec's other fields — `license`, `compatibility`, `metadata` — are
  **advisory warnings only**, never hard failures. Our skills do not use them today and the
  spec marks them optional; failing on them would force an unrelated backfill into this phase.

### Description-length cap
- **D-05:** The cap is a **ratchet**, not a fixed number: baseline captured at the current
  longest description (**380 chars**, `skills/discuss-phase/SKILL.md`), loud-fail when any
  description grows past the baseline. `--write-baseline` regenerates deliberately; **no
  auto-regen in CI** (mirrors the jargon/prose gates and `feedback_jargon_detector_no_auto_regen`).
  Directly fights token-tax creep instead of permitting growth up to a generous fixed limit.

### Spec-upstream watch (CAT-07)
- **D-06:** New cron notifier mirroring `bin/check-vibedrift-release.sh`: **npm version of
  the skills-ref / skills.sh linter CLI is authoritative**; `agentskills/agentskills` GitHub
  releases are **best-effort** (`|| exit 0` guard). Same posture as the existing
  second-upstream watch (STATE.md decision on @vibedrift/cli). Ops/cron notifier only —
  watch, do not vendor, never invoke at runtime.
- **D-07:** Register the watch in the idea-only upstream list in **PROJECT.md** (where
  VibeDrift as "second upstream" is recorded), not only in a watch-list doc. The todo
  assumed `upstream-deferred.md`; the live register is PROJECT.md + the `bin/check-*.sh`
  cron scripts. Reconcile during planning.

### `skills-ref validate` adoption (CAT-08 / CAT-03)
- **D-08:** Hybrid. Port the validation rules **natively** into the CJS gate for our own 86
  skills (runs offline in pre-commit + check-drift.yml, and callable by the Phase 16 trust
  gate via `bm-sdk query`). For **untrusted external catalog candidates only**, allow an
  optional `npx skills-ref validate` shell-out at assess time (network-dependent, opt-in).
  Native path keeps our own gate offline and zero-dep ("watch, don't vendor at runtime",
  VibeDrift D-01); the npx path gives real upstream fidelity where third-party code warrants it.

### Claude's Discretion
- Exact warn-band threshold for the soft ceiling (e.g. warn at >=88).
- Exact npm package name for the linter CLI (research confirms: skills-ref vs a skills.sh
  package) and the GitHub release endpoint.
- Placement/name of the new watch script (`bin/check-agentskills-release.sh` vs other).
- Whether to also surface the spec's optional fields (`compatibility`, `metadata`) as
  advisory annotations in gate output.
- Whether this phase ships CJS-only (consistent with other `bin/maintenance` ratchets) or
  needs an SDK twin — likely CJS-only, confirm against the trust-gate call path.

### Folded Todos
- `2026-10-03-add-agent-skills-spec-as-upstream-and-skill-md-conformance-gate.md` — this todo
  IS this phase; folded in full. Its "optionally adopt useful spec fields" and "document (do
  not automate) the skills.sh consumption path in README" items are in scope.

</decisions>

<specifics>
## Specific Ideas

- Mirror the established loud-fail ratchet gates (`check-user-docs-jargon.cjs` /
  `check-user-docs-prose.cjs`) in both structure and CLI surface (`--dry`, `--write-baseline`,
  exit codes 0/1/2).
- Mirror the established second-upstream watch (`check-vibedrift-release.sh`) for the notifier:
  robust npm resolution, network pre-check, `|| exit 0` so cron never wedges, mail to maintainer.
- Document the `skills.sh` consumption path in README as opt-in (`npx skills add <owner/repo>`
  then wire via `agent_skills` + `trusted_global_roots`); do not loosen the strict default.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (locked)
- `.planning/REQUIREMENTS.md` — CAT-07 (upstream watch) and CAT-08 (own-skill conformance +
  ceiling, skills-ref adoption). These define the WHAT; decisions above define the HOW.
- `.planning/ROADMAP.md` — Phase 18 goal + 3 success criteria.

### Patterns to mirror
- `bin/maintenance/check-user-docs-jargon.cjs` — counts-based loud-fail ratchet: baseline
  capture, grow-fail, `--write-baseline`, no auto-regen. Template for the conformance/ceiling gate.
- `bin/maintenance/check-user-docs-prose.cjs` — companion ratchet, same shape.
- `tests/user-docs-jargon.test.cjs`, `tests/user-docs-prose.test.cjs` — test pattern for a ratchet.
- `bin/check-vibedrift-release.sh` — second-upstream cron watch notifier. Template for CAT-07.

### CI + pre-commit wiring (integration targets)
- `.github/workflows/check-drift.yml` — add a job for the new gate here.
- `bin/maintenance/check-drift.cjs` — drift orchestrator; wire the gate into the local runner.
- `bin/maintenance/pre-commit-drift-baseline.sh` + `bin/maintenance/install-git-hooks.sh` —
  pre-commit hook mechanism and installer.

### Upstream register + adjacent feature
- `.planning/PROJECT.md` — idea-only upstream register (VibeDrift "second upstream" precedent,
  ~lines 48 and 128); the 5th upstream is recorded here.
- `.planning/notes/jit-skill-catalog-design-261003.md` — the separate runtime external-skill
  catalog feature; this phase's validate step feeds its trust gate. Read to keep the seam clean.
- `.planning/todos/2026-10-03-add-agent-skills-spec-as-upstream-and-skill-md-conformance-gate.md`
  — folded source todo.

### Phase 16 integration point
- `.planning/phases/16-catalog-and-trust-gate-foundation/` — the craft-skill trust gate
  (`bm-sdk query craft-skill.assess` / `.insert`) that the native validator plugs into (D-08).

### External (the upstream being watched — not vendored)
- agentskills.io — the Agent Skills spec site.
- github.com/agentskills/agentskills — spec repo + `skills-ref validate` linter.
- skills.sh — catalog / `npx skills add` consumption path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Counts-based ratchet skeleton (`check-user-docs-jargon.cjs`): repo-root guard, pattern
  scan, baseline compare, `--dry` / `--write-baseline`, exit 0/1/2. Clone for the gate.
- VibeDrift cron notifier (`check-vibedrift-release.sh`): robust `npm` resolution across cron
  PATHs, network pre-check, `|| exit 0` wedge-guard, ssh/mail to maintainer. Clone for the watch.
- `check-drift.cjs` orchestrator + `check-drift.yml` job matrix: add one job/step.

### Established Patterns
- Loud-fail ratchet with a committed baseline, deliberately **no auto-regen** in CI
  (jargon/prose gates; `feedback_jargon_detector_no_auto_regen`).
- Watch, don't vendor; never invoke the upstream at runtime (VibeDrift D-01).
- Plugin-self maintenance tooling under `bin/maintenance/` is **CJS-only** (not twinned).
- SKILL.md frontmatter today uses `name`, `description`, `argument-hint`, `allowed-tools`.

### Integration Points
- Pre-commit hook (via `install-git-hooks.sh`) and a new `check-drift.yml` job.
- Phase 16 craft-skill `assess` trust step calls the native validator through `bm-sdk query`.

### Gotcha
- Count `skills/*/SKILL.md` (86), **not** `skills/*/` dirs (87). `skills/bundled/` is an
  assets dir with no SKILL.md and must not be counted or validated as a skill.

</code_context>

<deferred>
## Deferred Ideas

- Runtime external-skill catalog (propose/assess/install at runtime) — separate feature
  (seed `jit-external-skill-catalog`, design note `jit-skill-catalog-design-261003.md`).
  This phase only delivers the validate step that feeds its trust gate.

### Reviewed Todos (not folded)
- `add-more-programming-language-rule-packs`, `nextup-recommends-plan-for-already-planned-phase`,
  `drift-detector-followups-from-code-review`, `route-ideation-questions-to-explore`,
  `buildomator-advises-community-health-files`, `auto-advance-default-and-gap-escalation`,
  `collapse-plan-phase-upstream-gates`, `codify-general-comment-and-style-conventions`,
  `auto-accept-recommended-default-prompts` — keyword-matched only (drift/skills/phase terms),
  not part of this phase's scope. Left on the todo list.

</deferred>

---

*Phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate*
*Context gathered: 2026-10-11*
