---
phase: 13-buildomator-plugin
reviewed: 2026-07-07T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - bin/lib/bm-transform.cjs
  - bin/build-bm.cjs
  - tests/bm-transform.test.cjs
  - tests/build-bm-drift.test.cjs
  - tests/bm-parity.test.cjs
  - .github/workflows/check-drift.yml
  - .github/workflows/install-smoke.yml
  - RELEASING.md
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8 (plus cross-checks against the committed `dist/bm/` output and ~20 source files outside the changeset that the transform touches)
**Status:** issues_found

## Summary

`bin/lib/bm-transform.cjs` and `bin/build-bm.cjs` are well-structured, well-tested for the cases their own test suites cover, and the `--check` regenerate-and-diff design is sound (temp dir, cleanup in `finally`, no root-marketplace mutation in check mode, correct file-mode preservation for every text/shebang file). The `/gsd:` → `/bm:` command-ref rewrite itself is safe for the cases exercised in `tests/bm-transform.test.cjs` — I could not find a token outside `.planning/` that both contains a `/gsd:` substring and must survive.

However, the **hook cache-fallback stamp is not applied broadly enough**. `FALLBACK_STAMP_FILES` in `bin/build-bm.cjs` hardcodes exactly three carriers (`hooks/hooks.json`, `hooks/run-bash-hook.cjs`, `bin/check-plugin-update.sh`), but the identical `cache/gsd-plugin/gsd` fallback-resolver literal is embedded as **executed** bash in at least 19 other tracked files (5 skills, 4 agents, 10 workflows) — confirmed present, un-stamped, in the currently committed `dist/bm/` tree. This is not a rare corner case: per `CHANGELOG.md:174`, `CLAUDE_PLUGIN_ROOT` being unset is the *common* case in the Bash-tool environment, which is exactly when these fallbacks fire. I also found a second, narrower under-rewrite in the SDK's headless-prompt sanitizer that ships unmodified in `dist/bm`.

The known `tests/bm-parity.test.cjs` vs `tests/build-bm-drift.test.cjs` shared-mutable-state race is real (see WR-01) but does not currently bite CI, which runs each test as an isolated `node <file>` step.

## Critical Issues

### CR-01: `FALLBACK_STAMP_FILES` misses ~19 files that carry the same executed cache-fallback literal, so `/bm:*` commands can resolve the wrong plugin's `gsd-tools.cjs`

**File:** `bin/build-bm.cjs:62-66` (the `FALLBACK_STAMP_FILES` set), applied at `bin/build-bm.cjs:140`

**Issue:** The stamp is scoped to exactly three files. But the identical literal `cache/gsd-plugin/gsd` — the plugin-name segment `stampHookFallback` exists to rewrite — also appears as **executed** shell inside the resolver idiom `${CLAUDE_PLUGIN_ROOT:-$(ls -d "$HOME/.claude/plugins/cache/gsd-plugin/gsd/"*/ 2>/dev/null|sort -V|tail -1)}` in (confirmed via `git grep`, and confirmed still present verbatim in the committed `dist/bm/`):

- `skills/version/SKILL.md:12`
- `skills/resume-at/SKILL.md:24`
- `skills/resume-work/SKILL.md:47`
- `skills/from-gsd2/SKILL.md:24,32`
- `skills/graphify/SKILL.md:128`
- `agents/gsd-code-reviewer.md:97`
- `agents/gsd-pattern-mapper.md:151`
- `agents/gsd-phase-researcher.md:628,636`
- `agents/gsd-planner.md:877,885`
- `workflows/code-review.md:336,357`
- `workflows/complete-milestone.md:608`
- `workflows/execute-phase.md:246`
- `workflows/ingest-docs.md:49,284`
- `workflows/plan-phase.md:1605`
- `workflows/plan-review-convergence.md:78,91,220`
- `workflows/pr-branch.md:12`
- `workflows/quick.md:165`
- `workflows/ship.md:30`
- `workflows/spec-phase.md:57`

Per `CHANGELOG.md:176`, this is the documented, deliberate "versioned-dir glob" fallback that 16+ executed callsites were hardened to use specifically *because* `CLAUDE_PLUGIN_ROOT` is commonly unset in the Bash-tool environment (`CHANGELOG.md:174`). Every one of these is copied into `dist/bm` untouched, so:

