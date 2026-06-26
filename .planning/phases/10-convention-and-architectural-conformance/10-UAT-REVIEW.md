---
phase: 10-convention-and-architectural-conformance
reviewed: 2026-06-26T20:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - bin/lib/uat-convention-violator.cjs
findings:
  critical: 0
  warning: 2
  convention: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 10: Code Review Report (UAT Fixture)

**Reviewed:** 2026-06-26T20:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `bin/lib/uat-convention-violator.cjs`, a deliberately convention-violating
fixture created for Phase 10 human-UAT test #1 ("Live /gsd:code-review surfaces a
CONVENTION finding"). The file's stated purpose is to break derived/idiom conventions
on purpose so the convention-checker tooling can be validated against it; it is not
wired into any runtime path.

Because the file is an intentional fixture, the snake_case identifier and the
read-verb/mutation mismatch are by-design and are folded into the advisory CONVENTION
tier (non-blocking), matching the convention checker's own output. However, two defects
go beyond the labeled conventions and are worth flagging on their own merits even for a
fixture: a hardcoded absolute `/tmp` path used for a real filesystem write, and the
function returning a process secret. Neither blocks (the file is unreferenced and
unexecuted), so both land at WARNING rather than BLOCKER.

The convention checker (`verify conventions --check`) was run against the file and
correctly returned two CONVENTION-tier findings (identifier casing, verb-vs-body),
both `blocking: false`. This confirms the tooling behaves as the UAT expects.

## Warnings

### WR-01: Real side-effecting filesystem write to a hardcoded absolute path

**File:** `bin/lib/uat-convention-violator.cjs:12`
**Issue:** `fs.writeFileSync('/tmp/uat-side-effect.txt', 'written')` performs an actual
unconditional write to a hardcoded absolute path every time `get_user_config` is called.
For a fixture this is a latent hazard: if anything ever does `require()` and call this
export (for example a test that imports the module to assert the convention checker fires),
it writes to the real filesystem. The hardcoded `/tmp` is also non-portable (no such path
on Windows) and could collide with another process's file of the same name. The
file's own comment frames this as illustrating CONV-03 (side-effecting I/O in a read verb),
but the concrete write is a real side effect independent of the naming convention.
**Fix:** If a side effect is needed only to illustrate the convention violation, make it
inert or non-filesystem. For example, drop the write entirely and rely on the parameter
mutation alone to demonstrate the read-verb/mutation mismatch:
```js
function get_user_config(config_obj) {
  config_obj.cache = {}; // mutation alone illustrates CONV-03
  return process.env.SECRET_TOKEN;
}
```
If a write must be demonstrated, use `os.tmpdir()` and a unique name so it is portable
and collision-free:
```js
const path = require('node:path');
const os = require('node:os');
fs.writeFileSync(path.join(os.tmpdir(), `uat-side-effect-${process.pid}.txt`), 'written');
```

### WR-02: Function returns a process secret from the environment

**File:** `bin/lib/uat-convention-violator.cjs:14`
**Issue:** `return process.env.SECRET_TOKEN` reads and returns a secret-named environment
variable directly to the caller. The file comment labels this CONV-04 (direct
`process.env` access instead of injected configuration), but returning a value named
`SECRET_TOKEN` out of an exported function is a secrets-handling smell in its own right:
an exported helper that surfaces a secret invites accidental logging or propagation if
the fixture is ever copied or imported. It also returns `undefined` whenever the env var
is unset, which would silently propagate to any caller. Since the fixture's purpose is the
`process.env`-vs-injection convention, the specific secret name is incidental and avoidable.
**Fix:** Use a non-secret env var name to illustrate the same convention without surfacing
a secret, or return injected config instead of reading the environment:
```js
// illustrates direct-env convention without a secret-named value
return process.env.UAT_SAMPLE_VALUE;
```

## Convention (advisory, non-blocking)

These are emitted by `node bin/gsd-tools.cjs verify conventions --check` and are
intentional per the fixture's design. Listed for completeness at the advisory CONVENTION
tier (below WARNING; never blocking or gating).

### CV-01: Identifier casing is snake_case in a camelCase corpus

**File:** `bin/lib/uat-convention-violator.cjs:10`
**Deviation:** identifier casing is snake (`get_user_config`)
**Convention:** identifier-casing should be camel (bin/lib corpus is NAMED=camel, ~0.98)
**Fix:** rename `get_user_config` (and parameter `config_obj`) to camelCase. (Intentional
in this fixture.)

### CV-02: Read-verb function mutates state / does side-effecting I/O

**File:** `bin/lib/uat-convention-violator.cjs:10`
**Deviation:** verb-vs-body — read-verb function `get_user_config` mutates its parameter
and performs side-effecting I/O.
**Convention:** read-verb names (get/list/find/read/...) should not mutate (intent mismatch).
**Fix:** rename to a mutating verb (e.g. `buildUserConfig`) or remove the side effects.
(Intentional in this fixture.)

## Info

### IN-01: `config_obj` mutation discards caller data without signalling

**File:** `bin/lib/uat-convention-violator.cjs:11`
**Issue:** `config_obj.cache = {}` unconditionally overwrites any existing `cache`
property on the passed object and assumes `config_obj` is non-null. A real caller passing
`null`/`undefined` would throw `TypeError: Cannot set properties of null`. This is
acceptable in a throwaway fixture but would be a defect in production code; noting it so
the pattern is not copied into a wired module.
**Fix:** Guard the parameter (`if (config_obj == null) return;`) and avoid clobbering
existing state if this logic is ever reused.

---

_Reviewed: 2026-06-26T20:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
