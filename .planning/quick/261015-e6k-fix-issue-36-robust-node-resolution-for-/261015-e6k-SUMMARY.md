---
phase: quick-261015-e6k
plan: 01
subsystem: infra
tags: [hooks, mcp, posix-sh, node-resolution, path, build-bm, cross-spawn]

requires: []
provides:
  - "POSIX node-resolution preamble on all 18 hook commands (gsd and bm twins), active only when command -v node fails"
  - "bin/gsd-node POSIX wrapper plus bin/gsd-node.cmd Windows twin for the stdio MCP server"
  - "MCP server launches via ${CLAUDE_PLUGIN_ROOT}/bin/gsd-node in both plugin manifests"
  - "tests/hook-node-resolution.test.cjs (8 cases) wired into check-drift.yml CI"
affects: [hooks, mcp, build-bm, release-4.9.3]

tech-stack:
  added: []
  patterns:
    - "Gate PATH mutation on command -v node failing so the on-PATH install is never changed"
    - "Launcher file (bin/gsd-node) for a shell-less spawn point; inline preamble for shell-form spawn points"

key-files:
  created:
    - bin/gsd-node
    - bin/gsd-node.cmd
    - tests/hook-node-resolution.test.cjs
  modified:
    - hooks/hooks.json
    - .claude-plugin/plugin.json
    - .github/workflows/check-drift.yml
    - CHANGELOG.md
    - dist/bm (regenerated twins)

key-decisions:
  - "Hooks use an inline preamble (no plugin-path reference) so the stale-CLAUDE_PLUGIN_ROOT cache fallback stays intact; only the MCP command references the wrapper."
  - "Scripted the 18-command edit with a byte-for-byte JSON round-trip assertion so the node -e payloads were never re-escaped."
  - "One build-bm run after the last source edit, with new files staged first, so every dist/bm twin (including CHANGELOG.md and check-drift.yml) matches."

patterns-established:
  - "PATH-first node resolution: probe install dirs only on command -v node failure"

requirements-completed: [ISSUE-36]

duration: 5min
completed: 2026-10-15
---

# Quick 261015-e6k: Node resolution for hooks and MCP without a login shell (#36) Summary

**Each of the 18 shell-form hooks now carries one identical POSIX preamble, and the stdio MCP server launches through a new `bin/gsd-node` wrapper, so both resolve version-manager node (pixi, nvm, fnm, volta, mise, asdf, Homebrew) when Claude Code is started without a login shell, with zero change where node is already on PATH.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-15T08:44:26Z
- **Completed:** 2026-10-15T08:49:37Z
- **Tasks:** 4
- **Files modified:** 14 (7 source + 7 dist/bm twins) in one commit

## Accomplishments
- Prepended an identical `command -v node || { probe dirs; }` preamble to all 18 hook commands via a scripted edit with a JSON round-trip guard; the `node -e` payloads are untouched.
- Added `bin/gsd-node` (POSIX sh, mode 100755, shellcheck-clean, `exec node "$@"`, exit 127 with a `gsd-node:` message when no node is found) and its `bin/gsd-node.cmd` twin; pointed `mcpServers.gsd.command` at `${CLAUDE_PLUGIN_ROOT}/bin/gsd-node` with args and version unchanged.
- Wrote `tests/hook-node-resolution.test.cjs` (8 cases) and wired it into `check-drift.yml`; added a dash-free, ratchet-clean CHANGELOG `### Fixed` entry under `[Unreleased]` for #36 (no version bump, no README row).
- Regenerated the dist/bm twins with one build after the last source edit; the exec bit is tracked as 100755 on both `bin/gsd-node` twins.

## Task Commits

The whole fix is one atomic commit (source + new files + regenerated dist/bm twins + CHANGELOG), per the plan:

1. **Tasks 1 to 4 (hook preamble, wrapper + .cmd + manifest, test + CI + CHANGELOG + dist/bm build, commit + gates)** - `b28f9e4` (fix)

The docs artifacts (SUMMARY.md, STATE.md) are committed separately by the orchestrator.

## Files Created/Modified
- `hooks/hooks.json` - 18 command strings each prefixed by the identical POSIX node-resolution preamble; description documents it.
- `bin/gsd-node` - POSIX sh launcher that tries PATH node first, then probes 13 install dirs, execs node with argv intact, exits 127 with a `gsd-node:` stderr message otherwise.
- `bin/gsd-node.cmd` - Windows twin forwarding to bare `node` via PATHEXT resolution.
- `.claude-plugin/plugin.json` - `mcpServers.gsd.command` now `${CLAUDE_PLUGIN_ROOT}/bin/gsd-node`; args and version (4.9.2) unchanged.
- `tests/hook-node-resolution.test.cjs` - 8-case zero-dep proof (identical preambles, gsd/bm hooks boot off PATH via a tagged PATH= line, on-PATH PATH unchanged, wrapper argv passthrough, wrapper on-PATH, wrapper exit 127, dist/bm twins + manifests).
- `.github/workflows/check-drift.yml` - new CI step next to the hook fallback step.
- `CHANGELOG.md` - `### Fixed` entry for #36 under `[Unreleased]`.
- `dist/bm/*` - build-generated twins of all of the above (hooks with `g='bm'` stamp, manifest rekeyed to `mcpServers.bm`, CHANGELOG and workflow carried through).