- If a user has **only** `bm` installed (no `gsd`), the glob `~/.claude/plugins/cache/gsd-plugin/gsd/*/` matches nothing, the fallback expands to empty, and `node "" /bin/gsd-tools.cjs ...` fails — `/bm:resume-work`, `/bm:version`, `/bm:from-gsd2`, `/bm:graphify`, `/bm:plan-phase`, `/bm:code-review`, `/bm:complete-milestone`, `/bm:execute-phase`, `/bm:ingest-docs`, `/bm:plan-review-convergence`, `/bm:pr-branch`, `/bm:quick`, `/bm:ship`, `/bm:spec-phase`, and the `graphify`/`code-review`/`gsd-planner`/`gsd-phase-researcher`/`gsd-code-reviewer`/`gsd-pattern-mapper` agent invocations all break whenever `CLAUDE_PLUGIN_ROOT` is unset.
- If a user has **both** plugins installed, the fallback silently resolves and executes the sibling `gsd` plugin's `gsd-tools.cjs` under a `/bm:` command — cross-plugin code execution under the wrong brand, contradicting the documented design goal (RELEASING.md: "a bm-only user never gets bounced into the sibling plugin").

Neither existing gate catches this: `tests/bm-parity.test.cjs`'s "no `/gsd:` leak" check greps for the colon-form command token only (no colon in `cache/gsd-plugin/gsd`), and `tests/build-bm-drift.test.cjs` / `install-smoke.yml`'s "fallback carriers" assertions only inspect the same three hardcoded files.

**Fix:** Either (a) stamp every text file, not an allowlisted subset — `stampHookFallback` is already idempotent and a no-op on files that don't contain the literal, so there's no correctness reason to scope it — or (b) derive `FALLBACK_STAMP_FILES` from a repo-wide search for the literal at build time instead of a hand-maintained `Set`, with a test asserting the derived set has zero `cache/gsd-plugin/gsd` occurrences left anywhere in `dist/bm`:
```js
// bin/build-bm.cjs — apply unconditionally, drop the allowlist:
if (isTextFile(rel, buf)) {
  let text = stampHookFallback(rewriteCommandRefs(buf.toString('utf8')));
  fs.writeFileSync(dest, text);
  ...
}
```
Then extend `tests/bm-parity.test.cjs`'s zero-leak scan to also grep `dist/bm` for `cache/gsd-plugin/gsd` (not just `/gsd:`), so this class of gap fails CI instead of shipping silently.

### CR-02: SDK headless-prompt sanitizer still only recognizes `gsd`, so it fails to strip interactive-only `/bm:` lines from bm's own headless prompts

**File:** `sdk/src/prompt-sanitizer.ts:72` (and the compiled `sdk/dist/cli.js:39129`, both copied verbatim into `dist/bm/`)

**Issue:** `sanitizePrompt()` exists specifically to strip interactive-only command references before a prompt is sent to the headless Agent SDK (doc comment at `sdk/src/prompt-sanitizer.ts:9-10`). Its pattern is:
```ts
/^.*\/gsd[:-]\S+.*$/gm,
```
This uses a character class `[:-]`, so the literal substring `/gsd:` never appears in the source text and `rewriteCommandRefs`'s `/\/gsd:/g` scan does not touch it (confirmed: identical in `dist/bm/sdk/src/prompt-sanitizer.ts:72` and `dist/bm/sdk/dist/cli.js:39129` after a fresh build). Meanwhile every prompt-building source file (workflows, agents) *does* get its `/gsd:` command references rewritten to `/bm:` by the build. Net effect: in the `bm` package, this sanitizer strips `/gsd:`/`/gsd-` lines (which no longer exist in bm's own prompts) but does **not** strip `/bm:`/`bm-` lines (which now do exist), silently reintroducing exactly the bug class the sanitizer was written to prevent — an interactive-only instruction like "Run `/bm:thread` now and wait for the user" can leak into a headless SDK call for the bm plugin.

**Fix:** Generalize the regex so it isn't brand-specific, e.g.:
```ts
/^.*\/(?:gsd|bm)[:-]\S+.*$/gm,
```
or better, derive the brand token from the installed plugin's own manifest `name` field so the sanitizer doesn't need updating again at the next rebrand. Add a `dist/bm`-scoped regression (mirroring `sdk/src/prompt-sanitizer.test.ts`) asserting `/bm:...` lines are stripped, not just `/gsd:...` ones.

