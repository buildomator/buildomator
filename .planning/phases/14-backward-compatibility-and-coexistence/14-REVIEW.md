---
phase: 14-backward-compatibility-and-coexistence
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - bin/build-bm.cjs
  - bin/gsd-tools.cjs
  - bin/lib/bm-transform.cjs
  - bin/lib/checkpoint.cjs
  - bin/lib/coexist.cjs
  - bin/lib/core.cjs
  - bin/lib/state.cjs
  - hooks/hooks.json
  - hooks/run-bash-hook.cjs
  - .github/workflows/check-drift.yml
  - .github/workflows/install-smoke.yml
  - tests/build-bm-drift.test.cjs
  - tests/coexist.test.cjs
  - tests/handoff-write-lock.test.cjs
  - tests/hook-single-fire.test.cjs
  - tests/nudge-emission.test.cjs
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the coexistence work: the shared leader-election helper (`coexist.cjs`),
the HANDOFF.json write-lock reuse in `checkpoint.cjs`, the bm byte-transform nudge
strip in `bm-transform.cjs`, and the two hook dispatch points that carry the
election (`gsd-tools.cjs case 'hook'` and `run-bash-hook.cjs`).

The four areas the prompt called out are, on balance, sound:

- **session_id path-injection** is correctly closed. `SESSION_ID_RE`
  (`/^[A-Za-z0-9_-]+$/`) rejects slashes, dots, and backslashes before the id is
  ever composed into a filename; malformed/absent ids are treated as "not
  announced". No traversal path is reachable.
- **O_EXCL lock reuse for HANDOFF.json** is safe: the real torn-file protection
  is `platformWriteSync`'s per-pid temp-file + atomic rename, and the lock is
  belt-and-suspenders. Distinct `.lock` paths per file (verified by Test C).
  No new circular dependency: `checkpoint.cjs → state.cjs` does not cycle back.
- **suppressNudge regex anchoring** handles indented sentinels correctly
  (`^[ \t]*` with the `m` flag), so it does not no-op on the 8-space-indented
  sentinels in `gsd-tools.cjs`, and it leaves the block-in-a-string sentinels in
  `bm-transform.cjs` itself intact.

No BLOCKER-tier defects were proven. The findings below are a fragile identity
heuristic, an unbounded temp-marker leak, the documented-but-real SessionStart
election residual, and several lower-severity nits.

## Warnings

### WR-01: `pluginIdentity` heuristic is inconsistent between the two dispatch points and misfires off-cache

**File:** `bin/lib/coexist.cjs:37-41`
**Issue:** Identity is derived from substrings of the resolved path:
`p.includes('/cache/gsd-plugin/bm/') || p.includes('/bm/bin/')`. The `/bm/bin/`
clause only covers files under `bin/` (i.e. `gsd-tools.cjs`). The bash dispatch
point `hooks/run-bash-hook.cjs` lives under `hooks/`, so for any bm deployment
NOT under the cache dir it is misclassified as `gsd`. Verified:

```
dist/bm/hooks/run-bash-hook.cjs  -> gsd   (WRONG; the bin/ sibling resolves to bm)
dist/bm/bin/gsd-tools.cjs        -> bm
/home/me/bm/bin/gsd-tools.cjs    -> bm    (false positive: a gsd checkout in a dir named bm)
```

Consequences: (a) a bm copy that misreads as `gsd` will call neither
`markBmActive` nor own the run, and will YIELD whenever the *correct* bm
`gsd-tools` copy has planted the marker — so the bm bash hooks
(`gsd-session-state.sh`, `gsd-validate-commit.sh`, `gsd-phase-boundary.sh`)
silently never fire in that deployment; (b) a plain gsd checkout that happens to
sit under a `…/bm/bin/…` path misreads as `bm`, plants a marker, and never yields.
Production cache installs (`cache/gsd-plugin/{gsd,bm}/…`) resolve correctly, which
is why CI passes, but the heuristic is brittle for the dist/bm artifact the smoke
job itself runs and for any non-standard install location.
**Fix:** Make the two callers agree. Either add a `hooks/`-aware clause, or better,
key identity off a stable, location-independent signal — e.g. read the plugin
`name` from the nearest `.claude-plugin/plugin.json`, or match the plugin-segment
immediately after `cache/gsd-plugin/` rather than a bare `/bm/` substring:

```js
// Anchor on the plugin segment, tolerate both bin/ and hooks/ layouts.
if (/\/(?:cache\/gsd-plugin\/bm|bm)\/(?:bin|hooks)\//.test(p)) return 'bm';
```

### WR-02: bm-active marker files are never cleaned up (unbounded temp accumulation), and the mtime-refresh rationale is dead

**File:** `bin/lib/coexist.cjs:70-78` (and `bin/lib/core.cjs:195-219`)
**Issue:** `markBmActive` writes `bm-active-<sid>.marker` into `os.tmpdir()/gsd/`
once per session and there is no delete path anywhere — no Stop/session-end
cleanup, and `reapStaleTempFiles` is only ever called with its default `gsd-`
prefix (in `output()` and the tests), which by design never matches
`bm-active-`. So markers accumulate one-per-session for the lifetime of the temp
dir. Relatedly, the code comment states the write "refreshes the marker mtime on
every fire, so a long session is never reaped mid-run" — but since nothing ever
reaps this prefix, the mtime refresh guards against a reap that cannot happen; the
reasoning is moot and misleading.
**Fix:** Add a bounded cleanup: either reap `bm-active-` markers on an aged mtime
from a dispatch point that already runs (e.g. call
`reapStaleTempFiles('bm-active-', { maxAgeMs: <session-scale> })` opportunistically
from the Stop hook), or delete the session's own marker on `Stop`. If markers are
genuinely meant to live forever, drop the mtime-refresh comment so it does not
imply a protection that is not wired.

