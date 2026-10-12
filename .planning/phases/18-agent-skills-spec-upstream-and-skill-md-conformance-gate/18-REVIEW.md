---
phase: 18-agent-skills-spec-upstream-and-skill-md-conformance-gate
reviewed: 2026-10-12T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - bin/maintenance/check-skill-conformance.cjs
  - bin/check-agentskills-release.sh
  - bin/lib/skill-trust-gate.cjs
  - sdk/src/skill-trust-gate.ts
  - bin/lib/craft-skill-insert.cjs
  - sdk/src/query/craft-skill.ts
  - bin/maintenance/check-drift.cjs
  - bin/maintenance/pre-commit-drift-baseline.sh
  - .github/workflows/check-drift.yml
  - README.md
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 18 ships three distinct units: a loud-fail SKILL.md conformance gate (`check-skill-conformance.cjs`) wired into CI, pre-commit and the drift umbrella; the fifth idea-only upstream watch (`check-agentskills-release.sh`); and an opt-in `--validate-external` shell-out added to both craft-skill trust-gate twins.

The primary security surface the phase asked me to scrutinize, the `--validate-external` shell-out, is clean. Both twins build an argv array (no `shell: true`), `path.resolve` the directory to an absolute path before the spawn (so a `--`-leading argument cannot become an option), gate the spawn behind an explicit opt-in flag that is absent from `match`/`insert`/`release`, and fail closed to a `block` on spawn error, timeout, null exit, or non-zero exit via `applyExternalValidation`. The parity test confirms neither twin spawns `npx` without the flag and that the recorded argv is exactly `--yes skills-ref@0.1.5 validate <dir>`. No shell injection, no stdin/argv interpolation.

Hard-rule checks pass on the committed diff: no em/en-dashes, no occurrence of the forbidden word, and no GSD workflow metadata in product code or comments.

The issues below are a twin-parity divergence that fails the opt-in check open on a malformed invocation, and three robustness defects in the watch script and the baseline writer.

## Warnings

### WR-01: SDK twin silently skips the opt-in external validation on a bare `--validate-external` (parity divergence, fails open)

**File:** `sdk/src/query/craft-skill.ts:511-514`, `bin/lib/craft-skill-insert.cjs:356-368`
**Issue:** The two twins diverge when `--validate-external` is passed with no directory argument (a bare trailing flag, or a flag immediately followed by another `--flag`). Both `parseFlags` implementations set the flag value to boolean `true` in that case. The CJS handler passes that `true` straight through, so `o.validateExternal !== undefined`, the string/length guard trips, and it exits 1 with a usage error (fails loud). The SDK handler funnels the flag through `asString(flags['validate-external'])`, which returns `undefined` for a non-string (`asString` at line 617-619), so `o.validateExternal === undefined` is true and the handler returns the *base* assessment without running the linter and without any signal that validation was skipped. A caller who intended to validate gets an unvalidated verdict (possibly `allow`) and no error. This breaks the stated byte-identical-behavior contract between the twins (the file header asserts it) and fails the opt-in security check open on the SDK path. The parity test does not cover this case: every `--validate-external` case passes a real directory.
**Fix:** Normalize the bare-flag case identically in both twins. In the SDK handler, detect the boolean-true case before `asString` collapses it and route it to the same `GSDError('--validate-external requires an existing skill directory')` the CJS twin raises, e.g.:
```ts
const ve = flags['validate-external'];
if (ve === true) {
  throw new GSDError('--validate-external requires an existing skill directory', ErrorClassification.Validation);
}
const a = assessCraftSkill({ id: positional[0], catalog: asString(flags.catalog), validateExternal: asString(ve) });
```
Then add a parity case that invokes `assess <id> --validate-external` with no directory and asserts both twins error identically.

### WR-02: Watch script can wedge cron on a hung registry or unreachable mail host (no timeouts on npm / gh / ssh)

