# Quick 261015-e6k: Robust node resolution for hooks and MCP (issue #36) - Research

**Researched:** 2026-10-15
**Domain:** Claude Code plugin hooks / stdio MCP server process launch, POSIX sh, bm build transform
**Confidence:** HIGH for hooks, MEDIUM for the MCP Windows twin (reasoned from the CC binary, not run on Windows)

## Summary

Issue #36 is real and unchanged in 4.9.2: all 18 `hooks/hooks.json` commands are shell-form `node -e "..."` and the manifest's MCP server is `"command": "node"`. Claude Code runs shell-form hooks via `sh -c` with the parent process environment and spawns stdio MCP servers with `shell: false` using the parent PATH (both confirmed from the official docs and from the installed CC 2.1.300 binary). When CC is launched without a login shell, that PATH lacks version-manager node (pixi, nvm, fnm, volta, mise, asdf, Homebrew on a fresh Linux shell), so every hook exits 127 silently and the MCP server fails to start. The Bash tool is not affected because it uses CC's login-shell PATH snapshot, which is why the plugin's skills keep working and the breakage goes unnoticed.

Two different fixes are needed because the two launch paths have different constraints. Hooks already run under a shell, so the cheapest robust fix is a small POSIX preamble in each command that only acts when `command -v node` fails: it probes the common install directories and prepends the first hit to PATH, then the existing `node -e` payload runs untouched. This keeps the existing "CLAUDE_PLUGIN_ROOT unset or stale" cache-scan fallback intact (the preamble references no plugin path at all) and does not change the on-PATH case (PATH is only touched after `command -v node` fails). The MCP server has no shell, so it needs a launcher file: a POSIX sh wrapper `bin/gsd-node` referenced as `"command": "${CLAUDE_PLUGIN_ROOT}/bin/gsd-node"` (the docs confirm `${CLAUDE_PLUGIN_ROOT}` is substituted in the MCP `command` field), plus a `bin/gsd-node.cmd` twin so Windows keeps resolving to bare `node` through cross-spawn's PATHEXT lookup.

Both shapes were tested locally under `sh`, `bash` and `dash` with a node-less PATH (found Homebrew node), with node already on PATH (unchanged), and with every candidate masked (clear stderr, exit 127). The wrapper is shellcheck-clean. The bm build (`bin/build-bm.cjs`) copies every tracked file and preserves the exec bit, so the new wrapper needs no allow-list entry; only the committed `dist/bm` must be rebuilt.

**Primary recommendation:** Inline POSIX node-resolution preamble in all 18 hook commands (no plugin-path dependency) + `bin/gsd-node` sh wrapper with a `bin/gsd-node.cmd` twin as the MCP `command`; rebuild `dist/bm`; add one zero-dep test that proves the SessionStart resolver boots with node off PATH.

## Project Constraints (from CLAUDE.md)

- No em-dashes or en-dashes anywhere: prose, code comments, JSON, commit messages, CHANGELOG. Use commas, colons, parentheses, periods.
- No `Co-Authored-By` trailer on commits.
- Claude Code only plugin: do not add Codex/other-runtime handling. Windows support means Claude Code on Windows with Git Bash (the three `.sh` hooks and `hooks/run-bash-hook.cjs` already assume bash there).
- Generated code hygiene: no GSD phase/quick-task bookkeeping in product code or comments (the wrapper and hooks.json comments must describe behaviour only, not "quick 261015-e6k").
- Never use the word "canonical" (user memory rule).
- Release hygiene (user memory): every release bumps both `plugin.json` and `marketplace.json`; a bug fix needs a CHANGELOG `## [Unreleased]` entry under `### Fixed`; a README features-table row is only required for new user-facing capability (this is a fix, so optional).
- `node bin/build-bm.cjs --check` false-fails on a dirty tree (user memory): run it after committing, or accept that uncommitted edits show as drift.

## Focus Question 1: CLAUDE_PLUGIN_ROOT availability

