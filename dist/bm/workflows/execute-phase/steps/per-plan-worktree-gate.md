# Per-plan worktree decision (#2772)

Run this for **each plan in the current wave** before its `Agent()` dispatch. The output `USE_WORKTREES_FOR_PLAN` gates the dispatch branch (worktree mode vs sequential mode) for that plan only — other plans in the same wave can still take the worktree path.

`SUBMODULE_PATHS` is computed once in the `initialize` step (parsed from `.gitmodules`).

`PLAN_FILES` is the whitespace-separated list of paths the plan declared it will touch, from the `phase-plan-index` JSON loaded in `discover_and_group_plans`:

```bash
# plan_json: JSON object for this plan from PLAN_INDEX.plans[]; files_modified is an array of paths/globs
PLAN_FILES=$(jq -r '.files_modified // [] | join(" ")' <<<"$plan_json")
plan_id=$(jq -r '.id' <<<"$plan_json")
```

Then run the per-plan gate:

```bash
USE_WORKTREES_FOR_PLAN="$USE_WORKTREES"

if [ -n "$SUBMODULE_PATHS" ] && [ "$USE_WORKTREES_FOR_PLAN" != "false" ]; then
  if [ -z "$PLAN_FILES" ]; then
    # Planned paths unknown/unparseable — safe fallback: disable worktree isolation for this plan.
    echo "[worktree] Plan ${plan_id}: files_modified missing/unparseable — disabling worktree isolation as a safety fallback (submodule project)"
    USE_WORKTREES_FOR_PLAN=false
  else
    # Glob-safe intersection: normalize both sides (strip leading "./", trailing "/") and match
    # bidirectionally so "vendor/**/*.c" matches submodule "vendor/foo", and "./vendor/foo/bar.c" too.
    INTERSECT=""
    set -f  # disable globbing while iterating literal patterns
    for sm_raw in $SUBMODULE_PATHS; do
      # Normalize submodule path: strip ./ prefix and trailing /
      sm="${sm_raw#./}"
      sm="${sm%/}"
      [ -z "$sm" ] && continue
      for pf_raw in $PLAN_FILES; do
        # Normalize planned path the same way
        pf="${pf_raw#./}"
        pf="${pf%/}"
        [ -z "$pf" ] && continue
        matched=0
        # Direction 1: planned path is the submodule or lies inside it
        case "$pf" in
          "$sm"|"$sm"/*) matched=1 ;;
        esac
        # Direction 2: submodule lies inside the planned path (e.g. plan declares "vendor")
        if [ "$matched" -eq 0 ]; then
          case "$sm" in
            "$pf"|"$pf"/*) matched=1 ;;
          esac
        fi
        # Direction 3: planned path is a glob — strip wildcards, check prefix overlap both ways.
        if [ "$matched" -eq 0 ]; then
          case "$pf" in
            *'*'*|*'?'*|*'['*)
              # Literal prefix before the first glob metachar.
              prefix="${pf%%[*?[]*}"
              prefix="${prefix%/}"
              if [ -n "$prefix" ]; then
                case "$sm" in
                  "$prefix"|"$prefix"/*) matched=1 ;;
                esac
                if [ "$matched" -eq 0 ]; then
                  case "$prefix" in
                    "$sm"|"$sm"/*) matched=1 ;;
                  esac
                fi
              fi
              ;;
          esac
        fi
        if [ "$matched" -eq 1 ]; then
          INTERSECT="$INTERSECT $pf_raw"
        fi
      done
    done
    set +f
    if [ -n "$INTERSECT" ]; then
      echo "[worktree] Plan ${plan_id}: planned paths intersect submodule paths (${INTERSECT# }) — disabling worktree isolation for this plan"
      USE_WORKTREES_FOR_PLAN=false
    fi
  fi
fi
```

After running this for the plan, the dispatch branches in `execute_waves` step 3 MUST gate on `USE_WORKTREES_FOR_PLAN` for the current plan, not on the project-level `USE_WORKTREES`. Track which plans in this wave used worktrees (append `plan_id` to a `WAVE_WORKTREE_PLANS` accumulator when `USE_WORKTREES_FOR_PLAN != false`) — the post-wave cleanup step (5.5) uses this to decide whether worktree-merge cleanup is needed.
