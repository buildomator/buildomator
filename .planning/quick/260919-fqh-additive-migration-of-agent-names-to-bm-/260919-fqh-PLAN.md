---
phase: quick-260919-fqh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/bm-*.md (33 files, git mv from agents/gsd-*.md, sole spawnable agent per role)
  - tests/agent-name-normalization.test.cjs (new)
  - sdk/shared/model-catalog.json
  - bin/lib/model-catalog.cjs
  - bin/lib/model-profiles.cjs
  - bin/lib/core.cjs
  - bin/lib/commands.cjs
  - bin/lib/verify.cjs
  - bin/lib/init.cjs
  - bin/lib/docs.cjs
  - bin/lib/install-profiles.cjs
  - bin/lib/surface.cjs
  - sdk/src/model-catalog.ts
  - sdk/src/query/config-query.ts
  - sdk/src/query/skills.ts
  - sdk/src/query/init.ts
  - sdk/src/query/init-complex.ts
  - sdk/src/query/docs-init.ts
  - sdk/src/query/validate.ts
  - sdk/src/tool-scoping.ts
  - sdk/src/index.ts
  - sdk/src/init-runner.ts
  - sdk/src/query/config-query.test.ts
  - sdk/src/query/skills.test.ts
  - sdk/src/query/init-complex.test.ts
  - sdk/dist/** (rebuilt)
  - workflows/**/*.md (~45 files: spawn refs, lookup sites, prose)
  - skills/*/SKILL.md (~15 files)
  - references/*.md (~25 files, incl. model-profiles.md, agent-contracts.md)
  - templates/*.md (~8 files)
  - README.md
  - CLAUDE.md
  - tests/agent-namespace-spawn.test.cjs
  - tests/fable-tier.test.cjs
  - tests/bm-parity.test.cjs
  - tests/bm-transform.test.cjs
  - tests/resolve-model-missing-config.test.cjs
  - tests/agent-skills-plugin-form.test.cjs
  - tests/surface-empty-manifest-agents.test.cjs
  - tests/lazy-mvp-refs.test.cjs
  - tests/code-fixer-worktree-gate.test.cjs
  - tests/gap-auto-routing.test.cjs
  - .github/workflows/check-drift.yml
  - dist/bm/** (regenerated mirror of all of the above)
autonomous: true
requirements: [QUICK-260919-FQH]

must_haves:
  truths:
    - "Exactly one agent file per role exists, agents/bm-<role>.md with name: bm-<role>; no agents/gsd-*.md remain and no generated alias files are introduced"
    - "Every internal spawn (subagent_type, available_agent_types lists) and every resolve-model / agent-skills lookup in workflows, skills, agents, bin, and sdk targets bm-<role>; zero subagent_type=\"gsd:gsd-<role>\" remain in source"
    - "resolve-model returns the same profile for gsd-planner and bm-planner on BOTH resolver twins (bin/gsd-tools.cjs and sdk/dist/cli.js); model_overrides and agent_skills keyed under either prefix resolve for a query under the other; a config keyed agent_skills.gsd-executor still resolves after the rename"
    - "The v4.7.3 Skill grants survive: the tools: line of every renamed file is byte-identical to its pre-rename form, and the 19 granted agents still list Skill"
    - "The persisted doc marker literal `generated-by: gsd-doc-writer` is unchanged everywhere it is a DATA literal, machine-checked in the agent bodies (agents/bm-doc-writer.md 4 occurrences, agents/bm-doc-verifier.md 1 occurrence) as well as in bin/lib/docs.cjs and sdk/src/query/docs-init.ts; zero `generated-by: bm-doc-writer` exists anywhere in the tree"
    - "node bin/build-bm.cjs --check passes; CJS battery has zero new failures beyond the baseline (context-monitor-hook-event, version-command); SDK unit suite green; integration failing set is a strict subset of the pre-change baseline"
    - "No version bump, no CHANGELOG entry, no Co-Authored-By; added lines contain no em/en-dash, no four-digit issue numbers, and never the word that means 'the one true form'"
  artifacts:
    - path: "agents/bm-planner.md"
      provides: "Sole agent file for the role, name: bm-planner (one of 33)"
      contains: "name: bm-planner"
    - path: "agents/bm-doc-writer.md"
      provides: "Renamed doc-writer agent whose emitted-marker prose still reads the gsd- literal (4 occurrences)"
      contains: "generated-by: gsd-doc-writer"
    - path: "tests/agent-name-normalization.test.cjs"
      provides: "Twin resolvers agree for gsd-/bm- names; agent-skills cross-prefix on both twins; catalog keys all bm-; zero legacy spawn refs in source; marker literal counts in agent bodies"
    - path: "sdk/shared/model-catalog.json"
      provides: "agents map keyed bm-<role> (33 keys, zero gsd- keys)"
      contains: "\"bm-planner\""
    - path: "bin/lib/model-catalog.cjs"
      provides: "normalizeAgentName, legacyAgentName, lookupByAgentName (CJS twin)"
    - path: "sdk/src/model-catalog.ts"
      provides: "normalizeAgentName, legacyAgentName, lookupByAgentName (SDK twin)"
  key_links:
    - from: "workflows/*.md"
      to: "agents/bm-<role>.md"
      via: "subagent_type=\"gsd:bm-<role>\" (transform renders bm:bm-<role> in dist/bm)"
      pattern: "subagent_type=\"gsd:bm-"
    - from: "bin/lib/core.cjs resolveModelInternal"
      to: "MODEL_PROFILES[bm-<role>]"
      via: "normalizeAgentName at entry; lookupByAgentName for model_overrides"
      pattern: "normalizeAgentName\\(agentType\\)"
    - from: "sdk/src/query/config-query.ts resolveModel"
      to: "MODEL_PROFILES[bm-<role>]"
      via: "same normalization as the CJS twin"
      pattern: "normalizeAgentName\\(.*agentType"
    - from: "bin/lib/init.cjs buildAgentSkillsBlock + sdk/src/query/skills.ts agentSkills"
      to: "config.agent_skills[<either prefix>]"
      via: "lookupByAgentName"
      pattern: "lookupByAgentName\\(.*agent_skills"
    - from: "agents/bm-doc-writer.md marker prose"
      to: "bin/lib/docs.cjs GSD_MARKER + sdk/src/query/docs-init.ts GSD_MARKER"
      via: "the agent emits the literal the code compares against; both sides must keep the gsd- spelling"
      pattern: "generated-by: gsd-doc-writer"
    - from: ".github/workflows/check-drift.yml"
      to: "tests/agent-name-normalization.test.cjs + tests/agent-namespace-spawn.test.cjs"
      via: "bm-build-drift job steps"
      pattern: "agent-name-normalization.test.cjs"
---

<objective>
Migrate the 33 GSD agent names from `gsd-<role>` to `bm-<role>`. `bm-<role>` becomes the sole, primary, spawnable agent (`gsd:bm-<role>` in the gsd plugin, `bm:bm-<role>` in the generated bm plugin). Backwards compatibility for the surfaces users actually touch (`.planning/config.json` keys under `model_overrides` and `agent_skills`, and the `resolve-model` / `agent-skills` CLI arguments) is delivered by name-normalization on both resolver twins: a leading `gsd-<role>` is accepted and resolved as `bm-<role>` through the 4.x line and stops resolving at v5.0 (2026-10-01, together with the `/gsd:` prefix and the `gsd-sdk` alias).

Purpose: the same additive-then-subtract-at-v5.0 playbook already used for `/gsd:` to `/bm:` (dist/bm) and `gsd-sdk` to `bm-sdk`, now applied to the last gsd-branded surface users see: agent names in `model_overrides`, `agent_skills`, `resolve-model`, and the `Agent` tool picker.

Output: 33 renamed `agents/bm-*.md`, a bm-keyed model catalog with normalizing resolvers on both twins, every internal spawn and lookup pointed at bm-, one new regression test, regenerated dist/bm, and a documented v5.0 subtraction list in the SUMMARY.

SCOPE DECISION (supersedes the earlier "both names spawnable" design): NO generated `agents/gsd-<role>.md` alias files, NO `bin/build-agent-aliases.cjs`, NO alias `--check` gate, NO `tests/agent-alias-parity.test.cjs`. Nothing external spawns our agents by name (`subagent_type` is internal and this plan repoints all of it to bm-), so a spawnable gsd- alias serves a case that does not occur. Compatibility lives entirely in the lookup layer, which is a pure string function on each twin and a clean deletion at v5.0.

CRITICAL ORDERING: a config key or CLI argument spelled `gsd-<role>` must keep working at every commit, and a `bm-<role>` reference must never point at nothing. So Task 1 makes both resolver twins, the skills lookup, and the install/prune paths accept both spellings while the files are still named gsd- (tree consistent: legacy filenames are accepted by checkAgentsInstalled). Task 2a renames the 33 files (name: line only) and commits that alone, so the rename is a small, mechanically verifiable diff that never has to be re-derived (tree consistent: spawn refs still say gsd:gsd-<role>, which the Task 1 lookup layer resolves, and checkAgentsInstalled accepts the bm- filenames). Task 2b then moves every internal reference to bm- in one sweep commit that can be reset and retried on its own if the sweep misbehaves (tree consistent: every spawn and lookup targets a file and a catalog key that exist). Task 3 regenerates dist/bm, runs every gate, and writes the SUMMARY.

SWEEP RULE (applies to Task 2b): the anchored role substitution rewrites agent SPAWN and NAME references only (subagent_type values, available_agent_types lists, resolve-model / agent-skills arguments, agents/<file>.md path mentions, prose naming an agent). It must NOT rewrite data literals that happen to contain a role name. The one known data literal is the persisted doc marker `<!-- generated-by: gsd-doc-writer -->`: the code in bin/lib/docs.cjs and sdk/src/query/docs-init.ts deliberately keeps comparing against that literal (GSD-generated-doc detection for staleness and overwrite decisions), and the agent bodies of doc-writer (4 lines) and doc-verifier (1 line) are PROSE telling the agent which literal to emit or skip. Rewriting those lines to bm-doc-writer would make new docs invisible to the detector. So the sweep carries a negative guard for lines containing `generated-by: gsd-` and the marker counts are machine-checked in the agent bodies, not just in the two code files.

SCOPE NOTE FOR THE ORCHESTRATOR (total file-count impact): about 185 source paths (33 renames + 1 new test + roughly 150 edited files) plus the dist/bm mirror of the same set (build-bm mirrors agents, bin, sdk, tests, workflows, skills, references, templates, README, CLAUDE.md), so roughly 370 git paths in the final diff. That is down from about 440 in the alias design (36 new files and 33 committed alias twins removed). Task 2b's prose sweep (about 100 of the edited .md files) is one anchored perl substitution over the 33 exact role names with a marker guard; it is the largest file count and the smallest risk, and it is what makes the v5.0 removal a pure subtraction (no lingering gsd- prose to chase later).
</objective>

<execution_context>
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/bm/4.7.1/workflows/execute-plan.md
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/bm/4.7.1/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@bin/build-bm.cjs
@bin/lib/bm-transform.cjs
@bin/lib/model-catalog.cjs
@sdk/src/model-catalog.ts
@sdk/src/query/skills.ts
@tests/build-bm-drift.test.cjs
@tests/agent-namespace-spawn.test.cjs
@tests/resolve-model-missing-config.test.cjs
@.planning/quick/260726-5tt-rename-gsd-sdk-cli-command-to-bm-sdk-as-/260726-5tt-PLAN.md

Key facts established during planning (verified live 2026-09-19, re-verified at revision 2):

- 33 agent files in agents/, all `gsd-<role>.md`, frontmatter `name: gsd-<role>` matches the filename. Two `tools:` shapes exist: a single comma-separated line (32 files) and a YAML list (`gsd-nyquist-auditor.md`: `tools:` followed by `  - Read` lines). Every `description:` is a single line. Task 2a changes ONLY the `name:` line; Task 2b's sweep then rewrites role tokens in the bodies (prose naming other agents, e.g. gsd-phase-researcher.md and gsd-ui-researcher.md name gsd-planner / gsd-executor) while the tools:, description:, color:, model: lines carry no role tokens and pass through byte-for-byte.
- The v4.7.3 Skill grant (commit af2a0fd) touched 19 agents: advisor-researcher, assumptions-analyzer, codebase-mapper, debugger, doc-writer, executor, integration-checker, nyquist-auditor, phase-researcher, plan-checker, planner, project-researcher, research-synthesizer, roadmapper, security-auditor, ui-auditor, ui-checker, ui-researcher, verifier. Their `tools:` must survive the rename byte-for-byte (`grep -l Skill agents/*.md` reports 20 today because one file mentions Skill in prose; the gate is "at least 19").
- Spawn refs: 69 `subagent_type="gsd:gsd-<role>"` in source (workflows 63, skills 4, agents 1 in gsd-debug-session-manager.md; the 2 CHANGELOG hits are excluded history). Another ~60 `gsd:gsd-<role>` tokens live in `<available_agent_types>` prose lists (workflows/execute-phase.md, quick.md, plan-phase.md, new-project.md, new-milestone.md, new-ddd.md, ...). 45 `bm-sdk query resolve-model gsd-<role>` / `agent-skills gsd-<role>` lookup sites in workflows. All of these are matched by one anchored regex over the 33 role names because `\bgsd-planner` matches inside `gsd:gsd-planner` and after a space alike.
- Doc marker DATA literal (must not change, five prose sites plus two code sites, verified live): agents/gsd-doc-writer.md lines 54, 67, 100, 594 (4 occurrences of `generated-by: gsd-doc-writer`, each telling the agent to emit the marker as the first line of a generated doc), agents/gsd-doc-verifier.md line 104 (1 occurrence, telling the verifier to skip that comment), bin/lib/docs.cjs line 16 `const GSD_MARKER`, sdk/src/query/docs-init.ts line 24 `const GSD_MARKER`. The unanchored role regex WOULD match `gsd-doc-writer` inside those lines, which is why the sweep needs the `generated-by: gsd-` line guard. Zero `generated-by: bm-doc-writer` exists in the tree today (outside .git), and that must remain true after every commit.
- Hardcoded 'gsd-<role>' strings in code: bin/lib/init.cjs (20 resolveModelInternal calls), bin/lib/docs.cjs (1 call + the GSD_MARKER literal above), sdk/src/query/init.ts (14 getModelAlias calls), init-complex.ts (3 required-agents entries + 5 calls), docs-init.ts (1 call + the GSD_MARKER literal above), sdk/src/tool-scoping.ts PHASE_AGENT_MAP (4 filenames), sdk/src/index.ts loadAgentDefinition (4 paths), sdk/src/init-runner.ts readAgentFile (3 filenames). The marker is a doc-output identity string persisted in users' generated docs and compared on re-run; it is not an agent-name lookup, so it stays `gsd-doc-writer`.
- Catalog consumers: bin/lib/model-catalog.cjs builds MODEL_PROFILES / AGENT_TO_PHASE_TYPE / AGENT_DEFAULT_TIERS from catalog.agents; bin/lib/model-profiles.cjs re-exports; core.cjs uses them in resolveModelInternal (~1490), the dynamic-routing resolver (~1616 AGENT_DEFAULT_TIERS), resolveReasoningEffortInternal (~1683), checkAgentsInstalled (~1333 expects `<key>.md` or `<key>.agent.md` in getAgentsDir()); commands.cjs cmdResolveModel (~245 unknown_agent flag); verify.cjs cmdValidateAgents (~1197). SDK: sdk/src/model-catalog.ts mirrors; config-query.ts resolveModel (~176) and re-exports at line 25; init.ts / docs-init.ts / validate.ts each have a checkAgentsInstalled port keyed on MODEL_PROFILES.
- agent-skills lookup: bin/lib/init.cjs buildAgentSkillsBlock line ~1724 `config.agent_skills[agentType]`; sdk/src/query/skills.ts line ~68 `config.agent_skills?.[agentType]`. config-schema.cjs already accepts `agent_skills.<any [a-zA-Z0-9_-]+>` and `model_profile_overrides.<runtime>.<tier>` (runtime keyed, not agent keyed; nothing to do there).
- npx-install code paths that key on the `gsd-` prefix: bin/lib/install-profiles.cjs parseCallsAgents regex `/\bgsd-[a-z][a-z-]*/g` (feeds which agent files a tiered profile stages) and stageAgentsForProfile stem match; bin/lib/surface.cjs _syncGsdDir prunes only `gsd-*` agent files. Both must learn `bm-`.
- Tests that assert on agent names or the agents/ listing: sdk/src/query/config-query.test.ts (MODEL_PROFILES keys == `^gsd-.*\.md$` files), tests/fable-tier.test.cjs (keys), tests/agent-namespace-spawn.test.cjs (regexes `gsd:gsd-`; NOT registered in check-drift.yml today), tests/bm-parity.test.cjs census class `agent-ref` `/gsd:gsd-[a-z0-9-]+/`, tests/resolve-model-missing-config.test.cjs, tests/agent-skills-plugin-form.test.cjs, tests/surface-empty-manifest-agents.test.cjs, tests/lazy-mvp-refs.test.cjs, tests/code-fixer-worktree-gate.test.cjs, tests/gap-auto-routing.test.cjs (read agents/gsd-*.md by path), sdk/src/query/init-complex.test.ts (requiredAgents list), sdk/src/golden/read-only-golden-rows.ts (`resolve-model gsd-planner` row: leave, it now exercises the normalization path on both twins).
- Test runners: CJS battery = `for f in tests/*.test.cjs; do node "$f"; done` (69 files; CI registers each in .github/workflows/check-drift.yml, bm items under the `bm-build-drift` job at line ~164). SDK: `npm --prefix sdk test` (vitest unit), `npm --prefix sdk run test:integration` (known pre-existing ~13 read-only golden failures; the gate is zero NEW). sdk/dist is tracked and shipped (bm-sdk execs sdk/dist/cli.js), so SDK source edits require `npm --prefix sdk run build` and the rebuilt dist is committed; build-bm then mirrors it.
- Build: `node bin/build-bm.cjs` regenerates dist/bm from `git ls-files` (tracked files only: new files must be `git add`ed before building), `--check` diffs. The transform is colon-only (`gsd:(?!/)` to `bm:`) plus the cache-fallback literal pairs; it never touches `gsd-`/`bm-` filename or name tokens, so `name: bm-<role>` passes through unchanged and `subagent_type="gsd:bm-<role>"` renders as `bm:bm-<role>` in dist/bm with no transform change.
- Hygiene gates on ADDED lines (the repo's existing lines already contain em-dashes; new lines must not): no em-dash or en-dash characters, no `#[0-9]{4}` issue references (SUMMARY only), never the word meaning "the one true form", no version bump, no CHANGELOG edit, no Co-Authored-By trailer.
</context>

<tasks>

<task type="auto">
  <name>Task 1: baselines, bm-keyed catalog, name-normalizing resolvers and lookups on both twins</name>
  <files>sdk/shared/model-catalog.json, bin/lib/model-catalog.cjs, bin/lib/model-profiles.cjs, bin/lib/core.cjs, bin/lib/commands.cjs, bin/lib/verify.cjs, bin/lib/init.cjs, bin/lib/install-profiles.cjs, bin/lib/surface.cjs, sdk/src/model-catalog.ts, sdk/src/query/config-query.ts, sdk/src/query/skills.ts, sdk/src/query/init.ts, sdk/src/query/docs-init.ts, sdk/src/query/validate.ts, sdk/src/query/config-query.test.ts, sdk/src/query/skills.test.ts, tests/fable-tier.test.cjs, tests/resolve-model-missing-config.test.cjs, tests/agent-skills-plugin-form.test.cjs, tests/surface-empty-manifest-agents.test.cjs, tests/agent-name-normalization.test.cjs, .github/workflows/check-drift.yml, sdk/dist/**</files>
  <action>
Before touching anything, capture baselines into the scratchpad and record the base sha (`git rev-parse HEAD`): (1) run the CJS battery (`for f in tests/*.test.cjs; do node "$f" >/dev/null 2>&1 || echo "$f"; done`) and save the failing-file list (expected: context-monitor-hook-event, version-command); (2) run `npm --prefix sdk run test:integration` and save the failing test-name list; (3) confirm `node bin/build-bm.cjs --check` passes and `git status --porcelain` shows only the pre-existing .planning/ and .rtf noise. These are the zero-new gates for Task 3.

Rekey the catalog: in sdk/shared/model-catalog.json rename every key of the `agents` map from `gsd-<role>` to `bm-<role>` (33 keys, values untouched, key order preserved). Afterwards `grep -c '"gsd-' sdk/shared/model-catalog.json` must be 0 and `grep -c '"bm-' ...` must be 33.

Add the normalization helpers to BOTH catalog twins with identical semantics (the two-resolver rule: bin/lib and sdk/src must both change, then the SDK is rebuilt). In bin/lib/model-catalog.cjs and sdk/src/model-catalog.ts export: `normalizeAgentName(name)` (string coerce; if it starts with `gsd-` return `bm-` + the remainder, else return unchanged), `legacyAgentName(name)` (normalize, then if it starts with `bm-` return `gsd-` + remainder), and `lookupByAgentName(map, name)` (undefined when map is falsy; otherwise the first defined of map[name], map[normalizeAgentName(name)], map[legacyAgentName(name)]). Add them to the re-export lists in bin/lib/model-profiles.cjs and sdk/src/query/config-query.ts (line ~25) so existing importers reach them. Comment the helpers in one short paragraph: the gsd- prefix is the 4.x backwards-compat spelling for config keys and CLI arguments, removed at v5.0 together with these three functions.

Apply the helpers on the CJS side: core.cjs resolveModelInternal, the dynamic-routing resolver (the function that reads AGENT_DEFAULT_TIERS around line 1616), and resolveReasoningEffortInternal each compute `const agentKey = normalizeAgentName(agentType)` first and use agentKey for every MODEL_PROFILES / AGENT_TO_PHASE_TYPE / AGENT_DEFAULT_TIERS index; the per-agent override reads `lookupByAgentName(config.model_overrides, agentType)` (a user config keyed `model_overrides.gsd-planner` must still win for a `bm-planner` query and vice versa). commands.cjs cmdResolveModel computes unknown_agent from the normalized key. core.cjs checkAgentsInstalled and verify.cjs cmdValidateAgents keep iterating MODEL_PROFILES keys (now bm-) but treat an agent as installed when any of `<key>.md`, `<key>.agent.md`, `<legacy>.md`, `<legacy>.agent.md` exists (installed_agents keeps reporting the bm- key; the legacy-filename branch is what keeps the tree consistent between this commit and Task 2a, and it also covers a user's stale `~/.claude/agents/gsd-*.md` copies until v5.0). init.cjs buildAgentSkillsBlock replaces `config.agent_skills[agentType]` with `lookupByAgentName(config.agent_skills, agentType)` (import from ./model-profiles.cjs; keep the rest of the function untouched). install-profiles.cjs parseCallsAgents regex becomes `/\b(?:bm|gsd)-[a-z][a-z-]*/g` (update the doc comment to say both prefixes) and stageAgentsForProfile copies a file when `resolvedProfile.agents` has the stem OR its normalized OR its legacy form. surface.cjs _syncGsdDir agent prune condition becomes: skip files that start with neither `gsd-` nor `bm-` (so a stale gsd- copy in the synced dir is pruned once the bm- file replaces it).

Apply the same on the SDK side: config-query.ts resolveModel normalizes agentType for the MODEL_PROFILES / AGENT_TO_PHASE_TYPE reads and uses lookupByAgentName for model_overrides; skills.ts agentSkills reads `lookupByAgentName(config.agent_skills, agentType)`; the three checkAgentsInstalled ports in init.ts, docs-init.ts, validate.ts accept the legacy filename forms exactly like core.cjs. Nothing else in these files changes in this task (the hardcoded 'gsd-<role>' call sites move to bm- in Task 2b).

Update the existing tests that pin the old keys: tests/fable-tier.test.cjs HEAVY list and the quality/balanced/budget assertions use bm- keys; sdk/src/query/config-query.test.ts compares MODEL_PROFILES keys against the agents/ listing through normalizeAgentName on the filename stems (so it passes before Task 2a, after it, and after Task 2b; its describe text says bm- keys); tests/resolve-model-missing-config.test.cjs keeps its gsd- checks (they now prove the normalization path) and adds the same loop for `bm-planner` / `bm-executor`; tests/agent-skills-plugin-form.test.cjs keeps the gsd-executor keyed configs and adds one case where the config key is `gsd-executor` and the query is `bm-executor` (directive emitted) plus one where the key is `bm-executor` and the query is `gsd-executor`; tests/surface-empty-manifest-agents.test.cjs seeds a `bm-planner.md` alongside the gsd- files and asserts the control case prunes a superseded bm- file and still never touches `other.md`; sdk/src/query/skills.test.ts adds one legacy-key case mirroring the CJS one.

Create `tests/agent-name-normalization.test.cjs` (zero-dep check(name, fn) harness as in tests/build-bm-drift.test.cjs; spawn twins like tests/resolve-model-missing-config.test.cjs with a fresh temp project and an empty GSD_HOME): (a) catalog keys: all 33 keys of require('../sdk/shared/model-catalog.json').agents start with `bm-`, none with `gsd-`, and the set of roles equals the set of `agents/*.md` basenames after normalizeAgentName (exact `bm-` filenames are asserted by check (h) once Task 2a lands); (b) helper units: normalizeAgentName('gsd-planner') is 'bm-planner', 'bm-planner' unchanged, 'other' unchanged; legacyAgentName('bm-x') is 'gsd-x'; lookupByAgentName cross-prefix in both directions and undefined on null map; (c) for each profile in quality, balanced, budget, and for the empty config: resolveModelInternal(dir, 'gsd-planner') === resolveModelInternal(dir, 'bm-planner'), and 'gsd-executor' equals 'bm-executor'; (d) overrides: config `model_overrides: { 'gsd-planner': 'custom-a' }` resolves 'bm-planner' to custom-a, and `model_overrides: { 'bm-planner': 'custom-b' }` resolves 'gsd-planner' to custom-b; (e) twin agreement: spawn `bin/gsd-tools.cjs resolve-model <name>` and `sdk/dist/cli.js query resolve-model <name>` for gsd-planner and bm-planner, parse JSON, assert all four `model` values are equal and none carries `unknown_agent`; (f) agent-skills cross-prefix through BOTH twins (`gsd-tools.cjs agent-skills` and `sdk/dist/cli.js query agent-skills`): config keyed gsd-executor answers `agent-skills bm-executor` with the `<agent_skills>` block, keyed bm-executor answers `agent-skills gsd-executor`, and keyed gsd-executor answers `agent-skills gsd-executor` (the "config written before the rename still works" case); (g) install-profiles: parseCallsAgents('spawn gsd:bm-planner and gsd-executor') returns both stems; stageAgentsForProfile with agents Set {'bm-planner'} against a temp dir holding bm-planner.md, gsd-planner.md, bm-executor.md stages both planner files and not the executor; (h) source hygiene, guarded to SKIP (print a skip line, do not fail) while any `agents/gsd-*.md` still exists: exactly 33 `agents/bm-*.md`, zero `agents/gsd-*.md`, every file's `name:` equals its basename, at least 19 bm- files list `Skill` in their tools block, and `grep -rn 'subagent_type="gsd:gsd-'` over workflows, skills, agents returns zero lines while `subagent_type="gsd:bm-` returns 69 (this spawn-count sub-check is guarded to SKIP while any `subagent_type="gsd:gsd-` still exists, i.e. between Task 2a and Task 2b); (i) marker literal, ALWAYS live (no guard): the doc-writer agent file (whichever of agents/gsd-doc-writer.md or agents/bm-doc-writer.md exists) contains exactly 4 lines matching `generated-by: gsd-doc-writer`, the doc-verifier agent file contains exactly 1, bin/lib/docs.cjs and sdk/src/query/docs-init.ts each contain exactly 1, and a recursive scan of the tracked tree (`git ls-files`, so .git and node_modules are excluded and dist/bm is included) finds zero lines containing `generated-by: bm-doc-writer`. Checks (h) and (i) are the durable "no legacy spawn refs" and "marker never rebranded" gates.

Rebuild the SDK: `npm --prefix sdk run build` (tsc + bundle) so sdk/dist reflects the change; commit the rebuilt sdk/dist with the source. Register in `.github/workflows/check-drift.yml` under the `bm-build-drift` job, before the existing `Run build-bm drift test` step: a step running `node tests/agent-name-normalization.test.cjs` and a step running `node tests/agent-namespace-spawn.test.cjs` (grep confirmed it is not registered anywhere in the file today). Run: the new test, tests/fable-tier.test.cjs, tests/resolve-model-missing-config.test.cjs, tests/agent-skills-plugin-form.test.cjs, tests/surface-empty-manifest-agents.test.cjs, tests/model-catalog-resolver-flat-layout.test.cjs, tests/config-schema-sdk-parity.test.cjs, and `npm --prefix sdk test`. Commit: `feat(model-catalog): key agents by bm-<role> and accept gsd-<role> spellings on both twins` (no trailer lines).
  </action>
  <verify>
    <automated>node tests/agent-name-normalization.test.cjs && node tests/fable-tier.test.cjs && node tests/resolve-model-missing-config.test.cjs && node tests/agent-skills-plugin-form.test.cjs && node tests/surface-empty-manifest-agents.test.cjs && npm --prefix sdk test -- --reporter=dot 2>&1 | tail -5 && [ "$(grep -c '"gsd-' sdk/shared/model-catalog.json)" -eq 0 ] && grep -q 'agent-name-normalization.test.cjs' .github/workflows/check-drift.yml</automated>
  </verify>
  <done>Baselines saved; catalog has 33 bm- keys and zero gsd- keys; both twins return identical profiles for gsd-planner and bm-planner (proved by spawning both CLIs); model_overrides and agent_skills resolve across prefixes in both directions on both twins; the agents/ listing is still gsd- and checkAgentsInstalled accepts it; marker check (i) passes against the unrenamed files; SDK unit suite green; sdk/dist rebuilt and committed; CI registers the two tests.</done>
</task>

<task type="auto">
  <name>Task 2a: git mv the 33 agents to bm-<role>, flip only the name: line, prove tools: unchanged, commit</name>
  <files>agents/bm-*.md (33, git mv from agents/gsd-*.md; name: line only)</files>
  <action>
Snapshot the tools lines first so the Skill-grant gate has ground truth: `for f in agents/gsd-*.md; do echo "$(basename "$f" | sed 's/^gsd-//'): $(awk '/^---$/{c++; next} c==1 && /^tools:/{print; getline; while ($0 ~ /^  - /) {print; if (!getline) break}}' "$f")"; done > <scratchpad>/tools-before.txt` (the awk captures the single-line form and the list form in gsd-nyquist-auditor.md). Also snapshot the marker counts: `grep -c 'generated-by: gsd-doc-writer' agents/gsd-doc-writer.md agents/gsd-doc-verifier.md > <scratchpad>/marker-before.txt` (expected 4 and 1).

Rename: for each of the 33 files `git mv agents/gsd-<role>.md agents/bm-<role>.md`, then change ONLY the frontmatter line `name: gsd-<role>` to `name: bm-<role>` in each (sed anchored on `^name: gsd-` limited to the frontmatter; do not touch tools:, description:, color:, model:, or the body; body role tokens are Task 2b's job). Verify with `ls agents/gsd-*.md 2>/dev/null | wc -l` = 0, `ls agents/bm-*.md | wc -l` = 33, `grep -L '^name: bm-' agents/bm-*.md` printing nothing, `[ "$(grep -l 'Skill' agents/bm-*.md | wc -l)" -ge 19 ]`, and `git diff --cached -M --stat -- agents | tail -1` reporting 33 files changed with exactly 33 insertions and 33 deletions (one line per file).

Regenerate the tools listing over agents/bm-*.md (strip `bm-` instead of `gsd-`) into `<scratchpad>/tools-after.txt` and `diff` it against tools-before.txt: must be empty. Regenerate the marker counts over agents/bm-doc-writer.md and agents/bm-doc-verifier.md and diff against marker-before.txt ignoring the filename prefix: 4 and 1, unchanged (this step cannot change them; it is the baseline the Task 2b gate compares against).

The tree is consistent at this commit: every `subagent_type="gsd:gsd-<role>"` still resolves through the Task 1 lookup layer (normalizeAgentName in both twins, legacy-filename branch in checkAgentsInstalled), and the catalog is already bm- keyed. Run `node tests/agent-name-normalization.test.cjs` (check (h) filename and Skill sub-checks are live now; its spawn-count sub-check prints its skip line; check (i) must pass) and `npm --prefix sdk test -- --reporter=dot` (config-query.test.ts compares through normalizeAgentName so it stays green). Commit: `refactor(agents): rename gsd-<role> agent files to bm-<role>` (no trailer lines). This commit is intentionally small so a bad sweep in Task 2b can be reset to it (`git reset --hard <2a-sha>`) and retried without re-deriving the 33 renames.
  </action>
  <verify>
    <automated>[ "$(ls agents/gsd-*.md 2>/dev/null | wc -l)" -eq 0 ] && ls agents/bm-*.md | wc -l | grep -qx 33 && [ "$(grep -L '^name: bm-' agents/bm-*.md | wc -l)" -eq 0 ] && [ "$(grep -l 'Skill' agents/bm-*.md | wc -l)" -ge 19 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' agents/bm-doc-writer.md)" -eq 4 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' agents/bm-doc-verifier.md)" -eq 1 ] && git diff HEAD~1 HEAD -M --numstat -- agents | awk '$1!=1 || $2!=1 {bad=1} END {exit bad}' && node tests/agent-name-normalization.test.cjs</automated>
  </verify>
  <done>33 agents/bm-*.md and zero agents/gsd-*.md committed as renames; every changed agent file differs from its pre-rename form by exactly the name: line; tools-line snapshot diff is empty; marker counts 4 and 1 unchanged; agent-name-normalization check (i) and the filename/Skill parts of check (h) pass; SDK unit suite green.</done>
</task>

<task type="auto">
  <name>Task 2b: anchored bm- sweep with the marker guard over docs, code call sites, and tests; commit</name>
  <files>agents/bm-*.md (body prose), workflows/**/*.md, skills/*/SKILL.md, references/*.md, templates/*.md, README.md, CLAUDE.md, bin/lib/init.cjs, bin/lib/docs.cjs, sdk/src/query/init.ts, sdk/src/query/init-complex.ts, sdk/src/query/docs-init.ts, sdk/src/tool-scoping.ts, sdk/src/index.ts, sdk/src/init-runner.ts, sdk/src/query/init-complex.test.ts, tests/agent-namespace-spawn.test.cjs, tests/bm-parity.test.cjs, tests/bm-transform.test.cjs, tests/lazy-mvp-refs.test.cjs, tests/code-fixer-worktree-gate.test.cjs, tests/gap-auto-routing.test.cjs, sdk/dist/**</files>
  <action>
Record the Task 2a sha (`git rev-parse HEAD`) as the retry point. Build the role alternation once: `ROLES=$(ls agents/bm-*.md | sed 's#agents/bm-##; s#\.md$##' | paste -sd'|' -)` (33 names) and use it for every substitution below as the anchored pattern `\bgsd-(ROLES)\b` to `bm-$1`. Anchoring on the exact 33 role names is what keeps `gsd-tools.cjs`, `gsd-sdk`, `gsd-plugin`, `gsd-local-patches`, `gsd-resume-at`, `gsd-session-state.sh` untouched: verify with a dry-run count before and a `git diff --stat` after.

MARKER GUARD (mandatory, applies to every invocation of the substitution in this task): the sweep rewrites agent spawn and name references only, never data literals that happen to contain a role name. The perl one-liner therefore applies the substitution only to lines that do NOT contain the literal `generated-by: gsd-` (in perl -pi terms: guard the `s///g` with `unless /generated-by: gsd-/`, so the line is printed unchanged). Known protected lines: agents/bm-doc-writer.md (4 lines), agents/bm-doc-verifier.md (1 line), bin/lib/docs.cjs line 16, sdk/src/query/docs-init.ts line 24. Before running the sweep for real, run it in dry-run form (print matching lines without writing) and confirm none of the listed marker lines appear in the output.

Markdown sweep (spawn refs, available_agent_types lists, resolve-model and agent-skills lookup sites, prose, and agents/*.md path mentions in one pass): run the guarded perl substitution over `git ls-files 'agents/bm-*.md' 'workflows/*.md' 'workflows/**/*.md' 'skills/*/SKILL.md' 'references/*.md' 'references/**/*.md' 'templates/*.md' 'templates/**/*.md' README.md CLAUDE.md`. Explicitly EXCLUDED: CHANGELOG.md, docs/upstream-sync/**, tests/**, bin/**, sdk/** (handled by targeted edits next), hooks/** (carries no role tokens), .planning/**. After the sweep assert: `grep -rn 'subagent_type="gsd:gsd-' workflows skills agents | wc -l` is 0 and `grep -rn 'subagent_type="gsd:bm-' workflows skills agents | wc -l` is 69; `grep -rnE '(resolve-model|agent-skills) +"?gsd-' workflows skills | wc -l` is 0; `grep -c 'generated-by: gsd-doc-writer' agents/bm-doc-writer.md` is 4 and the same over agents/bm-doc-verifier.md is 1; `git ls-files -z | xargs -0 grep -l 'generated-by: bm-doc-writer' | wc -l` is 0. If any marker assertion fails, `git reset --hard <2a-sha>`, fix the guard, and rerun the sweep (do not hand-patch the marker lines on top of a bad sweep; the point of the Task 2a commit is a clean retry).

