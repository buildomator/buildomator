---
name: gsd:version
description: Print the installed GSD plugin version and check online for updates
effort: low
allowed-tools:
  - Bash
---

Run this and relay its output verbatim; add nothing.

```bash
PJ="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json}"; [ -f "$PJ" ] || PJ=$(ls -d "$HOME"/.claude/plugins/cache/gsd-plugin/gsd/*/.claude-plugin/plugin.json 2>/dev/null|sort -V|tail -1)
CUR=$(grep -m1 '"version"' "$PJ" 2>/dev/null|grep -oE '[0-9]+\.[0-9]+\.[0-9]+'); LAT=$(git ls-remote --tags --refs https://github.com/jnuyens/buildomator 2>/dev/null|grep -oE '[0-9]+\.[0-9]+\.[0-9]+$'|sort -V|tail -1)
echo "GSD plugin: ${CUR:-unknown}  (latest: ${LAT:-could not check})"
if [ -n "$LAT" ] && [ "$CUR" != "$LAT" ] && [ "$(printf '%s\n%s' "$CUR" "$LAT"|sort -V|tail -1)" = "$LAT" ]; then echo "Update available: /plugins -> Marketplace -> refresh gsd-plugin -> Esc x2, then /reload-plugins"; fi
```
