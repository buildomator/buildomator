# Phase 13: Buildomator Plugin - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

> Decisions below were locked by best judgment while the user was away, grounded in
> Phase 12's carried-forward constraints (D-01..D-13) and a scout of the actual
> build/hook/MCP mechanics. All four are defensible; the MCP-key one (D-05) is the
> most reasonable to sanity-check before execution.

<domain>
## Phase Boundary

Make the generated `bm` package a coherent, standalone `/bm:` plugin: every command
surfaces as `/bm:*`, and its agents, hooks, and MCP server behave identically to the
`gsd` plugin. Phase 12 already GENERATES the package (byte-identical except
name/displayName/description); Phase 13 makes it actually cohere as Buildomator instead
of a gsd clone whose docs and hook fallback still point at gsd. Covers BM-01/02/03.

**Out of scope (later phases):**
- Double-fire dedup + "no duplicate MCP writers" + deprecation nudge when BOTH plugins
  are enabled — Phase 14 (coexistence).
- Buildomator branding prose ("GSD"/"Get Shit Done" -> "Buildomator", "GSD:" stderr
  strings, README/CHANGELOG/buildomator.com copy) — Phase 15.
- Retiring `/gsd:` and flipping authored identity to bm — v5.0 (breaking).
</domain>

<decisions>
## Implementation Decisions

### Command self-reference rewriting (BM-02)
- **D-01:** The build (`bin/build-bm.cjs`) rewrites command self-references
  `/gsd:<skill>` -> `/bm:<skill>` across all tracked text/doc files in the generated
  `dist/bm` tree (skills, workflows, agents, references, templates). Phase 12 D-02
  already assigned this rewrite to Phase 13. Rationale: a bm-only user following a
  Next-Up like "next run `/gsd:plan-phase`" would otherwise invoke the sibling gsd
  plugin; rewriting makes bm self-consistent and standalone (criterion 1 + 2). Source
  has ~179 files / ~1,234 `/gsd:` occurrences.
- **D-02:** The rewrite touches ONLY command-invocation self-references matching
  `/gsd:<skill-name>`. It MUST NOT touch: functional identity strings
  (`cache/gsd-plugin/gsd`, `gsd-tools.cjs`, `gsd-sdk`, `gsd-session-state.sh`, any
  `gsd-*` filename), the MCP resource scheme (`gsd://...`) and short tool names
  (`gsd_*`) inside `server.cjs`, or branding prose ("GSD" / "Get Shit Done" —
  Phase 15). Reuse the proven regex approach in
  `bin/maintenance/rewrite-command-namespace.cjs` (skill-name alternation sorted
  longest-first, negative lookbehind `(?<![a-zA-Z0-9/])` to skip path contexts,
  negative lookahead to block partial matches), retargeted `gsd:` -> `bm:`. Prefer
  factoring one shared transform used by both the maintenance rewriter and the build.
  **Superseded in part by D-08** (the leading-slash anchor is broadened; see below).
- **D-03:** The Phase 12 byte-drift guard widens from "identical except
  name/displayName/description" to "identical after applying the deterministic bm
  transform (identity stamp + command-prefix self-ref rewrite + hook-path stamp)."
  The `--check` regenerate-and-diff mode already regenerates and byte-compares, so it
  accommodates the wider transform automatically; what changes is the assertion in
  `tests/build-bm-drift.test.cjs` that currently allows ONLY the three manifest fields
  to diverge — it must now also allow `/bm:` where source had `/gsd:` (and the stamped
  hook path from D-04). Widening this guard is expected, not a Phase 12 regression.

