---
created: 2026-10-03T00:00:00.000Z
title: Add the Agent Skills spec as the 5th idea-only upstream + a SKILL.md conformance/ceiling gate
area: tooling
files:
  - .planning/upstream-deferred.md (add agentskills.io / agentskills/agentskills to the watch list)
  - skills/*/SKILL.md (86 files the gate validates)
  - bin/ (new check script, pre-commit + check-drift.yml wiring, ratchet pattern)
  - README.md (Added features beyond upstream row, + skills.sh consumption doc)
---

## Problem

The Agent Skills spec (agentskills.io / `agentskills/agentskills`) is the formal,
vendor-neutral SKILL.md contract (frontmatter: name/description/license/
compatibility/metadata/allowed-tools; scripts/references/assets layout; progressive
disclosure) and ships a `skills-ref validate` linter. It is the direct analog to the
workspace.json spec already tracked as an idea-only upstream, but it is not on the
watch list.

Separately, the 86 plugin skills have no conformance gate and no size ceiling. Every
skill's name+description loads at startup, so skill count is an always-on token tax
(strains `feedback_minimize_workflow_tokens`), and there are addition paths
(spike-wrap-up, sketch-wrap-up) but no prune path (mirror of
`feedback_gsd_scope_asymmetry`).

## Solution

1. Track the Agent Skills spec as the 5th idea-only upstream in
   `.planning/upstream-deferred.md` (watch for spec changes + skills-ref releases).
2. Cash it out as a SKILL.md conformance gate over the 86 skills, in the existing
   loud-fail ratchet style (like the jargon/prose gates, see
   `feedback_jargon_detector_no_auto_regen`): validate frontmatter against the spec,
   enforce a description-length cap and a total-skill-count ceiling so adding #87 is
   a deliberate act. Wire into pre-commit + check-drift.yml.
3. Optionally adopt the spec's useful optional fields (compatibility, metadata)
   where they help.
4. Document (do not automate) the skills.sh consumption path in README:
   `npx skills add <owner/repo>` then wire via `agent_skills` + `trusted_global_roots`.
   Keep consumption opt-in; do not loosen the strict default.

This is the cheap, durable half of the skills.sh exploration (2026-10-03). The
expensive half (runtime catalog + propose/assess) is the separate seed
`jit-external-skill-catalog` and design note
`.planning/notes/jit-skill-catalog-design-261003.md`; the validate gate from here
feeds that feature's trust step. Fits the 4.9.x line.
