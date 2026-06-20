---
name: gsd:version
description: Print the installed GSD plugin version and check online for updates
effort: low
allowed-tools:
  - Bash
---

Run this bash block and relay its output verbatim; add nothing. The online check is best-effort and never blocks.

```bash
# Installed version: CLAUDE_PLUGIN_ROOT, else newest versioned cache dir. grep/sed (works when the JS runtime is down).
PJ="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json}"
[ -f "$PJ" ] || PJ=$(ls -d "$HOME/.claude/plugins/cache/gsd-plugin/gsd/"*/.claude-plugin/plugin.json 2>/dev/null | sort -V | tail -1)
CUR=$(grep -m1 '"version"' "$PJ" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+'); CUR=${CUR:-unknown}
# Latest = newest git tag (releases ship as tags, not Releases); curl tags API as fallback.
LAT=$(git ls-remote --tags --refs https://github.com/jnuyens/gsd-plugin 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
[ -z "$LAT" ] && command -v curl >/dev/null && LAT=$(curl -fsSL https://api.github.com/repos/jnuyens/gsd-plugin/tags 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1)
echo "GSD plugin: ${CUR}  (latest: ${LAT:-could not check})"
[ -n "$LAT" ] && [ "$CUR" != unknown ] && [ "$CUR" != "$LAT" ] && [ "$(printf '%s\n%s' "$CUR" "$LAT" | sort -V | tail -1)" = "$LAT" ] && \
  printf 'Update available. To update: /plugins -> Marketplace -> refresh gsd-plugin -> Esc x2, then /reload-plugins (each open session).\n'
```