| Question | Answer | Source |
|----------|--------|--------|
| Is `CLAUDE_PLUGIN_ROOT` an env var inside hook processes? | Yes. "Both forms ... export them as the environment variables `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PLUGIN_DATA` on the spawned process, so a script can read `process.env.CLAUDE_PLUGIN_ROOT` regardless of how it was launched." The repo's inline resolvers already rely on this. | [CITED: code.claude.com/docs/en/hooks] + hooks.json |
| Is `${CLAUDE_PLUGIN_ROOT}` substituted in hook `command`? | Yes, "Anywhere in `command` and `args`". The docs recommend quoting it in shell form (`"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`) and `claude plugin validate` warns when it is unquoted. | [CITED: code.claude.com/docs/en/plugins-reference#where-each-variable-resolves] |
| Is `${CLAUDE_PLUGIN_ROOT}` substituted in the MCP stdio `command` field (not only `args`)? | Yes: "MCP `stdio` servers: `command`, `args`, `env`". The MCP docs' plugin example is literally `"command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server"`. `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` are also exported into the server's environment. | [CITED: code.claude.com/docs/en/plugins-reference], [CITED: code.claude.com/docs/en/mcp#plugin-provided-mcp-servers] |
| Is the variable visible in the Bash tool? | No ("The variables aren't present in the environment of commands Claude runs through the Bash tool"). Irrelevant to this fix but it is why `bin/bm-sdk` self-resolves. | [CITED: plugins-reference] |
| Does the hook env carry the user's login-shell PATH? | Not documented either way; docs say "A hook process inherits the parent environment". The issue reporter's `/bin/sh: 1: node: not found` is consistent with a plain inherited PATH. Design for the worst case (no login PATH). | [CITED: hooks docs] + issue #36 |
| How does CC actually spawn them? | From the installed CC 2.1.300 binary: shell-form hooks spawn `command` with `shell:!0` (so `/bin/sh -c`), exec-form hooks spawn `[command, args]` directly, and a separate `powershell` branch exists. Stdio MCP: the bundled `StdioClientTransport` spawns `command, args` with `shell:!1`, `env:{...getDefaultEnvironment(), ...serverParams.env}` (merge, PATH inherited from CC's process). | [VERIFIED: strings in ~/.local/share/claude/versions/2.1.300] |

Conclusion: the hook fix must not depend on `${CLAUDE_PLUGIN_ROOT}` (stale-after-upgrade case, see Q2), and the MCP fix may use it in `command` with HIGH confidence.

## Focus Question 2: Fix shape (compare, then recommend one)

### Option (a): shipped sh wrapper used by hooks AND MCP

- Hook line would become `"\"${CLAUDE_PLUGIN_ROOT}\"/bin/gsd-node -e \"<payload>\" hook session-start"`.
- MCP: `"command": "${CLAUDE_PLUGIN_ROOT}/bin/gsd-node"`.
- CLAUDE_PLUGIN_ROOT unset: hook line degrades to `/bin/gsd-node` (does not exist) and every hook dies with 127. This also reintroduces the exact failure commit `7a80d47` fixed ("hook commands fall back to newest cached plugin version when the session's baked `${CLAUDE_PLUGIN_ROOT}` path has been pruned after an upgrade"): the baked path is substituted once at session start, so after an in-session update the wrapper path is gone and the cache-scan fallback inside the payload never gets a chance to run. Rejected for hooks.

### Option (b): inline POSIX preamble in each hook command (recommended for hooks)

- The hook already runs under `sh -c`; prepend a resolver that touches PATH only when node is missing, then the unchanged payload runs.
- CLAUDE_PLUGIN_ROOT unset or stale: identical to today, because the preamble references no plugin path. The payload's cache scan still handles the plugin-root fallback. Verified: `tests/hook-fallback-resolution.test.cjs` runs the committed SessionStart[0] command with `CLAUDE_PLUGIN_ROOT` deleted and a fake HOME; the preamble's `$HOME/...` probes simply miss and PATH node is used.
- On-PATH case: `command -v node` succeeds, PATH untouched, zero behaviour change. Verified with PATH containing `node@22` first: that node still wins and PATH is byte-identical.
- Cost: one `command -v` plus at most 13 `[ -x ]` stat calls on the failure path only. Hook timeouts (3 to 10 s) are unaffected.
- Duplication: 18 copies of a 454-char string. The file already carries 18 copies of a ~900-char JS resolver, so this follows the existing pattern; a test should pin that all 18 preambles are identical.

### Option (c): keep working when CLAUDE_PLUGIN_ROOT is unset

Option (b) is option (c) for hooks. For MCP, nothing can work without `${CLAUDE_PLUGIN_ROOT}` because `args` already points at `${CLAUDE_PLUGIN_ROOT}/mcp/server.cjs`; using it in `command` adds no new failure mode.

### Recommendation

Hooks: option (b). MCP: wrapper file (option (a) shape, MCP only) plus a `.cmd` twin.

#### Exact hook preamble (POSIX, single line, tested under sh/bash/dash)

Raw shell form:

```sh
command -v node >/dev/null 2>&1 || { for d in "$HOME/.pixi/bin" /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin" "$HOME/.local/share/mise/shims" "$HOME/.asdf/shims" "$HOME/.nodenv/shims" "$HOME/.nix-profile/bin" /home/linuxbrew/.linuxbrew/bin /snap/bin "$HOME/.local/share/fnm/aliases/default/bin" "$HOME/Library/Application Support/fnm/aliases/default/bin" "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/node" ] && { PATH="$d:$PATH"; break; }; done; }
```

Each `command` value in hooks.json becomes `<preamble>; node -e "<unchanged payload>" <unchanged trailing args>`. In the JSON text every `"` inside the preamble is written `\"` exactly like the payload's quotes; nothing inside the payload changes. Example of the first entry (payload elided):

```json
"command": "command -v node >/dev/null 2>&1 || { for d in \"$HOME/.pixi/bin\" /opt/homebrew/bin /usr/local/bin \"$HOME/.volta/bin\" \"$HOME/.local/share/mise/shims\" \"$HOME/.asdf/shims\" \"$HOME/.nodenv/shims\" \"$HOME/.nix-profile/bin\" /home/linuxbrew/.linuxbrew/bin /snap/bin \"$HOME/.local/share/fnm/aliases/default/bin\" \"$HOME/Library/Application Support/fnm/aliases/default/bin\" \"$HOME\"/.nvm/versions/node/*/bin; do [ -x \"$d/node\" ] && { PATH=\"$d:$PATH\"; break; }; done; }; node -e \"const f=require('fs'),p=require('path'),o=require('os'),c=[];...\" hook session-start"
```

Why these details:
- `PATH="$d:$PATH"` without `export` is enough: PATH is already in the environment, and POSIX keeps the export attribute on reassignment. Verified: the subsequent `node -e` found `/opt/homebrew/bin/node` from a `PATH=/usr/bin:/bin` start.
- The nvm glob is unquoted on purpose (`"$HOME"/.nvm/versions/node/*/bin`); with no match the literal pattern is tested and skipped. It picks the lexicographically first version dir (a v8 would beat a v22); acceptable, nvm users without a login shell are rare and `fnm`/`volta`/`mise` have stable "default" paths.
- Order: PATH first (no regression), then pixi (the reported case), Homebrew, `/usr/local/bin`, then version managers. `/usr/local/bin` is also where `n` installs.
- The payload spawns bash hooks with `process.execPath`, so the resolved node propagates to `run-bash-hook.cjs` children without further lookup.
- `hooks/hooks.json` `description` must be updated to mention the preamble (it currently documents only the inline cache resolver).

#### Exact MCP wrapper: `bin/gsd-node` (mode 100755, shellcheck -s sh clean, tested)

```sh
#!/bin/sh
# Locate a node binary and exec it with the given arguments.
# Claude Code may be launched without a login shell (desktop launcher,
# systemd unit, terminal -e), so node installed by a version manager is
# not on PATH. PATH is tried first so a normal install is never changed.
if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi
for d in \
  "$HOME/.pixi/bin" \
  /opt/homebrew/bin \
  /usr/local/bin \
  "$HOME/.volta/bin" \
  "$HOME/.local/share/mise/shims" \
  "$HOME/.asdf/shims" \
  "$HOME/.nodenv/shims" \
  "$HOME/.nix-profile/bin" \
  /home/linuxbrew/.linuxbrew/bin \
  /snap/bin \
  "$HOME/.local/share/fnm/aliases/default/bin" \
  "$HOME/Library/Application Support/fnm/aliases/default/bin" \
  "$HOME"/.nvm/versions/node/*/bin
do
  if [ -x "$d/node" ]; then
    PATH="$d:$PATH"
    export PATH
    exec "$d/node" "$@"
  fi
done
echo "gsd-node: node not found on PATH or in the usual install locations." >&2
echo "          Start Claude Code from a login shell, or add node to PATH." >&2
exit 127
```

Test results (this machine): node-less PATH resolved `/opt/homebrew/bin/node`; `dash` executes it; with node on PATH the PATH node wins and `"$@"` passes `a b` and `c'd` intact; with all candidates masked it prints the two stderr lines and exits 127.

#### Exact Windows twin: `bin/gsd-node.cmd`

```bat
@echo off
rem Windows twin of bin/gsd-node. node is on the machine PATH on Windows
rem (installer, nvm-windows, scoop), so forward straight to it.
node %*
exit /b %ERRORLEVEL%
```

#### Exact manifest change: `.claude-plugin/plugin.json`

```json
"mcpServers": {
  "gsd": {
    "type": "stdio",
    "command": "${CLAUDE_PLUGIN_ROOT}/bin/gsd-node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/server.cjs"]
  }
}
```

`stampBmManifest` in `bin/build-bm.cjs` rekeys `gsd` to `bm` and carries the server object through unchanged, so `dist/bm/.claude-plugin/plugin.json` gets the same `command`. The file name `gsd-node` is not rewritten by the transform (it only rewrites `gsd:` prefixes and the four fallback literals), which matches the existing `dist/bm/bin/gsd-tools.cjs`.

## Focus Question 3: Windows

Evidence of platform support:
- Issue #16 (closed) was a Windows user running the plugin's bash hooks under Cygwin/MSYS2 with Kaspersky; `hooks/run-bash-hook.cjs` ships a Windows-specific fork retry. `bin/bm-sdk.cmd` and `bin/gsd-sdk.cmd` exist. So Windows with Git Bash is supported in practice and must not regress. PowerShell-only Windows (no Git Bash) is not a supported configuration: the three `.sh` hooks already need bash, and the hooks docs say shell-form hooks run under Git Bash on Windows, falling back to PowerShell only when Git Bash is absent. [VERIFIED: repo] [CITED: hooks docs]
- Commit `6b04cfc` (quick 260417-3jn) replaced the hardcoded `/usr/local/bin/node` with bare `node` "for Linux and Windows compatibility". The recommended shapes keep that property: bare `node` is still tried first everywhere, and nothing hardcodes a single absolute path. The prior task's summary directory is not in `.planning/quick/` (only its commits survive: 6b04cfc, cc826e8, 2213321, b7dba4a).

Decision: keep the fix cross-platform, at minimal cost.
- Hooks: under Git Bash the POSIX preamble runs as-is; `command -v node` finds `node.exe` on the Windows PATH, so the fallback loop never runs; the Unix candidate directories do not exist there and are harmless. Net effect on Windows: none.
- MCP: Claude Code's bundled `StdioClientTransport` spawns through cross-spawn (the official SDK source `packages/client/src/client/stdio.ts` line 8 is `import spawn from 'cross-spawn'` with `shell: false`; the CC 2.1.300 binary carries cross-spawn's `readShebang` (`Buffer.alloc(150)`), the `/\.(?:com|exe)$/i` executable test and the `node_modules/.bin/*.cmd` shim regex). On Windows cross-spawn resolves `<root>/bin/gsd-node` through `which` with PATHEXT, which finds `gsd-node.cmd`, then wraps it in `cmd.exe /d /s /c`. That is why the `.cmd` twin is required: without it, cross-spawn's second lookup finds the extensionless sh file, reads its `#!/bin/sh` shebang and tries to run `sh`, which is not on the Windows PATH. [VERIFIED: SDK source via gh api] [VERIFIED: binary strings] [ASSUMED: the PATHEXT resolution outcome on a real Windows box; not run here]
- If the user wants zero Windows exposure, the fallback is to ship the hooks fix only and leave `"command": "node"` for MCP (documented limitation: start CC from a login shell or symlink node into `/usr/local/bin`). The research recommends the twin because the evidence chain is concrete and the worst case is a visible "MCP server failed" notice, not silent damage.

Not applicable: the `shell` hook field, exec-form hooks (`args` present means no shell, so no fallback is possible), and `"command": "sh"` for MCP (sh is not on the Windows PATH).

## Focus Question 4: Transform / twin coverage

Verified in `bin/build-bm.cjs`:
- Source list is `git ls-files` filtered by `shouldExclude` (excludes `.git`, `.planning`, `.claude`, `node_modules`, `dist`, `scratchpad`, `.DS_Store`, `.claude-plugin/marketplace.json`). A new tracked `bin/gsd-node` and `bin/gsd-node.cmd` are included automatically; there is no file allow-list or manifest to update.
- `isTextFile` treats extensionless files that start with `#!` as text, so `bin/gsd-node` goes through `rewriteCommandRefs`, `stampHookFallback`, `suppressNudge`. None of them match its content as long as the wrapper contains no `gsd:` followed by a lowercase letter, no `/gsd[:-]`, and none of the four fallback literals. The `.cmd` has no matching extension and no shebang, so it is byte-copied.
- Exec bit: `fs.chmodSync(dest, fs.statSync(src).mode & 0o777)` after each text write, and `copyFileSync` for binaries. `git config core.filemode` is `true` and existing wrappers are tracked as `100755`. Marketplace installs are git checkouts (`gsd` source `./`, `bm` source `./dist/bm`), so the mode survives install.
- `hooks/hooks.json` twin: regenerated with `g='gsd'` stamped to `g='bm'` (18 times, asserted by `tests/build-bm-drift.test.cjs`). The preamble contains none of the stamp literals and no `gsd:` token, so it is copied verbatim into the bm twin. `tests/hook-fallback-resolution.test.cjs` reads SessionStart[0] from both files and executes them with `bash -c`, so both twins get exercised.
- `.claude-plugin/plugin.json` twin: written by `stampBmManifest`; the `mcpServers.gsd` object is moved to `mcpServers.bm` unchanged.
- The parity census (`tests/bm-parity.test.cjs`) only flags `gsd:` prefixes, agent refs, the cache literal and the sanitizer literal; `gsd-node` as a filename is in the allow-listed `gsd-<file>` shape.

Steps for the planner: edit source files, commit, `node bin/build-bm.cjs`, commit `dist/bm` (the user memory notes `--check` must run on a clean tree to give a true signal). Then run `node tests/build-bm-drift.test.cjs`, `node tests/bm-parity.test.cjs`, `node tests/hook-fallback-resolution.test.cjs`, `node bin/validate-plugin.cjs .claude-plugin/plugin.json`, `node bin/validate-plugin.cjs dist/bm/.claude-plugin/plugin.json`, `claude plugin validate .` and `claude plugin validate dist/bm` (baseline today: both pass with the known CLAUDE.md-at-root warning).

## Focus Question 5: Pitfalls

### Pitfall 1: breaking the quoted `node -e` payload
**What goes wrong:** The 18 payloads contain `\"` escapes, single quotes, `\\d` regex escapes and `\\n`. Re-typing or re-escaping them is the main way to corrupt a hook.
**How to avoid:** Prepend the preamble textually before the literal `node -e`; never touch the payload. Do the edit with a script that reads the JSON, asserts each command starts with `node -e `, prepends the same preamble constant, and writes with 2-space indentation (matching the current file). Round-trip verified: `JSON.stringify` then `JSON.parse` then `sh -c` produced `payload-ok` with the preamble in front.
**Warning signs:** `tests/hook-fallback-resolution.test.cjs` fails, or `bash -n` style parse errors in `claude --debug` hook output.

### Pitfall 2: regressing the stale-plugin-root fallback (commit 7a80d47)
**What goes wrong:** Referencing `${CLAUDE_PLUGIN_ROOT}/bin/gsd-node` from hook commands kills every hook after an in-session plugin update prunes the baked path.
**How to avoid:** Hooks use the inline preamble only. Only the MCP `command` references the plugin root, and it already did via `args`.

### Pitfall 3: changing node priority on machines where it already works
**What goes wrong:** Prepending candidate dirs unconditionally would make `/opt/homebrew/bin/node` (v26 here) win over the user's PATH node (v22 here).
**How to avoid:** Gate everything on `command -v node` failing. Verified PATH is byte-identical when node is already present.

### Pitfall 4: exec bit lost
**What goes wrong:** A `0644` wrapper makes the MCP server fail with EACCES on every Unix install.
**How to avoid:** `chmod 755 bin/gsd-node` before `git add`, verify `git ls-files -s bin/gsd-node` shows `100755`, rebuild `dist/bm`, verify `git ls-files -s dist/bm/bin/gsd-node` shows `100755`.

### Pitfall 5: bashisms in a `#!/bin/sh` file or in the preamble
**What goes wrong:** Debian/Ubuntu `sh` is dash; `[[ ]]`, arrays, `local`, `${var//x/y}` break there (the issue reporter is on Linux with `/bin/sh: 1:` dash-style messages).
**How to avoid:** Both shapes use only `command -v`, `[ -x ]`, `for`, `exec`, `"$@"`. Verified under `/bin/dash` locally; `shellcheck -s sh` clean.

### Pitfall 6: dashes in generated text
**What goes wrong:** Em/en-dashes in the wrapper comments, hooks.json description, CHANGELOG or commit message violate CLAUDE.md.
**How to avoid:** Plain hyphens only; grep the diff for U+2013/U+2014 before committing.

### Pitfall 7: `bin/` is on the Bash tool's PATH
**Note:** The plugins reference says files in `bin/` are on the Bash tool's PATH while the plugin is enabled, so `gsd-node` becomes a bare command for Claude. That is harmless and even useful for diagnosis (`gsd-node -v`), but the name must not collide with anything (it does not). Also: "claude.ai and Cowork don't install a plugin that has this directory", which is already the case today because of `bin/bm-sdk`.

### Security note
The wrapper evaluates no input: it only tests fixed directories (plus `$HOME`-relative ones, which the user already controls) and `exec`s node with `"$@"` verbatim. The preamble does the same. Neither reads files, writes files, or interpolates hook stdin. Prepending a `$HOME` directory to PATH is the same trust level as the user's own PATH. If `$HOME` is unset the probes degrade to `/.pixi/bin` style root paths, which do not exist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hook node resolution | Hook command string (sh) | none | Must work before any plugin file is known to exist |
| MCP node resolution | Plugin file `bin/gsd-node` (+ `.cmd`) | Manifest `command` field | No shell at spawn, so a launcher file is the only hook point |
| bm twin generation | `bin/build-bm.cjs` | tests (drift, parity, fallback) | Automatic via `git ls-files`; tests pin the shape |

## Standard Stack

No new packages. POSIX sh, Node built-ins, existing zero-dep test harness. Package Legitimacy Audit: not applicable (nothing installed).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Windows `.cmd` launching for MCP | A cmd/sh polyglot or an `.exe` | `gsd-node.cmd` twin resolved by cross-spawn's PATHEXT lookup | CC's transport already handles `.cmd` shims |
| Re-escaping 18 payloads by hand | Manual JSON edits | A one-off node script that prepends a shared constant and rewrites the file | Payload quoting is the top corruption risk |

## Runtime State Inventory

Not a rename/migration phase. Omitted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | tests, build-bm | yes | v22.22.3 (PATH), v26.3.0 (Homebrew) | none needed |
| sh / bash / dash | wrapper + preamble tests | yes | bash 3.2.57 as `/bin/sh`, `/bin/dash` present | none needed |
| shellcheck | optional lint | yes | /opt/homebrew/bin/shellcheck | skip lint |
| claude CLI | `claude plugin validate` | yes | 2.1.300 | `node bin/validate-plugin.cjs` only |
| gh | issue comment / close | yes | works (read issue #36) | manual |
| Windows box | verifying the `.cmd` twin | no | - | ask a Windows user; see Assumptions |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | zero-dep Node scripts, `node tests/<name>.test.cjs` (85 files), run individually in `.github/workflows/check-drift.yml` |
| Config file | none |
| Quick run command | `node tests/hook-fallback-resolution.test.cjs && node tests/build-bm-drift.test.cjs && node tests/bm-parity.test.cjs` |
| Full suite command | the step list in `.github/workflows/check-drift.yml` plus `node bin/build-bm.cjs --check` on a clean tree, `node bin/validate-plugin.cjs` for both manifests, `claude plugin validate .` and `claude plugin validate dist/bm` |

### Requirements to Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| Hooks boot with node off PATH | SessionStart[0] from both hooks.json files resolves node from a fake `$HOME/.pixi/bin/node` symlink with `PATH=/usr/bin:/bin` and prints the planted stub marker | integration | `node tests/hook-node-resolution.test.cjs` | no, Wave 0 |
| All 18 commands share one preamble | every `command` in both files starts with the identical preamble string and then `node -e ` | unit | same file | no, Wave 0 |
| No regression on-PATH | with node on PATH the stub marker still prints and `$PATH` seen by the payload is unchanged | integration | same file | no, Wave 0 |
| Wrapper resolves and passes argv | `bin/gsd-node -e ...` with node off PATH and fake HOME prints marker and argv round-trips | integration | same file | no, Wave 0 |
| Wrapper fails loudly | with HOME fake and the fixed dirs unavailable the exit is 127 and stderr mentions `gsd-node:` (only testable by sed-masking the fixed dirs into a temp copy, as done in research) | integration | same file | no, Wave 0 |
| Twins regenerate | drift test, parity census, `--check` | existing | `node tests/build-bm-drift.test.cjs`, `node tests/bm-parity.test.cjs`, `node bin/build-bm.cjs --check` | yes |
| Stale/unset plugin root still falls back | existing | existing | `node tests/hook-fallback-resolution.test.cjs` | yes |
| Manifests valid | `command` present, placeholders accepted | existing | `node bin/validate-plugin.cjs <manifest>`, `claude plugin validate` | yes |

### Sampling Rate
- Per task commit: `node tests/hook-node-resolution.test.cjs && node tests/hook-fallback-resolution.test.cjs`
- Per wave merge: quick run command above plus `node bin/build-bm.cjs --check` after the dist commit
- Gate: all of the above green, `claude plugin validate` for both trees passes with only the pre-existing CLAUDE.md warning

### Wave 0 Gaps
- [ ] `tests/hook-node-resolution.test.cjs` (model on `tests/hook-fallback-resolution.test.cjs`: fresh HOME, plant stub `gsd-tools.cjs`, symlink `process.execPath` to `$HOME/.pixi/bin/node`, run each SessionStart[0] command with `bash -c` and `PATH=/usr/bin:/bin`). Add it to `.github/workflows/check-drift.yml` next to the fallback test (line 247 area).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (argv passthrough) | `exec node "$@"`, no eval, no word splitting of arguments |
| V14 Configuration | yes | PATH mutated only when node is absent; only fixed or `$HOME`-relative directories; no network, no file writes |
| V2/V3/V4/V6 | no | not applicable |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| PATH hijack via writable candidate dir | Elevation | candidates are user-owned (`$HOME`) or admin-owned system dirs, same trust as the user's PATH; PATH is consulted first |
| Payload corruption via quoting | Tampering | scripted edit + round-trip test |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/usr/local/bin/node` hardcoded in manifest | bare `node` | 6b04cfc (2026-04-17) | fixed Linux/Windows, introduced #36 for no-login-shell launches |
| bare `node -e` with inline cache resolver | preamble + inline resolver | this task | works without login shell, keeps cache fallback |
| `"command": "node"` for MCP | `${CLAUDE_PLUGIN_ROOT}/bin/gsd-node` + `.cmd` twin | this task | Unix no-login-shell fixed; Windows path via cross-spawn |

context-mode's approach from the issue (rewrite commands to the installing `process.execPath`) needs an install step the plugin does not have and would bake a path that breaks when node is upgraded; not adopted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On Windows, CC's bundled cross-spawn resolves `<root>/bin/gsd-node` to `gsd-node.cmd` via PATHEXT and runs it through `cmd.exe`, so the MCP server keeps starting | Q3 | MCP server shows "failed to start" on Windows (hooks unaffected). Fallback: revert MCP `command` to `node` for Windows parity, or ask a Windows user to confirm |
| A2 | The reporter's environment (pixi, Linux, no login shell) sets `HOME` | Q2 | pixi probe misses; the other fixed dirs still apply |
| A3 | nvm users without a login shell are rare enough that "first version dir" ordering is acceptable | Q2 | an older nvm version could be picked; cosmetic |

## Open Questions

1. **Windows MCP confirmation.** Known: cross-spawn is bundled and the SDK transport uses it. Unclear: real-world PATHEXT resolution for a forward-slash `${CLAUDE_PLUGIN_ROOT}` path. Recommendation: ship with the `.cmd` twin, note it in the CHANGELOG entry, and ask on issue #36 for a Windows confirmation.
2. **Optional override variable.** A `GSD_NODE_DIR`-style env override was considered and left out to keep the preamble small; add later only if a user reports an install location not in the list.

## Sources

### Primary (HIGH confidence)
- https://code.claude.com/docs/en/plugins-reference (Environment variables: "Where each variable resolves" table; `bin/` on Bash PATH; quoting rules)
- https://code.claude.com/docs/en/hooks (shell form via `sh -c`, Git Bash / PowerShell on Windows, env export of `CLAUDE_PLUGIN_ROOT`, exit-code semantics, `onFailure`)
- https://code.claude.com/docs/en/mcp (plugin-provided servers: `${CLAUDE_PLUGIN_ROOT}` in `command`, `args`, `env`)
- modelcontextprotocol/typescript-sdk `packages/client/src/client/stdio.ts` via `gh api` (cross-spawn import, `shell: false`, `getDefaultEnvironment`)
- Installed CC 2.1.300 binary strings (hook runner `shell:!0` / exec form / powershell branch; `StdioClientTransport` with `shell:!1`; cross-spawn shebang and `.cmd` code)
- Repo: `hooks/hooks.json`, `.claude-plugin/plugin.json`, `bin/build-bm.cjs`, `bin/lib/bm-transform.cjs`, `tests/hook-fallback-resolution.test.cjs`, `tests/build-bm-drift.test.cjs`, `tests/bm-parity.test.cjs`, `hooks/run-bash-hook.cjs`, `bin/bm-sdk`, `bin/bm-sdk.cmd`, commits 6b04cfc and 7a80d47, GitHub issues #36 and #16
- Local execution: preamble and wrapper under `sh`, `bash`, `dash` with node-less PATH, on-PATH, and masked-candidates scenarios; `shellcheck -s sh`; `claude plugin validate` baseline for both trees

### Secondary (MEDIUM confidence)
- Inference that CC's Windows MCP spawn resolves the `.cmd` twin (binary evidence + SDK source, not executed on Windows)

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Hook fix shape: HIGH (docs + binary + local tests + existing test harness)
- MCP Unix fix: HIGH (docs confirm `command` substitution; wrapper tested)
- MCP Windows twin: MEDIUM (reasoned, not run on Windows)
- Transform coverage: HIGH (read `build-bm.cjs` and the three tests)

**Research date:** 2026-10-15
**Valid until:** 2026-11-15 (CC hook/MCP launch semantics are stable; recheck if CC changes its MCP transport)
