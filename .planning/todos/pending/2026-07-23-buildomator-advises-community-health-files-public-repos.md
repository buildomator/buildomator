---
created: 2026-07-23
title: Buildomator advises on community-health files for public GitHub repos
area: workflow
files:
  - workflows/health.md (candidate home for the advisory)
  - references/ (SECURITY.md + LICENSE templates)
---

## Idea

When the project is a public GitHub repo, Buildomator should proactively advise adding the community-health files it lacks, starting with LICENSE and SECURITY.md. It proposes; it never auto-writes.

## Detection

- Public GitHub remote: `git remote get-url origin` plus `gh repo view --json visibility` (visibility == PUBLIC).
- Missing files: no LICENSE / SECURITY.md in any GitHub-recognized location (repo root, `docs/`, `.github/`).

## LICENSE advice (reconcile declared-vs-file)

- If a license is already DECLARED (a manifest `license` field, or an SPDX id in docs) but there is NO LICENSE file, propose adding the matching LICENSE file. Not a strategic choice, the license was already picked.
- If NOTHING is declared anywhere, present the tradeoff and let the maintainer CHOOSE: GPLv3 (copyleft, keeps derivatives open, maximizes collaboration and long-term survival) vs MIT/BSD (permissive, allows proprietary reuse, shares without expecting anything back) vs other. Never pick for them. No license at all is the worst outcome: reusers do not know what they are allowed to do.

## SECURITY.md advice

- Propose a disclosure-policy SECURITY.md (not a posture doc). Channel = GitHub private vulnerability reporting (the Security tab "Report a vulnerability" flow). Frame scope around attacker-controlled input executed as unintended code (crafted planning docs or poisoned upstream artifacts driving a hook / gsd-tools / the MCP server into arbitrary shell or path traversal); out of scope = the user's own commands, Claude Code / Node itself.

## Home

- Primary: `/bm:health` advisory (it already diagnoses hygiene and offers repairs). Extensible toward GitHub's full community profile (README, CONTRIBUTING, CODE_OF_CONDUCT) later.
- Secondary: onboarding (`new-project`).

## Constraints

- Advises and proposes; never writes without confirmation. The license choice is the maintainer's genuine strategic call; adding the file for an already-declared license is mechanical.
