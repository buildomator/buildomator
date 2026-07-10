# Phase 14: Backward Compatibility and Coexistence - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the `gsd` and `bm` plugins safe to run at the same time. Both are byte-identical
plugins (bm is generated from gsd source, stamped with a distinct `name`, hook
cache-fallback segment, and MCP key per Phase 13 D-04/D-05/D-08). This phase guarantees
four things when a user has one or both enabled:

1. A gsd-only user (bm not active) sees zero change in `/gsd:*` behavior after upgrading
   to 4.1.0 (COMPAT-01).
2. With both plugins active, each hook fires exactly once per event (COMPAT-02).
3. With both active, shared project state (STATE.md, HANDOFF.json, phase plans) is not
   corrupted by the second plugin's writers (COMPAT-03).
4. A non-blocking `/gsd:` -> `/bm:` deprecation nudge surfaces, mentioning the v5.0
   retirement (COMPAT-04).

**Out of scope (later):**
- Branding prose ("GSD"/"Get Shit Done" -> "Buildomator", README/CHANGELOG/buildomator.com
  copy) - Phase 15.
- Actually retiring `/gsd:` and flipping the authored identity to bm - v5.0 (breaking).
</domain>

<decisions>
## Implementation Decisions

### Primary-plugin policy
- **D-01:** bm becomes primary WHEN ACTIVE. In any session where bm is active, bm owns the
  single hook fire and drives shared state; the gsd copy yields (and nudges). When bm is
  not active, gsd behaves exactly as it does today, which is what preserves COMPAT-01. At
  v5.0 gsd retires, so bm is the sole plugin and is primary by default. Detection keys on
  "is bm active THIS session", not merely "bm is installed on disk" (see D-03).

### Hook single-fire mechanism (COMPAT-02)
- **D-02:** Deterministic identity election, not a first-to-run race. Each hook copy knows
  whether it is the gsd or bm copy from its `CLAUDE_PLUGIN_ROOT` path segment
  (`.../gsd/...` vs `.../bm/...`). The gsd copy yields (exits 0, performs no state-mutating
  side effects) when bm is active; the bm copy always runs. The outcome is a pure function
  of (my identity, is-bm-active) with no lockfile race for the common case.
- **D-03:** "bm is active this session" is detected by a bm self-announced per-session
  presence marker: the bm copy writes a small marker on its first hook fire, keyed on
  `session_id` in the session temp dir. The gsd copy yields only if that marker exists.
  This is correct even when bm is cache-present-but-DISABLED (no bm hook ever runs -> no
  marker -> gsd runs normally, so gsd is never wrongly suppressed). Accepted residual: on
  the first event of a session where the gsd copy happens to fire before the bm copy
  (notably SessionStart), gsd may run once before the marker lands. That is at most one
  double-fire at session start, then clean for the rest of the session.

### MCP + shared state (COMPAT-03)
- **D-04:** Extend the proven `bin/lib/state.cjs` O_EXCL lock + atomic read-modify-write to
  cover ALL shared-state writers, not just STATE.md. Audit that HANDOFF.json and phase-plan
  writes go through the same lock/atomic path (not a bare `writeFileSync`) and close any
  gap. Because both plugins run identical code writing identical formats, a serialized
  last-write-wins is consistent. Add a coexistence test that interleaves gsd and bm writes
  and asserts the files stay valid/uncorrupted. No new single-writer coordination layer:
  MCP tools are invoked explicitly by name, so the agent already calls one server per
  action, and the lock handles concurrent/interleaved sessions.

### Deprecation nudge (COMPAT-04)
- **D-05:** The nudge surfaces once per session via the gsd SessionStart hook, emitted as
  non-blocking context (same channel as the existing resume directive / systemMessage). No
  per-skill edits (editing ~1200 `/gsd:` refs is rejected). The message must mention `/bm:`
  and the v5.0 retirement, and must not block the command.
- **D-06:** Audience is EVERY gsd session, whether or not bm is installed. This maximizes
  reach (a gsd-only user learns bm exists and that gsd retires at v5.0), and the
  once-per-session cadence keeps it from nagging. The nudge is EXEMPT from the D-02 yield:
  the gsd SessionStart hook still emits the (read-only, non-blocking) nudge even when it
  yields the stateful session-state work to bm, so a both-installed gsd session still shows
  it. The bm package suppresses its OWN nudge (bm must never tell users to switch to bm) -
  suppression is single-sourced through the existing bm build transform, keyed on plugin
  identity.

### Claude's Discretion
- Exact marker file path/name and session temp dir (reuse `core.cjs` GSD_TEMP_DIR / session
  conventions).
- Module boundary for the identity-election + bm-active-check helper (new `bin/lib/*` helper
  vs inline in the hooks.json resolver / `gsd-tools.cjs hook` dispatch). Prefer one shared
  helper so every hook uses the same election.
- Exact nudge wording, within the constraints in D-05 (mention `/bm:` + v5.0, non-blocking,
  plain and non-marketing).
- Whether bm nudge-suppression is a build-time strip or a runtime identity guard, as long as
  it is single-sourced with the Phase 13 bm transform and cannot drift.