### Hook plugin-awareness (BM-03)
- **D-04:** The build stamps the hook fallback cache segment from the plugin name so
  the bm hooks fall back to `~/.claude/plugins/cache/gsd-plugin/bm/<version>` instead
  of `.../gsd/...`. `hooks/hooks.json` currently hardcodes
  `cache/gsd-plugin/gsd` in every inline Node resolver; only the trailing plugin-name
  segment (`/gsd` -> `/bm`) is stamped. The marketplace-name segment `gsd-plugin`
  STAYS (Phase 12 D-11/D-12 — cache id is unchanged this milestone). The primary
  `${CLAUDE_PLUGIN_ROOT}` path already resolves per-plugin correctly (Phase 12 D-10),
  so only the FALLBACK literal needs the stamp. This is the "per-plugin hook
  cache-fallback fix" Phase 12 deferred here. The "GSD:" stderr prefix in those
  resolvers is branding and stays for Phase 15. Double-fire when both plugins are
  enabled stays Phase 14. **Extended by D-08** (the stamp now covers every runtime
  carrier of the fallback literal, not only the three hooks files).

### MCP server identity (BM-03)
- **D-05:** Stamp the manifest `mcpServers` key `gsd` -> `bm` in the bm `plugin.json`
  (an identity field, same family as `name`), so each plugin registers a
  distinctly-keyed server (`gsd`, `bm`). SAFE: a scout confirmed ZERO source docs
  reference full harness tool ids (`mcp__plugin_gsd_gsd__*` = 0 hits) — agents/skills
  call MCP via `gsd-sdk`/short names, so nothing internal keys off the manifest key.
  `mcp/server.cjs` stays BYTE-IDENTICAL (its internal `name: 'gsd'`, `gsd_*` tool
  names, and `gsd://` resource URIs are unchanged), which is exactly what satisfies
  criterion 3 ("same resources and tools"). Distinct keys also hand Phase 14 a clean
  starting point: it only has to coordinate two writers to the same STATE.md, not
  disambiguate two identically-named servers. **Sanity-check before execution:**
  confirm Claude Code namespaces MCP tools by the manifest key (so bm tools surface as
  `mcp__plugin_bm_bm__*`) and that no consumer hardcodes the `gsd` key.

### Parity proof / acceptance gate (BM-01/02/03)
- **D-06:** Acceptance is an automated command-inventory parity test
  (`tests/*.test.cjs`, following the Phase 12 CI-as-gate pattern) that: (a) enumerates
  every skill/command in source and asserts an identically-named one exists in
  `dist/bm`; (b) asserts every `dist/bm` file equals its source counterpart AFTER
  applying the deterministic bm transform — i.e. no un-rewritten `/gsd:` self-ref
  leaks into bm, and no bm divergence that the transform doesn't explain. This is
  effectively the widened `--check` drift gate expressed as parity. Wire it into
  `.github/workflows/check-drift.yml` (extend the existing `bm-build-drift` job).
  **Hardened by D-08** (the parity test gains a fail-closed census with a positive
  control).
- **D-07:** Extend the Phase 12 `bm-package-smoke` job in `install-smoke.yml` to prove
  runtime parity for BM-03: the bm MCP server starts and lists the same tools/
  resources under its own key, and a bm hook fires resolving via the bm
  `CLAUDE_PLUGIN_ROOT` (the primary-path-wins tripwire already exists). Keep the gsd
  job byte-untouched (Phase 12 D-12).

### Claude's Discretion
- Exact module boundary for the shared `/gsd:`->`/bm:` transform (new
  `bin/lib/*` helper vs. exported function on `build-bm.cjs`).
- Precise file-type/extension filter for the rewrite (mirror `git ls-files` text-file
  handling already in the build).
- Whether the parity test is a new `tests/bm-parity.test.cjs` or folded into
  `tests/build-bm-drift.test.cjs`.
- Exact smoke assertions for the MCP tool-list comparison.