**File:** `bin/check-agentskills-release.sh:46,63,123`
**Issue:** The stated design goal is "never wedge cron," and the GitHub connectivity precheck is time-bounded (`curl ... --max-time 5`). But the three calls that actually do network I/O are not: `$NPM view skills-ref version` (line 46) has no registry timeout, `$GH api ...` (line 63) has no timeout, and the `$SSH "$MAIL_HOST" ...` mail send (line 123) has no `ConnectTimeout`/`BatchMode`. If the npm registry stalls, or the mail host is unreachable or prompts for input, the process blocks indefinitely and overlapping cron invocations pile up. The curl precheck only proves api.github.com is reachable; it does not bound the registry or SSH paths. The wedge-guard test cannot catch this because its shims return instantly.
**Fix:** Bound each network call. For ssh add `-o BatchMode=yes -o ConnectTimeout=10`. For npm add `--fetch-timeout=10000` (or wrap in `timeout 30 ...`). For gh, wrap in `timeout 15 ...`. Example:
```bash
$SSH -o BatchMode=yes -o ConnectTimeout=10 "$MAIL_HOST" "mail -s '${SUBJECT}' ${RECIPIENT}"
```

### WR-03: Unescaped subject and unquoted recipient interpolated into the remote ssh command

**File:** `bin/check-agentskills-release.sh:123`
**Issue:** `echo "$BODY" | $SSH "$MAIL_HOST" "mail -s '${SUBJECT}' $RECIPIENT"` builds a remote shell command by string interpolation. `SUBJECT` is embedded inside single quotes and carries `$LATEST`/`$PREVIOUS` (from `npm view`) and `${SHA:0:8}`; `$RECIPIENT` is unquoted. Real-world exploitability is low because npm versions are semver-constrained and the sha is hex, but this is still an unescaped construction of a command that runs on a remote host, exactly the shell-out surface this phase set out to harden. A future change that lets any less-constrained value reach `SUBJECT` (or a maintainer who overrides `RECIPIENT`) would open command injection on the mail host.
**Fix:** Pass the subject as data rather than interpolating it into a quoted remote string, or at minimum quote the recipient and strip quote/control characters from `SUBJECT` before building the command. Prefer invoking `mail` locally if the host runs it, or send the subject over stdin/argv to a small remote reader that does not re-expand it.

### WR-04: `--write-baseline` silently discards sibling baseline sections when `drift-baseline.json` is unparseable

**File:** `bin/maintenance/check-skill-conformance.cjs:155-186`
**Issue:** `writeBaseline` is documented as "Set ONLY the skill_conformance key, preserving sibling sections," and `tests/drift-baseline.json` does carry siblings (`file_layout`, `user_docs_prose`). But it rebuilds from `readBaseline() || {}`, and `readBaseline` swallows any JSON parse error and returns `null` (lines 160-162). So if the baseline file is ever corrupt or hand-edited into invalid JSON, running `--write-baseline` silently overwrites the whole file with only the `skill_conformance` section, destroying the other two ratchet baselines with no warning. The "preserving sibling sections" guarantee quietly fails exactly when the file is in a state worth preserving.
**Fix:** Distinguish "file absent" from "file unparseable" in `readBaseline`. Return `null` only when the file does not exist; on a parse error, fail loud (print the error and `process.exit(1)`) so `--write-baseline` refuses to clobber a corrupt baseline rather than silently resetting it.

## Info

### IN-01: `--validate` with a missing directory argument silently falls through to a full scan

**File:** `bin/maintenance/check-skill-conformance.cjs:48-49,228-231`
**Issue:** `VALIDATE_DIR = VALIDATE_IDX !== -1 ? args[VALIDATE_IDX + 1] : null`. If `--validate` is the last token (no directory follows), `VALIDATE_DIR` is `undefined`, the `if (VALIDATE_DIR)` guard in `main` is falsy, and the tool quietly runs the full-repo baseline comparison instead of reporting that the standalone validate mode was requested without a target. Harmless but surprising.
**Fix:** When `--validate` is present but the next token is absent or itself a flag, print a usage line and `process.exit(2)`.

## Convention

Reported by the standalone rule packs (`verify conventions --check`); CONVENTION tier never blocks.

### CV-01: Export style flagged as CommonJS where the axis dominance is ESM

**File:** `bin/lib/skill-trust-gate.cjs:1`, `bin/lib/craft-skill-insert.cjs:1`, `bin/maintenance/check-skill-conformance.cjs:1`
**Deviation:** export style is cjs.
**Convention:** the rule pack's dominant export axis resolved to esm.
**Fix (recommend, likely no-op):** These are `.cjs` files, where CommonJS (`require`/`module.exports`) is mandated by the extension, so the flag is a corpus-scoping artifact rather than a real deviation. No change recommended; noted for completeness.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (bm-code-reviewer)_
_Depth: deep_
