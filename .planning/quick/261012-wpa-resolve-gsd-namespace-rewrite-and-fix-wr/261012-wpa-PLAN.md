---
quick_id: 261012-wpa
slug: resolve-gsd-namespace-rewrite-and-fix-wr
date: 2026-10-12
mode: quick
---

# Quick Task 261012-wpa: Resolve /gsd- -> /gsd: namespace rewrite + fix code-review WR-01

Two independent pieces of housekeeping, handled on the main tree (no worktree:
the git operations need human-in-the-loop reasoning about the stash, and the
tracked `.planning/` layout makes worktree isolation hazardous).

## Task 1: Commit the namespace sweep, rescue stash content, drop stash@{0}

**Starting state (verified):**
- ~48 tracked files are modified in the working tree. Confirmed these are the
  `/gsd-` -> `/gsd:` command-namespace rewrite (sampled `hooks/`, `references/`,
  `sdk/src` + `sdk/dist`).
- `stash@{0}` ("WIP on master: d2e6031") is a superset: the same sweep plus 8
  extra `.planning/` files not present in HEAD or the working tree.
- Of the 8 extras, 7 are safe to restore wholesale (unchanged since the stash
  base d2e6031): a substantive "260902 update" ledger in
  `.planning/notes/vibedrift-scan-260822.md` (the real record for quick task
  260902-0o5, whose commit a7788cb is an empty 0-byte stub) and stray-tag
  (`</content>`/`</invoke>`) cleanups in 6 archived phase docs (13-03, 13-04,
  13-VALIDATION, 15-01, 15-02, 15-RESEARCH) whose tags are still in the tree.
- The 8th, `.planning/STATE.md`, changed since the stash base, so its stash
  version is NOT restored wholesale; only its single `/gsd-new-milestone` ->
  `/gsd:new-milestone` line is applied by hand.

**Steps:**
1. Commit the working-tree namespace sweep as one atomic commit (exclude the
   untracked `gsd-bugs-housekeeping.rtf`, which is the operator's scratch notes).
2. Rescue the 7 safe stash-only files via `git checkout stash@{0} -- <files>`,
   apply the STATE.md one-liner by hand, commit as a separate "rescue" commit.
3. Drop `stash@{0}` (recoverable via reflog if ever needed).

**Done when:** working tree has no namespace-rewrite or rescued-doc changes
pending, `git stash list` is empty, and nothing unique to the stash is lost.

## Task 2: Fix code-review WR-01 (SDK bare `--validate-external` fails open)

**Finding (18-REVIEW.md WR-01):** the SDK `craftSkillAssess` handler funnels
`--validate-external` through `asString()`, which returns `undefined` for a
boolean `true` (bare flag, no directory). That hits the `=== undefined`
early-return in `assessCraftSkill`, so the SDK silently returns the base verdict
without validating. The CJS twin passes the raw `true`, trips its string/length
guard, and exits 1. This is a twin-parity divergence that fails the opt-in
security check open on the SDK path.

**Steps:**
1. In `sdk/src/query/craft-skill.ts` `craftSkillAssess`, detect
   `flags['validate-external'] === true` and throw the same
   `GSDError('--validate-external requires an existing skill directory', ...Validation)`
   the CJS twin raises, before `asString` collapses it.
2. Add a parity case to `tests/craft-skill-sdk-parity.test.cjs` that runs
   `assess <id> --validate-external` with no directory and asserts both twins
   fail identically (non-zero exit, same usage message, no npx spawn).
3. Rebuild the SDK (`npm --prefix sdk run build`), run the parity test.
4. Commit the fix + test + rebuilt dist.

## Task 3: Regenerate dist/bm so the drift gate passes

After all source changes (sweep + WR-01) are committed and the tree is clean,
run `npm run build:bm`, commit any `dist/bm` delta, and confirm
`npm run check:bm-drift` passes on a clean tree (per the dirty-tree false-fail
gotcha).

## Verification
- `git stash list` empty.
- `node tests/craft-skill-sdk-parity.test.cjs` passes (incl. new bare-flag case).
- `npm run check:bm-drift` passes on a clean tree.
- `grep -rn "/gsd-" ` over product surfaces shows no remaining command-form
  `/gsd-<verb>` references that the sweep intended to convert.
