---
title: Just-in-time external skill catalog (propose + trust-gate domain craft, no startup tax)
trigger_condition: when a phase/quick-task repeatedly needs domain craft the 86 skills lack (SEO, docx/pdf/pptx/xlsx, Playwright e2e, framework packs, deep security tooling), or when scoping a 4.9.x substantial feature, or alongside adding the Agent Skills spec as an upstream
planted_date: 2026-10-03
---

# Just-in-time external skill catalog

Let Buildomator reach skills.sh / Anthropic domain-craft skills WITHOUT installing
them as plugin skills (which would grow the always-on startup token tax of the 86
and pull untrusted instructions into the `/bm:` namespace).

Shape: a curated catalog (domain -> pinned external skill, source, install signal,
trust tier) that costs nothing until a task enters its domain. When scope matches a
trigger, the workflow PROPOSES the candidate on fit (model), then GATES insertion on
trust (structural + human: publisher allowlist, `skills-ref validate`, scan/ban
bundled scripts, pinned commit, one-time human approve). On accept it writes a
project-scoped `agent_skills.<agent>` entry through the existing
`trusted_global_roots` path and records the pinned insertion in `.planning` for
reproducibility.

Key correction baked in: the model proposes on FIT only; it must never read a
third-party SKILL.md and vouch for its SAFETY (reading it is already ingesting
untrusted instructions). Safety is structural + human.

Full design: `.planning/notes/jit-skill-catalog-design-261003.md`.
Pairs with: the Agent Skills spec upstream todo (supplies skills-ref validate).
See also [[token-lean-sdk-query]].