## Decisions Made
- Inline preamble for hooks (no `${CLAUDE_PLUGIN_ROOT}` reference) so the stale-plugin-root cache fallback from commit 7a80d47 keeps working; only the shell-less MCP spawn point uses the wrapper file.
- PATH is mutated only after `command -v node` fails, so an install where node is already on PATH sees a byte-identical PATH (proven by test case 4 and case 6).

## Deviations from Plan

### Mechanics adjustment (not a code deviation)

**1. [Verification mechanics] `grep -c 'command -v node' dist/bm/hooks/hooks.json` reads 19, not the 18 the plan's verify line expected.**
- **Found during:** Task 3 (build verification)
- **Issue:** The plan's Task 1 step 4 mandates a description sentence that itself contains the phrase `command -v node`; that description line is counted by the raw `grep -c`, so the line count is 18 command lines + 1 description line = 19. The plan's Part D/verify assertion of 18 is a miscount of its own mandated text.
- **Resolution:** Verified the substantive invariant directly instead: exactly 18 command values in each of `hooks/hooks.json` and `dist/bm/hooks/hooks.json` start with the preamble (confirmed by a per-command count and by test case 1, which splits all 36 commands and asserts a single shared preamble prefix). No source change; the preamble is present on every command exactly once.
- **Files modified:** none (verification method only)

---

**Total deviations:** 1 (verification-mechanics clarification only; no code or scope change)
**Impact on plan:** None. The code matches the plan exactly; only one verify line in the plan was internally inconsistent with the plan's own mandated description text.

## Issues Encountered
- An early `grep -c "g='bm'"` returned 0 due to shell single-quote escaping inside a double-quoted Bash command, not a transform problem. Re-checked with `grep -oE "g='[a-z]+'"`, which confirmed 18 `g='bm'` occurrences in the dist twin. No change needed.

## Verification (stated honestly)

Run on this macOS host; observed results:

- `node tests/hook-node-resolution.test.cjs` - 8/8 PASS (spawns under `/bin/sh`).
- `node tests/hook-fallback-resolution.test.cjs` - 5/5 PASS (stale/unset CLAUDE_PLUGIN_ROOT cache fallback still works through the preamble).
- `node tests/build-bm-drift.test.cjs` - all PASS.
- `node tests/bm-parity.test.cjs` - all PASS.
- `node bin/build-bm.cjs --check` on the committed tree - `bm drift check: PASS (committed dist/bm matches a fresh build).`
- `node bin/validate-plugin.cjs .claude-plugin/plugin.json` - valid `gsd@4.9.2`, MCP server `gsd`.
- `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json` - valid `bm@4.9.2`, MCP server `bm`.
- `claude plugin validate .` and `claude plugin validate dist/bm` - both "Validation passed with warnings" (only the pre-existing CLAUDE.md-at-root warning).
- `node bin/maintenance/check-user-docs-prose.cjs` - PASS, no regression (CHANGELOG entry added zero em/en-dashes and zero marketing words).
- Manual smoke: SessionStart[0] command booted exit 0 under both `/bin/sh` and `/bin/dash` with node off PATH and a fake `$HOME/.pixi/bin/node`; the wrapper resolved node off PATH with argv `a b "c'd"` intact, left PATH unchanged when node was on PATH, and exited 127 with the `gsd-node:` line when all candidates were masked.
- `git ls-files -s bin/gsd-node dist/bm/bin/gsd-node` - both `100755`.
- Dash sweep of the staged diff and the commit message - no U+2013/U+2014. No `Co-Authored-By` trailer. No `261015` quick-task id in any product file.

**Windows caveat (reasoned, not run):** The `bin/gsd-node.cmd` twin is reasoned from the npm-shim pattern and cross-spawn's PATHEXT lookup (Claude Code's bundled StdioClientTransport spawns through cross-spawn with `shell: false`). It was NOT exercised on a Windows host in this environment. On Windows, hooks run under Git Bash where `command -v node` finds `node.exe`, so the preamble loop never runs there. A Windows confirmation is requested in the CHANGELOG entry and on issue #36.

## Next Phase Readiness
- Fix is committed on master (`b28f9e4`) and ships in both the gsd and bm trees. The CHANGELOG entry sits under `[Unreleased]` for a later 4.9.3 cut; no version bump was made here.
- Open follow-up: a real Windows host confirmation of the `.cmd` MCP path (Assumption A1 in RESEARCH.md).

## Self-Check: PASSED

All created files present (bin/gsd-node, bin/gsd-node.cmd, tests/hook-node-resolution.test.cjs, the three dist/bm twins, SUMMARY.md) and commit b28f9e4 exists.

---
*Phase: quick-261015-e6k*
*Completed: 2026-10-15*