### Research needed (for gsd-phase-researcher)
- Claude Code cross-plugin hook execution ORDER within a single event (does gsd or bm fire
  first?), which sizes the D-03 first-event residual, and whether CC exposes an
  enabled-plugins signal to hooks (env var or hook stdin JSON) that would give a cleaner,
  race-free "bm active" signal than the self-announce marker.
- Confirm SessionStart `additionalContext`/`systemMessage` is the right non-blocking channel
  for the nudge and that emitting it from the gsd copy while yielding stateful work is
  supported.
</decisions>

<specifics>
## Specific Ideas

- Lean on what already works: `state.cjs` lock+atomic RMW for COMPAT-03, and the existing
  SessionStart systemMessage channel (the resume directive) as the template for the nudge.
- The whole phase premise is that Claude Code MERGES hooks from every enabled plugin, so
  both byte-identical copies fire. The fix is election at the top of each hook, not removing
  hooks from the bm package (bm needs its hooks to work standalone).
- Keep the election single-sourced: one helper used by every hook entry, so adding a hook
  later cannot forget the election.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + strategy
- `.planning/REQUIREMENTS.md` - COMPAT-01..04 with acceptance criteria.
- `.planning/ROADMAP.md` Phase 14 - goal + 4 success criteria (the non-negotiable
  contract); Phase 15 and v5.0 boundaries (what to leave out).
- `.planning/PROJECT.md` - v4.1 additive strategy, "zero re-enable" guarantee, v5.0
  retirement, repo/cache id stays `gsd-plugin`.

### Prior-phase decisions this builds on
- `.planning/phases/13-buildomator-plugin/13-CONTEXT.md` - D-04 hook cache-fallback stamp,
  D-05 distinct MCP keys (`gsd`/`bm`), D-08 the bm build transform scope (where nudge
  suppression must plug in).
- `.planning/phases/12-two-plugin-build-foundation/12-CONTEXT.md` - cache mechanics
  (D-10..D-12), per-plugin `CLAUDE_PLUGIN_ROOT` resolution (basis for identity detection).

### Hooks + state + build to extend
- `hooks/hooks.json` - the 8 events (SessionStart, Pre/PostToolUse, Stop, PreCompact,
  SubagentStop) whose copies double-fire; where the identity election and the nudge go.
- `bin/lib/state.cjs` - O_EXCL lock (`acquireLock`, ~line 944) + atomic read-modify-write
  (~line 1011); the COMPAT-03 primitive to extend to all shared writers.
- `bin/gsd-tools.cjs` - the `hook <event>` dispatch (session-start, post-tool-use
  checkpoint, stop, pre-compact) where the yield/election is enforced.
- `bin/build-bm.cjs` + the Phase 13 bm transform - where bm nudge-suppression is stamped.

### CI to extend
- `.github/workflows/install-smoke.yml` and `.github/workflows/check-drift.yml` - the
  Phase 12/13 bm jobs to extend with a coexistence / single-fire test.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/lib/state.cjs` - `acquireLock` (O_EXCL lockfile with retry/jitter) + atomic
  read-modify-write; extend its coverage to HANDOFF.json and phase-plan writes (D-04).
- `bin/lib/core.cjs` GSD_TEMP_DIR (`os.tmpdir()/gsd`) and session temp conventions - home
  for the bm-active per-session marker (D-03).
- `hooks/hooks.json` inline Node resolver - already branches on `CLAUDE_PLUGIN_ROOT` vs the
  `cache/gsd-plugin/gsd` fallback, so plugin identity is derivable at the top of every hook
  (basis for D-02).
- The SessionStart systemMessage/resume-directive channel - template for the non-blocking
  nudge (D-05).

### Established Patterns
- Claude Code merges hooks from every enabled plugin, so both byte-identical copies run -
  this is the phase premise.
- Shared-state writes serialize via the state.cjs lock; identical code writes identical
  formats, so serialized last-write-wins is consistent.
- bm is a deterministic byte-transform of gsd (`build-bm.cjs`); anything gsd-only (the
  nudge) must be suppressed by that transform so the two packages never drift.

### Integration Points
- `hooks/hooks.json` (election + nudge), a shared `bin/lib` election/bm-active helper,
  `bin/lib/state.cjs` (extend lock coverage), `bin/build-bm.cjs` (nudge suppression),
  CI smoke/drift jobs (coexistence + single-fire test).

### Known constraint carried in
- Distinct MCP keys (`gsd`/`bm`) from Phase 13 D-05 mean the two servers are already
  disambiguated; COMPAT-03 is about coordinating two writers to the same files, not
  disambiguating two identically-keyed servers.
</code_context>

<deferred>
## Deferred Ideas

- Branding prose "GSD"/"Get Shit Done" -> "Buildomator", README/CHANGELOG/buildomator.com
  copy - Phase 15.
- Retiring `/gsd:` and flipping the authored identity to bm; making bm primary by default
  with no gsd present - v5.0 (breaking).

### Reviewed Todos (not folded)
- `todo.match-phase 14` returned four keyword-only matches (naming-drift rule packs, a
  Next-Up recap bug, drift-detector follow-ups, ideation routing). None relate to
  coexistence, so none were folded.
</deferred>

---

*Phase: 14-backward-compatibility-and-coexistence*
*Context gathered: 2026-07-11*