## Warnings

### WR-01: Known shared-state race between `tests/bm-parity.test.cjs` and `tests/build-bm-drift.test.cjs` (reported per review brief, not a new finding)

**File:** `tests/build-bm-drift.test.cjs:285-296` (tamper-then-rebuild-in-place on the committed `dist/bm`) vs. `tests/bm-parity.test.cjs:51-88` (reads the same committed `dist/bm` with no isolation)

**Issue:** `build-bm-drift.test.cjs`'s "`--check` exits 1 and names the path after tampering" case does `fs.appendFileSync(dist/bm/.claude-plugin/plugin.json, ' ')`, asserts `--check` fails, then rebuilds to restore. If `bm-parity.test.cjs` runs concurrently against the same filesystem path during that window (e.g. under `node --test` auto-parallelization, or any future local runner that fans out `tests/*.test.cjs`), its inventory/byte-parity/`--check` assertions can observe the tampered tree and fail for a reason unrelated to any real regression. CI is safe today only because `check-drift.yml`'s `bm-build-drift` job runs each test as its own sequential `node tests/X.test.cjs` step (`.github/workflows/check-drift.yml:138-143`).

**Severity assessment:** Low as shipped (CI sequences correctly), but a latent trap for local development and for any future CI change that switches to `node --test` or a parallel runner — the failure mode is silent/misleading (looks like a real drift bug, is actually a test-ordering artifact).

**Fix location:** Fix belongs in `build-bm-drift.test.cjs`, not `bm-parity.test.cjs`. `bm-parity.test.cjs` reading the "current committed state" is the correct, cheap behavior for a parity gate; the test that *mutates* shared state is the one that should not do so against a path other tests assume is stable. Isolate the tamper+rebuild cycle to a private temp copy (e.g. `cp -R dist/bm "$TMP"`, tamper and run `--check` against a copy, or add a `--out`/env override to `build-bm.cjs` so the integration case never touches the real committed tree) rather than defensively snapshotting from the read side.

### WR-02: The blind substring transform mutates program logic, not just prose — demonstrated in a copied maintenance script

**File:** `bin/maintenance/rewrite-command-namespace.cjs:91`, transformed into `dist/bm/bin/maintenance/rewrite-command-namespace.cjs:91`

