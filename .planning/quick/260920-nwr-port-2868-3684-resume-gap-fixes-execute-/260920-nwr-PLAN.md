---
phase: 260920-nwr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - workflows/execute-phase.md
  - tests/execute-phase-resume-gaps.test.cjs
  - bin/lib/security.cjs
  - bin/lib/init.cjs
  - sdk/src/query/skills.ts
  - bin/lib/config-schema.cjs
  - sdk/src/query/config-schema.ts
  - tests/trusted-global-roots.test.cjs
  - sdk/src/query/skills.test.ts
  - references/planning-config.md
  - README.md
  - .github/workflows/check-drift.yml
  - sdk/dist/
  - dist/bm/
autonomous: true
requirements: []
tags: [upstream-sync, execute-phase, resume, agent-skills, config-schema, security]

must_haves:
  truths:
    - "When every plan in a phase is already complete (including a retired one), no --gaps-only or --wave filter is active, and no VERIFICATION.md exists, execute-phase does not exit with 'No matching incomplete plans'; it reports the resume and continues at aggregate_results so the verification tail runs"
    - "When every plan is complete, VERIFICATION.md exists, and the ROADMAP checkbox for the phase is still unticked, execute-phase resumes directly at update_roadmap without re-running verification or the gates"
    - "When a --gaps-only or --wave filter is active, or the phase is verified and ticked, the all-filtered exit is unchanged"
    - "A global:<name> skill whose directory symlinks outside the runtime skills dir is skipped with the symlink-escape WARNING by default (no <agent_skills> block), in both the CJS and SDK resolvers"
    - "The same skill is accepted (block contains @<global skills dir>/<name>/SKILL.md) with a NOTE line on stderr when the outside directory is listed in agent_skills_security.trusted_global_roots, in both resolvers"
    - "A project-relative entry, the filesystem root, the home directory, and a non-existent path are each dropped from trusted_global_roots, so a skill under them stays rejected; an in-base skill still loads with no NOTE; the plugin-form global:<plugin>:<skill> branch is untouched"
    - "agent_skills_security.trusted_global_roots is a fixed leaf key accepted by config-set in both twins and the CJS/SDK parity test stays green"
    - "phase.complete run twice on the same fixture leaves ROADMAP.md byte-identical after the first run"
    - "CJS battery, SDK unit, and SDK integration suites show zero NEW failures versus the pre-edit baselines; sdk/dist rebuilt; dist/bm regenerated and node bin/build-bm.cjs --check passes"
  artifacts:
    - path: "workflows/execute-phase.md"
      provides: "Status-aware 4-way all-filtered decision in discover_and_group_plans"
      contains: "check.verification-status"
    - path: "tests/execute-phase-resume-gaps.test.cjs"
      provides: "Fixture-driven routing inputs (plan-index complete + verification missing; verified + unticked) plus workflow-text pins and phase.complete idempotency"
      min_lines: 80
    - path: "bin/lib/security.cjs"
      provides: "loadTrustedGlobalRoots(config) exported next to validatePath"
      exports: ["loadTrustedGlobalRoots"]
    - path: "bin/lib/init.cjs"
      provides: "trusted-root acceptance in the global:<name> branch of buildAgentSkillsBlock"
      contains: "accepted via trusted_global_roots"
    - path: "sdk/src/query/skills.ts"
      provides: "inline loader + trusted-root acceptance byte-identical in strings to the CJS twin"
      contains: "accepted via trusted_global_roots"
    - path: "bin/lib/config-schema.cjs"
      provides: "fixed leaf key"
      contains: "agent_skills_security.trusted_global_roots"
    - path: "sdk/src/query/config-schema.ts"
      provides: "fixed leaf key"
      contains: "agent_skills_security.trusted_global_roots"
    - path: "tests/trusted-global-roots.test.cjs"
      provides: "CJS loader unit checks + subprocess agent-skills acceptance/rejection matrix"
      min_lines: 80
    - path: "references/planning-config.md"
      provides: "config reference row"
      contains: "agent_skills_security.trusted_global_roots"
    - path: "README.md"
      provides: "Added-features row"
      contains: "trusted_global_roots"
  key_links:
    - from: "workflows/execute-phase.md discover_and_group_plans"
      to: "bm-sdk query check.verification-status"
      via: "VERIFY_STATUS"
      pattern: "check\\.verification-status \"?\\$\\{?PHASE_NUMBER"
    - from: "workflows/execute-phase.md discover_and_group_plans"
      to: "roadmap.analyze phases[].roadmap_complete"
      via: "PHASE_MARKED"
      pattern: "roadmap_complete"
    - from: "bin/lib/init.cjs buildAgentSkillsBlock"
      to: "bin/lib/security.cjs loadTrustedGlobalRoots"
      via: "require('./security.cjs') destructure, computed once before the skill loop"
      pattern: "loadTrustedGlobalRoots\\(config\\)"
    - from: "sdk/src/query/skills.ts agentSkills"
      to: "inline loadTrustedGlobalRoots"
      via: "computed once before the entry loop; consulted only when resolveWithinBase(skillMd, globalSkillsBase) is null"
      pattern: "loadTrustedGlobalRoots\\(config"
    - from: "tests/config-schema-sdk-parity.test.cjs"
      to: "both VALID_CONFIG_KEYS sets"
      via: "text extraction of the SDK Set literal"
      pattern: "VALID_CONFIG_KEYS"
---

<objective>
Two disjoint upstream ports in one quick task, both landing in both plugins (gsd source tree and the generated dist/bm):

Part A: `workflows/execute-phase.md` currently exits with "No matching incomplete plans" whenever every plan is filtered out, even when the run that completed the plans died before verification (no VERIFICATION.md) or before the ROADMAP tick (VERIFICATION.md exists, checkbox unticked). Replace that unconditional exit with a status-aware 4-way decision keyed on our `complete` vocabulary, resuming at `aggregate_results` or `update_roadmap`. Workflow text only; no CJS/SDK source change.

Part B: implement `agent_skills_security.trusted_global_roots` (array of absolute directory paths, default `[]`). A `global:<name>` skill whose directory symlinks outside the runtime skills dir is rejected today; when its resolved location sits under a listed trusted root it is accepted with a stderr NOTE. Both resolver twins, both config-schema twins, docs rows, tests in both suites.

