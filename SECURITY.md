# Security Policy

Buildomator is a Claude Code plugin that runs code on your machine: session hooks, an MCP server, the `gsd-tools` CLI, and git operations. Reports about that surface are welcome.

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue or discussion.

Use GitHub's private vulnerability reporting: go to the repository's **Security** tab and click **Report a vulnerability**. That opens a private advisory visible only to the maintainer.

This is a solo-maintained project, so response times are best effort. You will get an acknowledgement as soon as it is seen, and a fix or a decision as quickly as is practical. If a report is valid and you would like credit, say so and you will be credited in the advisory and release notes.

## Supported versions

Only the latest released version line receives security fixes. Please reproduce on the current release before reporting.

## Scope

**In scope:** the plugin executing attacker-controlled input as code you did not intend. For example, a crafted planning document (`PLAN.md`, `ROADMAP.md`, `STATE.md`) or a poisoned upstream artifact that drives a hook, `gsd-tools`, or the MCP server into arbitrary shell execution, or into reading or writing files outside the project.

**Out of scope:** commands you deliberately run yourself (running commands and editing files under your direction is the plugin's job), your own misconfiguration, and vulnerabilities in Claude Code, Node.js, or other upstream software rather than in Buildomator's own code.
