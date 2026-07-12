# Phase 15: Buildomator Identity and Communications - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the project *present* as Buildomator wherever a human reads it, wire buildomator.com
into metadata, and write the v4.1.0 CHANGELOG entry that tells the rebrand + migration story.
Scope is the prose / metadata layer only:

- README.md (branding, primary command surface, migration section, logo)
- `plugin.json` + `.claude-plugin/marketplace.json` (descriptions, homepage/repository links, version)
- CHANGELOG.md (the v4.1.0 rebrand + migration entry)
- A Buildomator logo asset in `assets/`

Delivers BRAND-01, BRAND-02, BRAND-03. Ships as plugin 4.1.0 (completes the v4.1 milestone).

**Not in this phase (already done or later):**
- The runtime `/gsd:` -> `/bm:` deprecation nudge mechanism — already ships (Phase 14 D-05/D-06).
  This phase only aligns its stated date, no mechanism change.
- The machine `name`/prefix identity (`gsd`/`bm` plugin names, `/bm:` command surface) — already
  set (Phase 13). `name: "gsd"` stays until v5.0.
- Retiring `/gsd:` / flipping authored identity to bm — v5.0 (breaking).
- Building the buildomator.com website — separate repo (`/Users/jnuyens/src/buildomator.com`).
</domain>

<decisions>
## Implementation Decisions

### /gsd: retirement commitment
- **D-01:** Hard calendar date. `/gsd:` retires at **v5.0 on 2026-10-01**. This exact date is
  stated identically everywhere it appears: the CHANGELOG v4.1.0 entry, the README "Migrating
  from /gsd:" section, and the marketplace legacy-entry description. Also update the wording of
  the already-shipped Phase 14 deprecation nudge string to name `2026-10-01` (string only — do
  NOT touch the nudge mechanism). BRAND-03's "retirement date" is satisfied by this concrete date.

### buildomator.com metadata wiring (BRAND-02)
- **D-02:** Point BOTH `homepage` AND `repository` fields at `https://buildomator.com` in
  `plugin.json` and in BOTH marketplace.json plugin entries. README brand + docs links point to
  buildomator.com.
- **D-03:** Do NOT change the marketplace `source` fields (`./` for gsd, `./dist/bm` for bm) —
  those are functional install paths, not branding. Repo + cache id stay `gsd-plugin`.
  Accepted residual: `repository` semantically expects a VCS URL; pointing it at buildomator.com
  is a deliberate branding choice (buildomator.com is the project home). The actual git source
  stays github.com/jnuyens/gsd-plugin and installs are unaffected.

### README rebrand (BRAND-01)
- **D-04:** Full rebrand. H1 becomes Buildomator, intro prose rebrands to Buildomator, all
  command examples switch to `/bm:`. Add a "Migrating from /gsd:" section stating: `/gsd:` keeps
  working through all of 4.x, `/bm:X` is identical to `/gsd:X`, and `/gsd:` retires at v5.0 on
  2026-10-01.
- **D-05:** Install + troubleshooting sections keep real identifiers unchanged — `gsd-sdk`,
  `gsd-plugin`, cache paths (`~/.claude/plugins/cache/gsd-plugin/`), filenames. These are actual
  paths/filenames, not brand prose. Only brand-name prose changes.
- **D-06:** New logo. Copy a Buildomator logo from `/Users/jnuyens/src/buildomator.com`
  (READ-ONLY source — never write there) into this repo's `assets/`, and reference it in the
  README header, replacing `assets/gsd-plugin-logo.png`. Candidate files: `buildomator-logo-big.png`,
  `src/assets/logo-small.png`, `src/assets/logo-square.png`.

### Two-plugin marketplace presentation
- **D-07:** bm entry = primary. `displayName: "Buildomator"`; description leads as the primary
  plugin ("use /bm:"). New users install this one.
- **D-08:** gsd entry = legacy alias. `displayName: "Buildomator (legacy /gsd:)"`; description:
  same plugin, original `/gsd:` command prefix, retires v5.0 on 2026-10-01, new users should
  install Buildomator. Both descriptions contain "Buildomator" so BRAND-01 holds for both plugins.
- **D-09:** The gsd `plugin.json` `description` also flips to Buildomator-worded (BRAND-01 covers
  "plugin description"). Keep `name: "gsd"` and the `gsd` keyword — machine identity plus
  discoverability for existing users searching "gsd".

### CHANGELOG v4.1.0 (BRAND-03)
- **D-10:** Promote `[Unreleased]` to a `[4.1.0]` entry that (a) explains the rebrand to
  Buildomator, (b) describes the additive strategy — `/bm:` added, `/gsd:` fully retained through
  4.x with zero disruption, (c) states `/gsd:` retires at v5.0 on 2026-10-01. Keep the gsd-core
  provenance line per the existing CHANGELOG convention.

