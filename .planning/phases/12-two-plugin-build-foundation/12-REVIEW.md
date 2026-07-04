---
phase: 12-two-plugin-build-foundation
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - .claude-plugin/marketplace.json
  - .github/workflows/check-drift.yml
  - .github/workflows/install-smoke.yml
  - RELEASING.md
  - bin/build-bm.cjs
  - bin/maintenance/check-file-layout.cjs
  - bin/maintenance/check-version-alignment.cjs
  - bin/maintenance/rewrite-command-namespace.cjs
  - package.json
  - tests/build-bm-drift.test.cjs
  - tests/version-alignment.test.cjs
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-04
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the generate-and-stamp build (`bin/build-bm.cjs`), its drift `--check` mode, the version-single-sourcing guard (`check-version-alignment.cjs`), the two CI jobs (`bm-build-drift`, `bm-package-smoke`), the exclusion updates in `check-file-layout.cjs` / `rewrite-command-namespace.cjs`, and the two test suites.

The core build/stamp logic is sound and well-tested. I ran both test suites (`build-bm-drift.test.cjs`, `version-alignment.test.cjs`) and `build-bm.cjs --check` — all green, and the committed `dist/bm` matches a fresh build. Exclusion logic (`shouldExclude`, the `dist/` skip in both maintenance detectors) correctly prevents self-nesting and untracked-file leakage. I specifically probed the two most likely traps and cleared them:

- The `grep -q ... && { exit 1; }` tripwire lines in `install-smoke.yml` under `set -e` do NOT abort on the no-match (success) path — `set -e` is suppressed for the left side of an `&&` list, so the smoke job proceeds correctly. Not a bug.
- `git ls-files -z` in `build-bm.cjs` is NUL-delimited and safe against odd filenames.

The findings below are robustness gaps and consistency issues, not correctness defects in the happy path. The most material one is a version site (`package.json`) that no guard covers and that is already stale.

## Warnings

### WR-01: `package.json` version (2.45.0) is stale and no guard catches it

**File:** `package.json:3`, cross-ref `bin/maintenance/check-version-alignment.cjs:156-169`, `RELEASING.md:20`
**Issue:** The phase's headline claim is version single-sourcing (D-08): "every manifest site stays in lockstep." But `check-version-alignment.cjs` only reads `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `dist/bm/.claude-plugin/plugin.json`. `package.json` is a fourth version site and it currently reads `2.45.0` while the product is `4.0.4` — a two-major drift that no check flags. RELEASING.md step 4 tells the releaser to bump only `plugin.json`, so `package.json` will stay frozen at 2.45.0 indefinitely. This undercuts the "impossible to forget" framing: it is a version site that is both un-guarded and already wrong.
**Fix:** Either (a) add `package.json` to the parity set in `collectVersionMismatches` / the caller (read `package.json` version, compare to `pluginVersion`), or (b) if `package.json` version is deliberately decoupled (it is `private: true`, never published), document that decision in RELEASING.md and add a one-line comment in `check-version-alignment.cjs` stating package.json is intentionally out of scope, so a future maintainer does not assume it is covered.

### WR-02: `--check` cannot detect a stale `dist/bm` file whose source was deleted but whose stale copy is still git-tracked in `dist/bm`

**File:** `bin/build-bm.cjs:166-209` (`check`), `104-120` (`generate`)
**Issue:** `check()` regenerates into a temp dir and diffs against committed `dist/bm`. `generate()` starts with `fs.rmSync(outDir, {recursive, force})` on the temp dir, so the fresh tree only contains current source. The "extra in dist/bm" branch (lines 195-197) does catch a committed file with no fresh counterpart — good. However, the real-build path writes into `root/dist/bm` and also `rmSync`s first, so a source-file deletion is handled on rebuild. The gap is narrower: `listFiles(committed)` walks the on-disk `dist/bm`, but the committed tree is what git tracks. If a maintainer deletes a source file, rebuilds locally (removing the stale copy on disk), but forgets to `git add -A dist/bm` (so the deletion is not staged), CI checks out the still-tracked stale file and `--check` correctly flags it as "extra." This path is actually covered. The genuine residual risk is only if `dist/bm` on disk and in the index diverge locally; CI is safe. Downgrade acknowledged — but worth a guard note.
**Fix:** No code change strictly required for CI correctness. Recommend adding a test case to `build-bm-drift.test.cjs` that plants an orphan file under `dist/bm` and asserts `--check` exits 1 naming it "extra", to lock in the branch at lines 195-197 (currently only the "differs"/"missing" branches are exercised by the tamper test at 213-224).

### WR-03: `generate()` does not verify git ls-files succeeded before wiping `dist/bm`

**File:** `bin/build-bm.cjs:95-102` (`includedFiles`), `105-106` (`generate`)
**Issue:** `generate()` calls `fs.rmSync(outDir, {recursive, force: true})` at line 106 BEFORE iterating `includedFiles(root)`. `includedFiles` uses `execFileSync('git', ['ls-files', '-z'])`, which throws if git is absent or the repo is corrupt. Because the destructive `rmSync` runs first, a git failure leaves the developer with a wiped `dist/bm` and no rebuild — the committed package is destroyed on disk before the source list is even obtained. `execFileSync` throwing after the wipe means the process exits non-zero with `dist/bm` gone.
**Fix:** Compute the file list before the destructive wipe:
```js
function generate(root, outDir) {
  const files = includedFiles(root); // may throw — do this first
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of files) { /* ... */ }
```
This keeps the committed tree intact if git enumeration fails.