DEFENSE IN DEPTH (one pass, after the automated assertions): eyeball `git diff -- agents references templates | grep '^[-+]' | grep -v '^[-+][-+]' | grep -vE 'subagent_type|available_agent_types|resolve-model|agent-skills|agents/bm-|^\+- gsd:bm-|^-- gsd:gsd-'` for any OTHER non-spawn `gsd-<role>` data literal that should not have changed (a persisted marker, a file-format token, a fixture string, a config key example that is meant to show the legacy spelling). The marker is the only one known today; if another turns up, add it to the guard's alternation, reset to the 2a sha, and rerun, then record the new literal in the SUMMARY's deliberate non-changes.

Code call sites (targeted, the same guarded substitution restricted to these files): bin/lib/init.cjs (the 20 resolveModelInternal calls), bin/lib/docs.cjs (the doc_writer_model call ONLY; the GSD_MARKER line 16 must still read `generated-by: gsd-doc-writer`, which the guard enforces), sdk/src/query/init.ts (14 getModelAlias calls), sdk/src/query/init-complex.ts (the 3-entry required-agents list and 5 calls), sdk/src/query/docs-init.ts (the resolveModel call only; its GSD_MARKER at line 24 stays, guard-enforced), sdk/src/tool-scoping.ts PHASE_AGENT_MAP (4 filenames to bm-*.md), sdk/src/index.ts loadAgentDefinition (4 paths to bm-executor.md), sdk/src/init-runner.ts (3 readAgentFile filenames), sdk/src/query/init-complex.test.ts (requiredAgents list). Leave sdk/src/golden/read-only-golden-rows.ts untouched (its gsd-planner row now exercises the normalization path on both twins and must keep passing without a fixture change). Leave sdk/src/types.ts and prompt-builder.ts doc comments alone (outside the sweep set; skip).

