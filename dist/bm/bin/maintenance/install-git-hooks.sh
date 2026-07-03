#!/usr/bin/env bash
# install-git-hooks.sh
#
# Install the gsd-plugin pre-commit hook into .git/hooks/.
#
# The hook lives in version control at
# bin/maintenance/pre-commit-drift-baseline.sh so everyone working on
# the repo can install the same logic. This script does the local
# install step (.git/hooks/* is not version-controlled).
#
# Idempotent: re-running this script is safe.
#
# Usage:
#   bash bin/maintenance/install-git-hooks.sh
#
# Uninstall:
#   rm .git/hooks/pre-commit

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not inside a git repo. Run from the gsd-plugin root." >&2
  exit 1
fi
cd "$REPO_ROOT"

SOURCE="bin/maintenance/pre-commit-drift-baseline.sh"
TARGET=".git/hooks/pre-commit"

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: source script not found at $SOURCE" >&2
  exit 1
fi

mkdir -p .git/hooks

# If an existing pre-commit hook is present and is NOT a symlink to our
# script, back it up. The user might have other hook logic they care
# about; do not silently clobber.
if [ -f "$TARGET" ] && [ ! -L "$TARGET" ]; then
  cp "$TARGET" "${TARGET}.backup-$(date +%Y%m%d-%H%M%S)"
  echo "→ Backed up existing $TARGET to ${TARGET}.backup-*"
fi

# If $TARGET is already a symlink to our script, nothing to do.
if [ -L "$TARGET" ] && [ "$(readlink "$TARGET")" = "$REPO_ROOT/$SOURCE" ]; then
  echo "✓ pre-commit hook already installed (symlink to $SOURCE)."
  exit 0
fi

# Install as symlink so script updates land automatically on the next commit.
ln -sf "$REPO_ROOT/$SOURCE" "$TARGET"
chmod +x "$REPO_ROOT/$SOURCE"
chmod +x "$TARGET" 2>/dev/null || true

echo "✓ pre-commit hook installed: $TARGET → $SOURCE"
echo ""
echo "From now on, commits that add a new tracked workflow/skill/agent file"
echo "will auto-regenerate tests/drift-baseline.json in-place, eliminating"
echo "the previous two-step pattern (commit + drift-baseline-regen commit)."
echo ""
echo "Override on a per-commit basis with: git commit --no-verify"
echo "Uninstall: rm $TARGET"
