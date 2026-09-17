---
phase: 260917-u0b
plan: 01
subsystem: agent-skills
tags: [agent-skills, plugin-skill, resolver-twins, cjs-sdk-parity]
requires: []
provides:
  - "global:<plugin>:<skill> plugin-skill form in both agent_skills resolver twins"
  - "Skill-tool load-by-name directive rendering (no path resolution)"
affects:
  - sdk/src/query/skills.ts
  - bin/lib/init.cjs
  - references/planning-config.md
tech-stack:
  added: []
  patterns:
    - "PLUGIN_SKILL_NAME_RE colon-detection placed before the legacy GLOBAL_SKILL_NAME_RE check"
    - "fs.writeSync(1, block) for raw CLI output that survives the gsd-tools stdout interception"
key-files:
  created:
    - tests/agent-skills-plugin-form.test.cjs
    - dist/bm/tests/agent-skills-plugin-form.test.cjs
  modified:
    - sdk/src/query/skills.ts
    - bin/lib/init.cjs
    - sdk/src/query/skills.test.ts
    - references/planning-config.md
    - sdk/dist/cli.js
    - dist/bm/
decisions:
  - "Plugin skills load by name via the Skill tool; the resolver performs no filesystem access for the namespaced form"
  - "Trailing-newline difference between the SDK CLI (appends \\n) and the CJS CLI (none) is a pre-existing CLI-level detail; twin parity is asserted on the normalized block"
metrics:
  duration: ~15m
  completed: 2026-09-17
---

# Quick 260917-u0b: global:<plugin>:<skill> agent-skills form Summary

Both agent_skills resolver twins now accept the upstream-documented `global:<plugin>:<skill>` form and render a Skill-tool load-by-name directive instead of dropping the entry as an "Invalid global skill name". Reported as issue #33.

## What changed

- `sdk/src/query/skills.ts` and `bin/lib/init.cjs`: added `PLUGIN_SKILL_NAME_RE = /^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)+$/`, a colon-detection branch placed BEFORE the legacy `GLOBAL_SKILL_NAME_RE` test, a `runtime !== 'claude'` guard, and a `kind: 'plugin'` entry that renders the fixed directive line. The personal `global:<name>` path branch is untouched.
- Directive line emitted (identical in both twins):
  `- Invoke the Skill tool with skill "<plugin>:<skill>" at agent start (plugin skill, loaded by name, not by path)`