### Namespace rewrite scope revision (BM-02/BM-03) - added 2026-07-09 post code-review
- **D-08:** The bm transform's command/namespace rewrite broadens from the
  leading-slash-anchored `/\/gsd:/g` to `gsd:(?!/)`: every `gsd:` namespace prefix
  becomes `bm:` (slash-commands `/gsd:`, `subagent_type=`/`type=` agent refs
  `gsd:gsd-<agent>`, and agent/skill frontmatter `name: gsd:<x>`), while the negative
  lookahead spares `gsd://` MCP resource URIs (D-05). Verified against Claude Code
  docs: `subagent_type` is the plugin-scoped id `plugin-name:agent-name`, so a bm
  workflow calling `gsd:gsd-executor` resolves the GSD plugin's agent (and fails on a
  bm-only install). bm MUST use `bm:gsd-executor` - this is a functional BM-03
  requirement (69 refs). Skill frontmatter `name:` is display-only for skills in
  `skills/` subdirs but is rewritten too so the fail-closed census needs no `gsd:`
  exception. Also stamped: the `cache/gsd-plugin/gsd` resolver fallback in every
  runtime carrier (dash form; D-04 extended from the hooks-only 3-file allowlist to
  all carriers), and the `/gsd[:-]` SDK headless-prompt sanitizer pattern (rewritten
  to `/bm[:-]`). Preserved (allow-list): the `gsd-plugin` marketplace id, `gsd-*`
  filenames, `gsd://`, `gsd_*` MCP tools, camelCase `gsd[A-Z]` identifiers,
  `open-gsd`/`.gsd`/`gsd/{milestone}` branch template, and branding prose
  "GSD"/"Get Shit Done" (Phase 15).
  - **Implementation note (D-05 interaction):** `mcp/server.cjs` must stay
    byte-identical (D-05, guarded by `cmp`). It carries the MCP URIs in two shapes:
    real `gsd://...` (spared by the `(?!/)` lookahead) and regex-source-escaped
    `gsd:\/\/...` at two `uri.match(...)` sites, where the char after `gsd:` is a
    backslash that the bare `(?!/)` lookahead would wrongly flip. Because server.cjs
    contains ONLY URI-form `gsd:` tokens (no command/agent refs to rewrite), it is
    excluded from the command-ref rewrite entirely so its byte-identity is guaranteed
    regardless of regex shape. This implements D-08's stated intent of sparing MCP
    resource URIs without regressing the zero-leak scan of the same-shaped `/gsd:\S+`
    tokens that legitimately appear in SDK test files and must still flip.
</decisions>

<specifics>
## Specific Ideas

- Model every new guard/test on the already-shipped Phase 12 pattern:
  `bin/build-bm.cjs` (`--check`), `tests/build-bm-drift.test.cjs`, the
  `bm-build-drift` + `bm-package-smoke` CI jobs. Do not invent a parallel mechanism.
- The slash-command prefix derives ONLY from `plugin.json` `name` (fact-checked in
  Phase 12 via claude-code-guide), so `/bm:*` already works from the name stamp; this
  phase is about self-consistency of the CONTENT and per-plugin hook/MCP identity, not
  about registering the commands.
- One deterministic transform (identity stamp + self-ref rewrite + hook-path stamp)
  is the entire divergence lever — keep it single-sourced so `--check` stays honest.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + strategy
- `.planning/REQUIREMENTS.md` — BM-01/02/03 with acceptance criteria.
- `.planning/ROADMAP.md` Phase 13 — goal + 3 success criteria (the non-negotiable
  contract); Phase 14/15 boundaries (what to leave out).
- `.planning/PROJECT.md` — v4.1 milestone + Key Decisions (repo/cache id stays
  `gsd-plugin`; prefix from `plugin.json` name; additive `/bm:` alongside `/gsd:`).
- `.planning/phases/12-two-plugin-build-foundation/12-CONTEXT.md` — carried-forward
  D-01..D-13, esp. the naming layers (D-09), cache mechanics (D-10..D-12), and the
  three items deferred to Phase 13.

### Build + guards to extend (the divergence lever lives here)
- `bin/build-bm.cjs` — the generate-and-stamp build + `--check` drift mode; add the
  self-ref rewrite (D-01/02) and the hook-path stamp (D-04) here.
