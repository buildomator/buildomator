---
date: "2026-07-23"
promoted: false
---

# Public-repo community-health advisory: design decisions

From `/bm:explore` (2026-07-23). Context for whoever builds the "advise on missing community-health files for public GitHub repos" feature (see the paired todo).

- **Two files to start:** LICENSE and SECURITY.md. Extensible to GitHub's community profile (README, CONTRIBUTING, CODE_OF_CONDUCT, issue templates) later, but scope the first cut to these two.
- **SECURITY.md flavor:** a disclosure policy (how to report a vuln), NOT a security-posture/reassurance doc. Those are different documents for different readers; the user chose the disclosure policy.
- **SECURITY channel:** GitHub native private vulnerability reporting (a repo Security-settings toggle), not a public email. Avoids spam, lives where researchers look first. Email is a fallback option only.
- **SECURITY scope / threat-model:** in-scope = attacker-controlled input executed as unintended code via a hook / gsd-tools / planning doc (command injection, path traversal, poisoned upstream artifact). Grey zone: "it ran a command" is the plugin's job, not a vuln; "ran a command embedded in an untrusted PR's planning doc without approval" is. Out of scope = the user's own commands, Claude Code / Node / user misconfiguration.
- **LICENSE logic = reconcile declared-vs-file:** if a license is already declared (manifest) but there is no LICENSE file, just add the matching file (mechanical). Only when nothing is declared do you present the choice. Never pick a license for the user; copyleft vs permissive is a genuine strategic decision.
- **Dogfood:** `buildomator/buildomator` is itself the first offender. It is public, declares `MIT` in `plugin.json` and both `marketplace.json` entries, but has NO LICENSE file (GitHub shows "no license") and no SECURITY.md.