### WR-03: SessionStart election residual can double-run the stateful session-start work in both plugins

**File:** `bin/gsd-tools.cjs:1276-1290` (and `hooks/run-bash-hook.cjs:131-133`)
**Issue:** The election is a marker-based TOCTOU: the gsd copy yields only if it
observes bm's marker. On the *first* hook of a both-plugins session (SessionStart),
gsd and bm fire near-simultaneously; if gsd checks `isBmActive` before bm's
`markBmActive` write lands, gsd does not yield and both copies run the SessionStart
body. That body is not purely idempotent: it writes the HANDOFF systemMsg and the
workspace-context block to stdout (duplicate context injection into the model), and
runs `autoMigrate(cwd)` (a filesystem mutation) — two copies can run it
concurrently. This residual is explicitly documented and accepted (D-03; see the
`hook-single-fire.test.cjs` "(d) residual bound" case and the pre-yield-emit comment
at `gsd-tools.cjs:1288`), and it is bounded to at most one duplicate, but it is a
real correctness gap, not merely cosmetic.
**Fix:** If the residual must stay, harden the SessionStart body for concurrent
execution: guard `autoMigrate` with its own O_EXCL lock (reuse `acquireStateLock`)
so two copies cannot interleave, and/or gate the stdout context injection behind an
idempotency marker so a duplicate SessionStart does not inject the same block twice.

## Info

### IN-01: checkpoint comment overstates the "never truncated" guarantee

**File:** `bin/lib/checkpoint.cjs:399-405`
**Issue:** The comment claims the write goes "via the temp-file + atomic-rename
helper so a lock-less reader can never observe a truncated, mid-write file."
`platformWriteSync` (`shell-command-projection.cjs:492-503`) falls back to a
non-atomic `fs.writeFileSync(filePath, …)` when `renameSync` throws (e.g. Windows
EPERM/EBUSY on an open target). On that fallback path a concurrent lock-less reader
(such as the SessionStart HANDOFF reader at `gsd-tools.cjs:1310`) can observe a torn
file. The reader wraps its `JSON.parse` in a swallowing try/catch so this only
skips checkpoint detection rather than crashing, but the absolute wording in the
comment is inaccurate.
**Fix:** Soften the comment to "atomic on the rename path" or make the fallback
write also go through a temp+rename retry.

### IN-02: `suppressNudge` strips only the first sentinel block (no `g` flag)

**File:** `bin/lib/bm-transform.cjs:79-97`
**Issue:** `NUDGE_BLOCK_RE` has the `m` flag but not `g`, and `suppressNudge` does a
single `.replace`. Today exactly one BM-NUDGE block exists, so this is correct, but
if a second sentinel-bracketed nudge is ever added to any shipped file, only the
first is stripped and the second ships in bm. The drift gate would not catch it
because `expectedText` in the drift test applies the identical single-replace, so
both sides agree while still shipping a nudge.
**Fix:** Add the `g` flag (`…, 'mg')`) so all sentinel blocks are stripped, matching
the "bm must never tell users to switch to bm" invariant regardless of block count.

### IN-03: brittle magic-number `17` couples two gates to the exact hook count

**File:** `.github/workflows/install-smoke.yml:253` and `tests/build-bm-drift.test.cjs:202`
**Issue:** Both gates assert `count(hooks, 'cache/gsd-plugin/bm') === 17`. Adding or
removing any hook entry from `hooks.json` breaks both with an opaque "!= 17"
message that does not explain the real cause. This is a maintainability trap for a
future hook change.
**Fix:** Derive the expected count from the source (e.g. count occurrences in the
committed `hooks/hooks.json` and assert the dist copy matches), or assert the
invariant that matters directly: zero `cache/gsd-plugin/gsd` literals and at least
one `cache/gsd-plugin/bm` literal.

### IN-04: `acquireStateLock` blocks with `Atomics.wait` inside the 3s PostToolUse budget

**File:** `bin/lib/state.cjs:952-983` (used by `bin/lib/checkpoint.cjs:403`)
**Issue:** Under contention the lock retries up to 10 times with a synchronous
`Atomics.wait(…, retryDelay + jitter)` (~200-250ms each, ~2.5s worst case). The
PostToolUse checkpoint runs on a 3s timeout budget, so a contended HANDOFF write
could approach the timeout. The atomic rename already makes the lock optional for
correctness, so the blocking wait buys little here.
**Fix:** For the HANDOFF path consider a shorter retry ceiling, or rely on the
atomic rename and skip the lock when the budget is tight. Low priority.

## Conventions

The shared conventions checker reports **45 CONVENTION-tier findings**, all the same
axis: "catch block swallows the error (empty / no rethrow)" — 20 in `core.cjs`, 11
in `state.cjs`, 6 in `gsd-tools.cjs`, 4 in `checkpoint.cjs`, 3 in `run-bash-hook.cjs`,
1 in `coexist.cjs`. These are the codebase's deliberate, dominant fail-open hook
style ("never break the hook / best-effort"), documented at nearly every site (e.g.
`coexist.cjs:75`, `run-bash-hook.cjs:130`, the PreCompact 5s-budget contract). They
are advisory only, never blocking, and match the established convention, so no change
is recommended. Noted for completeness per the CONVENTION tier; the new swallow-catches
introduced this phase all carry an explanatory comment describing the intent.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
