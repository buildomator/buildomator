#!/bin/bash
set -euo pipefail

# VibeDrift second-upstream release watch (D-02).
# Idea baseline pinned at v0.14.0. GSD does NOT invoke vibedrift at runtime
# (D-01) -- this is an ops/cron notifier only so the maintainer can cherry-pick
# new heuristics natively over time. The scoped package @vibedrift/cli is the
# real artifact; the bare unscoped "vibedrift" is a different package and is
# never referenced here.

# --- Configuration ---
VERSION_FILE="$HOME/.vibedrift-last-known-version"
# Resolve npm robustly. cron runs with a minimal PATH and npm is NOT at
# /usr/bin/npm on Homebrew macOS, so a hardcoded path made `$NPM view` fail and
# `|| exit 0` froze the watcher (stuck at 0.14.4 while npm latest was 0.14.8).
# Probe PATH first, then known install locations; exit 0 (never wedge cron) if
# npm is genuinely absent. Fixed in quick-260701-gbo.
NPM="$(command -v npm 2>/dev/null || true)"
if [ -z "$NPM" ]; then
  for cand in /opt/homebrew/bin/npm /usr/local/bin/npm /opt/homebrew/opt/node@22/bin/npm; do
    [ -x "$cand" ] && NPM="$cand" && break
  done
fi
[ -n "$NPM" ] || exit 0
CURL="/usr/bin/curl"
SSH="/usr/bin/ssh"
RECIPIENT="jnuyens"
MAIL_HOST="m1.linuxbe.com"

# --- Network connectivity check ---
# Hit a lightweight GitHub endpoint; exit silently if unreachable
$CURL -sf --max-time 5 https://api.github.com/zen >/dev/null 2>&1 || exit 0

# --- Fetch latest @vibedrift/cli version from npm ---
# Use the scoped package (@vibedrift/cli); guard with || exit 0 so a missing
# npm binary or offline state never fails the maintainer's cron.
LATEST=$($NPM view @vibedrift/cli version 2>/dev/null) || exit 0

# Validate LATEST is non-empty
if [ -z "$LATEST" ]; then
  exit 0
fi

# --- First-run handling ---
# If version file does not exist, save current version and exit (no email)
if [ ! -f "$VERSION_FILE" ]; then
  echo "$LATEST" > "$VERSION_FILE"
  exit 0
fi

# --- Version comparison ---
PREVIOUS=$(cat "$VERSION_FILE")

if [ "$LATEST" = "$PREVIOUS" ]; then
  exit 0
fi

# --- Build release URL and notes (npm package page; no API call needed) ---
RELEASE_URL="https://www.npmjs.com/package/@vibedrift/cli/v/${LATEST}"

# Attempt to fetch release notes from GitHub if the repo is known; fall back
# gracefully -- the mail is still useful without them.
RELEASE_BODY=""
VIBEDRIFT_REPO="lalalune/vibecheck"  # GitHub home for the vibedrift tooling
GH="/opt/homebrew/bin/gh"
if [ -x "$GH" ]; then
  RELEASE_BODY=$($GH api "repos/$VIBEDRIFT_REPO/releases/tags/v${LATEST}" \
    --jq '.body // ""' 2>/dev/null || true)
fi

if [ -z "${RELEASE_BODY:-}" ]; then
  RELEASE_BODY="(No release notes found for v${LATEST}. See: ${RELEASE_URL})"
fi

# Truncate oversize notes to keep mail bodies reasonable (~20 KB)
MAX_NOTES_BYTES=20000
if [ "${#RELEASE_BODY}" -gt "$MAX_NOTES_BYTES" ]; then
  RELEASE_BODY="${RELEASE_BODY:0:$MAX_NOTES_BYTES}

[truncated -- see full notes at ${RELEASE_URL}]"
fi

# --- Send notification email via SSH to mail host ---
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
BODY="VibeDrift second-upstream release detected (D-02: periodic heuristic watch).

New version:      v${LATEST}
Previous version: v${PREVIOUS}
Release URL:      ${RELEASE_URL}
Checked at:       ${TIMESTAMP}

Action: review @vibedrift/cli v${LATEST} changelog for new drift-detection
heuristics worth porting natively into GSD (the porting roadmap lives in
.planning/phases/11-drift-detection-and-consistency-gate/11-CONTEXT.md).
GSD does NOT install or invoke vibedrift at runtime (D-01).

───── Release Notes ─────────────────────────────────────────────

${RELEASE_BODY}

─────────────────────────────────────────────────────────────────
Sent by check-vibedrift-release.sh on $(hostname)"

echo "$BODY" | $SSH "$MAIL_HOST" "mail -s 'VibeDrift second-upstream release: v${LATEST} available -- review for portable heuristics' $RECIPIENT"

# --- Update version file (only after successful mail send) ---
echo "$LATEST" > "$VERSION_FILE"