### WR-04: Marketplace `bm` description branding is hand-maintained and can silently drift from the stamped manifest

**File:** `.claude-plugin/marketplace.json:28`, cross-ref `bin/build-bm.cjs:72-82` (`stampBmManifest`), `127-142` (`syncMarketplaceVersions`)
**Issue:** `syncMarketplaceVersions` rewrites ONLY the `version` field of each marketplace entry. The `bm` entry's `description` ("Buildomator -- structured workflow plugin...") and `displayName` are hand-authored and never synced. `stampBmManifest` independently derives the manifest description ("Buildomator -- a structured workflow plugin...") from `plugin.json`. The two strings already differ ("structured" vs "a structured"), and nothing keeps them consistent. If the gsd description is reworded, the stamped `dist/bm` manifest updates automatically but the marketplace `bm` entry stays frozen, with no guard catching the divergence.
**Fix:** Either sync the marketplace `bm`/`gsd` descriptions from `plugin.json` in `syncMarketplaceVersions` (rename it, or add a description-sync pass), or add the marketplace descriptions to a parity assertion. If the two descriptions are intentionally allowed to differ, note that in the build-bm header so it is not read as a bug later.

## Info

### IN-01: `stampBmManifest` sets `version` redundantly and appends `displayName` out of natural position

**File:** `bin/build-bm.cjs:75-81`
**Issue:** The returned object spreads `...srcManifest` (which already carries `version`) and then sets `version: srcManifest.version` again — a no-op. Separately, because the source `plugin.json` has no `displayName` key, the spread-then-override places `displayName` last in the emitted JSON (line 26 of the generated manifest), after `mcpServers`, rather than near `name`/`description`. Harmless (the build is byte-stable and `--check` passes), but the redundant `version:` line reads as if it does something.
**Fix:** Drop the redundant `version: srcManifest.version` line. Optionally place `displayName` explicitly for readable key ordering.

### IN-02: Inconsistent git-enumeration robustness between build-bm and the two maintenance detectors

**File:** `bin/build-bm.cjs:96` (uses `git ls-files -z`), vs `bin/maintenance/check-file-layout.cjs:92` and `bin/maintenance/rewrite-command-namespace.cjs:66` (both use `git ls-files` split on `\n`)
**Issue:** `build-bm.cjs` correctly uses NUL-delimited `-z` output, immune to filenames with newlines or the C-style quoting git applies to non-ASCII paths. The two detectors split plain `git ls-files` on `\n`, so a tracked path containing a newline (or a quoted unicode path) would be mis-parsed. Low practical risk in this repo, but the new `dist/` skip added to both detectors this phase touches that same code path, and the two scripts now disagree with build-bm on enumeration safety.
**Fix:** For consistency and robustness, migrate both detectors to `git ls-files -z` split on `\0` when they are next touched. Not urgent given the current tracked-file set.

### IN-03: `install-smoke.yml` bm smoke omits a "Test 2" and the numbering skips

**File:** `.github/workflows/install-smoke.yml:142,154` ("bm Test 1", then "bm Test 3")
**Issue:** The bm smoke steps are labelled "bm Test 1", then "bm Test 3" (line 154) — there is no "bm Test 2". The gsd job it mirrors has a Test 2 (PATH-based resolution). The skip is presumably deliberate (bm does not re-test PATH resolution), but the gap in numbering reads like a dropped step and invites a "did we lose a test?" question on every review.
**Fix:** Either renumber the bm steps contiguously (Test 1, Test 2, ...) or add a one-line comment at line 154 stating Test 2 (PATH resolution) is intentionally not duplicated for bm because it is package-identity-independent.

### IN-04: `--check` marketplace-parity loop reports `entry.name || '?'` but never asserts the entry has a name

**File:** `bin/build-bm.cjs:180-184`
**Issue:** The parity message falls back to `"?"` when `entry.name` is missing. A marketplace entry with a mismatched version but no `name` would produce `marketplace entry "?" version ...`, which is unactionable. This is defensive-code smell rather than a bug (the committed marketplace always names both entries).
**Fix:** Acceptable as-is; if hardening is desired, include the array index in the message (`entry #2`) so an unnamed entry is still locatable.

### IN-05: Pre-existing em-dashes in reviewed maintenance scripts (not introduced this phase)

**File:** `bin/maintenance/check-version-alignment.cjs:22,33,34,36,64,...`, `bin/maintenance/check-file-layout.cjs:34,44,51,...`
**Issue:** These files contain em-dashes (U+2014) in comments and console output, which violate the project owner's standing "no em-dashes in any output including code/comments" instruction. Verified via `git diff` that the em-dash lines are pre-existing and were NOT added by this phase's changes, so they are out of scope for a Phase 12 gate. Flagged only so a future cleanup pass is aware.
**Fix:** No action required for this phase. When these files are next edited, replace em-dashes with commas/colons/parentheses per the project convention.

---

_Reviewed: 2026-07-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
