<purpose>
Print the installed GSD plugin version, check GitHub for the latest release, and
when an update is available (or the check could not run) show how to update.
Read-only and best-effort: the online check never blocks and never fails the
command. No project state is touched.
</purpose>

<process>

**Step 1: Gather version info**

Run this single bash block and relay its output verbatim. It resolves the
installed version from the plugin manifest, queries GitHub for the latest
release (best-effort: `gh` first, then `git ls-remote`), compares them, and
prints update guidance only when relevant.

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}"

# Installed version from the plugin manifest.
CURRENT=$(node -e "process.stdout.write(String(require('$PLUGIN_ROOT/.claude-plugin/plugin.json').version||''))" 2>/dev/null)
[ -z "$CURRENT" ] && CURRENT="unknown"

# Latest version from GitHub (best-effort, non-fatal). The repo ships releases
# as git tags (vX.Y.Z), so tags are the source of truth here — NOT GitHub
# "Releases", which can lag when a Release object was not published. Primary:
# git ls-remote (dependency-free). Fallback: the tags API via curl. Strip "v".
LATEST=$(git ls-remote --tags --refs https://github.com/jnuyens/gsd-plugin 2>/dev/null \
  | sed 's|.*refs/tags/v\{0,1\}||' \
  | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
if [ -z "$LATEST" ] && command -v curl >/dev/null 2>&1; then
  LATEST=$(curl -fsSL https://api.github.com/repos/jnuyens/gsd-plugin/tags 2>/dev/null \
    | grep -oE '"name"[[:space:]]*:[[:space:]]*"v?[0-9.]+"' \
    | sed -E 's/.*"v?([0-9.]+)".*/\1/' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
fi

echo "GSD plugin version"
echo "=================="
echo "Installed: ${CURRENT}"

if [ -z "$LATEST" ]; then
  echo "Latest:    (could not check — offline, or GitHub unreachable)"
  STATUS="unknown"
elif [ "$CURRENT" = "unknown" ]; then
  echo "Latest:    ${LATEST}"
  STATUS="unknown"
else
  echo "Latest:    ${LATEST}"
  # Newest of the two via version sort. If newest == current, we are current.
  NEWEST=$(printf '%s\n%s\n' "$CURRENT" "$LATEST" | sort -V | tail -1)
  if [ "$CURRENT" = "$LATEST" ]; then
    STATUS="current"
  elif [ "$NEWEST" = "$CURRENT" ]; then
    STATUS="ahead"   # local build newer than the latest published release
  else
    STATUS="behind"
  fi
fi

echo ""
case "$STATUS" in
  current) echo "You are on the latest release. Nothing to do." ;;
  ahead)   echo "Your installed build is newer than the latest published release (likely a local/dev build)." ;;
  behind)  echo "An update is available: ${CURRENT} -> ${LATEST}." ;;
  unknown) echo "Could not determine whether an update is available." ;;
esac

# Show update guidance only when it is useful (update available or check failed).
if [ "$STATUS" = "behind" ] || [ "$STATUS" = "unknown" ]; then
  echo ""
  echo "To update (type these at the Claude Code prompt):"
  echo "  /plugin marketplace update gsd-plugin   # refresh the marketplace catalog"
  echo "  /plugin install gsd@gsd-plugin          # install the new version on disk"
  echo "  /reload-plugins                         # activate it — run in EACH open session"
  echo ""
  echo "Tip: enable marketplace auto-update in Claude Code settings to skip the manual steps."
fi
```

**Step 2: Relay**

Print the block's output as-is. Do NOT add project analysis, git status, or
next-step suggestions beyond what the block prints. This command only reports the
version and update path.

</process>
