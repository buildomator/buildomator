---
quick_id: 260701-vnh
type: security-investigation
date: 2026-07-01
status: complete
---

# Investigation: Issue #19 "Critical: Multiple Skills Auto-Approve Unrestricted Shell"

## The report
`joshua-trustabl` (Trustabl scanner, first-time outside reporter, 2026-07-01) filed
a **Critical** claim: `skills/add-backlog`, `skills/add-phase`, `skills/add-tests`
"contain a skill configuration that auto-approves unrestricted shell access ...
can execute any shell command without user intervention." The issue is largely
Trustabl product marketing (`brew install trustabl/tap/trustabl`, `trustabl scan ...`).

## What the files actually contain
All three declare only `allowed-tools:` including `Bash` (add-tests also Edit/Glob/
Grep/Task/AskUserQuestion). **No** `bypassPermissions`, `--dangerously-skip-permissions`,
`acceptEdits`, or any auto-approve/permission field exists anywhere in them.

## Verified mechanism (Claude Code docs, via claude-code-guide)
- `allowed-tools:` = "tools Claude can use **without asking permission when this
  skill is active**" (code.claude.com/docs/en/skills.md). It suppresses the
  per-command permission prompt **only while that user-invoked skill runs**, and
  **only for the listed tools**.
- It is NOT a global auto-approval. A plugin/skill **cannot** set permission modes
  (`bypassPermissions`), write `allow`/`deny` rules, or pass CLI danger flags —
  those are strictly the END USER's settings (see [[reference_cc_plugin_no_permissions]],
  [[reference_cc_tool_grant_semantics]]). Enforcement lives in the user's
  settings/permission-mode, not the skill.

## Verdict: MISCHARACTERIZED severity — theoretical/low, not a real "Critical"

The scanner's technical kernel is real (Bash runs unprompted *while these
user-invoked skills are active*), but the "Critical unrestricted shell without
user intervention" framing is wrong, because:

1. **User invocation IS the intervention/consent.** These are slash commands the
   user explicitly types (`/gsd:add-backlog`). Nothing runs in the background or
   remotely; there is no trigger without the user launching the command.
2. **It's documented, intended behavior** of `allowed-tools` for user-invoked
   commands — suppressing per-step prompts so a workflow the user launched isn't
   interrupted 20 times. Not a bypass or exploit.
3. **It's the standard pattern, not a defect in 3 files.** 83 of 86 GSD skills
   declare Bash — they must, to run `gsd-sdk`/git (e.g. add-backlog runs
   `gsd-sdk query phase.next-decimal 999`). The scanner flagged an arbitrary 3 of 83.
4. **No privilege escalation / no silent execution / no remote vector.** The trust
   boundary is "do you trust this plugin's (source-visible) skills when you run
   them" — the same trust decision as any plugin that automates git/build, not a
   gsd-plugin-specific vulnerability.

**So: more theoretical than real.** Severity is not Critical. The only genuine
kernel is the generic Claude-Code plugin trust model (a user-invoked skill with
`allowed-tools: Bash` runs its bash unprompted), which applies to essentially all
workflow plugins and is gated by explicit invocation.

## Scoped-Bash hardening: EXPLORED, and REJECTED (useless overhead)

Explored narrowing `allowed-tools: Bash` -> `Bash(gsd-sdk:*)` etc. across the 83
skills. Verdict: **do not do it.**

1. **Wrong layer / unproven.** The `Bash(cmd:*)` prefix grammar belongs to
   `settings.json` `permissions.allow`/`deny` (user-controlled) — the only repo
   occurrences are in `skills/bundled/updateConfig.ts`, which DOCUMENTS that
   settings syntax. A plugin cannot set those (reference_cc_plugin_no_permissions).
   Skill-frontmatter `allowed-tools` is documented as tool NAMES; the granular
   `Bash(...)` form is not confirmed to be honored there at all.
2. **No enforcement uplift even if it worked.** `allowed-tools` only suppresses
   prompts; it does not enforce. Scoping would just re-introduce prompts for
   un-listed commands — it can't stop a malicious one. The user already consented
   by invoking the slash command.
3. **Real, recurring cost for a non-vuln.** The shell surface is broad and diverse
   per skill (gsd-sdk/git/node/jq/mkdir/rm/awk/sed/find/python3/mail/...).
   Enumerating each skill's command allow-list across 83 skills = large, brittle
   frontmatter loaded on every invocation (violates minimize-workflow-tokens,
   [[feedback_minimize_workflow_tokens]]) and breaks every time a skill adds a
   command -> prompt storms / failures. Pure overhead to appease a naive scanner.

**Cheaper, real alternative (opt-in, zero per-skill bloat):** document a
`settings.json` deny snippet for genuinely destructive commands (e.g.
`"deny": ["Bash(rm -rf:*)"]`) in the README — the additive-doc pattern
(reference_cc_plugin_no_permissions), which the updateConfig skill already
teaches. That reduces blast radius without touching any skill frontmatter. Even
this is optional; the primary action is to close #19 with the explanation.

## Recommended response to #19
Not a real vulnerability at the stated severity; safe to close with a courteous
explanation (documented allowed-tools behavior, user-invoked, no bypass, 83/86
skills), optionally noting the scoped-Bash hardening as a future consideration.
Draft prepared for the user; do not auto-post (outside reporter / third-party norm).