### Version bump
- **D-11:** Bump to `4.1.0` in `plugin.json`, both `marketplace.json` entries, and the README
  "Plugin version" line. This is the v4.1 milestone-completing release; it ships as a git tag.

### Claude's Discretion
- Exact logo file choice + header width (match the current ~320px header).
- Exact README H1 wording, section ordering, and whether to add a short "why the rename" note.
- Exact CHANGELOG and marketplace prose, within the D-08/D-10 constraints.
</decisions>

<specifics>
## Specific Ideas

- The retirement date must read identically everywhere: **2026-10-01**.
- Copy reads like a person wrote it: no em-dashes, no "canonical", no AI-marketing tells
  (rule-of-three, "seamless/robust/leverage", hollow superlatives). User global rule.
- Keep functional identifiers (`gsd-sdk`, `gsd-plugin`, cache paths, filenames) exactly as-is —
  renaming them would break installs and drift checks.
- buildomator.com is a separate repo/site; this phase only links to it.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + strategy
- `.planning/REQUIREMENTS.md` — BRAND-01/02/03 acceptance criteria.
- `.planning/ROADMAP.md` Phase 15 — goal + the 3 success criteria (the contract).
- `.planning/PROJECT.md` — v4.1 additive strategy, v5.0 retirement, repo/cache id stays `gsd-plugin`.

### Prior-phase decisions this builds on
- `.planning/phases/14-backward-compatibility-and-coexistence/14-CONTEXT.md` — D-05/D-06
  deprecation nudge (align its stated date to 2026-10-01; do not change the mechanism).
- `.planning/phases/13-buildomator-plugin/13-CONTEXT.md` — the bm build transform (`build-bm.cjs`)
  and distinct `name`/MCP keys already set; the marketplace `bm` entry already carries
  `displayName: "Buildomator"`.

### Files to edit
- `README.md` — full rebrand + migration section + logo (D-04/D-05/D-06).
- `plugin.json` — description, homepage, repository, version (D-02/D-09/D-11).
- `.claude-plugin/marketplace.json` — both entries: descriptions, displayName, homepage,
  repository, version (D-02/D-07/D-08/D-11).
- `CHANGELOG.md` — the [4.1.0] entry (D-10).
- `assets/` — new Buildomator logo (D-06).

### Read-only source
- `/Users/jnuyens/src/buildomator.com` — logo assets live here; NEVER write to this directory.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.claude-plugin/marketplace.json` already has a `bm` entry with `displayName: "Buildomator"`
  (Phase 13) — extend the existing entries, do not create new ones.
- Existing README header pattern (`<p align="center"><img ... width="320" /></p>`) — reuse it,
  swap the image source.
- CHANGELOG follows Keep a Changelog with a gsd-core provenance note per entry — match that shape.

### Established Patterns / CRITICAL constraint
- **bm is a deterministic byte-transform of gsd source** (`bin/build-bm.cjs`, Phase 13). The
  README, `plugin.json`, and marketplace prose being rebranded are gsd SOURCE that flows through
  that transform. The researcher/planner MUST verify `build-bm.cjs` produces correct bm-branded
  output after these edits: bm must NOT describe itself as "legacy /gsd:", and the description/
  displayName rebrand must not break the bm parity / drift gate. Rebranding without checking the
  transform is the main risk in this phase.
- Every release bumps BOTH `plugin.json` and `marketplace.json`; releases ship as git tags.

### Integration Points
- No runtime code changes. The only code-adjacent surface is `bin/build-bm.cjs` (transform must
  stay consistent) and the CI drift/parity gate that validates the two plugins.

### Known constraint carried in
- Phase 14 already ships the deprecation nudge; D-01 only updates its stated date string, keeping
  the single-sourced bm suppression (Phase 14 D-06) intact.
</code_context>

<deferred>
## Deferred Ideas

- Flipping the authored identity (plugin `name` -> bm, `/gsd:` removal, bm primary by default with
  no gsd present) — v5.0 (breaking).
- Building buildomator.com site content — separate repo, out of scope.

### Reviewed Todos (not folded)
- `todo.match-phase 15` returned 8 keyword-only matches (all score 0.6): naming-drift rule packs,
  a Next-Up recap bug, comment-convention codification, drift-detector follow-ups, ideation
  routing, auto-accept prompts, auto_advance default-on, plan-phase gate collapse. None relate to
  branding or communications, so none were folded.

---

*Phase: 15-buildomator-identity-and-communications*
*Context gathered: 2026-07-12*
</deferred>
