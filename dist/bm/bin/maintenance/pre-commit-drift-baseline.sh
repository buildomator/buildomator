#!/usr/bin/env bash
# pre-commit-drift-baseline.sh
#
# Pre-commit hook source for gsd-plugin. Auto-regenerates
# tests/drift-baseline.json when a new tracked file legitimately
# increases the file-layout drift count, so feature commits that add a
# workflow or skill do not produce a transient CI failure before a
# follow-up baseline-regen commit.
#
# Behavior:
#   1. Skip silently if check-file-layout.cjs is missing (partial checkout).
#   2. Run the drift check; if it passes, exit 0.
#   3. If the failure shows genuinely_missing > previous, ABORT the commit.
#      That is a real drift regression and the author must fix it.
#   4. Otherwise (only has_plugin_counterpart went up because a new
#      tracked file added a unique subpath ref), regenerate the baseline
#      and stage it as part of the in-flight commit.
#
# Override: git commit --no-verify
#
# Install:
#   ln -sf "$(pwd)/bin/maintenance/pre-commit-drift-baseline.sh" .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Or run: bash bin/maintenance/install-git-hooks.sh

set -e

# Resolve repo root so the hook works regardless of pwd
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi
cd "$REPO_ROOT"

DRIFT_SCRIPT="bin/maintenance/check-file-layout.cjs"

if [ ! -f "$DRIFT_SCRIPT" ]; then
  # Partial checkout or someone deleted the script. Don't block commits.
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  # No node available; can't run the check. Don't block commits.
  exit 0
fi

# Run the drift check. Capture output for parsing.
DRIFT_OUTPUT="$(node "$DRIFT_SCRIPT" 2>&1)" || DRIFT_STATUS=$?

# Re-derive status because we used || to capture non-zero exit
DRIFT_STATUS="${DRIFT_STATUS:-0}"

if [ "$DRIFT_STATUS" -eq 0 ]; then
  # File-layout passes. Skip its auto-regen branch and proceed to the
  # jargon check below (the jargon detector runs UNCONDITIONALLY so that
  # commits which add CHANGELOG/README jargon but do not affect file-layout
  # drift still trip the ratchet).
  :
else

# FAIL. Parse to determine which counter regressed.
# Sample fail line: "  genuinely_missing 5 > 0"
# (POSIX-compatible regex; no \d)
if echo "$DRIFT_OUTPUT" | grep -E "^[[:space:]]+genuinely_missing[[:space:]]+[0-9]+[[:space:]]+>[[:space:]]+[0-9]+" >/dev/null 2>&1; then
  echo "" >&2
  echo "ERROR: file-layout drift introduced genuinely-missing refs." >&2
  echo "" >&2
  echo "$DRIFT_OUTPUT" >&2
  echo "" >&2
  echo "These are dangling @-include references with no plugin counterpart." >&2
  echo "Aborting commit. Fix the missing refs first, or override with: git commit --no-verify" >&2
  exit 1
fi

# Only has_plugin_counterpart went up. Safe to auto-regen baseline.
echo "→ Drift baseline out of date (new tracked file added a unique subpath ref)."
echo "→ Auto-regenerating tests/drift-baseline.json..."

node "$DRIFT_SCRIPT" --write-baseline >/dev/null

if [ -f tests/drift-baseline.json ]; then
  git add tests/drift-baseline.json
  echo "→ Staged updated tests/drift-baseline.json (will land in this commit)."
fi
fi  # end of else-branch for $DRIFT_STATUS

# ── User-docs jargon detector (separate detector, NO auto-regen) ──────────
#
# Unlike the file-layout detector, the jargon ratchet does NOT auto-regen
# on regression. Auto-regen would defeat the catch: the point is to make
# the author pause and confirm a jargon mention in user-facing docs was
# intentional. Each plugin release that adds a CHANGELOG entry describing
# internal work will trip this check; the author must run
#   node bin/maintenance/check-user-docs-jargon.cjs --write-baseline
# explicitly and commit the new baseline. That moment of explicit
# acknowledgement is the whole point.
JARGON_SCRIPT="bin/maintenance/check-user-docs-jargon.cjs"
if [ -f "$JARGON_SCRIPT" ] && command -v node >/dev/null 2>&1; then
  if ! node "$JARGON_SCRIPT" >/dev/null 2>&1; then
    echo "" >&2
    echo "ERROR: user-docs jargon ratchet regressed." >&2
    echo "" >&2
    node "$JARGON_SCRIPT" >&2 || true
    echo "" >&2
    echo "If the new mentions are intentional (e.g., CHANGELOG describing internal work):" >&2
    echo "  node bin/maintenance/check-user-docs-jargon.cjs --write-baseline" >&2
    echo "  git add tests/drift-baseline.json" >&2
    echo "  # then re-run the commit" >&2
    echo "" >&2
    echo "Override entirely: git commit --no-verify" >&2
    exit 1
  fi
fi

exit 0