Tests that name the old form: tests/agent-namespace-spawn.test.cjs: nsSpawnRe becomes `subagent_type=["']gsd:bm-[a-z][a-z-]*["']`, bareSpawnRe becomes `subagent_type=["'](?:gsd|bm)-[a-z][a-z-]*["']` (still: bare = missing plugin prefix), add check 3 `no legacy spawns: zero subagent_type="gsd:gsd-*" across workflows, skills, and agents`, and the available_agent_types prose check flags `^- (?:gsd|bm)-[a-z]` (un-namespaced) while requiring at least one `- gsd:bm-` line to exist; update the header comment to describe the bm- name and the 4.x gsd- config-key normalization. tests/bm-parity.test.cjs: widen the `agent-ref` census class to `/gsd:(?:gsd|bm)-[a-z0-9-]+/` and add a positive control for `subagent_type=gsd:bm-executor` (this file sits in COMMAND_REWRITE_EXCLUDE so its fixtures survive in dist/bm). tests/bm-transform.test.cjs: add one assertion that rewriteCommandRefs('subagent_type=gsd:bm-executor') yields 'subagent_type=bm:bm-executor' (existing gsd:gsd- fixtures stay; they still hold as pure transform cases). tests/lazy-mvp-refs.test.cjs, tests/code-fixer-worktree-gate.test.cjs (both source and dist paths), tests/gap-auto-routing.test.cjs: point the agent paths at agents/bm-*.md.