**Issue:** `rewriteCommandRefs` (and its doc comment's safety argument at `bin/lib/bm-transform.cjs:9-15`) reasons only about *prose/command-reference* occurrences of `/gsd:`. But the transform runs over every text file's raw bytes with no syntax awareness, so it also rewrites `/gsd:` substrings that are part of program logic. Concretely, `bin/maintenance/rewrite-command-namespace.cjs` line 91:
```js
const after = before.replace(pattern, (_, name) => `/gsd:${name}`);
```
ships in `dist/bm` as:
```js
const after = before.replace(pattern, (_, name) => `/bm:${name}`);
```
This silently changes the *behavior* of the copied maintenance script (it now emits `/bm:<skill>` instead of `/gsd:<skill>` when normalizing dash-form command refs), even though that script's actual regex still only matches the dash-form `/gsd-<skill>` pattern — a pattern that has no meaning in the bm package's own maintenance lifecycle (bm isn't synced from a dash-form upstream). Low real-world impact here specifically (nobody is expected to run this maintenance script from inside `dist/bm`), but it is a concrete, reproducible instance of the exact risk class flagged in the review brief: the transform cannot currently distinguish "a command reference that should follow the brand" from "a code-logic string literal that should not."

**Fix:** No single mechanical fix is free, but at minimum: (a) note this residual risk explicitly in `bin/lib/bm-transform.cjs`'s doc comment instead of asserting unconditional safety, and (b) add this file to a small "known non-command-ref occurrences" exclusion/assertion in `tests/bm-transform.test.cjs` or `tests/bm-parity.test.cjs` so a reviewer notices if the set of affected files grows.

### WR-03: Brittle exact-occurrence-count assertions create maintenance friction unrelated to real regressions

**File:** `tests/build-bm-drift.test.cjs:192-204`; `.github/workflows/install-smoke.yml:216-229`

**Issue:** Both the local test and the CI smoke step hardcode exact counts (`17`, `1`, `1`, `1`, `1`) of `cache/gsd-plugin/bm` / `cache/gsd-plugin/gsd` occurrences in `hooks/hooks.json` and `hooks/run-bash-hook.cjs`. Any future unrelated edit to `hooks.json` that adds or removes one resolver (or reformats it) will fail these gates for a reason that has nothing to do with the bm transform actually breaking.

**Fix:** Assert the invariant that actually matters — `count(gsd-form) === 0 && count(bm-form) >= 1` — rather than an exact literal count:
```js
if (count(hooks, 'cache/gsd-plugin/gsd') !== 0) fail('hooks.json still has gsd-path fallbacks');
if (count(hooks, 'cache/gsd-plugin/bm') < 1) fail('hooks.json has no bm-path fallbacks');
```

### WR-04: GSD housekeeping metadata (plan ID) leaked into a CI workflow comment

**File:** `.github/workflows/install-smoke.yml:113`

**Issue:** `# Proves the committed dist/bm package (from plan 12-01) resolves its own` embeds a `.planning/` plan ID directly in a shipped CI workflow comment (this file is also copied byte-for-byte into `dist/bm/.github/workflows/install-smoke.yml`), which is exactly the pattern `CLAUDE.md`'s "Generated Code Hygiene" rule prohibits ("No phase/plan numbers ... in product source or comments"). Note for attribution: this line predates phase 13 (introduced in commit `fbaca8b`, phase 12) and was not touched by phase 13's commit (`38b492b` only added lines below it) — it is not a new regression from this phase, but it is still present in a file phase 13 modified and is worth cleaning up while the file is being touched.

**Fix:** Reword without the plan ID, e.g. "Proves the committed `dist/bm` package resolves its own SDK and hooks entirely via `${CLAUDE_PLUGIN_ROOT}`."

## Info

### IN-01: The distributed `dist/bm` package ships the full dev/CI toolchain, and its packaged docs retroactively narrate gsd history using post-rewrite `/bm:` names

**File:** `bin/build-bm.cjs:49` (`EXCLUDE_ROOTS`); `dist/bm/CHANGELOG.md`, `dist/bm/.github/`, `dist/bm/tests/`, `dist/bm/RELEASING.md`, `dist/bm/package-lock.json`

**Issue:** `shouldExclude()` only excludes `.git`, `.planning`, `.claude`, `node_modules`, `dist`, `scratchpad` at the top level, so `.github/workflows/`, the entire `tests/` suite, `RELEASING.md`, `package-lock.json`, `.vibedriftignore`, `.gsd/` etc. all ship inside the installable `dist/bm` plugin bundle. This mirrors how the root `gsd` plugin already ships (marketplace source `./`), so it isn't a regression introduced by this phase, but it means the same bloat is now duplicated into a second distributed package. Additionally, because the rewrite runs over `CHANGELOG.md`/`RELEASING.md` uniformly, historical entries are rewritten to describe past `gsd`-era features using `/bm:` (e.g. a `dist/bm/CHANGELOG.md` entry about a feature that shipped under `/gsd:scan --drift` long before `bm` existed now reads "Surfaced through `/bm:scan --drift`"), which could read as confusing/inaccurate history to a bm-only user inspecting their installed package's changelog.

**Fix:** Optional polish, not a blocker: consider excluding `.github/`, `tests/`, `package-lock.json`, `RELEASING.md` from the shipped package (for both plugins), or leave `CHANGELOG.md`/other purely-historical docs out of the command-ref rewrite pass so they retain their as-shipped-at-the-time command names.

### IN-02: Personal cron notifier ships with hardcoded infra details in both distributed packages

**File:** `bin/check-plugin-update.sh:20-24`

**Issue:** Hardcoded `GH=/opt/homebrew/bin/gh`, `SSH=/usr/bin/ssh`, `RECIPIENT="jnuyens"`, `MAIL_HOST="m1.linuxbe.com"` — a personal, author-only maintenance script that is not part of the plugin's Claude Code runtime surface, but is nonetheless copied (stamped) into both `dist/bm` and the root package. Pre-existing, not introduced by this phase; flagged for awareness only since the bm build doubles its distribution footprint. No action required unless the intent is for `check-plugin-update.sh` to become a general-purpose end-user script.

---

_Reviewed: 2026-07-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
