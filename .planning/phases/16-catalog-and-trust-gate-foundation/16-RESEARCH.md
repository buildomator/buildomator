# Phase 16 Research: Catalog and Trust Gate Foundation

Seeded 2026-10-05 from committed exploration (not re-researched). Primary sources:
- `.planning/notes/jit-skill-catalog-design-261003.md` (design + license gate)
- `.planning/notes/craft-skills-survey-261003.md` (catalog candidates + tiers)
- `.planning/REQUIREMENTS.md` (CAT-01, CAT-03, CAT-04, CAT-05 for this phase)

## Existing mechanism this phase builds on (verified in-repo 2026-10-05)

The injection path already exists; Phase 16 adds the catalog + trust gate on top, it
does not build a new injector and does not loosen the security default.

- **Per-agent-type injection, on demand.** `sdk/src/query/skills.ts` (the `agent-skills`
  query) takes an agent type and looks up `config.agent_skills[agentType]`
  (`lookupByAgentName`, ~line 111), emits an `<agent_skills>` block (~line 209). Workflows
  query per agent type and interpolate into only that agent's `Task()` prompt, e.g.
  `workflows/execute-phase.md:60` (`query agent-skills bm-executor`),
  `workflows/docs-update.md:19` (`bm-doc-writer`), `workflows/secure-phase.md:21`
  (`bm-security-auditor`). 19 distinct agent types each query separately. Consequence a
  skill wired to one agent type never enters another agent's context and never loads at
  startup. This is the no-startup-tax property (CAT-05).
- **CJS twin.** The same semantics live in `bin/lib/init.cjs` (buildAgentSkillsBlock
  path, ~lines 1714-1780) and `bin/lib/security.cjs` `loadTrustedGlobalRoots` (~lines
  126-160). Both twins must stay in lock-step and `dist/bm` regenerated + `--check` PASS.
- **Entry forms the resolver already accepts** (`skills.ts` ~129-198): project-relative
  path (resolved within projectDir), `global:<name>`, and `global:<plugin>:<skill>`
  (load-by-name Skill-tool directive on the Claude runtime, added in #33, superpowers is
  the existing example).
- **Security default (keep strict).** `agent_skills_security.trusted_global_roots` is an
  opt-in allowlist; a `global:` skill resolving (via `realpathSync`) outside the runtime
  global skills dir is rejected as a symlink escape. `loadTrustedGlobalRoots` refuses the
  filesystem root and the home dir, drops non-existent entries, and defaults to empty
  (strict). Config schema keys: `agent_skills.<agent-type>` and
  `agent_skills_security.trusted_global_roots` (both twins: `bin/lib/config-schema.cjs`,
  `sdk/src/query/config-schema.ts`).

## What Phase 16 adds

1. **Catalog artifact (CAT-01).** A curated file (format TBD by the planner: JSON under
   `sdk/shared/` like model-catalog.json, or a `.planning`/references doc) mapping
   domain/trigger -> entry: `source`, `pinned_commit`, `license` (SPDX), `trust_tier`
   (A/B/C), `bundles_scripts` flag, `publisher`. Metadata + pins only, never skill bodies
   (reference-not-redistribute). Seed entries: SEO (coreyhaines31/marketingskills, MIT)
   and DuckDB (duckdb/duckdb-skills, MIT).
2. **Trust gate: safety (CAT-03).** Structural checks + a one-time human approve, never
   model-vouched. Publisher allowlist, bundled-`scripts/` review-or-ban, pinned commit
   (no floating HEAD).
3. **Trust gate: license (CAT-04).** Allow MIT/Apache-2.0/BSD/ISC; flag copyleft +
   source-available; block no-license/unknown/NC/proprietary. Record SPDX + one-line
   obligations; surface at the insert prompt. Note bundled tooling (e.g. CodeQL) carries
   its own license. Verified v1 licenses: SEO MIT, DuckDB MIT; Anthropic docgen is
   all-rights-reserved/Services-only -> BLOCKED (handled in Phase 17 via built-in doc
   skills, not here).
4. **Scoped insertion (CAT-05).** Accepting a candidate writes an `agent_skills.<agent>`
   entry (through the existing path) plus a `.planning` record (pinned commit) for
   reproducibility. Default ephemeral (remove after the task); sticky (persist in config)
   is an explicit opt-in. Never global, never startup.

## Constraints / gotchas for the planner

- Both resolver twins + rebuild `sdk/dist` (`npm --prefix sdk run build`); regen `dist/bm`
  (`node bin/build-bm.cjs`) and confirm `--check` PASS.
- `.planning` is gitignored (git add -f); executor runs on the MAIN tree (worktrees can't
  see gitignored PLAN.md).
- Product source/comments describe behavior only: no GSD bookkeeping (issue/PR numbers,
  wave/status, "CAT-0x") in `bin/lib` or `sdk/src` or their comments; those belong in the
  SUMMARY/plan.
- Do not vendor third-party skill bodies into the repo (a test or the drift gate should
  assert the catalog holds metadata + pins only).
- Keep the strict `trusted_global_roots` default unchanged; this phase must not widen it.
- No version bump / CHANGELOG here (release cut separately; ships on the 4.9.x line).

## Success criteria (from ROADMAP Phase 16)

1. Catalog schema with SEO + DuckDB entries (metadata + pins only), validated by a test.
2. Gate rejects no-license/unknown, proprietary, non-allowlisted publisher, unreviewed
   scripts; flags copyleft/source-available. Tests prove it.
3. Accepted skill injected into only its target agent type (ephemeral default, sticky
   opt-in); test shows it appears for that agent type only, not others, not at startup.
4. No third-party skill bodies vendored; test/drift-gate confirms metadata + pins only.
5. Both twins updated; `dist/bm` regenerated; `--check` PASS.
