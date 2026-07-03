# Releasing gsd-plugin

The pre-release gate is **CI**: `.github/workflows/check-drift.yml` and `install-smoke.yml` run on every push and pull request, so the full regression suite must be green before any release tag is cut. Treat a red CI run as a hard block on releasing.

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
4. **Bump the version in BOTH** `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
5. **Update `CHANGELOG.md`** with the new version section.
6. **Update the README** "Added features beyond upstream" table for any new user-facing capability.
7. **Tag and publish:** `git push origin master && git push origin vX.Y.Z`, then `gh release create vX.Y.Z --notes-file <changelog-section>`.

## Versioning

As of v4.0.0 the plugin is on its own version line; the major signals the plugin's own milestones, not gsd-core's. See [README, Versioning](./README.md#versioning).

## Why CI is the gate

The checkpoint write-guards test exists because issue #17 (a silent data-loss bug in the periodic-checkpoint hook) shipped in v4.0.0. Wiring its regression test into CI means the same failure mode fails the build before a tag is ever cut, rather than relying on a human remembering to run it.
