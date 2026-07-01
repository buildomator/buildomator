# Phase 12: Two-Plugin Build Foundation - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

One build step generates both the `bm` (Buildomator) and `gsd` plugin packages from a single source, released in lockstep at the same version, with the repo/cache identity (`gsd-plugin`) and hook paths verified unaffected by the dual-package arrangement. Covers BUILD-01/02/03.

**Out of scope (later phases):** the `/gsd:` -> `/bm:` command-doc rewrites and full command parity (Phase 13); hook/MCP double-fire dedup when both plugins are enabled (Phase 14); Buildomator branding/README/CHANGELOG copy (Phase 15); retiring `/gsd:` (v5.0).
</domain>

<decisions>
## Implementation Decisions

### Source-of-truth model
- **D-01:** Repo root stays the **authored `gsd` package** (`.claude-plugin/plugin.json` name `gsd`, current `marketplace.json` source `./`). Current `/gsd:` installs are untouched (satisfies success criterion 3 trivially). The **`bm` package is generated** by copying the source and stamping identity. gsd = authored, bm = generated (Option A, lowest risk). The v5.0 breaking release will later flip the authored identity to bm; not now.

### Package divergence (what the build changes)
- **D-02:** The build stamps ONLY **manifest identity + branding**: `name` (`gsd` -> `bm`) and the `description`/branding text (-> "Buildomator") in `plugin.json` and the bm `marketplace.json` entry. Every other file is byte-identical between packages. The ~1,179 `/gsd:` -> `/bm:` command-doc rewrites are **Phase 13** (parity), NOT here. The drift guard whitelists exactly these (name, description/branding) fields.

### Marketplace + output layout
- **D-03:** A single `.claude-plugin/marketplace.json` gains a **second `bm` plugin entry** alongside `gsd`, each with its own `source` path. Users pick `/gsd:` or `/bm:` from the one marketplace. The generated bm package lands at **`dist/bm/`**.
- **D-04:** Because Claude Code resolves a marketplace `source` from the repo **at the installed git ref**, the generated `dist/bm/` is **committed as part of the release** (not a gitignored artifact), so bm installs resolve. *(Flagged for research confirmation — see canonical_refs / needs-verify.)*

### Build trigger + drift guard
- **D-05:** The build runs **automatically via a prepublish hook** (so regeneration can never be forgotten). The release commits the regenerated `dist/bm/`. Reconciles Q3+Q4: auto-built AND committed.
- **D-06:** A **CI test regenerates bm and asserts it equals the gsd source except the whitelisted (name, description/branding) fields**, failing on any other drift (success criterion 4 — "the build step is the only place identity diverges"). Follows the existing drift-detector + regression-test pattern (e.g. the 4.0.2 mktemp/version-alignment guards).
- **D-07:** BUILD-03 path-safety is verified by **extending the existing `.github/workflows/install-smoke.yml`** to also smoke-test the bm package path. Repo/cache id stays `gsd-plugin`, so `CLAUDE_PLUGIN_ROOT` and hook scripts resolve unchanged.

### Version lockstep (BUILD-02)
- **D-08:** Both packages derive their version from **one source** (`.claude-plugin/plugin.json` `version`) at build time, guaranteeing identical version (4.1.0) across both `plugin.json` and both `marketplace.json` entries. Aligns with the version-alignment guard shipped in 4.0.2 (plugin/marketplace parity).

### Naming layers (locked — do NOT conflate)
- **D-09:** Four distinct identifiers, confirmed 2026-07-01:
  1. **Command prefix** = `bm` -> `/bm:` (the `plugin.json` `name` field; short by deliberate choice).
  2. **Brand / display name** = "Buildomator" (goes in `description`, README, marketplace text, buildomator.com) — NOT the command prefix.
  3. **Repo + install-cache id** = **`gsd-plugin`, unchanged this milestone** (BUILD-03). The move to `buildomator/buildomator` is the deferred high-risk lever (breaks `CLAUDE_PLUGIN_ROOT`/hook path resolvers) — a separate later step, NOT v4.1.
  4. **Build output folder** = `dist/bm/` — internal, named after the `bm` package; cosmetic. Do NOT rename it to `dist/buildomator/` and do NOT infer a repo move from the `bm` package name.

