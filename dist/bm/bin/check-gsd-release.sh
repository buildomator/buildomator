#!/bin/bash
set -euo pipefail

# --- Configuration ---
# Upstream moved twice: gsd-build/get-shit-done (original, now locked) ->
# open-gsd/get-shit-done-redux (May 2026 community continuation) ->
# open-gsd/gsd-core (the repo + npm package @opengsd/gsd-core we now track).
# get-shit-done-redux still mirrors the same release tags, but gsd-core is the
# source of truth, so the release watch points here.
REPO="open-gsd/gsd-core"
VERSION_FILE="$HOME/.gsd-last-known-version"
GH="/opt/homebrew/bin/gh"
CURL="/usr/bin/curl"
SSH="/usr/bin/ssh"
RECIPIENT="jnuyens"
MAIL_HOST="m1.linuxbe.com"

# --- Network connectivity check ---
# Hit a lightweight GitHub endpoint; exit silently if unreachable
$CURL -sf --max-time 5 https://api.github.com/zen >/dev/null 2>&1 || exit 0

# --- Fetch latest release tag ---
LATEST=$($GH api "repos/$REPO/releases/latest" --jq '.tag_name' 2>/dev/null) || exit 0

# Strip leading "v" if present
LATEST="${LATEST#v}"

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

# --- Fetch release title and body (second API call — only fires on a version change) ---
RELEASE_TITLE=$($GH api "repos/$REPO/releases/tags/v${LATEST}" --jq '.name // .tag_name // empty' 2>/dev/null || true)
RELEASE_BODY=$($GH api "repos/$REPO/releases/tags/v${LATEST}" --jq '.body // ""' 2>/dev/null || true)

if [ -z "${RELEASE_BODY:-}" ]; then
  RELEASE_BODY="(No release notes published for v${LATEST}.)"
fi

# Truncate oversize notes to keep mail bodies reasonable (~20 KB)
MAX_NOTES_BYTES=20000
if [ "${#RELEASE_BODY}" -gt "$MAX_NOTES_BYTES" ]; then
  RELEASE_BODY="${RELEASE_BODY:0:$MAX_NOTES_BYTES}

[truncated — see full notes at https://github.com/${REPO}/releases/tag/v${LATEST}]"
fi

# --- Send notification email via SSH to mail host ---
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
BODY="New GSD upstream release detected.

New version:      v${LATEST}
Previous version: v${PREVIOUS}
Release title:    ${RELEASE_TITLE:-v${LATEST}}
Release URL:      https://github.com/${REPO}/releases/tag/v${LATEST}
Checked at:       ${TIMESTAMP}

───── Release Notes ─────────────────────────────────────────────

${RELEASE_BODY}

─────────────────────────────────────────────────────────────────
Sent by check-gsd-release.sh on $(hostname)"

echo "$BODY" | $SSH "$MAIL_HOST" "mail -s 'GSD upstream release: v${LATEST} available (was v${PREVIOUS})' $RECIPIENT"

# --- Update version file (only after successful mail send) ---
echo "$LATEST" > "$VERSION_FILE"
