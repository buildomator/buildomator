# Phase 13: Buildomator Plugin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 13-buildomator-plugin
**Areas discussed:** Self-ref rewriting, Hook plugin-awareness, MCP key identity, Parity proof
**Mode:** discuss (best-judgment; user away during the area-selection prompt)

---

## Self-reference rewriting

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite `/gsd:`->`/bm:` in dist/bm content | bm docs point to bm siblings; bm is standalone-consistent | ✓ |
| Leave refs as `/gsd:` | bm docs point at the gsd plugin; smaller diff but confuses bm-only users | |

**Choice:** Rewrite in the build, self-references only, path/identity/branding strings excluded (D-01/D-02). Phase 12 D-02 had already assigned this rewrite to Phase 13. The Phase 12 byte-drift guard widens to allow the deterministic transform (D-03).
**Notes:** Reuse the path-context-safe regex in `rewrite-command-namespace.cjs`; the transform stays single-sourced so `--check` remains honest.

---

## Hook plugin-awareness

| Option | Description | Selected |
|--------|-------------|----------|
| Stamp fallback plugin segment `/gsd`->`/bm` | bm hooks fall back to the bm cache dir; marketplace segment `gsd-plugin` stays | ✓ |
| Leave the gsd fallback | bm hooks fall back into the gsd cache after an upgrade prune | |

**Choice:** Stamp only the trailing plugin-name segment of the `cache/gsd-plugin/gsd` fallback in `hooks.json` (D-04). Primary `${CLAUDE_PLUGIN_ROOT}` already resolves per-plugin (Phase 12 D-10).
**Notes:** The "GSD:" stderr prefix is branding -> Phase 15. Double-fire when both plugins enabled -> Phase 14. This closes the one known limitation Phase 12 documented.

---

## MCP key identity

| Option | Description | Selected |
|--------|-------------|----------|
| Stamp `mcpServers.gsd`->`bm` in bm manifest | distinctly-keyed servers; clean Phase 14 boundary | ✓ |
| Keep `gsd` key | byte-identical, but two same-named servers collide when both enabled | |

**Choice:** Stamp the manifest key to `bm` (D-05). Scout confirmed 0 source docs reference full harness tool ids (`mcp__plugin_gsd_gsd__*`), so it is safe; `server.cjs` stays byte-identical (tools/resources unchanged = criterion 3).
**Notes:** Flagged for a pre-execution sanity-check that Claude Code namespaces MCP tools by the manifest key. State-file writer coordination when both enabled stays Phase 14.

---

## Parity proof

| Option | Description | Selected |
|--------|-------------|----------|
| Automated command-inventory parity test + extended smoke | CI gate: every gsd command has a matching bm one, no un-rewritten leaks; runtime hook/MCP smoke | ✓ |
| Manual checklist | no CI enforcement; drifts silently | |

**Choice:** Extend the Phase 12 `bm-build-drift` job with an inventory+transform parity assertion (D-06) and the `bm-package-smoke` job with bm MCP tool-list + hook-fire proof (D-07). Follows the Phase 12 CI-as-gate pattern.
**Notes:** Keep the gsd jobs byte-untouched (Phase 12 D-12).

---

## Claude's Discretion

- Module boundary for the shared `/gsd:`->`/bm:` transform.
- File-type filter for the rewrite (mirror the build's existing `git ls-files` handling).
- Whether the parity test is a new file or folded into `build-bm-drift.test.cjs`.
- Exact MCP tool-list smoke assertions.

## Deferred Ideas

- Double-fire dedup + no-duplicate-MCP-writers + deprecation nudge (both plugins enabled) — Phase 14.
- Branding prose ("GSD"/"Get Shit Done"->"Buildomator", "GSD:" stderr, README/CHANGELOG/buildomator.com) — Phase 15.
- Retire `/gsd:` and flip authored identity to bm — v5.0.
