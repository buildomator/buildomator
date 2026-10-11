#!/bin/bash
set -euo pipefail

# Agent Skills spec watch, the fifth idea-only upstream.
# Watches agentskills.io, github.com/agentskills/agentskills, the npm
# "skills-ref" reference linter, and npm "skills" (the skills.sh consumption
# CLI). The plugin never installs or invokes skills-ref at runtime; the native
# validation subset for the plugin's own skills lives in
# bin/maintenance/check-skill-conformance.cjs. This script is an ops cron
# notifier only (watch, do not vendor): it reads npm/GitHub metadata and mails
# the maintainer when the spec or its linter moves.

# --- Configuration ---
VERSION_FILE="$HOME/.agentskills-last-known-version"
SHA_FILE="$HOME/.agentskills-last-known-sha"

# Resolve npm robustly. cron runs with a minimal PATH and npm is NOT at
# /usr/bin/npm on Homebrew macOS, so probe PATH first, then known install
# locations; exit 0 (never wedge cron) if npm is genuinely absent. The NPM,
# CURL, SSH, GH, RECIPIENT and MAIL_HOST env overrides below exist for the test
# harness to shim tool paths and never carry secrets.
NPM="${NPM:-}"
if [ -z "$NPM" ]; then
  NPM="$(command -v npm 2>/dev/null || true)"
fi
if [ -z "$NPM" ]; then
  for cand in /opt/homebrew/bin/npm /usr/local/bin/npm /opt/homebrew/opt/node@22/bin/npm; do
    [ -x "$cand" ] && NPM="$cand" && break
  done
fi
[ -n "$NPM" ] || exit 0
CURL="${CURL:-/usr/bin/curl}"
SSH="${SSH:-/usr/bin/ssh}"
GH="${GH:-/opt/homebrew/bin/gh}"
RECIPIENT="${RECIPIENT:-jnuyens}"
MAIL_HOST="${MAIL_HOST:-m1.linuxbe.com}"

# --- Network connectivity check ---
# Hit a lightweight GitHub endpoint; exit silently if unreachable.
$CURL -sf --max-time 5 https://api.github.com/zen >/dev/null 2>&1 || exit 0

# --- Authoritative signal (D-06): npm skills-ref version ---
# The spec repo cuts no releases or tags, so npm skills-ref is the authoritative
# watch signal. Guard with || exit 0 so a missing npm or offline state never
# fails the maintainer's cron.
LATEST=$($NPM view skills-ref version 2>/dev/null) || exit 0

# Validate LATEST is non-empty.
if [ -z "$LATEST" ]; then
  exit 0
fi

# Informational only: the skills.sh consumption CLI version. Shown in the mail
# body, never a trigger on its own.
SKILLS_CLI=$($NPM view skills version 2>/dev/null || true)

# --- Best-effort GitHub signal ---
# Never probe releases or tags (the repo has none; such a probe always 404s).
# Read the main commit sha instead. A missing gh or a failed call leaves SHA
# empty and the script carries on.
SHA=""
if [ -x "$GH" ]; then
  SHA=$($GH api repos/agentskills/agentskills/commits/main --jq .sha 2>/dev/null || true)
fi

# --- First-run handling ---
# If the version file does not exist, seed both state files and exit (no mail).
if [ ! -f "$VERSION_FILE" ]; then
  echo "$LATEST" > "$VERSION_FILE"
  echo "$SHA" > "$SHA_FILE"
  exit 0
fi

# --- Comparison ---
PREVIOUS=$(cat "$VERSION_FILE")
PREVIOUS_SHA=$(cat "$SHA_FILE" 2>/dev/null || true)

if [ "$LATEST" = "$PREVIOUS" ] && { [ -z "$SHA" ] || [ "$SHA" = "$PREVIOUS_SHA" ]; }; then
  exit 0
fi

# --- Build URLs ---
NPM_URL="https://www.npmjs.com/package/skills-ref/v/${LATEST}"
SPEC_URL="https://agentskills.io/specification"
COMPARE_LINE=""
if [ -n "$SHA" ] && [ -n "$PREVIOUS_SHA" ] && [ "$SHA" != "$PREVIOUS_SHA" ]; then
  COMPARE_LINE="Spec repo compare:   https://github.com/agentskills/agentskills/compare/${PREVIOUS_SHA}...${SHA}"
fi

# --- Compose subject ---
if [ "$LATEST" = "$PREVIOUS" ]; then
  SUBJECT="Agent Skills spec repo moved: main ${SHA:0:8}"
else
  SUBJECT="Agent Skills spec upstream changed: skills-ref ${LATEST} (was ${PREVIOUS})"
fi

# --- Compose body ---
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
SHA_FROM="${PREVIOUS_SHA:-(unavailable)}"
SHA_TO="${SHA:-(unavailable)}"
BODY="The Agent Skills spec upstream changed (fifth idea-only upstream watch).

===================================================================

skills-ref npm version: ${PREVIOUS} -> ${LATEST}
spec repo main sha:     ${SHA_FROM} -> ${SHA_TO}
skills.sh CLI (npm skills) version: ${SKILLS_CLI:-(unavailable)}
npm page:            ${NPM_URL}
Spec:                ${SPEC_URL}
${COMPARE_LINE}
Checked at:          ${TIMESTAMP}

===================================================================

Action: review the spec diff and the skills-ref validator for rule changes
worth porting into the native subset in
bin/maintenance/check-skill-conformance.cjs. The plugin does not install or run
skills-ref at runtime (watch, do not vendor).

Sent by check-agentskills-release.sh on $(hostname)"

# --- Send notification email via SSH to the mail host ---
echo "$BODY" | $SSH "$MAIL_HOST" "mail -s '${SUBJECT}' $RECIPIENT"

# --- Update state files (only after a successful mail send) ---
# A failed send leaves the state untouched so the next run re-notifies, matching
# the VibeDrift analog.
echo "$LATEST" > "$VERSION_FILE"
echo "$SHA" > "$SHA_FILE"