Docs that describe the taxonomy (after the sweep so the note is not rewritten): references/model-profiles.md gets one sentence under the Profile Definitions table: agent keys are `bm-<role>`; the `gsd-<role>` spelling is accepted in `model_overrides`, `agent_skills`, `resolve-model`, and `agent-skills` through the 4.x line and stops resolving at v5.0. references/agent-contracts.md registry is already flipped by the sweep; add the same one-line note under its Agent Registry heading. README.md rows referencing agents/gsd-verifier.md and agents/gsd-executor.md are flipped by the sweep; no new README row (this is the rename of an existing capability, not a new one; a docs catch-up can add a line at release time).

Rebuild the SDK (`npm --prefix sdk run build`). Run tests/agent-name-normalization.test.cjs (checks (h) and (i) are fully live now and must pass), tests/agent-namespace-spawn.test.cjs, tests/bm-transform.test.cjs, tests/lazy-mvp-refs.test.cjs, tests/code-fixer-worktree-gate.test.cjs (its dist path assertion will fail until Task 3 regenerates dist/bm; that is expected here, confirm the source-side check passes), tests/gap-auto-routing.test.cjs, and `npm --prefix sdk test` (config-query.test.ts and init-complex.test.ts must pass against the renamed listing). Commit: `refactor(agents): spawn and look up agents as bm-<role> everywhere` (no trailer lines).
  </action>
  <verify>
    <automated>[ "$(grep -rn 'subagent_type="gsd:gsd-' workflows skills agents | wc -l)" -eq 0 ] && [ "$(grep -rn 'subagent_type="gsd:bm-' workflows skills agents | wc -l)" -eq 69 ] && [ "$(grep -rnE '(resolve-model|agent-skills) +"?gsd-' workflows skills | wc -l)" -eq 0 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' agents/bm-doc-writer.md)" -eq 4 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' agents/bm-doc-verifier.md)" -eq 1 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' bin/lib/docs.cjs)" -eq 1 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' sdk/src/query/docs-init.ts)" -eq 1 ] && [ "$(git ls-files -z | xargs -0 grep -l 'generated-by: bm-doc-writer' | wc -l)" -eq 0 ] && node tests/agent-name-normalization.test.cjs && node tests/agent-namespace-spawn.test.cjs && node tests/bm-transform.test.cjs && node tests/lazy-mvp-refs.test.cjs && node tests/gap-auto-routing.test.cjs</automated>
  </verify>
  <done>All 69 spawn refs read gsd:bm-<role>; zero gsd:gsd- spawns or gsd- lookup sites remain in workflows/skills/agents; code call sites and agent filenames use bm-; the doc-writer marker literal is unchanged in the agent bodies (4 + 1) and the two code files (1 + 1) and zero bm-doc-writer markers exist in the tracked tree, all machine-checked; the eyeball pass found no other rebranded data literal (or the new literal is in the guard and recorded for the SUMMARY); namespace, transform, and path-based tests updated and green on the source side; SDK unit suite green.</done>
