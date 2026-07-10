---
name: bm:resume-at
description: Schedule a future resume of work - e.g. '/bm:resume-at 09:00', '/bm:resume-at +2h', or '/bm:resume-at 04:00 --cmd /bm:execute-phase 9'
argument-hint: "<HH:MM | ISO 8601 | +<duration>> [--cmd <command>]"
allowed-tools:
  - Skill
  - AskUserQuestion
  - Bash
---

<objective>
Schedule a future Claude Code session that automatically resumes the current GSD project at the requested time. Useful for: coming back after a usage/token cap, kicking off work overnight so HANDOFF restores the morning session, or queuing a future GSD command (e.g. `/bm:execute-phase 9` at 04:00) for off-peak quota use.

> **No-token fallback.** If you've hit your usage cap and the skill itself won't run (it needs tokens to parse args and call CronCreate), `/exit` the rate-limited session and invoke the shell wrapper from a plain terminal:
>
> ```bash
> /exit                                 # leave the rate-limited Claude session first
> gsd-resume-at 17:41                   # then schedule from your shell — no tokens consumed
> # or with explicit duration / project:
> gsd-resume-at +3h --project ~/code/myproject
> # if `gsd-resume-at` isn't on PATH:
> $CLAUDE_PLUGIN_ROOT/bin/gsd-resume-at +3h
> # or fully absolute:
> ~/.claude/plugins/cache/gsd-plugin/bm/<version>/bin/gsd-resume-at +3h
> ```
>
> Pure shell — uses `nohup sleep` for an OS-level timer, no Claude tokens consumed. macOS only for v1; the script reports if you're on another platform. Does NOT survive a reboot — for durable cross-reboot scheduling, use this skill (`/bm:resume-at`) when tokens are available. The plugin's `Stop` hook surfaces this hint automatically when it detects a rate-limit message in the transcript.

Thin wrapper: the plugin already covers the resume itself (HANDOFF.json + `/bm:resume-work`); this skill provides the scheduling on-ramp, and Claude Code's `/schedule` (or CronCreate primitive) does the durable cron storage.
</objective>

<process>

1. **Parse the time argument.** The first positional argument is the target time. Accept three forms:
   - `HH:MM` — today at that local clock time. If the time has already passed today, schedule for tomorrow at the same time.
   - ISO 8601 (e.g. `2026-04-28T08:00`, `2026-04-28T08:00:00-04:00`) — absolute timestamp. Use as-is.
   - `+<duration>` — relative offset from now. Accept `+30m`, `+2h`, `+90m`, `+1d`. Compute absolute target as `now + duration`.

   If no argument is provided, ask the user via AskUserQuestion: "When should I resume? (e.g. `09:00`, `+2h`, or `2026-04-28T08:00`)". If parsing fails, surface the input and the supported forms; do not guess.

2. **Resolve the command to schedule.** Default is `/bm:resume-work` (the plugin's standard resumption entry point — restores HANDOFF.json + STATE.md and routes to next action). If the user passed `--cmd "<command>"`, use that command instead. Useful overrides:
   - `--cmd "/bm:next"` — resume by jumping to the next workflow step (skips the status-print phase of resume-work)
   - `--cmd "/bm:execute-phase 9"` — resume directly into a specific phase
   - `--cmd "/bm:quick <task description>"` — schedule a quick task for later

3. **Schedule via Claude Code's scheduling primitive.** Use the `Skill` tool to invoke `/schedule` if the host CLI exposes it; otherwise fall back to `CronCreate` directly. Pass:
   - `prompt`: the resolved command (default `/bm:resume-work`)
   - `time`: the absolute timestamp computed in step 1 (ISO 8601, with the local timezone)
   - working directory: the current GSD project root, so the new session opens with HANDOFF.json visible

   When `/schedule`/CronCreate isn't available in the current Claude Code build, surface that explicitly — don't silently no-op. Tell the user the plugin's `resume-at` skill needs the host's scheduling support, and link them to `/schedule` documentation.

4. **Confirm what was scheduled.** Print:
   - Absolute time (local + UTC)
   - The exact command that will fire
   - The project directory the future session will open in
   - A reminder that `HANDOFF.json` is checkpointed every ≤60s during active work, so the resume reflects state from at most ~60s before this scheduling call (or from the most recent `/compact` if the session is currently idle)

5. **Optional safety nudge.** If the user did not pass `--cmd` and the current session has uncommitted dirty state (a non-empty `git status -s`), warn that a future `/bm:resume-work` will pick up *whatever HANDOFF reflects at scheduling time* — they may want to `/bm:pause-work` explicitly first to capture intent before scheduling.

</process>

<output_format>
After scheduling, emit a confirmation block:

```
✓ Resume scheduled
  When:    2026-04-27 22:00 PDT (2026-04-28 05:00 UTC)
  Command: /bm:resume-work
  Project: /Users/you/your-project
  HANDOFF: written 47s ago (auto-postool)
```

If a `/clear` boundary makes sense (long session, scheduling at the end of an active day), suggest `/clear` per `references/continuation-format.md`. Otherwise, just confirm and stop — the user is presumably about to step away.
</output_format>

<rules>
- This skill **never** advances or deletes HANDOFF.json. The scheduled session does that via `/bm:resume-work`.
- The skill **does not poll, sleep, or block** — it returns immediately after scheduling.
- If the user passes `--cmd` with a non-`/bm:` command (e.g. `/help`), pass it through anyway. Resume-at schedules; it does not gatekeep what runs.
- Times in the past (after parsing) are an error — surface the parsed timestamp and ask for a new value. Do not silently round up to "now + 1m".
- When scheduling uses CronCreate directly, prefer **one-shot** scheduling (single fire), not recurring. Recurring resume is a separate use case (`/loop` covers that).
</rules>

<notes>
- Wrapper, not reimplementation: `/schedule` and `CronCreate` already handle persistence-across-restarts, timezone math, and authorization. Resume-at only translates GSD-flavored input (`+2h`, default `/bm:resume-work`) into the form `/schedule` expects.
- Default `/bm:resume-work` (prints status and routes) over `/bm:next` (jumps straight to action): the safer choice when you might forget where you were. Override via `--cmd`.
- Complement skills: `/bm:resume-work` restores (deletes HANDOFF after), `/bm:pause-work` captures (writes HANDOFF on demand). resume-at schedules.
</notes>