Purpose: Part A closes two real resume gaps (a phase whose plans all completed but whose tail never ran is currently un-resumable through execute-phase). Part B lets users keep skills in a dotfiles repo or shared directory and symlink them into the skills dir without disabling the symlink-escape guard.

Output: edited workflow, two resolver twins + two schema twins, `loadTrustedGlobalRoots` in security.cjs, two new CJS guard tests wired into CI, appended SDK vitest cases, a config-reference row and a README features row, rebuilt `sdk/dist`, regenerated `dist/bm`, all gates green with zero new failures. No version bump, no CHANGELOG entry (release cut separately), no Co-Authored-By.
</objective>

<execution_context>
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/bm/4.7.1/workflows/execute-plan.md
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/bm/4.7.1/templates/summary.md
</execution_context>

<context>
@/Users/jnuyens/src/gsd-plugin/CLAUDE.md
@/Users/jnuyens/src/gsd-plugin/workflows/execute-phase.md
@/Users/jnuyens/src/gsd-plugin/bin/lib/security.cjs
@/Users/jnuyens/src/gsd-plugin/sdk/src/query/skills.ts
@/Users/jnuyens/src/gsd-plugin/tests/agent-skills-plugin-form.test.cjs
@/Users/jnuyens/src/gsd-plugin/tests/gap-auto-routing.test.cjs
@/Users/jnuyens/src/gsd-plugin/tests/phase-complete-backlog-sentinel.test.cjs
@/Users/jnuyens/src/gsd-plugin/.planning/quick/260920-mb0-port-4-upstream-gsd-core-v1-12-v1-14-fix/260920-mb0-PLAN.md

<planner_findings>
Facts established during planning (use directly, do not re-derive):

- The exit to replace is `workflows/execute-phase.md:319`, the single line `If all filtered: "No matching incomplete plans" → exit.` inside `<step name="discover_and_group_plans">` (:306-334). The next step is `cross_ai_delegation` (:336), then `execute_waves` (:407), `checkpoint_handling` (:1023), `aggregate_results` (:1065), ... `verify_phase_goal` (:1424), `update_roadmap` (:1597). `PHASE_NUMBER` is the phase variable already used at :301 and :1601; `WAVE_FILTER` is set by `--wave N` in `parse_args` (:46); `--gaps-only` has no variable, it is referenced by flag name (:315, :1169).
- `aggregate_results` (:1065-1107) builds its report from on-disk SUMMARY.md one-liners and then runs the security gate (`workflow.security_enforcement` + `*-SECURITY.md`); nothing in it depends on plans having executed in THIS run, so jumping there with zero plans executed is safe. `update_roadmap` (:1597) is `bm-sdk query phase.complete "${PHASE_NUMBER}"` plus a docs commit.
- `check.verification-status` is SDK-only (`sdk/src/query/check-verification-status.ts`, registered as `check.verification-status` and `check verification-status`). The CLI prints the data object directly (no `data` wrapper): for phase 13 of this repo it printed `{"status":"human_needed",...}`. With no VERIFICATION.md (or phase not found) it returns `status: "missing"`. A VERIFICATION.md with no table rows and frontmatter `status: passed` returns `status: "passed"`.
- `roadmap.analyze` exists in BOTH twins: `bm-sdk query roadmap.analyze` and `node bin/gsd-tools.cjs roadmap analyze`. Each `phases[]` entry has `number` (roadmap spelling, e.g. `"9"`) and `roadmap_complete` (boolean from the `- [x] Phase N:` checklist; `bin/lib/roadmap.cjs:303`, `sdk/src/query/roadmap.ts:795`). Phase dirs are zero-padded (`09-foundation`) while the roadmap says `9`, hence the leading-zero normalization on both sides. Note: on THIS repo the live analyze output has an empty `phases` array (milestone layout quirk); use the fixture, not the repo, to prove the shape.
- `phase-plan-index` exists in both twins (`node bin/gsd-tools.cjs phase-plan-index <N>` and `bm-sdk query phase-plan-index <N>`); each plan carries `has_summary` and `complete`, and the top level carries `incomplete[]`. `complete` derives from `summaryFileIsComplete`: a SUMMARY whose frontmatter `status` is NOT in `INCOMPLETE_SUMMARY_STATUSES` (`paused, partial, incomplete, blocked, gaps, gaps_found, not-complete, not_complete`) counts as complete. So `status: retired` reads `complete: true` without any code change, which is exactly why upstream's `blocked_by` branch is unnecessary here (see the drop below).
- Upstream condition 2 (the `blocked_by` "stuck on a halt" branch) is DROPPED: our plan index does not surface `blocked_by`, and our status-aware filter already keeps blocked/paused/partial plans (`complete: false`) in the run set, so an all-filtered state can only mean every plan is complete or retired. Record this in the SUMMARY.
- CJS agent-skills: `bin/lib/init.cjs:1708 buildAgentSkillsBlock(config, agentType, projectRoot)`; `validatePath` is destructured from `./security.cjs` at :1709; `globalSkillsBase` computed at :1713; the failing check is `if (!pathCheck.safe)` at :1774 (WARNING text: Global skill "<name>" failed path check (symlink escape?), then the pre-existing dash character, then "skipping"; keep it byte-identical), and the accept is `validPaths.push({ kind: 'path', ref: `${globalSkillDir}/SKILL.md`, display: displayPath })` at :1778 (logical path, not the realpath; keep it). The plugin form (`skillName.includes(':')`, :1741-1752) never touches the filesystem; leave it alone.
- SDK agent-skills: `sdk/src/query/skills.ts:59 agentSkills`; `globalSkillsBase = resolveGlobalSkillsBase(runtime)` at :87; failing check `resolveWithinBase(skillMd, globalSkillsBase) === null` at :133 with the same WARNING text; accept `validEntries.push({ kind: 'path', ref: skillMd })` at :137. `skills.ts` imports only `existsSync, realpathSync` from `node:fs` and `join, resolve, sep` from `node:path`; it does not import from security. `config` there is a `GSDConfig`; the file already casts `config as { runtime?: unknown }`, so use the same cast style for `agent_skills_security`.
- Both config loaders pass unknown top-level keys through untouched (that is how `agent_skills` reaches the resolvers today), so `config.agent_skills_security.trusted_global_roots` is readable without loader changes.
- `security.cjs` requires `fs` and `path` at :18-19 (no `os` yet); exports block at :478-505 starts with `// Path safety` / `validatePath, requireSafePath`. `validatePath(filePath, baseDir, { allowAbsolute: true })` returns `{ safe, resolved, error? }` and realpaths both sides, so it can be reused verbatim for per-root containment.
- Config schema: `bin/lib/config-schema.cjs` VALID_CONFIG_KEYS ends with `'resolve_model_ids',` then `]);` at ~:86-87; `sdk/src/query/config-schema.ts` same shape at ~:93-95. `tests/config-schema-sdk-parity.test.cjs` extracts the SDK Set literals by text and compares; adding one identical string to both keeps it green. Do NOT add a dynamic pattern (the `agent_skills.<agent-type>` pattern at cjs:104 / ts:112 is a different family).
- Test fixtures for the global skills dir: both twins honor `CLAUDE_CONFIG_DIR` (CJS `runtime-homes.cjs:124`, SDK `helpers.ts:44`), so the base is `<CLAUDE_CONFIG_DIR>/skills`. `tests/agent-skills-plugin-form.test.cjs` already spawns `gsd-tools.cjs agent-skills` with `CLAUDE_CONFIG_DIR: path.join(root, 'cfg')`; `sdk/src/query/skills.test.ts:210-231` sets `process.env.CLAUDE_CONFIG_DIR` around the call and :246-263 spies on `process.stderr.write`. macOS tmpdir is a symlink (`/var/folders/...` -> `/private/var/...`); both `validatePath` and `resolveWithinBase` realpath both sides, and the loader realpaths roots, so fixtures work unchanged.
- Config reference: `references/planning-config.md:338` is the `agent_skills` row (inside `### Advanced Fields`, a 5-column table `Key | Type | Default | Allowed Values | Description`). README `## Added features beyond upstream` table starts at README.md:171 (3 columns `Feature | What it does | Command / hook`); the prose ratchet (`bin/maintenance/check-user-docs-prose.cjs`) and jargon ratchet (`check-user-docs-jargon.cjs`) cover README.md and CHANGELOG.md only.
- CI: new CJS tests are enumerated one per line in the `drift-detectors` job of `.github/workflows/check-drift.yml` (:98-134), e.g. `- name: Run skill effort-frontmatter guard test` / `run: node tests/effort-frontmatter.test.cjs`.
- Baselines measured during planning (2026-09-20): CJS battery has THREE failing files: `tests/agent-name-normalization.test.cjs` (environmental: it scans the gitignored `.planning/` and finds a `generated-by: bm-doc-writer` marker in a quick PLAN; not visible to CI), `tests/context-monitor-hook-event.test.cjs`, `tests/version-command.test.cjs`. SDK `test:integration` has ~14 known golden failures. Re-capture both before editing; zero NEW allowed.
- `bin/build-bm.cjs` copies via `git ls-files`, so NEW files must be `git add -N`ed before `node bin/build-bm.cjs`; `dist/bm/workflows/execute-phase.md`, `dist/bm/bin/lib/security.cjs`, `dist/bm/references/planning-config.md` are all generated twins.
- Hygiene gate (identical to the mb0 plan): match dash bytes in octal under `LC_ALL=C` and the forbidden word with `canon[i]cal` so the gate never contains a forbidden token. Upstream markers: `#2868` and `#3684` are allowed in the workflow resume messages (instruction prose, aids debugging, matches upstream) and in the SUMMARY; they are forbidden in `bin/lib`, `sdk/src`, and `tests` source or comments. Upstream provenance for the SUMMARY only: Part A upstream issues 2868 and 3684 (plus dropped 2830 branch); Part B upstream PR 754.
</planner_findings>

