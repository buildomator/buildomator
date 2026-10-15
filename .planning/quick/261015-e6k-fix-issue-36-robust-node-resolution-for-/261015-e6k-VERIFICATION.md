---
task: 261015-e6k
verified: 2026-10-15
status: human_needed
score: 6/6 must-haves verified
has_blocking_gaps: false
human_verification:
  - test: "Run bin/gsd-node.cmd and an MCP launch on a Windows host"
    expected: "node resolves via machine PATH and args pass through"
    why_human: "Windows path is reasoned from the npm shim pattern, not run; honestly disclosed in CHANGELOG and commit message"
---

# Quick 261015-e6k Verification (issue #36)

Commit b28f9e4 checked against the repo, not the SUMMARY.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | 18 hook commands share one preamble, gated on `command -v node` failing, no CLAUDE_PLUGIN_ROOT, payloads unchanged | VERIFIED | hooks/hooks.json and dist/bm/hooks/hooks.json: 18 commands each, 1 distinct preamble, no CLAUDE_PLUGIN_ROOT in it. Preamble is `command -v node >/dev/null 2>&1 \|\| { for d in ...; do [ -x "$d/node" ] && { PATH="$d:$PATH"; break; }; done; };`. Comparing against b28f9e4~1, all 18 original `node -e` payloads are preserved in the new commands. |
| 2 | bin/gsd-node POSIX sh, 100755 (source and dist), execs node, exits nonzero with message, no eval; .cmd exists; plugin.json command and version | VERIFIED | Shebang `#!/bin/sh`. Index mode 100755 for bin/gsd-node and dist/bm/bin/gsd-node (same blob). `exec node "$@"` on PATH; otherwise scans install dirs; falls through to `gsd-node: node not found ...` and `exit 127`. No eval. bin/gsd-node.cmd present (100644, expected). plugin.json `mcpServers.gsd.command` is `${CLAUDE_PLUGIN_ROOT}/bin/gsd-node`; version 4.9.2. |
| 3 | tests/hook-node-resolution.test.cjs passes | VERIFIED | Ran it: `8/8 checks passed`. It covers the shared preamble, SessionStart boot with node off PATH for both the gsd and bm hooks, the on-PATH case, wrapper argv passthrough, wrapper failing loudly with no node, and the dist twins. |
| 4 | Commit atomicity and hygiene | VERIFIED | `git show --stat` shows 14 files: 7 source (plugin.json, check-drift.yml, CHANGELOG, gsd-node, gsd-node.cmd, hooks.json, test) and 7 dist twins. No Co-Authored-By trailer. Zero em/en-dashes on added lines. No marketplace.json change, no version bump in plugin.json (only the mcp command line), nothing under sdk/ or bin/lib/. |
| 5 | `node bin/build-bm.cjs --check` | VERIFIED | `bm drift check: PASS (committed dist/bm matches a fresh build).` Working tree clean apart from the unrelated untracked gsd-bugs-housekeeping.rtf. |
| 6 | CHANGELOG entry and prose ratchet | VERIFIED | `### Fixed` entry cites #36 and states the `.cmd` path "has not been run on a Windows host yet". Prose ratchet: `Status: PASS, no regression, baseline matches` (em_en_dash 155/155, marketing_words 4/4, cliche_openers 0/0). |

## Notes

- Commit also touched `.github/workflows/check-drift.yml` (+2 lines, with its dist twin). It is among the 14 files and was not in the stated goal. It looks like CI wiring for the new test; it does not affect goal achievement.
- The test was observed passing, but the real Claude-without-login-shell launch was not exercised end to end here.

## Human verification (non-blocking)

1. Windows: run `bin/gsd-node.cmd` (and the MCP launch) on a Windows host. Expect node to resolve from machine PATH and args to pass through. The CHANGELOG already asks for confirmation on #36.

## Gaps

None.
