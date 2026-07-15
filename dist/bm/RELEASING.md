# Releasing Buildomator

The pre-release gate is **CI**: `.github/workflows/check-drift.yml` and `install-smoke.yml` run on every push and pull request, so the full regression suite must be green before any release tag is cut. Treat a red CI run as a hard block on releasing.

This repo now ships **two plugins from one source**: `gsd` (source `./`) and `bm` / Buildomator (source `./dist/bm`, a generate-and-stamp copy of the gsd source). A release must move both to the same version, and CI gates that they stay in lockstep. `check-drift.yml` runs a `bm-build-drift` job that regenerates `dist/bm` and hard-fails on any divergence from the committed tree, and `install-smoke.yml` runs a `bm-package-smoke` job that proves the bm package resolves via its own `${CLAUDE_PLUGIN_ROOT}`. A stale or hand-edited `dist/bm/` fails one of these jobs and blocks the tag, which is what makes forgetting the regeneration step impossible in a repo with no npm publish lifecycle.

## Pre-release checklist

1. **CI is green on the release commit.** This is the source of truth. The node regression suite that CI runs includes:
   - `tests/checkpoint-write-guards.test.cjs` (issue #17: the checkpoint hook must never blank a hand-authored `HANDOFF.json` in an idle project or create `.planning/` in a non-GSD directory)
   - `tests/session-start-skip-trivial-handoff.test.cjs`
   - `tests/mcp-stdio-framing.test.cjs`, `tests/mcp-write-tools-end-to-end.test.cjs`
   - `tests/conventions.test.cjs`
   - `tests/semantic-dup.test.cjs`, `tests/phantom-scaffolding.test.cjs`, `tests/drift-allowlist.test.cjs`
   - `tests/config-schema-sdk-parity.test.cjs` (CJS/SDK config parity)
   - the file-layout, HANDOFF-schema, namespace, and user-docs-jargon drift detectors
   - To run the whole node suite locally: `for t in tests/*.test.cjs; do node "$t" || break; done`
2. **`verify drift` and `verify conventions` exit 0** on the repo (`node bin/gsd-tools.cjs verify drift --scope . --json`).
3. **Rebuild `sdk/dist`** if any `sdk/src/**` changed: `cd sdk && npm run build`.
4. **Bump the version and regenerate the bm package.** Bump only `.claude-plugin/plugin.json` `version` (the single source), then run `npm run build:bm`. That regenerates `dist/bm/` and syncs the version into both marketplace entries and the bm manifest, so you no longer hand-edit `.claude-plugin/marketplace.json`. Commit the regenerated `dist/bm/` together with the bump and the updated `marketplace.json`. Before tagging, run the local pre-tag commands `npm run check:bm-drift` (fresh regeneration must equal the committed `dist/bm/`) and `npm run validate:bm-plugin` (the generated bm manifest is schema-valid).
5. **Update `CHANGELOG.md`** with the new version section.
6. **Update the README** "Added features beyond upstream" table for any new user-facing capability.
7. **Tag and publish:** `git push origin master && git push origin vX.Y.Z`, then `gh release create vX.Y.Z --notes-file <changelog-section>`.

## How the bm package diverges from gsd

`dist/bm` is a deterministic transform of the gsd source, not a byte copy. The build applies three passes: an identity stamp (`name` gsd -> bm, `displayName`/`description` -> Buildomator, and the `mcpServers` key gsd -> bm), a command-reference rewrite (`/bm:` -> `/bm:` across every text file so a bm-only user never gets bounced into the sibling plugin), and a hook cache-fallback stamp to `cache/gsd-plugin/bm` across the three carriers that hold it (`hooks/hooks.json`, the `run-bash-hook` launcher, and the update notifier). `mcp/server.cjs` stays byte-identical, so both plugins expose the same tools and resources under their own manifest key.

CI gates the divergence. `bm-build-drift` runs the drift test, the parity test, and `build-bm.cjs --check`, so a stale, hand-edited, or under-transformed `dist/bm` (including any leaked `/bm:` command reference) fails the job and blocks the tag. `bm-package-smoke` proves it at runtime: the hook fallback literals target the bm cache dir in both carriers, the primary `${CLAUDE_PLUGIN_ROOT}` path always wins over planted gsd and bm cache tripwires, and the bm MCP server lists the same tools and resources as the gsd server.

## Versioning

As of v4.0.0 the plugin is on its own version line; the major signals the plugin's own milestones, not gsd-core's. See [README, Versioning](./README.md#versioning).

## Why CI is the gate

The checkpoint write-guards test exists because issue #17 (a silent data-loss bug in the periodic-checkpoint hook) shipped in v4.0.0. Wiring its regression test into CI means the same failure mode fails the build before a tag is ever cut, rather than relying on a human remembering to run it.
