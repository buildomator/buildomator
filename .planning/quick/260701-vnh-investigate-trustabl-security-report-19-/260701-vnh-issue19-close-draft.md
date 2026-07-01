# Reply for issue #19 (closed as not-a-vulnerability / by design)

> POSTED + CLOSED 2026-07-01 (not-planned); comment
> https://github.com/jnuyens/gsd-plugin/issues/19#issuecomment-4860161607
> Posted text omits the final "Thanks again for the report." sentence below.

---

Thanks for taking the time to scan the repo and file this, Joshua.

I looked into it carefully, and this isn't a security vulnerability; it's a mischaracterization of documented Claude Code behavior. Closing as by-design, with the reasoning below in case it's useful for tuning the scanner.

**What the flagged skills actually declare**

`add-backlog`, `add-phase`, and `add-tests` each list `Bash` in their `allowed-tools` frontmatter. There is no `bypassPermissions`, no `--dangerously-skip-permissions`, and no auto-approve setting anywhere in them.

**What `allowed-tools` actually does (per the Claude Code docs)**

`allowed-tools` lets a skill use the listed tools "without asking permission when this skill is active." Two things follow from that:

1. It only suppresses the per-command prompt **while a skill the user explicitly invoked is running**, and only for the listed tools. It is not a background or global grant.
2. A plugin or skill **cannot** set permission modes (`bypassPermissions`), write `allow`/`deny` rules, or pass CLI danger flags. Those live in the end user's `settings.json` and permission mode. Enforcement is entirely the user's, not the skill's.

So "auto-approves unrestricted shell access ... can execute any shell command without user intervention" isn't accurate. The user intervention is the invocation: `/gsd:add-backlog` is a slash command the user types. Nothing runs remotely, in the background, or without the user launching it.

**Why these three skills aren't special**

83 of the 86 skills declare `Bash`, because they run `gsd-sdk` queries and `git` (for example, add-backlog runs `gsd-sdk query phase.next-decimal 999`). Flagging 3 of 83 for a pattern that is both the norm and required for the skills to function suggests the rule is matching on the mere presence of `allowed-tools: Bash` rather than on an actual permission bypass.

The trust boundary here is the standard one for any Claude Code plugin: do you trust these (source-visible) skills when you choose to run them? That's the same decision as installing any plugin that automates git or builds, and it is gated by the user invoking the command.

Happy to reopen if there's a concrete case where shell runs without the user invoking a skill; that would be a genuine issue. Thanks again for the report.
