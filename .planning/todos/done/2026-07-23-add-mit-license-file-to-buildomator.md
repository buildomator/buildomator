---
created: 2026-07-23
title: Add an MIT LICENSE file to buildomator/buildomator
area: repo-hygiene
files:
  - LICENSE
---

## Problem

`buildomator/buildomator` is a PUBLIC repo and declares `license: MIT` in `.claude-plugin/plugin.json` and both `.claude-plugin/marketplace.json` entries, but has NO LICENSE file. GitHub therefore reports "no license", and legally a reuser has no grant despite the MIT claim.

## Fix

Add a standard MIT LICENSE file at repo root: `Copyright (c) 2026 Jasper Nuyens`, standard MIT text. The license is already decided (MIT), so this is mechanical, not a strategic choice. Dogfoods the community-health advisory feature (see paired todo + note).