- `bin/maintenance/rewrite-command-namespace.cjs` — proven skill-name-alternation
  rewrite regex to reuse/retarget for `/gsd:`->`/bm:`.
- `tests/build-bm-drift.test.cjs` — the drift assertion to widen (D-03) and the likely
  home (or sibling) of the parity test (D-06).
- `.claude-plugin/plugin.json` — `mcpServers` key to stamp (D-05); the authored gsd
  manifest.
- `.claude-plugin/marketplace.json` — dual gsd/bm entry (unchanged this phase, but the
  bm `source: ./dist/bm` is what the parity/smoke tests target).

### Hooks + MCP (identity divergence)
- `hooks/hooks.json` — the inline Node resolvers whose `cache/gsd-plugin/gsd` fallback
  segment gets stamped (D-04).
- `mcp/server.cjs` — stays byte-identical; confirms the tools/resources parity target
  for D-05/D-07 (`gsd_*` tools, `gsd://` resources).

### CI + release to extend
- `.github/workflows/check-drift.yml` — `bm-build-drift` job to extend for the parity
  gate (D-06).
- `.github/workflows/install-smoke.yml` — `bm-package-smoke` job to extend for runtime
  hook/MCP parity (D-07).
- `RELEASING.md` — dual-package release procedure; note the widened transform if the
  release steps reference the drift check.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/build-bm.cjs` — the generate-and-stamp build with a `--check` regenerate-and-diff
  gate; the single place to add the content rewrite and hook-path stamp.
- `bin/maintenance/rewrite-command-namespace.cjs` — battle-tested command-reference
  rewrite regex (path-context-safe) to reuse for `gsd:`->`bm:`.
- Phase 12 CI jobs `bm-build-drift` (check-drift.yml) and `bm-package-smoke`
  (install-smoke.yml) — extend rather than replace.

### Established Patterns
- Generate-and-stamp + deterministic `--check` drift gate; git-tracked-only source
  list; pure exported helpers unit-tested without disk I/O (Phase 12).
- CI-as-release-gate: a stale/hand-edited `dist/bm` fails CI and blocks the tag.
- `dist/` is excluded from `check-file-layout.cjs` and `rewrite-command-namespace.cjs`
  scans (it is a generated byte copy) — keep that exclusion; the bm rewrite happens
  INSIDE `build-bm.cjs`, not by running the maintenance rewriter over `dist/`.

### Integration Points
- `bin/build-bm.cjs` (add transform), `hooks/hooks.json` (stamped fallback segment),
  `.claude-plugin/plugin.json` (mcpServers key stamp), `tests/build-bm-drift.test.cjs`
  + a parity test, `.github/workflows/{check-drift,install-smoke}.yml` (extend bm jobs).

### Known limitation carried in
- `dist/bm/hooks/hooks.json` currently keeps the verbatim gsd cache fallback (Phase 12
  documented this as the one known limitation to fix here). D-04 closes it.
</code_context>

<deferred>
## Deferred Ideas

- Double-fire dedup + "no duplicate MCP writers" + STATE.md write coordination when
  BOTH plugins are enabled — Phase 14 (coexistence).
- `/gsd:` deprecation nudge pointing at `/bm:` + v5.0 retirement timeline — Phase 14.
- Branding prose: "GSD"/"Get Shit Done" -> "Buildomator", the "GSD:" hook stderr
  prefix, README/CHANGELOG/buildomator.com copy — Phase 15.
- Retiring `/gsd:` and flipping the authored identity to bm — v5.0 (breaking).

### Reviewed Todos (not folded)
- No todo cross-reference was run interactively (user away); planner may re-check via
  `todo.match-phase 13`. The 8 pending GSD-internal todos surfaced in Phase 12 remain
  unrelated to the rebrand.
</deferred>

---

*Phase: 13-buildomator-plugin*
*Context gathered: 2026-07-04*
