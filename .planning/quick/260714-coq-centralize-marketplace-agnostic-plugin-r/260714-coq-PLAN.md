---
phase: 260714-coq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/hooks.json
  - hooks/run-bash-hook.cjs
  - bin/lib/coexist.cjs
  - bin/check-plugin-update.sh
  - tests/coexist.test.cjs
  - bin/lib/bm-transform.cjs
  - tests/bm-transform.test.cjs
  - tests/build-bm-drift.test.cjs
  - tests/bm-parity.test.cjs
  - tests/hook-fallback-resolution.test.cjs
  - .github/workflows/install-smoke.yml
  - .github/workflows/check-drift.yml
  - dist/bm/**
autonomous: true
requirements:
  - MKT-AGNOSTIC-01
  - COMPAT-05

must_haves:
  truths:
    - "An existing cache/gsd-plugin/gsd install still resolves the gsd plugin when CLAUDE_PLUGIN_ROOT is unset (backward compatibility)."
    - "An existing cache/gsd-plugin/bm install still resolves the bm plugin when CLAUDE_PLUGIN_ROOT is unset (backward compatibility)."
    - "A cache/buildomator/bm/<version>/ install resolves the bm plugin via the fallback when CLAUDE_PLUGIN_ROOT is unset."
    - "A gsd plugin cached under a non-gsd-plugin marketplace resolves via the fallback when CLAUDE_PLUGIN_ROOT is unset."
    - "When the same plugin is cached under two marketplaces at different versions, the globally highest semver wins (union sort, not first-marketplace-wins)."
    - "CLAUDE_PLUGIN_ROOT stays candidate[0] in every runtime carrier; the marketplace-agnostic scan fires only when the primary path is unset or stale."
    - "pluginIdentity returns 'bm' for a /bm/bin/ or /bm/hooks/ segment under any marketplace, and 'gsd' for the gsd equivalents, closing COMPAT-05."
    - "node bin/build-bm.cjs --check passes (committed dist/bm matches a fresh build after the source fallbacks change)."
    - "The four-marketplace resolution proof and the COMPAT-05 identity cases are permanent committed tests, not one-time verify shells."
  artifacts:
    - path: "hooks/hooks.json"
      provides: "Marketplace-agnostic inline node resolvers with global newest-version-wins ordering"
      contains: "gsd-tools.cjs"
    - path: "hooks/run-bash-hook.cjs"
      provides: "Marketplace-agnostic resolveCandidates() with union semver sort"
      contains: "resolveCandidates"
    - path: "bin/lib/coexist.cjs"
      provides: "pluginIdentity keyed on the plugin-name path segment, not the marketplace"
      contains: "function pluginIdentity"
    - path: "bin/check-plugin-update.sh"
      provides: "Marketplace-agnostic PLUGIN_CACHE discovery, merge-then-max across marketplaces"
      contains: "PLUGIN_CACHE"
    - path: "tests/coexist.test.cjs"
      provides: "Permanent COMPAT-05 pluginIdentity cases (/bm/hooks/, buildomator marketplace)"
      contains: "pluginIdentity"
    - path: "tests/hook-fallback-resolution.test.cjs"
      provides: "Permanent four-isolated-fixture resolution proof for the gsd and bm hook loaders"
      contains: "CLAUDE_PLUGIN_ROOT"
    - path: "bin/lib/bm-transform.cjs"
      provides: "FALLBACK stamp constants matching the new marketplace-agnostic literal shapes"
      contains: "stampHookFallback"
    - path: "dist/bm/hooks/hooks.json"
      provides: "Regenerated bm hooks that probe the bm plugin segment under any marketplace"
      contains: "gsd-tools.cjs"
    - path: ".github/workflows/check-drift.yml"
      provides: "CI wiring for the new resolution test"
      contains: "hook-fallback-resolution"
  key_links:
    - from: "hooks/hooks.json inline resolver"
      to: "~/.claude/plugins/cache/<any-marketplace>/gsd/<version>/bin/gsd-tools.cjs"
      via: "readdirSync marketplace enumeration, union semver sort, then candidate build"
      pattern: "readdirSync"
    - from: "bin/lib/bm-transform.cjs FALLBACK constants"
      to: "dist/bm fallback literals (plugin segment bm)"
      via: "stampHookFallback exact-literal split/join"
      pattern: "FALLBACK_"
    - from: "bin/lib/coexist.cjs pluginIdentity"
      to: "shouldYield election"
      via: "plugin-name path segment match"
      pattern: "pluginIdentity"
---

<objective>
Make the plugin-root FALLBACK marketplace-agnostic in the runtime-critical carriers so the
plugin boots and resolves no matter which marketplace directory it was installed under. The
cache layout is `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. A new
`buildomator` marketplace installs `bm` at `cache/buildomator/bm/`, but the runtime fallbacks
(hooks, the bash-hook launcher, the update watcher, and the transform that generates dist/bm)
hardcode the first cache segment as `gsd-plugin`. A session whose baked `CLAUDE_PLUGIN_ROOT`
was pruned after an upgrade then cannot locate the plugin under the new marketplace, so hooks
silently stop firing.

The fix keeps the plugin-name segment fixed per package (`gsd` for the gsd package, `bm` for
the generated bm package) and turns the marketplace segment into a wildcard scan. The globally
highest version across ALL marketplaces wins. `CLAUDE_PLUGIN_ROOT` stays the primary path
everywhere, only the fallback probe changes.

Purpose: a pruned-`CLAUDE_PLUGIN_ROOT` session under any marketplace (existing `gsd-plugin` or
new `buildomator`) still boots hooks and resolves the plugin, and both existing installs and
the new marketplace keep working. This pass also closes the deferred COMPAT-05 gap in
pluginIdentity (it currently misses `/bm/hooks/` and off-cache installs).

Output: marketplace-agnostic resolvers in hooks.json and run-bash-hook.cjs with global
newest-version-wins ordering, segment-based pluginIdentity, a glob-based update watcher, the
bm-transform constants updated in lockstep, a regenerated dist/bm, permanent committed tests
for both the four-marketplace resolution proof and the COMPAT-05 identity cases, and the CI plus
existing unit tests updated to the new glob shape.
</objective>

<scope_decision>
This pass fixes the RUNTIME-CRITICAL carriers ONLY. These are the paths that break a live
session when `CLAUDE_PLUGIN_ROOT` is pruned: the hook loaders, the bash-hook launcher, the
coexistence identity check, the update watcher, and the bm transform plus its generated
artifact and its test and CI guardrails. This is intentionally narrower than a full sweep of
every occurrence of the hardcoded literal, per the user scope decision (narrow this iteration).
</scope_decision>

<deferred>
EXPLICITLY DEFERRED to a separate follow-up quick task (NOT this plan): the same fallback
literal that appears in 42 markdown files across roughly 93 occurrences, namely agents (11),
workflows (24), skills (6), and references (1), in the two shapes `cache/gsd-plugin/current`
(about 67 occurrences) and `cache/gsd-plugin/gsd` (about 26 occurrences).

Rationale for deferring:
1. These fire only when an agent, workflow, or skill reads a reference or template file (or
   runs graphify) while `CLAUDE_PLUGIN_ROOT` is pruned, which is a rare edge case and does not
   break a live hook loop the way the runtime carriers do.
2. The gsd and bm packages ship identical reference and template content, so these markdown
   fallbacks can later use a plugin-agnostic glob (`cache/*/*/<version>/`) that needs NO bm
   transform coupling at all. Folding them in now would add transform surface for no runtime
   benefit.
3. That mechanical sweep is a clean, self-contained follow-up that can be planned and executed
   on its own without touching the transform or the drift gate.

Track this as: "follow-up: marketplace-agnostic sweep of the 42 markdown reference-doc
fallbacks (agents, workflows, skills, references), plugin-agnostic glob, no transform coupling."
</deferred>

<execution_context>
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.0.4/workflows/execute-plan.md
@/Users/jnuyens/.claude/plugins/cache/gsd-plugin/gsd/4.0.4/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- Current forms the executor must preserve or change. Extracted from the codebase. -->

hooks/hooks.json: every hook entry is an inline `node -e` resolver of this shape (17 total
across SessionStart, PreToolUse, PostToolUse, PreCompact, Stop, SubagentStop):
  1. If CLAUDE_PLUGIN_ROOT is set, push `${ROOT}/<bin-or-hooks>/<script>` FIRST.
  2. Then `const d=p.join(o.homedir(),'.claude/plugins/cache/gsd-plugin/gsd')`, readdirSync
     `d`, filter to `^\d+\.\d+\.\d+$` version dirs, sort DESCENDING, push
     `p.join(d,v,'<bin-or-hooks>/<script>')` for each.
  3. Iterate candidates `for (const x of c){...break;}`, skip missing, and if resolving a
     non-primary path after a set CLAUDE_PLUGIN_ROOT, write `GSD: plugin path stale, using <x>`
     to stderr, then require or spawn the FIRST existing candidate and stop.
The two carrier scripts are `bin/gsd-tools.cjs` (via require, then `hook <name>` argv) and
`hooks/run-bash-hook.cjs` (via child_process.spawnSync). The standalone detector `.js` hooks
use the same require-based shape. NOTE: because only candidate[0]-that-exists runs, the
candidate ORDER must already be global newest-first.

hooks/run-bash-hook.cjs resolveCandidates() (line ~53):
  `const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'gsd-plugin', 'gsd');`
  then readdirSync, version filter, DESCENDING sort, push `path.join(cacheBase, v, 'hooks', hookName)`.
  Header comment (line ~9) names `~/.claude/plugins/cache/gsd-plugin/gsd/`.

bin/lib/coexist.cjs pluginIdentity() (line ~37):
  `if (p.includes('/cache/gsd-plugin/bm/') || p.includes('/bm/bin/')) return 'bm'; return 'gsd';`
  This misses `/cache/buildomator/bm/`, `/bm/hooks/`, and off-cache bm checkouts, which is
  COMPAT-05.

bin/check-plugin-update.sh (lines 16, 28-29):
  `PLUGIN_CACHE="$HOME/.claude/plugins/cache/gsd-plugin/gsd"`
  then INSTALLED = `ls -1 "$PLUGIN_CACHE" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1`,
  guarded by `[ -d "$PLUGIN_CACHE" ]`.

bin/lib/bm-transform.cjs stamp constants (lines 32-35):
  FALLBACK_SLASH_FROM='cache/gsd-plugin/gsd' becomes FALLBACK_SLASH_TO='cache/gsd-plugin/bm'
  FALLBACK_QUOTED_FROM="'gsd-plugin', 'gsd'" becomes FALLBACK_QUOTED_TO="'gsd-plugin', 'bm'"
  stampHookFallback() applies both via split/join to every non-excluded text file. build-bm.cjs
  runs it, and `node bin/build-bm.cjs --check` regenerates and diffs (drift gate, the oracle).

Test and CI literal encodings that must move in lockstep:
  tests/bm-transform.test.cjs: asserts stamping of the hooks.json slash form, the run-bash-hook
    quoted pair, and the check-plugin-update PLUGIN_CACHE line, plus idempotence for both shapes.
  tests/build-bm-drift.test.cjs (lines ~202/206): `match(/cache\/gsd-plugin\/bm/g).length === 17`
    and `match(/'gsd-plugin', 'gsd'/g).length === 0`.
  tests/bm-parity.test.cjs (lines 86/119/136): detectViolations flags the gsd-form cache-fallback
    literal in dist/bm, positive control at 119, allow-list at 136 keeps `cache/gsd-plugin/bm`
    legitimate.
  .github/workflows/install-smoke.yml (lines ~253/254/259/260/261, plus tripwire 171-193):
    `count(hooks,"cache/gsd-plugin/bm")===17`, `count(hooks,"cache/gsd-plugin/gsd")===0`, the
    run-bash-hook quoted-pair counts, and the primary-path-wins tripwire planted at
    `cache/gsd-plugin/<seg>/9.9.9/bin`.
  .github/workflows/check-drift.yml: runs the unit suite in CI, including `node tests/coexist.test.cjs`
    (line ~163). This is where the new resolution test must be wired.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Marketplace-agnostic runtime fallbacks (global newest-version-wins) plus segment-based pluginIdentity</name>
  <files>hooks/hooks.json, hooks/run-bash-hook.cjs, bin/lib/coexist.cjs, bin/check-plugin-update.sh, tests/coexist.test.cjs</files>
  <action>
    Make the four runtime fallback carriers scan every marketplace directory instead of the
    hardcoded `gsd-plugin` first segment, ordering candidates by GLOBAL highest semver across all
    marketplaces. Keep the plugin-name segment `gsd` fixed in source and keep CLAUDE_PLUGIN_ROOT
    as candidate[0] everywhere.

    hooks/hooks.json: in EACH of the 17 inline `node -e` resolvers, replace the single
    `const d=p.join(o.homedir(),'.claude/plugins/cache/gsd-plugin/gsd')` plus per-marketplace
    readdirSync/sort/push with a UNION-then-sort algorithm, because only the first existing
    candidate ever runs (`for (const x of c){...break;}`) so the ordering must be globally
    newest-first, NOT first-marketplace-wins. Concretely: read the `.claude/plugins/cache` base
    dir; for each entry `mp` (marketplace) read `p.join(base, mp, 'gsd')` guarded by its own
    try/continue, and for each `^\d+\.\d+\.\d+$` version dir `v` collect a tuple
    `{v, path: p.join(base, mp, 'gsd', v, '<bin-or-hooks>/<script>')}`. After ALL marketplaces are
    walked, sort the flattened tuple list by semver DESCENDING (compare numeric major, then minor,
    then patch), then push each `.path` in that order. Preserve exactly: CLAUDE_PLUGIN_ROOT pushed
    FIRST, the `GSD: plugin path stale` stderr warning when a non-primary path resolves after a set
    CLAUDE_PLUGIN_ROOT, the require-vs-spawnSync split per carrier, and single fire via break or
    process.exit. The literal `cache/gsd-plugin/gsd` must no longer appear in this file. Choose the
    plugin-name literal (for example the `, 'gsd')` join argument) so Task 2's transform can flip
    gsd to bm deterministically. Task 2 owns the transform, but pick the shape here.

    hooks/run-bash-hook.cjs: rewrite resolveCandidates() with the same union-then-sort logic
    (walk every `p.join(base, mp, 'gsd')`, collect `{version, path}` tuples for
    `path.join(base, mp, 'gsd', v, 'hooks', hookName)`, sort the union by semver DESCENDING, push
    in that order). Update the header comment at line ~9 to describe the marketplace-agnostic,
    global-newest-version scan. Keep CLAUDE_PLUGIN_ROOT first and the existing stale-path warning.

    bin/check-plugin-update.sh: replace the fixed
    `PLUGIN_CACHE="$HOME/.claude/plugins/cache/gsd-plugin/gsd"` so INSTALLED is the highest semver
    version dir MERGED across ALL matching `"$HOME/.claude/plugins/cache"/*/gsd` marketplaces, not
    the first glob match. For example: enumerate every `.../*/gsd/*/` version dir, take
    `basename`, filter to semver, `sort -V | tail -1` over the merged set as INSTALLED. Keep a
    no-install guard so an empty set still exits 0 silently (preserve the current early-exit
    behavior). Choose the plugin-name literal so Task 2's transform can flip it to the bm segment.

    bin/lib/coexist.cjs pluginIdentity(): reidentify by the plugin-name path segment regardless of
    marketplace. Return 'bm' when the normalized path contains a `/bm/` segment followed by a
    version dir, `bin/`, or `hooks/` (covers `/cache/buildomator/bm/.../hooks/`,
    `/cache/gsd-plugin/bm/.../bin/`, and an off-cache `dist/bm/...` checkout), otherwise return the
    authored default 'gsd'. Must not depend on the marketplace segment. Do not touch markBmActive,
    isBmActive, or shouldYield.

    tests/coexist.test.cjs: add PERMANENT pluginIdentity cases so this cannot regress:
    `/x/.claude/plugins/cache/buildomator/bm/1.2.3/hooks/run-bash-hook.cjs` -> 'bm',
    `/x/.claude/plugins/cache/gsd-plugin/bm/1.2.3/bin/gsd-tools.cjs' -> 'bm',
    `/x/.claude/plugins/cache/buildomator/gsd/1.2.3/bin/gsd-tools.cjs' -> 'gsd',
    `/x/.claude/plugins/cache/gsd-plugin/gsd/1.2.3/hooks/run-bash-hook.cjs' -> 'gsd', and an
    off-cache checkout path -> 'gsd'. Match the file's existing assertion style.
  </action>
  <verify>
    <automated>node -e "const h=require('./hooks/hooks.json');const s=JSON.stringify(h);if(s.includes('cache/gsd-plugin/gsd')){console.error('FAIL: gsd-plugin/gsd literal still present in hooks.json');process.exit(1)};if((s.match(/gsd-tools.cjs/g)||[]).length<1){console.error('FAIL: hooks.json lost gsd-tools identity token');process.exit(1)};if((s.match(/readdirSync/g)||[]).length<17){console.error('FAIL: not every resolver enumerates marketplaces');process.exit(1)};console.log('hooks.json marketplace-agnostic OK')" && bash -n bin/check-plugin-update.sh && test -z "$(grep -n 'cache/gsd-plugin/gsd\"' bin/check-plugin-update.sh)" && node tests/coexist.test.cjs</automated>
  </verify>
  <done>hooks.json has no `cache/gsd-plugin/gsd` literal, keeps the gsd-tools.cjs token, and every resolver enumerates marketplaces and sorts the union by semver. run-bash-hook.cjs resolveCandidates does union-then-sort. check-plugin-update.sh merges the max version across all `*/gsd` marketplaces and passes bash -n. pluginIdentity returns bm/gsd by segment; coexist.test.cjs (with the new permanent cases including /bm/hooks/ and buildomator) passes.</done>
</task>

<task type="auto">
  <name>Task 2: Update bm-transform constants in lockstep and regenerate dist/bm</name>
  <files>bin/lib/bm-transform.cjs, dist/bm/**</files>
  <action>
    Update the transform so it still flips the plugin-name segment gsd to bm for EVERY new
    fallback literal shape introduced in Task 1, then regenerate dist/bm so the drift gate stays
    green. `node bin/build-bm.cjs --check` remains the oracle for transform lockstep.

    bin/lib/bm-transform.cjs: replace the FALLBACK_SLASH_FROM/TO and FALLBACK_QUOTED_FROM/TO
    constants, and if the new carriers introduce more than two distinct literal shapes, generalize
    stampHookFallback to apply a LIST of FROM/TO pairs. The new hooks.json and run-bash-hook.cjs JS
    plugin-name literal and the new check-plugin-update.sh glob must each get their `gsd` plugin
    segment stamped to `bm`, while the marketplace wildcard and every surrounding identity token
    (gsd-tools.cjs, any legitimate gsd-plugin substrings, run-bash-hook.cjs) survive untouched.
    Keep stampHookFallback exact-literal (split/join) and idempotent for each shape. Update the doc
    comment block (lines ~29-36 and ~52-58) to describe the marketplace-agnostic literals.

    Regenerate the bm package: run `node bin/build-bm.cjs`, then confirm `node bin/build-bm.cjs
    --check` reports PASS (committed dist/bm matches a fresh build). Verify by inspection that
    dist/bm hooks.json and run-bash-hook.cjs carry the `bm` plugin segment under a marketplace
    wildcard and no longer carry the `gsd` plugin-segment fallback, while CLAUDE_PLUGIN_ROOT
    remains their first candidate.
  </action>
  <verify>
    <automated>node bin/build-bm.cjs && node bin/build-bm.cjs --check && node -e "const fs=require('fs');const h=fs.readFileSync('dist/bm/hooks/hooks.json','utf8');const {pluginIdentity}=require('./dist/bm/bin/lib/coexist.cjs');const a=require('assert');a.ok((h.match(/gsd-tools.cjs/g)||[]).length>=1,'bm hooks lost gsd-tools identity token');a.strictEqual(pluginIdentity('/x/.claude/plugins/cache/buildomator/bm/1.2.3/hooks/run-bash-hook.cjs'),'bm');console.log('dist/bm regenerated and drift PASS')"</automated>
  </verify>
  <done>node bin/build-bm.cjs --check exits 0 (PASS, the transform-lockstep oracle). dist/bm hooks carry the bm plugin segment under a marketplace wildcard and keep the gsd-tools.cjs identity token. The transform is idempotent for each new literal shape.</done>
</task>

<task type="auto">
  <name>Task 3: Permanent resolution test, updated unit tests and CI, backward-compat plus new-marketplace proof</name>
  <files>tests/hook-fallback-resolution.test.cjs, tests/bm-transform.test.cjs, tests/build-bm-drift.test.cjs, tests/bm-parity.test.cjs, .github/workflows/install-smoke.yml, .github/workflows/check-drift.yml</files>
  <action>
    Add a permanent committed resolution test, move every test and CI encoding of the old fallback
    literal to the new shape, and prove backward compatibility, the new marketplace, and global
    newest-version-wins.

    tests/hook-fallback-resolution.test.cjs (NEW, permanent): prove the ACTUAL rewritten resolvers
    resolve each marketplace/package combo in FULL ISOLATION, so a future edit to hooks.json or
    run-bash-hook.cjs cannot silently regress this. Structure: run FOUR independent cases, each in
    its OWN fresh `fs.mkdtempSync` HOME, each planting exactly ONE marketplace/package combo with a
    DISTINCT stderr marker, and asserting THAT exact marker fired (no alternation) with exit 0 and
    CLAUDE_PLUGIN_ROOT unset. The four cases:
      1. gsd loader, `cache/gsd-plugin/gsd/9.9.9/bin/gsd-tools.cjs`, marker GSD_LEGACY (backward compat).
      2. gsd loader, `cache/buildomator/gsd/9.9.9/bin/gsd-tools.cjs`, marker GSD_NEWMKT (gsd under a non-gsd-plugin marketplace).
      3. bm loader, `cache/gsd-plugin/bm/9.9.9/bin/gsd-tools.cjs`, marker BM_LEGACY (backward compat).
      4. bm loader, `cache/buildomator/bm/9.9.9/bin/gsd-tools.cjs`, marker BM_NEWMKT (new marketplace).
    Extract the real SessionStart command via `require('./hooks/hooks.json').hooks.SessionStart[0].hooks[0].command`
    for the gsd cases and `require('./dist/bm/hooks/hooks.json')...` for the bm cases; run it with
    `env -u CLAUDE_PLUGIN_ROOT HOME=<tmp>` in a synthetic git project and feed `{}` on stdin. Plant
    each fake `gsd-tools.cjs` as a stub that writes its distinct marker to stderr and exits 0.
    Add a FIFTH case for global newest-version-wins: in one isolated HOME, plant the gsd plugin
    under TWO marketplaces at different versions (for example `cache/gsd-plugin/gsd/1.0.0` with
    marker OLD and `cache/buildomator/gsd/2.0.0` with marker NEW), run the gsd loader, and assert
    the NEW (higher-semver) marker fired regardless of readdirSync order.

    tests/bm-transform.test.cjs: update the stampHookFallback fixtures (the hooks.json form line,
    the run-bash-hook resolveCandidates line, the check-plugin-update PLUGIN_CACHE line, the
    `rewriteCommandRefs spares the cache path literal` case, and both idempotence cases) so the
    inputs are the new literals and the assertions check the new gsd to bm stamping. Keep a
    positive assertion that the stamped output no longer contains the new gsd-form plugin-segment
    literal.

    tests/build-bm-drift.test.cjs (lines ~202/206): update the count assertions to the new literal
    shape. If the marketplace-agnostic hooks.json still yields 17 stamped plugin-segment
    occurrences, keep 17 against the new needle, otherwise set the count to the actual value the
    regenerated dist/bm produces and assert the old gsd-form literal count is 0.

    tests/bm-parity.test.cjs: update detectViolations cache-fallback needle (line 86) to the new
    gsd-form plugin-segment literal that must never appear in dist/bm, update the positive control
    (line 119) to the new literal, and confirm the allow-list fixture (line 136) keeps a legitimate
    bm-form literal unflagged. The census must stay fail-closed.

    .github/workflows/install-smoke.yml: update the bm hook fallbacks step (lines ~253-261), the
    `count(hooks,"cache/gsd-plugin/bm")===17`, `count(hooks,"cache/gsd-plugin/gsd")===0`, and the
    run-bash-hook quoted-pair counts, to the new literal shape and the actual regenerated counts.
    For the primary-path-wins tripwire step (lines ~171-193), the tripwire is planted under
    `cache/gsd-plugin/<seg>/9.9.9/bin`; since `cache/*/gsd` and `cache/*/bm` still match `gsd-plugin`
    as one marketplace the tripwire stays valid, so keep it and only adjust if the chosen glob would
    fail to enumerate that path. Do not weaken any assertion.

    .github/workflows/check-drift.yml: wire the new test into CI by adding a step
    `node tests/hook-fallback-resolution.test.cjs` alongside the existing `node tests/coexist.test.cjs`
    step (line ~163), so it runs on every push and PR.

    Then run the full local verification set below.
  </action>
  <verify>
    <automated>node tests/hook-fallback-resolution.test.cjs && node tests/bm-transform.test.cjs && node tests/build-bm-drift.test.cjs && node tests/bm-parity.test.cjs && node tests/coexist.test.cjs && node bin/build-bm.cjs --check && grep -q "hook-fallback-resolution.test.cjs" .github/workflows/check-drift.yml && node -e "const fs=require('fs');const y=fs.readFileSync('.github/workflows/install-smoke.yml','utf8');if(/count\(hooks,\"cache\/gsd-plugin\/gsd\"\)/.test(y)===false && /cache\/gsd-plugin\/gsd/.test(y)){console.error('FAIL: stale gsd-form assertion literal left unadjusted in CI');process.exit(1)};console.log('CI assertions updated and resolution test wired')"</automated>
  </verify>
  <done>tests/hook-fallback-resolution.test.cjs exists and passes its four isolated single-marker cases (gsd-plugin/gsd, buildomator/gsd, gsd-plugin/bm, buildomator/bm) plus the global newest-version-wins case, all with CLAUDE_PLUGIN_ROOT unset. bm-transform, build-bm-drift, bm-parity, and coexist tests pass. node bin/build-bm.cjs --check exits 0. install-smoke.yml has no stale gsd-form assertion literal and stays fail-closed. check-drift.yml runs the new resolution test.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| cache dir enumeration | The fallback resolvers readdirSync the user-owned `~/.claude/plugins/cache` and require or spawn a resolved script. Marketplace directory names are user or Claude Code owned, not remote input. |
| hook stdin (session_id) | The coexist marker filename derives from hook stdin session_id, already validated by SESSION_ID_RE. Unchanged by this plan. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-coq-01 | Tampering, Elevation | marketplace enumeration in hooks.json and run-bash-hook resolveCandidates | accept | The cache dir is user-owned, the same trust surface as the pre-existing single-marketplace probe. The resolver still requires `bin/gsd-tools.cjs` or `hooks/<script>` to exist and prefers CLAUDE_PLUGIN_ROOT first. Widening the marketplace segment to a wildcard does not cross a new trust boundary. |
| T-coq-02 | Spoofing | pluginIdentity segment match | accept | Identity is a pure function of the on-disk resolved path. Keying on the `/bm/` plugin segment is strictly more precise than the current `/cache/gsd-plugin/bm/` check and cannot be influenced by remote input. |
| T-coq-03 | Tampering | dist/bm generated fallback literals | mitigate | The `node bin/build-bm.cjs --check` drift gate, the bm-parity census (fail-closed), the install-smoke CI assertions, and the new hook-fallback-resolution test prove the bm package carries only the bm plugin segment and that no gsd-form fallback survives. |
</threat_model>

<verification>
- node bin/build-bm.cjs --check exits 0 (dist/bm matches a fresh build, the transform-lockstep oracle).
- node tests/hook-fallback-resolution.test.cjs, node tests/bm-transform.test.cjs,
  node tests/build-bm-drift.test.cjs, node tests/bm-parity.test.cjs, node tests/coexist.test.cjs all pass.
- Backward compatibility (isolated fixtures, CLAUDE_PLUGIN_ROOT unset): cache/gsd-plugin/gsd/9.9.9
  resolves via the gsd loader (marker GSD_LEGACY) and cache/gsd-plugin/bm/9.9.9 resolves via the bm
  loader (marker BM_LEGACY).
- New marketplace (isolated fixtures, CLAUDE_PLUGIN_ROOT unset): cache/buildomator/bm/9.9.9 resolves
  via the bm loader (marker BM_NEWMKT) and cache/buildomator/gsd/9.9.9 resolves via the gsd loader
  (marker GSD_NEWMKT).
- Global newest-version-wins: the same plugin at 1.0.0 under one marketplace and 2.0.0 under another
  resolves the 2.0.0 copy regardless of readdirSync order.
- CLAUDE_PLUGIN_ROOT remains candidate[0] in every runtime resolver (unchanged primary path).
- install-smoke.yml hook-fallback assertions reference the new glob shape and are self-consistent;
  check-drift.yml runs the new resolution test.
</verification>

<success_criteria>
- The runtime carriers resolve the plugin via the fallback under any marketplace directory
  (existing gsd-plugin and new buildomator), for both the gsd and bm packages, when
  CLAUDE_PLUGIN_ROOT is unset, with the globally highest version winning, and existing installs keep
  working (backward compatible). Proven by four isolated single-marker fixtures plus a
  newest-version-wins case in a committed test.
- No cache/gsd-plugin/gsd marketplace-hardcoded literal remains in hooks.json,
  run-bash-hook.cjs, or check-plugin-update.sh.
- pluginIdentity returns bm or gsd by plugin-name segment regardless of marketplace, covering
  /bm/bin/ and /bm/hooks/ (COMPAT-05 closed), with permanent cases in tests/coexist.test.cjs.
- bm-transform flips the new literal deterministically; drift --check (the oracle), parity,
  transform, coexist, and hook-fallback-resolution tests pass; CI assertions are updated and
  self-consistent and the new test is wired into check-drift.yml.
- The deferred markdown reference-doc sweep is documented as a justified, separate follow-up.
</success_criteria>

<output>
Create `.planning/quick/260714-coq-centralize-marketplace-agnostic-plugin-r/260714-coq-SUMMARY.md` when done.
</output>