</task>

<task type="auto">
  <name>Task 3: regenerate dist/bm, run every gate against the baselines, write the SUMMARY with the v5.0 removal list</name>
  <files>dist/bm/**, .planning/quick/260919-fqh-additive-migration-of-agent-names-to-bm-/260919-fqh-SUMMARY.md</files>
  <action>
Make sure every new and renamed file is tracked (`git add -A agents tests` then `git status --porcelain | grep '^??'` must show only the pre-existing gsd-bugs-housekeeping.rtf), because build-bm copies from `git ls-files`. Run `node bin/build-bm.cjs`, then `node bin/build-bm.cjs --check` (PASS), `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json`, and `node bin/maintenance/check-version-alignment.cjs`. Spot check the mirror: `ls dist/bm/agents/*.md | wc -l` is 33 and `ls dist/bm/agents/gsd-*.md 2>/dev/null | wc -l` is 0 (build-bm must have dropped the stale gsd- copies; if it did not, investigate its prune step before continuing), `head -3 dist/bm/agents/bm-planner.md` shows `name: bm-planner` (registers as bm:bm-planner), `grep -c 'subagent_type="bm:bm-' dist/bm/workflows/execute-phase.md` is at least 1, `grep -rc 'gsd:bm-' dist/bm/workflows | grep -v ':0' | wc -l` is 0, and `grep -c 'generated-by: gsd-doc-writer' dist/bm/agents/bm-doc-writer.md` is 4 (the transform is colon-only and must not touch the marker either).

Gates, compared against the Task 1 baselines: (1) CJS battery `for f in tests/*.test.cjs; do node "$f" >/dev/null 2>&1 || echo "$f"; done` must list exactly the baseline set (context-monitor-hook-event, version-command) and nothing new, and the bm gates (agent-name-normalization including checks (h) and (i), agent-namespace-spawn, bm-parity, build-bm-drift, code-fixer-worktree-gate including its dist path) must each exit 0 when run individually; (2) `npm --prefix sdk test` green; (3) `npm --prefix sdk run test:integration` failing set must be a subset of the baseline list saved in Task 1 (diff the two lists; zero new names); (4) hygiene over ADDED lines only: `git diff <base-sha>..HEAD -U0 -- . ':!dist/bm' | grep '^+' | grep -v '^+++'` must contain no em-dash or en-dash character, no `#[0-9]{4}` token, and no occurrence of the word meaning "the one true form" (case-insensitive); (5) no version bump: .claude-plugin/plugin.json, .claude-plugin/marketplace.json, package.json, sdk/package.json versions unchanged versus base-sha; CHANGELOG.md untouched; `git log --format=%B <base-sha>..HEAD | grep -ci 'co-authored-by'` is 0; (6) rename isolation: `git diff <base-sha>..<2a-sha> -M --numstat -- agents` shows 33 renamed files with 1 insertion and 1 deletion each (only `name:` moved in Task 2a), and `git diff <2a-sha>..HEAD -U0 -- agents | grep '^[-+]' | grep -v '^[-+][-+]'` contains no line with `generated-by:` (the sweep never touched a marker line) and every removed/added pair differs only by `gsd-<role>` to `bm-<role>` tokens (spot check with the ROLES alternation: strip both prefixes from both sides and the multiset of lines must match).

If any gate fails, fix in place (never widen an allow-list or reorder census classes to pass; the bm-parity governance comment applies) and re-run from the build-bm step.

Write the SUMMARY at the path above using the summary template. Include: the scope decision (rename plus name-normalization, no alias files) and its one-paragraph rationale from the objective; the total file-count impact (renames, new, edited, dist mirror: about 185 source paths and about 370 git paths); the four commits and their shas (Task 1 catalog, Task 2a rename, Task 2b sweep, Task 3 dist); the gate results with the baseline lists; the quick-task id and this plan path (issue/task ids belong ONLY here). Add a `## v5.0 removal path` section listing the exact subtraction so the future change is mechanical: (a) delete `normalizeAgentName`, `legacyAgentName`, `lookupByAgentName` from bin/lib/model-catalog.cjs and sdk/src/model-catalog.ts plus their re-exports, and revert each call site to a direct map read: core.cjs (three resolvers + checkAgentsInstalled legacy-filename branch), commands.cjs, verify.cjs, init.cjs buildAgentSkillsBlock, config-query.ts, skills.ts, init.ts, docs-init.ts, validate.ts; (b) install-profiles.cjs parseCallsAgents regex back to a single `bm-` prefix and stageAgentsForProfile to a plain stem match; surface.cjs prune back to a single `bm-` prefix; (c) delete `tests/agent-name-normalization.test.cjs` checks (b) through (g) and its check-drift.yml step (keep checks (h) and (i) or fold them into agent-namespace-spawn), drop the gsd- loops from tests/resolve-model-missing-config.test.cjs and the cross-prefix cases from tests/agent-skills-plugin-form.test.cjs, tests/surface-empty-manifest-agents.test.cjs, sdk/src/query/skills.test.ts; drop the legacy `gsd:gsd-` fixtures from tests/bm-transform.test.cjs; (d) remove the one-line notes from references/model-profiles.md and references/agent-contracts.md; (e) the census regex `gsd:(?:gsd|bm)-` in tests/bm-parity.test.cjs may stay (still fail-closed); the catalog needs no change (already bm- keyed); the golden row `resolve-model gsd-planner` flips to bm-planner then; there are NO alias agent files to remove because none were created. User-facing consequence at v5.0 to announce in that release's CHANGELOG: `model_overrides.gsd-*` and `agent_skills.gsd-*` config keys and `resolve-model gsd-*` / `agent-skills gsd-*` arguments stop resolving. Also record the deliberate non-changes: the `generated-by: gsd-doc-writer` marker literal (agent prose 4 + 1, code 1 + 1, and it is NOT part of the v5.0 subtraction because it is persisted in users' generated docs), any additional data literal the Task 2b eyeball pass added to the guard, CHANGELOG history, docs/upstream-sync history, and the golden row.

Commit the regenerated dist/bm together with the SUMMARY: `chore(bm): regenerate dist/bm for the bm-<role> agent names` (no trailer lines). NO version bump and NO CHANGELOG entry: the release is cut separately.
  </action>
  <verify>
    <automated>node bin/build-bm.cjs --check && node tests/agent-name-normalization.test.cjs && node tests/agent-namespace-spawn.test.cjs && node tests/bm-parity.test.cjs && node tests/code-fixer-worktree-gate.test.cjs && node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json && ls dist/bm/agents/bm-*.md | wc -l | grep -qx 33 && [ "$(ls dist/bm/agents/gsd-*.md 2>/dev/null | wc -l)" -eq 0 ] && [ "$(grep -c 'generated-by: gsd-doc-writer' dist/bm/agents/bm-doc-writer.md)" -eq 4 ] && [ "$(git ls-files -z | xargs -0 grep -l 'generated-by: bm-doc-writer' | wc -l)" -eq 0 ] && test -f .planning/quick/260919-fqh-additive-migration-of-agent-names-to-bm-/260919-fqh-SUMMARY.md</automated>
  </verify>
  <done>dist/bm regenerated and drift-free with 33 bm- agent files and zero gsd- files; the marker literal survives in the mirror; CJS battery failing set equals the baseline; SDK unit green; integration failing set is a subset of the baseline; hygiene, no-bump, no-changelog, no-trailer, and rename-isolation checks pass; SUMMARY written with the scope rationale, file-count impact, four commit shas, gate results, and the v5.0 subtraction list.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo source to committed artifacts | bin/build-bm.cjs reads tracked files only and writes dist/bm; no network, no untrusted input |
| user config to resolver | .planning/config.json `model_overrides` / `agent_skills` keys are user-authored strings looked up by agent name |
| user's synced agent dir | ~/.claude/agents may hold stale gsd-*.md copies from earlier installs; surface.cjs prunes and checkAgentsInstalled reports them |
| generated user docs to doc detector | docs the doc-writer agent emitted into users' repos carry the persisted marker; bin/lib/docs.cjs and docs-init.ts compare against it on re-run |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fqh-01 | Tampering | dist/bm out of sync with source after the rename | mitigate | existing `build-bm.cjs --check` + bm-parity census widened to `gsd:(gsd|bm)-` |
| T-fqh-02 | Spoofing | a config key like `gsd-tools` normalizing to `bm-tools` | accept | normalization only feeds catalog/config map lookups; an unknown key misses under both prefixes exactly as before |
| T-fqh-03 | Elevation | a renamed file's tools: drifting during the rename (wider grants) | mitigate | Task 2a tools-line snapshot diff must be empty and the rename commit is 1 insertion / 1 deletion per file; Skill count gate at least 19 |
| T-fqh-04 | Denial of Service | a spawn ref left at gsd:gsd-<role> now targets a file that no longer exists | mitigate | agent-namespace-spawn check 3 + agent-name-normalization check (h): zero legacy spawns, 69 bm- spawns; both registered in CI; between Task 2a and 2b the Task 1 lookup layer resolves the legacy spawns |
| T-fqh-05 | Tampering | stale gsd-*.md copies in a user's synced agents dir shadowing or duplicating the bm- agent | mitigate | surface.cjs prune accepts both prefixes and removes files absent from the manifest |
| T-fqh-06 | Tampering | the sweep rebrands the persisted `generated-by: gsd-doc-writer` marker in the doc-writer / doc-verifier prose, so newly generated docs no longer match the detector in docs.cjs / docs-init.ts (silent overwrite or staleness misreport of user docs) | mitigate | Task 2b perl guard skips lines containing `generated-by: gsd-`; machine-checked counts 4 (bm-doc-writer.md), 1 (bm-doc-verifier.md), 1 + 1 (code) and zero `bm-doc-writer` markers in the tracked tree, in Task 2b verify, Task 3 verify, and agent-name-normalization check (i) in CI; eyeball pass for other data literals |
| T-fqh-SC | Tampering | npm/pip/cargo installs | accept | none: this task installs no packages (zero-dep Node built-ins only; SDK rebuild uses the existing lockfile) |
</threat_model>

<verification>
- `node bin/build-bm.cjs --check` PASS.
- 33 files in agents/ (all bm-, zero gsd-), mirrored in dist/bm/agents; the Task 2a rename commit changes exactly one line per file.
- `grep -rn 'subagent_type="gsd:bm-' workflows skills agents | wc -l` = 69; zero `gsd:gsd-` spawns; zero `resolve-model gsd-` / `agent-skills gsd-` lookup sites in workflows/skills.
- Marker literal machine-checked in the agent bodies and the code: `generated-by: gsd-doc-writer` appears 4 times in agents/bm-doc-writer.md, once in agents/bm-doc-verifier.md, once each in bin/lib/docs.cjs and sdk/src/query/docs-init.ts, 4 times in dist/bm/agents/bm-doc-writer.md; `generated-by: bm-doc-writer` appears nowhere in the tracked tree (agent-name-normalization check (i), registered in CI).
- Twin agreement: gsd-tools.cjs and sdk/dist/cli.js return the same model for gsd-planner and bm-planner; cross-prefix model_overrides and agent_skills resolve on both twins; a config keyed agent_skills.gsd-executor still answers (tests/agent-name-normalization.test.cjs).
- CJS battery failing set == baseline {context-monitor-hook-event, version-command}; `npm --prefix sdk test` green; integration failing set is a subset of the Task 1 baseline.
- Skill grants: at least 19 bm- files list Skill and the tools-line snapshot diff before/after the rename is empty.
- Hygiene over added lines (no dashes of the long kind, no four-digit issue tokens, no forbidden word); no version bump; CHANGELOG untouched; no Co-Authored-By.
</verification>

<success_criteria>
- `bm-<role>` is the sole spawnable agent per role (`gsd:bm-<role>` in the gsd plugin, `bm:bm-<role>` in dist/bm); no alias agent files exist.
- Internal spawns and lookups all target bm-; the gsd- spelling survives only in the lookup layer for users' existing config keys and CLI habits, and in the persisted `generated-by: gsd-doc-writer` marker (a data literal, machine-checked unchanged in agent bodies, code, and dist/bm).
- The rename lands as its own small commit (Task 2a) ahead of the sweep commit (Task 2b), so a bad sweep is a reset to the 2a sha, not a redo of the 33 renames.
- Model resolution and agent-skills accept both spellings on both twins with identical results.
- dist/bm regenerated, drift-free, and every gate at baseline or better.
- SUMMARY documents the scope decision, file-count impact, the four commit shas, gate results, and the exact v5.0 subtraction.
</success_criteria>

<output>
Create `.planning/quick/260919-fqh-additive-migration-of-agent-names-to-bm-/260919-fqh-SUMMARY.md` when done (Task 3 writes it).
</output>