### Claude's Discretion
- Exact copy/stamp mechanism and the precise file list the build touches.
- How the prepublish hook wires into `RELEASING.md` and `package.json`.
- Internal `dist/` structure and any build-script module layout.
- Whether the drift test is a standalone `tests/*.test.cjs` or folded into an existing job (follow the check-drift umbrella pattern).
</decisions>

<specifics>
## Specific Ideas

- Model the new drift/parity test on the already-shipped guard pattern: `bin/maintenance/check-version-alignment.cjs` + `tests/version-alignment.test.cjs` + `tests/mktemp-portable.test.cjs`, wired into `.github/workflows/check-drift.yml`.
- The slash-command prefix derives ONLY from `plugin.json` `name` (fact-checked via claude-code-guide), so name-stamping is the entire divergence lever for the command surface.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Manifests to stamp
- `.claude-plugin/plugin.json` — the authored gsd manifest (`name`, `version`, `description`); the fields the build stamps.
- `.claude-plugin/marketplace.json` — single-entry today (`source: "./"`); gains a second `bm` entry with its own source path.

### Requirements + strategy
- `.planning/REQUIREMENTS.md` — BUILD-01/02/03 with acceptance criteria.
- `.planning/PROJECT.md` — Current Milestone v4.1 + Key Decisions (single version line; repo/cache id stays `gsd-plugin`; prefix from `plugin.json` name).
- `.planning/ROADMAP.md` Phase 12 — goal + 4 success criteria (the non-negotiable contract).

### Build/release + verification to extend
- `RELEASING.md` — the release process the prepublish build hooks into (bump BOTH manifests, CHANGELOG, tag).
- `.github/workflows/install-smoke.yml` — existing install smoke test to extend for BUILD-03 (bm path).
- `.github/workflows/check-drift.yml` — where the regenerate-and-diff drift guard lands.
- `bin/validate-plugin.cjs` (via `npm run validate:gsd-plugin`) — the bm output must also pass plugin validation.

**Needs research/verify:** confirm Claude Code marketplace `source` must exist in the repo at the installed ref (validates committing `dist/bm/`), and that one `marketplace.json` may list two plugins with different `source` paths from a single repo. No external ADR exists; the rebrand strategy lives in PROJECT.md Key Decisions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Guard/test pattern (4.0.2):** `bin/maintenance/check-version-alignment.cjs`, `tests/version-alignment.test.cjs`, `tests/mktemp-portable.test.cjs` — the model for the new bm-vs-gsd drift test and its CI wiring.
- **`bin/validate-plugin.cjs`** — plugin manifest validator already in `package.json`; run it against the generated bm package too.
- **`RELEASING.md` checklist** — already codifies "bump BOTH plugin.json and marketplace.json"; the build should satisfy this automatically for both packages.

### Established Patterns
- **No build/dist step exists today** — the repo root IS the installed `gsd` package (`source: "./"`). Phase 12 introduces the first generation/output step. This is the central new mechanism.
- **CI-as-release-gate** (`RELEASING.md`): every guard is a CI job that hard-fails; the drift guard follows this.
- **Flat layout** (`skills/<name>/`, `bin/lib`, `sdk/`), not upstream's nested `get-shit-done/`.

### Integration Points
- `.claude-plugin/marketplace.json` (add bm entry), `dist/bm/` (new output, committed on release), `package.json` (build + prepublish scripts), `.github/workflows/{check-drift,install-smoke}.yml` (new drift test + bm smoke test), `RELEASING.md` (document the dual-package release).
</code_context>

<deferred>
## Deferred Ideas

- **`/gsd:` -> `/bm:` command-doc rewriting (~1,179 refs) + full command parity** — Phase 13 (Buildomator Plugin).
- **Hook/MCP double-fire dedup when both plugins enabled** — Phase 14 (Backward Compatibility & Coexistence).
- **Buildomator identity: README/CHANGELOG/buildomator.com copy** — Phase 15.
- **Retiring `/gsd:` and flipping authored identity to bm** — v5.0 (breaking).

### Reviewed Todos (not folded)
8 pending todos surfaced at score 0.6 (naming-drift rule packs, Next-Up recommends-plan, drift follow-ups, ideation routing to /gsd:explore, recommended-default auto-actions, collapse plan-phase upstream gates, general comment conventions). All are GSD-internal feature/drift items unrelated to the two-plugin build; none folded into Phase 12. Left in `.planning/todos/pending/`.
</deferred>

---

*Phase: 12-two-plugin-build-foundation*
*Context gathered: 2026-07-01*