- `sdk/src/query/skills.test.ts`: five new cases (directive emission, personal-global unchanged, four malformed forms rejected, mixed interleave in config order, non-claude runtime skip).
- `tests/agent-skills-plugin-form.test.cjs`: mirrors those cases through the CJS CLI with a hardcoded parity block.
- `references/planning-config.md`: the `agent_skills` row now documents all three entry forms.
- `dist/bm` regenerated (drift-checked); the new CJS test was intent-to-added before `build-bm` so `dist/bm/tests/agent-skills-plugin-form.test.cjs` is present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CJS `agent-skills` CLI emitted nothing on piped stdout**
- **Found during:** Task 2 (twin parity verify)
- **Issue:** `cmdAgentSkills` in `bin/lib/init.cjs` wrote the block via `process.stdout.write(block)` then called `process.exit(0)`. `bin/gsd-tools.cjs` intercepts fd 1 via an `fs.writeSync` override (#1891) and re-emits after the command returns. Because `process.stdout.write` to a pipe is async and the immediate `process.exit(0)` tears the process down before the buffer drains (and before the interception's re-emit runs), the block was truncated to empty. This is a pre-existing bug on the base commit (307e36d), confirmed for a plain path skill too, and it blocked both Task 2 parity and mandatory gate step 1.
- **Fix:** Emit the block with the blocking `fs.writeSync(1, block)` and drop the premature `process.exit(0)`, matching the `output()` helper's own documented pattern in `core.cjs`. The event loop drains naturally and the interception re-emits the captured bytes.
- **Files modified:** bin/lib/init.cjs (committed in the Task 2 commit)
- **Commit:** d5bca31

## Deferred

- `agent_skills_security.trusted_global_roots` (a path-allowlist for PATH-based global skills) is out of scope here. It is orthogonal to the plugin directive and would require config-schema declarations in both schema twins plus the parity test. Not built.

## Mandatory gate output (real)

### Step 1 - reporter repro fixed, both twins
Config `{"agent_skills":{"gsd-executor":["global:superpowers:brainstorming"]}}`.

SDK (`node sdk/dist/cli.js query --project-dir <T> agent-skills gsd-executor`):
```
<agent_skills>
Read these user-configured skills:
- Invoke the Skill tool with skill "superpowers:brainstorming" at agent start (plugin skill, loaded by name, not by path)
</agent_skills>
```
stderr: empty.

CJS (`node bin/gsd-tools.cjs agent-skills gsd-executor`):
```
<agent_skills>
Read these user-configured skills:
- Invoke the Skill tool with skill "superpowers:brainstorming" at agent start (plugin skill, loaded by name, not by path)
</agent_skills>
```
stderr: empty. No "Invalid global skill name", not empty.

### Step 2 - personal global:<name> no regression, both twins
Config `{"agent_skills":{"gsd-executor":["global:my-notes"]}}`, CLAUDE_CONFIG_DIR=<T>/cfg with a fixture skill. Both twins output the identical @-include:
```
<agent_skills>
Read these user-configured skills:
- @/var/folders/.../tmp.ylnEQjuqxt/cfg/skills/my-notes/SKILL.md
</agent_skills>
```

### Step 3 - malformed rejected, both twins
`global:a::b` skipped with `[agent-skills] WARNING: Invalid plugin skill name "a::b": expected <plugin>:<skill> with segments of letters, digits, "_" or "-", skipping` on stderr; empty block. Verified in both suites (SDK test rejects a::b, ::a, a:, a:b$c = 4 warnings; CJS test asserts the warning + empty stdout).

### Step 4 - twin parity byte-identical (trailing-newline normalized)
Mixed config `[".claude/skills/local-skill","global:superpowers:brainstorming","global:my-notes","global:a::b"]`:
```
--- diff (normalized) ---
PARITY: BYTE-IDENTICAL
--- sha256 ---
75c19321ed0491551481801cfa9fd36e6be2ab7d665cc556eded78a8aae58c1f
75c19321ed0491551481801cfa9fd36e6be2ab7d665cc556eded78a8aae58c1f
```

### Step 5 - suites
- CJS battery: `diff cjs-before cjs-after` empty. Only the 2 pre-existing baseline failures remain (context-monitor-hook-event, version-command); zero new.
- SDK unit: 129 files, 1897 tests passed (includes the 5 new skills cases; skills.test.ts = 19/19).
- SDK integration: 14 failing before and after; `comm -13 integ-before integ-after` empty (strict subset, zero NEW).

### Step 6 - dist/bm tracking + drift
```
tracked-in-index: YES
bm drift check: PASS (committed dist/bm matches a fresh build).
dist mirror EXISTS
fixture occurrences in dist mirror: 5
```

### Step 7 - hygiene
- Added-lines hygiene grep over `307e36d..HEAD` for bin/lib, sdk/src, tests, references/planning-config.md: no new `#NNNN`, no em/en-dash, no "canonical" (HYGIENE-CLEAN).
- CHANGELOG.md / .claude-plugin/plugin.json / .claude-plugin/marketplace.json / package.json: unchanged since base SHA (PROTECTED-UNCHANGED).
- Co-Authored-By trailers in the commit range: 0.

## Self-Check: PASSED
- tests/agent-skills-plugin-form.test.cjs FOUND
- dist/bm/tests/agent-skills-plugin-form.test.cjs FOUND
- Commits c41d749, d5bca31, a78f5d7 present in git log.
