#!/bin/bash
set -euo pipefail

# Weekly self-update watch for the gsd-plugin install.
#
# Claude Code's plugin auto-update is unreliable, so this notifier compares the
# INSTALLED plugin version (highest version present in the Claude Code plugin
# cache) against the latest buildomator/buildomator GitHub release, and emails only
# when the install is actually BEHIND. Intended to run weekly from cron.
#
# Never fails cron: every external step is guarded with `|| exit 0`, and a
# missing cache / offline state exits 0 silently. First run seeds without email.

# --- Configuration ---
REPO="buildomator/buildomator"
PLUGIN_CACHE="$HOME/.claude/plugins/cache/gsd-plugin/gsd"
# Tracks the latest release we have already notified about, so a given release
# is announced once (not re-nagged weekly) while every NEW release still fires.
NOTIFIED_FILE="$HOME/.gsd-plugin-last-notified"
GH="/opt/homebrew/bin/gh"
CURL="/usr/bin/curl"
SSH="/usr/bin/ssh"
RECIPIENT="jnuyens"
MAIL_HOST="m1.linuxbe.com"

# --- Determine the installed version (highest semver dir in the plugin cache) ---
INSTALLED=""
if [ -d "$PLUGIN_CACHE" ]; then
  INSTALLED=$(ls -1 "$PLUGIN_CACHE" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1 || true)
fi
# Can't determine what's installed -> nothing to compare, exit quietly.
[ -n "$INSTALLED" ] || exit 0

# --- Network connectivity check (exit silently if offline) ---
$CURL -sf --max-time 5 https://api.github.com/zen >/dev/null 2>&1 || exit 0

# --- Fetch the latest version from TAGS, not releases ---
# This repo ships releases as git tags; the GitHub Releases feed lags behind, so
# /gsd:version and this watch both use tags as the version signal. Take the
# highest semver tag (tags come back newest-first; 100/page covers the head).
LATEST=$($GH api "repos/$REPO/tags?per_page=100" --jq '.[].name' 2>/dev/null \
  | sed 's/^v//' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1) || exit 0
[ -n "$LATEST" ] || exit 0

# --- Up to date? (installed >= latest) -> record and exit, no email ---
HIGHEST=$(printf '%s\n%s\n' "$INSTALLED" "$LATEST" | sort -V | tail -1)
if [ "$INSTALLED" = "$LATEST" ] || [ "$HIGHEST" = "$INSTALLED" ]; then
  echo "$LATEST" > "$NOTIFIED_FILE"
  exit 0
fi

# --- Installed is behind. First run seeds without email. ---
if [ ! -f "$NOTIFIED_FILE" ]; then
  echo "$LATEST" > "$NOTIFIED_FILE"
  exit 0
fi

# Already told the user about this latest release -> do not re-nag.
PREV_NOTIFIED=$(cat "$NOTIFIED_FILE" 2>/dev/null || echo "")
[ "$LATEST" = "$PREV_NOTIFIED" ] && exit 0

# --- Release notes (only fetched when we are actually going to notify) ---
RELEASE_BODY=$($GH api "repos/$REPO/releases/tags/v${LATEST}" --jq '.body // ""' 2>/dev/null || true)
[ -n "${RELEASE_BODY:-}" ] || RELEASE_BODY="(No release notes published for v${LATEST}.)"
MAX_NOTES_BYTES=20000
if [ "${#RELEASE_BODY}" -gt "$MAX_NOTES_BYTES" ]; then
  RELEASE_BODY="${RELEASE_BODY:0:$MAX_NOTES_BYTES}

[truncated — see full notes at https://github.com/${REPO}/releases/tag/v${LATEST}]"
fi

# --- Send notification email via SSH to the mail host ---
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
BODY="gsd-plugin is behind the latest release (auto-update may not have applied).

Installed version: v${INSTALLED}
Latest release:    v${LATEST}
Checked at:        ${TIMESTAMP}

To update: open Claude Code, run /plugins, refresh the gsd marketplace, and
reinstall/update gsd-plugin. Then confirm with /gsd:version.

───── Release Notes (v${LATEST}) ─────────────────────────────────

${RELEASE_BODY}

─────────────────────────────────────────────────────────────────
Sent by check-plugin-update.sh on $(hostname)"

echo "$BODY" | $SSH "$MAIL_HOST" "mail -s 'gsd-plugin update available: v${LATEST} (installed v${INSTALLED})' $RECIPIENT"

# --- Record notified version only after a successful send ---
echo "$LATEST" > "$NOTIFIED_FILE"
