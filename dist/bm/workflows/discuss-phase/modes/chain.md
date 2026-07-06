# --chain mode — interactive discuss, then auto-advance

> **Lazy-loaded.** Read this file from `workflows/discuss-phase.md` when
> `--chain` is present in `$ARGUMENTS`, or when the parent's `auto_advance`
> step needs to dispatch to plan-phase under `--auto`.

## Effect

- Discussion is **fully interactive** (same as default mode).
- After discussion completes, **auto-advance to plan-phase → execute-phase**
  (same downstream behavior as `--auto`).

## auto_advance step (executed by the parent file)

1. Parse `--auto` and `--chain` flags from `$ARGUMENTS`. **Note:** `--all`
   is NOT an auto-advance trigger — it only affects area selection. A
   session with `--all` but without `--auto` or `--chain` returns to manual
   next-steps after discussion completes.

2. **Sync chain flag with intent** — if user invoked manually (no `--auto`
   and no `--chain`), clear the ephemeral chain flag from any previous
   interrupted `--auto` chain. This does NOT touch `workflow.auto_advance`
   (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false || true
   fi
   ```

3. Read consolidated auto-mode (`active` = chain flag OR user preference):
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

4. **If `--auto` or `--chain` flag present AND `AUTO_MODE` is not true:**
   Persist chain flag to config (handles direct usage without new-project):
   ```bash
   gsd-sdk query config-set workflow._auto_chain_active true
   ```

5. **Auto-advance to plan-phase.** Skip entirely if `--no-auto` is present in
   `$ARGUMENTS` (route to `confirm_creation` — the manual next-steps). Otherwise,
   when `--auto`/`--chain`/`AUTO_MODE` applies, choose the hand-off by intent:

   **a. Explicit `--auto` or `--chain` flag** (power user opted into the full silent
   chain): launch plan-phase silently via the Skill tool to keep the chain flat
   (deep Task nesting freezes — see #686):

   Banner:
   ```
   GSD ► AUTO-ADVANCING TO PLAN

   Context captured. Launching plan-phase...
   ```
   ```
   Skill(skill="gsd-plan-phase", args="${PHASE} --auto ${GSD_WS}")
   ```
   Then continue to step 6 (handle return).

   **b. Config default only** (`AUTO_MODE` true via `workflow.auto_advance`, NO
   explicit flag): do NOT silently dispatch with `--auto` — planning has genuine
   interactive scope decisions a nested `--auto` dispatch would suppress (#1009).
   Emit the /clear hand-off so plan-phase runs top-level and interactive, then STOP
   (do not dispatch, skip step 6):
   ```
   GSD ► CONTEXT CAPTURED ✓

   /clear then:

   /bm:plan-phase ${PHASE} ${GSD_WS}

   (/clear sheds the discussion transcript; plan-phase reads CONTEXT.md fresh with
    its scope prompts live. Default auto-advance keeps planning interactive — pass
    --chain for the full silent chain, or --no-auto to stop here.)
   ```

6. **Handle plan-phase return** (only after the explicit-flag silent dispatch in 5a):

   - **PHASE COMPLETE** → Full chain succeeded. Display:
     ```
     GSD ► PHASE ${PHASE} COMPLETE

     Auto-advance pipeline finished: discuss → plan → execute

     /clear then:

     Next: /bm:discuss-phase ${NEXT_PHASE} ${WAS_CHAIN ? "--chain" : "--auto"} ${GSD_WS}
     ```
   - **PLANNING COMPLETE** → Planning done, execution didn't complete:
     ```
     Auto-advance partial: Planning complete, execution did not finish.
     Continue: /bm:execute-phase ${PHASE} ${GSD_WS}
     ```
   - **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
     ```
     Auto-advance stopped: Planning needs input.
     Continue: /bm:plan-phase ${PHASE} ${GSD_WS}
     ```
   - **GAPS FOUND** → Stop chain:
     ```
     Auto-advance stopped: Gaps found during execution.
     Continue: /bm:plan-phase ${PHASE} --gaps ${GSD_WS}
     ```

7. **If none of `--auto`, `--chain`, nor config enabled:** route to
   `confirm_creation` step (existing behavior — show manual next steps).
