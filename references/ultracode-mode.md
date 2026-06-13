# Ultracode mode (`workflow.ultracode`)

Ultracode mode runs the GSD commands where multi-agent fan-out genuinely pays
off at maximum depth instead of their default, brevity-tuned fan-out: more
parallel agents, the full set of dimensions, and an adversarial verification
pass over the results before finalizing.

It is a **signal, not a mechanism**. A plugin cannot trigger Claude Code's
multi-agent Workflow orchestration on the user's behalf, so this does not spawn
anything by itself. It tells the orchestrating agent to run the good-fit
commands below at full depth. The agent honors it using the fan-out the workflow
already supports (parallel mappers, review dimensions, reviewer panels).

## When it is active (auto until 2026-06-22, then opt-in)

Ultracode is **on automatically through 2026-06-22**, because the deeper runs are
included during that window. **After 2026-06-22 it is off by default**, because it
becomes extra-paid. An explicit config value overrides the window in either
direction. (This 2026-06-22 cost window is independent of the Claude Fable 5
tier, which was withdrawn earlier on 2026-06-12.)

Each good-fit workflow resolves the state with this gate:

```bash
ULTRA=$(gsd-sdk query config-get workflow.ultracode --default auto 2>/dev/null || echo auto)
TODAY=$(date +%F)
# active when: ULTRA = "true"  (explicit opt-in, even after the window), OR
#              ULTRA != "false" AND TODAY <= 2026-06-22
```

| `workflow.ultracode` | On/before 2026-06-22 | After 2026-06-22 |
|----------------------|----------------------|------------------|
| unset (`auto`) | **active** | inactive |
| `true` | active | **active** (user accepts the extra cost) |
| `false` | inactive | inactive |

- **Runtime:** Claude Code only. This plugin targets Claude Code; the signal is
  not wired to any non-Claude runtime.
- **Override:** `gsd-sdk query config-set workflow.ultracode true|false` (or via
  `/gsd:settings`). Leave it unset to get the automatic window behavior.

## Good-fit commands

The signal is wired into the first three; the rest already run at full fan-out
and are listed so users know ultracode does not change them.

| Command | Default behavior | Under ultracode |
|---------|------------------|-----------------|
| `/gsd:map-codebase` | Spawns the standard mapper set | Spawn the **full** mapper set (never a trimmed subset) and reconcile overlapping findings before writing the summary |
| `/gsd:code-review` | Reviews the changed files at the configured depth | Run **every** review dimension regardless of depth, then adversarially refute each finding before reporting |
| `/gsd:review` (plan-review convergence) | Single reviewer panel, one convergence pass | Add a second, independent reviewer panel and an extra convergence pass; keep findings only when panels agree |
| `/gsd:execute-phase` | Already wave-parallel | Unchanged (already maximal) |
| `/gsd:new-project` research | Already runs 4 parallel researchers | Unchanged (already maximal) |

## Not a good fit

Commands that are inherently sequential, single-shot, or cheap (for example
`/gsd:note`, `/gsd:add-todo`, `/gsd:fast`, `/gsd:settings`) ignore the signal.
Fanning them out adds cost without improving the result.
