---
created: 2026-07-23
title: Add a SECURITY.md disclosure policy to buildomator/buildomator
area: repo-hygiene
files:
  - SECURITY.md
---

## Problem

`buildomator/buildomator` is public but has no SECURITY.md, so there is no clear private channel for reporting a vulnerability in a plugin that runs code on users' machines (session hooks, the MCP server, gsd-tools, git operations).

## Fix

Add a disclosure-policy SECURITY.md: reporting via GitHub private vulnerability reporting (enable it in the repo's Security settings first), supported versions = the latest release line, scope framed around attacker-controlled input executed as unintended code. See the design note `public-repo-community-health-advisory` for the threat-model wording. Dogfoods the advisory feature.