<interfaces>
From bin/lib/security.cjs (existing):
  validatePath(filePath, baseDir, opts = {}) -> { safe: boolean, resolved: string, error?: string }   // opts.allowAbsolute

To add to bin/lib/security.cjs (export next to validatePath):
  loadTrustedGlobalRoots(config) -> string[]   // resolved real paths, de-duped, order of first appearance

To add inline to sdk/src/query/skills.ts (not exported):
  function loadTrustedGlobalRoots(config: unknown): string[]

From sdk/src/query/skills.ts (existing, reuse for per-root containment):
  function resolveWithinBase(target: string, baseDir: string): string | null

Exact stderr strings (byte-identical in both twins; the WARNING already exists):
  `[agent-skills] NOTE: Global skill "${skillName}" accepted via trusted_global_roots (resolves under ${root})\n`
  The existing WARNING line stays byte-identical in both twins (it already contains a dash character between "(symlink escape?)" and "skipping"; copy it from the source, do not retype it)

CLI surfaces used by fixtures:
  node bin/gsd-tools.cjs phase-plan-index <N>        -> { plans[]{id, has_summary, complete}, incomplete[] }
  node sdk/dist/cli.js query check.verification-status <N> -> { status: 'missing' | <frontmatter/table-derived>, ... }
  node bin/gsd-tools.cjs roadmap analyze              -> { phases[]{number, roadmap_complete, ...} }
  node sdk/dist/cli.js query roadmap.analyze          -> same shape (read `.data ?? root` defensively)
  node bin/gsd-tools.cjs phase complete <N>           -> ticks the checkbox; idempotent on re-run
  node bin/gsd-tools.cjs agent-skills <agent>         -> raw <agent_skills> block on stdout, warnings/notes on stderr
  node sdk/dist/cli.js query agent-skills <agent>     -> same
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Capture baselines, then replace the unconditional all-filtered exit in execute-phase with the status-aware 4-way decision, pinned by a fixture-driven CJS guard test</name>
  <files>workflows/execute-phase.md, tests/execute-phase-resume-gaps.test.cjs</files>
  <behavior>
    - Fixture A (all plans complete, one `status: retired`, no VERIFICATION.md, roadmap unticked): `phase-plan-index 9` reports every plan `complete: true` and `incomplete: []`; `check.verification-status 9` reports `status: "missing"` (these are the inputs that must route to aggregate_results)
    - Fixture B (same plans plus `09-VERIFICATION.md` with frontmatter `status: passed`, roadmap unticked): `roadmap analyze` phase `9` has `roadmap_complete: false` and `check.verification-status 9` status is not `missing` (routes to update_roadmap)
    - Idempotency: on Fixture B, `phase complete 9` once ticks the box (`roadmap_complete: true`); running it a second time leaves `.planning/ROADMAP.md` byte-identical to the state after the first run
    - Workflow pins on the `discover_and_group_plans` step slice: the old `If all filtered: "No matching incomplete plans"` exit line is gone; the slice contains `check.verification-status`, `roadmap_complete`, `aggregate_results`, `update_roadmap`, `WAVE_FILTER`, `--gaps-only`, `#2868`, `#3684`
  </behavior>
  <action>
    Baselines FIRST, before any edit, into the scratchpad `/private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/`: (a) `cjs-baseline.txt` from `for f in tests/*.test.cjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done` (expect exactly the three files listed in planner_findings); (b) `integration-baseline.txt` from `npm --prefix sdk run test:integration 2>&1 | tail -60`. These are the comparison targets for Task 3.

    Edit `workflows/execute-phase.md` inside `<step name="discover_and_group_plans">` only. Delete the single line `If all filtered: "No matching incomplete plans" → exit.` (:319) and put in its place a subsection headed `**If every plan is filtered out:**` that reads as follows (directive prose plus one small bash block; use plain ASCII punctuation in the new text, no em or en dashes):

    First a one-sentence rationale: the status-aware filter above already keeps paused, blocked and partial plans (`complete: false`) in the run set, so an all-filtered state means every plan reads complete or retired, and the only open question is whether the phase tail (verification, roadmap tick) ran.

    Then a fenced bash block that computes two variables. `VERIFY_STATUS`: run `bm-sdk query check.verification-status "${PHASE_NUMBER}" 2>/dev/null`, with the bundled fallback `node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/sdk/dist/cli.js" query check.verification-status "${PHASE_NUMBER}"` on failure, piped through a `node -e` one-liner that JSON-parses stdin and prints `(o.data ?? o).status ?? 'missing'`, printing `missing` on parse failure. `PHASE_MARKED`: run `bm-sdk query roadmap.analyze 2>/dev/null`, with the bundled fallback `node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/bin/gsd-tools.cjs" roadmap analyze` (roadmap.analyze lives in both twins), piped through a `node -e` one-liner that receives `"${PHASE_NUMBER}"` as `process.argv[1]`, normalizes leading zeros on BOTH sides with `String(x).replace(/^0+(?=\d)/, '')`, finds the entry in `(o.data ?? o).phases` whose normalized `number` equals the normalized argument, and prints `true` only when that entry's `roadmap_complete === true`, else `false`. Add a one-line comment above the block that `check.verification-status` returns `missing` when no VERIFICATION.md exists and that both commands are read-only.

    Then the decision, as a numbered list evaluated in order:
    1. A filter is active (`--gaps-only` was passed or `WAVE_FILTER` is set): print `No matching incomplete plans` and exit (unchanged behaviour).
    2. No filter and `VERIFY_STATUS` is `missing`: this is a resume of a run that completed every plan but died before verification (#2868). Print a short notice (`All {N} plans are complete but Phase {X} has no VERIFICATION.md; resuming at the phase tail (#2868).`), then SKIP `cross_ai_delegation`, `execute_waves` and `checkpoint_handling` and continue at `aggregate_results` (its report is built from on-disk SUMMARYs and it runs the security gate; it does not need plans executed in this run). The normal tail follows from there.
    3. No filter, `VERIFY_STATUS` is not `missing`, and `PHASE_MARKED` is not `true`: verification exists but the run died before the roadmap tick (#3684). Print `Phase {X} is verified but not marked complete in ROADMAP.md; resuming at update_roadmap (#3684).` and continue directly at `update_roadmap` (do NOT redo verification or any gate). The steps after `update_roadmap` follow as normal.
    4. No filter, `VERIFY_STATUS` is not `missing`, and `PHASE_MARKED` is `true`: the phase is genuinely done. Print `Phase {X} is already complete (all plans complete, verified, roadmap ticked).` and exit (unchanged behaviour).

    Add one sentence after the list: an all-filtered state can only reach 2 to 4 because paused/blocked/partial plans are never filtered (there is no separate "stuck on a halt" branch). Leave the `Report:` block and everything else in the step untouched.

    Create `tests/execute-phase-resume-gaps.test.cjs` as a zero-dep harness (mirror `tests/gap-auto-routing.test.cjs` for the `ok`/`fail`/`failures`/`process.exit` shape and `tests/phase-complete-backlog-sentinel.test.cjs` for the ROADMAP/STATE fixtures). It must:
    - Pin the workflow text: read `workflows/execute-phase.md`, slice from `<step name="discover_and_group_plans">` to the next `<step name=`, assert the old line `If all filtered: "No matching incomplete plans"` is absent from the whole file, and assert each of `check.verification-status`, `roadmap_complete`, `aggregate_results`, `update_roadmap`, `WAVE_FILTER`, `--gaps-only`, `#2868`, `#3684` is present in the slice.
    - Build Fixture A in a `mkdtemp` project: `.planning/ROADMAP.md` with `## Current Milestone: Test`, a Progress table, checklist `- [ ] Phase 9: Foundation` and `- [ ] Phase 10: Final`, detail sections `### Phase 9: Foundation` and `### Phase 10: Final` (goal lines and `Plans:` lists as in the sentinel fixture) and a `### Phase 999.1: Backlog (BACKLOG)` tail; `.planning/STATE.md` from the sentinel fixture; `.planning/phases/09-foundation/` containing `09-01-PLAN.md` and `09-02-PLAN.md` (minimal frontmatter `phase: 09-foundation`, `plan: NN`, `wave: 1`, `autonomous: true`, plus an `<objective>` line), `09-01-SUMMARY.md` with `status: complete`, and `09-02-SUMMARY.md` with `status: retired`; NO VERIFICATION.md. Run `node bin/gsd-tools.cjs phase-plan-index 9` with `cwd` set to the project and assert every `plans[].complete === true` and `incomplete.length === 0`; run `node sdk/dist/cli.js query check.verification-status 9` (same cwd; parse `.data ?? root`) and assert `status === 'missing'`.
    - Build Fixture B: Fixture A plus `09-foundation/09-VERIFICATION.md` with frontmatter `status: passed` and a one-line body (no table). Assert `node bin/gsd-tools.cjs roadmap analyze` has a phase with `number === '9'` and `roadmap_complete === false`, and `check.verification-status 9` status is `'passed'`. Then run `node bin/gsd-tools.cjs phase complete 9`, read `ROADMAP.md` bytes, assert analyze now reports `roadmap_complete === true`, run `phase complete 9` again, and assert the ROADMAP bytes are identical to the first post-run read.
    - Clean up temp dirs in `finally`. Use `execFileSync(process.execPath, [...], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })`; the SDK CLI path is `path.join(ROOT, 'sdk', 'dist', 'cli.js')` (built artifact is tracked, so the test runs before Task 3's rebuild).
    Keep the test free of the forbidden dash characters and of the word spelled c-a-n-o-n-i-c-a-l. Issue numbers may appear ONLY inside the string literals the test asserts against the workflow (they are the workflow prose markers); do not put them in comments.
  </action>
  <verify>
    <automated>cd /Users/jnuyens/src/gsd-plugin && node tests/execute-phase-resume-gaps.test.cjs && ! grep -Fq 'If all filtered: "No matching incomplete plans"' workflows/execute-phase.md && awk '/<step name="discover_and_group_plans">/,/<step name="cross_ai_delegation">/' workflows/execute-phase.md > /private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/dgp.txt && for t in check.verification-status roadmap_complete aggregate_results update_roadmap WAVE_FILTER -- '--gaps-only' '#2868' '#3684' 'cross_ai_delegation'; do grep -Fq -- "$t" /private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/dgp.txt || { echo "missing $t"; exit 1; }; done && test -s /private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/cjs-baseline.txt -o -e /private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/cjs-baseline.txt && test -e /private/tmp/claude-503/-Users-jnuyens-src-gsd-plugin/b17e3628-eb00-4942-aa8c-5af54ba313a9/scratchpad/integration-baseline.txt && node tests/gap-auto-routing.test.cjs</automated>
  </verify>
  <done>Both baseline files exist in the scratchpad; the old exit line is gone; the `discover_and_group_plans` step carries the two read-only probes (with bundled-tool fallbacks), the ordered 4-way decision, and the resume messages with the #2868/#3684 markers; `tests/execute-phase-resume-gaps.test.cjs` passes (Fixture A: all complete + verification missing; Fixture B: verified + unticked, then ticked, then byte-identical on the second `phase complete`); the neighbouring `gap-auto-routing` workflow test still passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement agent_skills_security.trusted_global_roots in both resolver twins and both config-schema twins, with a CJS guard test and appended SDK cases</name>
  <files>bin/lib/security.cjs, bin/lib/init.cjs, sdk/src/query/skills.ts, bin/lib/config-schema.cjs, sdk/src/query/config-schema.ts, tests/trusted-global-roots.test.cjs, sdk/src/query/skills.test.ts</files>
  <behavior>
    - Loader: `loadTrustedGlobalRoots({})`, `loadTrustedGlobalRoots({ agent_skills_security: { trusted_global_roots: 'x' } })` and a non-object config each return `[]`; non-string entries are skipped; a relative entry (`outside`) is rejected; `/` is rejected; `os.homedir()` and `~` are rejected; a non-existent absolute path is dropped; an existing temp dir is returned as its real path; the same dir listed twice (once via a symlink to it) yields one entry
    - Default (no config key): a `global:ext-skill` whose `<cfg>/skills/ext-skill` is a symlink to `<root>/outside/ext-skill` produces empty stdout and a stderr WARNING containing `failed path check`
    - Trusted: with `agent_skills_security.trusted_global_roots: ['<root>/outside']`, stdout is the block whose only line is `- @<cfg>/skills/ext-skill/SKILL.md` (the logical path) and stderr contains `NOTE: Global skill "ext-skill" accepted via trusted_global_roots`
    - Hardening negatives, each with the same symlinked skill: roots `['outside']` (project-relative), `['/']`, `[os.homedir()]`, `['<root>/does-not-exist']` each produce empty stdout and the WARNING, never the NOTE
    - In-base skill (`<cfg>/skills/my-notes`, no symlink) with trusted roots configured still loads and stderr contains no `NOTE:`
    - Plugin form `global:superpowers:brainstorming` with trusted roots configured still emits the Skill-tool directive (branch untouched)
    - Same matrix passes against the SDK handler (`agentSkills(['gsd-executor'], tmpDir)` with `CLAUDE_CONFIG_DIR` set and a stderr spy)
    - `tests/config-schema-sdk-parity.test.cjs` stays green and both `VALID_CONFIG_KEYS` contain the exact string `agent_skills_security.trusted_global_roots`
  </behavior>
  <action>
    Config schema (both twins, identical string): append `'agent_skills_security.trusted_global_roots',` as the last literal of `VALID_CONFIG_KEYS` in `bin/lib/config-schema.cjs` (after `'resolve_model_ids',`) and in `sdk/src/query/config-schema.ts` (same position). Precede it with a one-line comment in each file: extra directories a symlinked global skill may resolve into (array of absolute paths, default empty). No dynamic pattern, no other file.

    `bin/lib/security.cjs`: add `const os = require('os');` next to the existing requires, then add `loadTrustedGlobalRoots(config)` directly after `requireSafePath` with a doc comment describing the contract (behaviour only, no issue or PR numbers). Logic: if `config` is not an object or `config.agent_skills_security` is not an object or its `trusted_global_roots` is not an array, return `[]`. Compute `homeReal` once as `fs.realpathSync(os.homedir())` (fall back to `path.resolve(os.homedir())` if realpath throws). For each entry: skip non-strings; tilde-expand (`~` alone -> homedir, `~/x` -> `path.join(homedir, x)`; other strings unchanged); skip when `!path.isAbsolute(expanded)`; `fs.realpathSync(expanded)` inside try/catch and skip silently on throw (non-existent or unreadable); skip when the real path is a filesystem, drive or UNC root, defined as: `const rootOf = path.parse(real).root; real === rootOf || real === rootOf.replace(/[\\/]+$/, '')`; skip when `real === homeReal`; push when not already present (de-dupe by the resolved real path, first occurrence wins). Return the array. Export it in the `// Path safety` group right after `validatePath` / `requireSafePath`.

    `bin/lib/init.cjs` `buildAgentSkillsBlock`: change the destructure at :1709 to `const { validatePath, loadTrustedGlobalRoots } = require('./security.cjs');` and, right after `globalSkillsBase` is computed (:1713), add `const trustedGlobalRoots = loadTrustedGlobalRoots(config);` (computed ONCE, before the loop). Replace the block at :1773-1778 so that when `pathCheck.safe` is false you look for the first `root` in `trustedGlobalRoots` for which `validatePath(globalSkillMd, root, { allowAbsolute: true }).safe` is true; if none, write the existing WARNING (byte-unchanged) and `continue`; if found, write the NOTE line `[agent-skills] NOTE: Global skill "${skillName}" accepted via trusted_global_roots (resolves under ${root})\n` to stderr and fall through to the existing `validPaths.push({ kind: 'path', ref: `${globalSkillDir}/SKILL.md`, display: displayPath })`. Update the guard comment above to say containment is checked against the runtime skills dir first and then against each configured trusted root (no issue numbers in the new comment text; the pre-existing `(#1992)` may stay only if that line is otherwise untouched). Do not touch the plugin-form branch or the project-relative branch. With no config key the code path is byte-identical in behaviour to today.

    `sdk/src/query/skills.ts`: extend the imports to `import { existsSync, realpathSync } from 'node:fs'`, `import { isAbsolute, join, parse, resolve, sep } from 'node:path'`, and add `import { homedir } from 'node:os'`. Add a module-private `function loadTrustedGlobalRoots(config: unknown): string[]` directly below `resolveWithinBase` implementing the SAME steps in the same order as the CJS twin (type-narrow with `typeof config === 'object' && config !== null`, then read `(config as { agent_skills_security?: unknown }).agent_skills_security`, then its `trusted_global_roots`); use `isAbsolute`, `realpathSync`, `parse(real).root`, `homedir()`. Keep the doc comment text identical to the CJS one. In `agentSkills`, right after `const globalSkillsBase = resolveGlobalSkillsBase(runtime);` add `const trustedGlobalRoots = loadTrustedGlobalRoots(config);`. Replace the `if (resolveWithinBase(skillMd, globalSkillsBase) === null) { WARNING; continue; }` at :133-136 with: when the base check is null, find the first `root` in `trustedGlobalRoots` with `resolveWithinBase(skillMd, root) !== null`; if none, write the existing WARNING (byte-unchanged) and `continue`; else write the identical NOTE line and fall through to `validEntries.push({ kind: 'path', ref: skillMd })`. The NOTE and WARNING strings must be byte-identical across the two twins; copy-paste them.

    Tests. Create `tests/trusted-global-roots.test.cjs` (zero-dep harness; reuse `withProject`, `writeSkill`, `writeConfig`, `runAgentSkills` from `tests/agent-skills-plugin-form.test.cjs` by copying them; `runAgentSkills` already sets `CLAUDE_CONFIG_DIR` to `<root>/cfg`). Part 1 loader checks: `require('../bin/lib/security.cjs').loadTrustedGlobalRoots` against the behaviour list (create a temp dir plus a symlink to it for the de-dupe case; use `fs.symlinkSync(target, link, 'dir')`). Part 2 subprocess matrix: helper `linkExternalSkill(root)` that calls `writeSkill(path.join(root, 'outside'), 'ext-skill')`, `fs.mkdirSync(path.join(root, 'cfg', 'skills'), { recursive: true })`, then `fs.symlinkSync(path.join(root, 'outside', 'ext-skill'), path.join(root, 'cfg', 'skills', 'ext-skill'), 'dir')`; then the default-rejected, trusted-accepted (assert stdout equals the exact three-line block with `- @${path.join(root, 'cfg', 'skills', 'ext-skill', 'SKILL.md')}` and stderr includes the NOTE), four hardening negatives, in-base-no-NOTE, and plugin-form-untouched cases. Use the same `check`/`assert` footer as the plugin-form test.
    Append to `sdk/src/query/skills.test.ts` a `describe('trusted_global_roots')` block with the same matrix: set `process.env.CLAUDE_CONFIG_DIR = join(tmpDir, 'cfg')` in a `beforeEach` of that block and restore in `afterEach`; create the symlink with `symlink` from `node:fs/promises` (`await symlink(target, link, 'dir')`); capture stderr with the existing `vi.spyOn(process.stderr, 'write')` pattern; assert `r.data` and the NOTE/WARNING presence. Run `cd sdk && npx vitest run --project unit src/query/skills.test.ts` and `node tests/trusted-global-roots.test.cjs`, `node tests/agent-skills-plugin-form.test.cjs`, `node tests/config-schema-sdk-parity.test.cjs`.
    Hygiene for every added line in `bin/lib`, `sdk/src`, `tests`: no `#NNNN` issue numbers, no em or en dash, no forbidden word.
  </action>
  <verify>
    <automated>cd /Users/jnuyens/src/gsd-plugin && node tests/trusted-global-roots.test.cjs && node tests/agent-skills-plugin-form.test.cjs && node tests/config-schema-sdk-parity.test.cjs && node -e "const {loadTrustedGlobalRoots}=require('./bin/lib/security.cjs');const os=require('os'),fs=require('fs'),path=require('path');const d=fs.mkdtempSync(path.join(os.tmpdir(),'tgr-'));try{const r=loadTrustedGlobalRoots({agent_skills_security:{trusted_global_roots:['/',os.homedir(),'~','rel/x',path.join(d,'nope'),d,d,42]}});if(r.length!==1||r[0]!==fs.realpathSync(d))throw new Error(JSON.stringify(r));if(loadTrustedGlobalRoots({}).length!==0)throw new Error('empty cfg');console.log('loader ok')}finally{fs.rmSync(d,{recursive:true,force:true})}" && grep -c "agent_skills_security.trusted_global_roots" bin/lib/config-schema.cjs sdk/src/query/config-schema.ts && grep -c 'accepted via trusted_global_roots (resolves under ' bin/lib/init.cjs sdk/src/query/skills.ts && cd sdk && npx vitest run --project unit src/query/skills.test.ts src/query/config-mutation.test.ts</automated>
  </verify>
  <done>Both schema twins list the fixed leaf key and the parity test passes; `loadTrustedGlobalRoots` is exported from security.cjs and its inline SDK equivalent exists with identical comment and string text; both resolvers accept a symlinked-out global skill only when its real location sits under a configured trusted root, emitting the NOTE, and otherwise keep the unchanged WARNING; the new CJS test and the appended vitest cases cover default rejection, trusted acceptance, four hardening negatives, in-base no-NOTE, and plugin-form untouched; the inline loader check prints `loader ok`.</done>
</task>

<task type="auto">
  <name>Task 3: Docs rows, CI wiring, SDK rebuild, dist/bm regeneration, and every hard gate against the baselines</name>
  <files>references/planning-config.md, README.md, .github/workflows/check-drift.yml, sdk/dist/, dist/bm/</files>
  <action>
    1. Docs. In `references/planning-config.md`, add a row directly after the `agent_skills` row (:338, `### Advanced Fields` table, 5 columns): key `` `agent_skills_security.trusted_global_roots` ``, type `array`, default `` `[]` ``, allowed values `Absolute directory paths (`~` expands to the home directory)`, description: extra directories a `global:<name>` skill is allowed to resolve into through a symlink; entries must be absolute and exist, the filesystem root and the home directory are refused, and with the default an outside-symlinked skill is skipped. In `README.md` `## Added features beyond upstream` table (starts :171), add a row as the first data row (after the header separator): feature `**Trusted roots for symlinked global skills**`, what it does: a global skill whose directory is a symlink to a location outside the runtime skills dir is refused by default; listing that location in `agent_skills_security.trusted_global_roots` accepts it, while the filesystem root and your home directory are never accepted; command/hook `` `.planning/config.json` ``. Plain ASCII punctuation, no em or en dash, none of the banned marketing words, no version tag (the release cut adds it). Run `node bin/maintenance/check-user-docs-prose.cjs` and `node bin/maintenance/check-user-docs-jargon.cjs`; if either flags the new row, reword the row (do not regenerate any baseline).
    2. CI. Add two lines to the `drift-detectors` job in `.github/workflows/check-drift.yml`, same indentation and one-line-per-test pattern, placed after the `skill effort-frontmatter guard test` entry: `- name: Run execute-phase resume-gap routing guard test` / `run: node tests/execute-phase-resume-gaps.test.cjs` and `- name: Run trusted global skill roots guard test` / `run: node tests/trusted-global-roots.test.cjs`.
    3. Build. `npm --prefix sdk run build` (tsc + esbuild). Prove Part B through the BUILT CLI: create a temp project with the symlinked `ext-skill` fixture from Task 2 and `agent_skills_security.trusted_global_roots` set to `<root>/outside`, run `CLAUDE_CONFIG_DIR=<root>/cfg node sdk/dist/cli.js query --project-dir <root> agent-skills gsd-executor`, and assert stdout is the block with `- @<root>/cfg/skills/ext-skill/SKILL.md` and stderr has the NOTE; repeat without the key and assert empty stdout plus the WARNING. Record the commands and outputs for the SUMMARY.
    4. Stage new files so build-bm sees them: `git add -N tests/execute-phase-resume-gaps.test.cjs tests/trusted-global-roots.test.cjs`. Then `node bin/build-bm.cjs` and `node bin/build-bm.cjs --check` (must PASS), `node tests/bm-parity.test.cjs`, `node tests/build-bm-drift.test.cjs`. Confirm the twins carried over: `grep -c 'check.verification-status' dist/bm/workflows/execute-phase.md`, `grep -c loadTrustedGlobalRoots dist/bm/bin/lib/security.cjs`, `grep -c trusted_global_roots dist/bm/references/planning-config.md` are all non-zero.
    5. Hard gates, each compared to the Task 1 baselines in the scratchpad:
       - CJS battery: `for f in tests/*.test.cjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done > <scratch>/cjs-after.txt; diff <scratch>/cjs-baseline.txt <scratch>/cjs-after.txt` must show no added `FAIL` lines (the three known files may still fail; `agent-name-normalization` is environmental, see planner_findings).
       - SDK unit: `npm --prefix sdk run test` fully green.
       - SDK integration: `npm --prefix sdk run test:integration 2>&1 | tail -60 > <scratch>/integration-after.txt`; the failing test names must be a subset of the baseline set (zero NEW). Do not touch goldens unless a failure is caused by this change and legitimately so; if that happens, explain in the SUMMARY.
       - Hygiene over added lines (dash bytes in octal, forbidden word via bracket regex): `git diff -U0 -- bin/lib sdk/src tests | grep '^+' | grep -v '^+++' | LC_ALL=C grep -nE $'#[0-9]{4}|\342\200\224|\342\200\223|canon[i]cal'` must print nothing EXCEPT the string-literal lines in `tests/execute-phase-resume-gaps.test.cjs` that assert the `#2868` / `#3684` workflow markers; if any other line matches, fix it. Separately confirm `git diff -U0 -- workflows references README.md .github | grep '^+' | grep -v '^+++' | LC_ALL=C grep -nE $'\342\200\224|\342\200\223|canon[i]cal'` prints nothing (workflow prose may contain the issue markers; it must not contain dashes or the forbidden word).
    6. Confirm no version or CHANGELOG change: `git diff --stat -- CHANGELOG.md package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json` is empty. No Co-Authored-By anywhere.
    7. Write the SUMMARY: Part A (upstream issues 2868 and 3684; the DROPPED upstream condition 2 / 2830 `blocked_by` branch and why: our plan index has no `blocked_by` and the status-aware filter keeps blocked/paused/partial plans in the run set; the `complete` vocabulary vs upstream `has_summary`); Part B (upstream PR 754; loader hardening rules; NOTE/WARNING strings byte-identical across twins; default `[]` byte-identical behaviour); the built-CLI proof outputs; before/after gate counts; the environmental `agent-name-normalization` baseline failure; docs rows added; CI lines added. Upstream numbers belong in the SUMMARY and the workflow resume messages only.
  </action>
  <verify>
    <automated>cd /Users/jnuyens/src/gsd-plugin && node bin/build-bm.cjs --check && node tests/bm-parity.test.cjs && node tests/build-bm-drift.test.cjs && node bin/maintenance/check-user-docs-prose.cjs && node bin/maintenance/check-user-docs-jargon.cjs && test "$(grep -c 'check.verification-status' dist/bm/workflows/execute-phase.md)" -ge 2 && test "$(grep -c loadTrustedGlobalRoots dist/bm/bin/lib/security.cjs)" -ge 2 && grep -q trusted_global_roots dist/bm/references/planning-config.md && grep -q 'agent_skills_security.trusted_global_roots' references/planning-config.md && grep -q trusted_global_roots README.md && grep -c "execute-phase-resume-gaps\|trusted-global-roots" .github/workflows/check-drift.yml && npm --prefix sdk run test && test -z "$(git diff -U0 -- bin/lib sdk/src tests | grep '^+' | grep -v '^+++' | grep -v 'tests/execute-phase-resume-gaps' | LC_ALL=C grep -E $'\342\200\224|\342\200\223|canon[i]cal')" && test -z "$(git diff -U0 -- bin/lib sdk/src | grep '^+' | grep -v '^+++' | LC_ALL=C grep -E '#[0-9]{4}')" && test -z "$(git diff -U0 -- workflows references README.md .github | grep '^+' | grep -v '^+++' | LC_ALL=C grep -E $'\342\200\224|\342\200\223|canon[i]cal')" && test -z "$(git diff --stat -- CHANGELOG.md package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json)"</automated>
  </verify>
  <done>Config reference and README rows present and passing both docs ratchets; CI lists both new tests; `sdk/dist` rebuilt and the built CLI proves trusted-root acceptance and default rejection; `dist/bm` regenerated with all three twins carried and `--check` green; CJS battery diff vs baseline shows no new failures; SDK unit green; integration failing set is a subset of baseline; hygiene scans clean (issue markers only in the workflow prose and the workflow-pinning test literals); no version/CHANGELOG diff; SUMMARY written with the dropped-branch rationale and upstream provenance.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| .planning/config.json -> agent prompt | User-authored config decides which SKILL.md files are injected into subagent prompts; a symlink under the global skills dir can point anywhere on disk |
| .planning markdown -> execute-phase routing | ROADMAP.md / VERIFICATION.md content decides whether the workflow resumes at the tail or exits |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nwr-01 | Elevation of Privilege | trusted_global_roots loader (both twins) | mitigate | Reject relative entries, the filesystem/drive/UNC root, and the home directory; realpath every root; drop non-existent roots; only a root explicitly listed in the project config widens containment, and only for the global:<name> branch |
| T-nwr-02 | Tampering | global skill symlink escape | mitigate | Default `[]` keeps the existing symlink-escape WARNING byte-identical; acceptance requires realpath containment under a listed root (validatePath / resolveWithinBase, never string prefix on logical paths) |
| T-nwr-03 | Information Disclosure | NOTE line prints the resolved root | accept | stderr only, local session, the user configured that root themselves |
| T-nwr-04 | Denial of Service | execute-phase tail resume with zero plans | mitigate | aggregate_results reads on-disk SUMMARYs and runs the security gate; update_roadmap is phase.complete, proven idempotent by the guard test; filters still exit unchanged |
| T-nwr-05 | Repudiation | phase marked complete without verification | mitigate | Branch 3 requires VERIFY_STATUS != missing before jumping to update_roadmap; branch 2 always goes through aggregate_results and the verification tail |
| T-nwr-SC | Tampering | npm/pip/cargo installs | accept | No packages installed; all changes use Node built-ins and existing devDependencies |
</threat_model>

<verification>
- `node tests/execute-phase-resume-gaps.test.cjs` passes: workflow pins, Fixture A routing inputs, Fixture B routing inputs, phase.complete idempotency.
- `node tests/trusted-global-roots.test.cjs`, `node tests/agent-skills-plugin-form.test.cjs`, `node tests/config-schema-sdk-parity.test.cjs` pass; `cd sdk && npx vitest run --project unit src/query/skills.test.ts` passes.
- Built CLI (`sdk/dist/cli.js`) reproduces trusted acceptance (NOTE) and default rejection (WARNING).
- `node bin/build-bm.cjs --check` PASS; bm parity and drift tests pass; both docs ratchets pass.
- CJS battery diff vs baseline: no new FAIL lines. SDK unit fully green. Integration failing set is a subset of baseline.
- Hygiene scans over added lines are clean; issue markers appear only in workflow prose and the workflow-pinning test literals.
</verification>

<success_criteria>
- execute-phase no longer dead-ends a phase whose plans are all complete: it resumes at aggregate_results when verification is missing, at update_roadmap when verified but unticked, and still exits under a filter or when genuinely done; the dropped upstream blocked_by branch is documented.
- trusted_global_roots works identically in both resolver twins with hardened loader rules, is a fixed leaf key in both schema twins, is documented in the config reference and README, and defaults to today's behaviour.
- Zero new failures across CJS battery, SDK unit, and SDK integration; sdk/dist rebuilt; dist/bm regenerated and drift check green; hygiene clean; no version bump, no CHANGELOG entry, no Co-Authored-By.
</success_criteria>

<output>
Create `/Users/jnuyens/src/gsd-plugin/.planning/quick/260920-nwr-port-2868-3684-resume-gap-fixes-execute-/260920-nwr-SUMMARY.md` when done (upstream issue and PR numbers belong there and in the workflow resume messages only, never in bin/lib, sdk/src, tests comments, or commit messages).
</output>
