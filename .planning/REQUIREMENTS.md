# Requirements: Craft Skill Catalog (v4.9.x)

Seeded 2026-10-05 from the committed exploration: `.planning/notes/jit-skill-catalog-design-261003.md`,
`.planning/notes/craft-skills-survey-261003.md`, the seed `.planning/seeds/jit-external-skill-catalog.md`,
and the todo for the Agent Skills spec upstream. Discussion, research, and scope were
settled in-conversation; this file records the resulting requirements.

## Goal

Let Buildomator reach external domain-craft skills just in time, proposed and assessed
only when a task enters their domain, injected into the one agent context that needs
them, with no startup token tax, no redistribution, and a trust gate on both safety and
license. Ships across the 4.9.x line (not a major bump; 5.0 stays reserved).

## Requirements

- **CAT-01 Catalog format.** (Delivered: Phase 16 Plan 01.) A curated catalog artifact maps domain/trigger to a pinned
  external skill with: source URL, pinned commit, SPDX license, trust tier (A/B/C), and
  a bundles-scripts flag. It is a vetted shortlist, not a mirror of the registry. Buildomator
  stores metadata + pins only; it never vendors third-party skill bodies into the repo.

- **CAT-02 Propose on fit.** When a phase or quick-task scope matches a catalog trigger,
  the workflow surfaces the candidate(s) for that domain. The model decides relevance
  only. Nothing is injected until the user accepts.

- **CAT-03 Trust gate: safety.** Insertion is gated structurally plus a one-time human
  approve, never by the model reading the skill and vouching for it. Checks: publisher
  allowlist, a review or ban of bundled `scripts/`, and a pinned commit (never floating
  HEAD).

- **CAT-04 Trust gate: license.** Allow OSI-permissive (MIT, Apache-2.0, BSD, ISC); flag
  copyleft and source-available for human decision; block no-license / unknown /
  non-commercial / proprietary-without-reviewed-terms. Record SPDX + a one-line
  obligation summary per entry and surface it at the insert prompt. Bundled tooling
  (for example CodeQL) carries its own license; check both. Label vendor skills factually,
  never implying endorsement.

- **CAT-05 Scoped insertion.** An accepted skill is wired into only the target agent type,
  via the existing `agent_skills` + `trusted_global_roots` path, and recorded in
  `.planning` for reproducibility. Default is ephemeral (removed after the task); sticky
  (persisted in config for that agent type) is an explicit opt-in. It never loads at
  startup and never enters other agents' contexts.

- **CAT-06 v1 capabilities.** Seed with SEO (coreyhaines31/marketingskills, MIT) and
  DuckDB (duckdb/duckdb-skills, MIT) as cataloged craft skills. Document generation uses
  Claude Code's built-in first-party doc skills (not cataloged, no license exposure),
  consistent with the Claude-Code-only directive. The Anthropic docgen skills are
  license-blocked for a third-party catalog (all-rights-reserved, Services-only).

- **CAT-07 Upstream watch.** Track the Agent Skills spec (agentskills.io /
  agentskills/agentskills) and skills.sh for catalog updates, VibeDrift-style (watch,
  do not vendor).

- **CAT-08 Own-skill conformance + ceiling.** A SKILL.md conformance gate over the 86
  plugin skills validates frontmatter against the Agent Skills spec and enforces a
  description-length cap and a total-skill-count ceiling (a loud-fail ratchet, like the
  jargon/prose gates), so adding skill #87 is deliberate. Adopt `skills-ref validate` to
  also vet catalog candidates (CAT-03).

## Out of scope (v1)

- Runtime auto-installer or any loosening of the strict `trusted_global_roots` default.
- Cataloging code-executing Tier-B skills beyond what the gate clears with human approve.
- Non-Claude-runtime portability work (plugin targets Claude Code).
- 5.0 / breaking changes.
