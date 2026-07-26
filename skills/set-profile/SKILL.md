---
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget/inherit)
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

Show the following output to the user verbatim, with no extra commentary:

!`SDK="$(command -v bm-sdk || command -v gsd-sdk)"; if [ -z "$SDK" ]; then printf '⚠ bm-sdk not found in PATH, /gsd:set-profile requires it (gsd-sdk also works as an alias).\n\nInstall the GSD SDK:\n  npm install -g @gsd-build/sdk\n\nOr update GSD to get the latest packages:\n  /gsd:update\n'; exit 1; fi; "$SDK" query config-set-model-profile $ARGUMENTS --raw`
