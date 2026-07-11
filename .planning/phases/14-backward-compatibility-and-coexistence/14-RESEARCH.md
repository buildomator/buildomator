# Phase 14: Backward Compatibility and Coexistence - Research

**Researched:** 2026-07-11
**Domain:** Claude Code plugin coexistence (hook merge/dedup semantics, per-session identity election, shared-state write serialization, non-blocking SessionStart context)
**Confidence:** HIGH

## Summary

This phase makes the byte-identical `gsd` and `bm` plugins safe to run together. The
research confirms the four decided designs (D-01..D-06) are feasible against live Claude
Code hook semantics, and it pins down the exact mechanics that size the design.

The load-bearing findings from the official hooks reference are: (1) Claude Code
deduplicates hooks "by command string and args", and because Phase 13 D-04 stamped the
bm hook cache-fallback literal (`cache/gsd-plugin/gsd` -> `cache/gsd-plugin/bm`), the two
packages' command strings DIFFER, so native dedup does NOT collapse them and both copies
fire. This confirms the phase premise. (2) gsd and bm hooks both live in the same
"Plugin" source tier, and hooks within a source run in PARALLEL, so the D-03 first-event
residual is a genuine parallel race that ordering cannot remove. (3) Claude Code exposes
NO env var or stdin field telling a hook which plugins are enabled, which confirms the
D-03 self-announced session marker is the correct approach and there is no cleaner
race-free native signal. (4) `session_id` is always present in hook stdin JSON, so keying
the marker on it is feasible. (5) The non-blocking SessionStart context channel is
`hookSpecificOutput.additionalContext` or plain stdout (the existing resume directive
already uses plain stdout); `systemMessage` is documented as a user-facing warning line,
not a context channel.

The COMPAT-03 gap is concrete and confirmed: `bin/lib/checkpoint.cjs` writes HANDOFF.json
with a bare `fs.writeFileSync` (line 398), bypassing the `acquireStateLock` +
read-modify-write path that STATE.md writes use. That is the single unprotected
shared-state writer D-04 must close.

**Primary recommendation:** Build one shared `bin/lib/coexist.cjs` helper exposing
`pluginIdentity(resolvedPath)`, `markBmActive(sessionId)`, and `isBmActive(sessionId)`;
call it at the top of every hook entry in `bin/gsd-tools.cjs hook` (and the JS hook
scripts) to enforce the D-02 election; generalize `acquireStateLock` to guard HANDOFF.json
writes (D-04); emit the deprecation nudge from the gsd SessionStart hook via plain stdout
(matching the existing resume directive), exempt from the yield (D-05/D-06); and suppress
the bm nudge through the existing `bin/lib/bm-transform.cjs` build transform.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hook single-fire election (COMPAT-02) | Hook dispatch (`gsd-tools.cjs hook` + JS hook scripts) | Shared helper `bin/lib/coexist.cjs` | Election must run at the top of every hook entry; single-sourcing it in a lib prevents a future hook forgetting it |
| "is bm active this session" signal (D-03) | Session temp dir (`core.cjs` GSD_TEMP_DIR) | Hook dispatch | No native enabled-plugins signal exists; a per-session self-announced marker is the only mechanism |
| Plugin identity self-detection (D-02) | Hook dispatch (resolved script path) | `bin/lib/coexist.cjs` | Identity is derivable from the resolved `bin/gsd-tools.cjs` path segment (`/gsd/` vs `/bm/`), robust when `CLAUDE_PLUGIN_ROOT` is absent |
| Shared-state write serialization (COMPAT-03) | Shared-state lib (`bin/lib/state.cjs` lock) | `bin/lib/checkpoint.cjs` | The proven O_EXCL lock + atomic RMW must cover HANDOFF.json, not just STATE.md |
| Deprecation nudge emission (COMPAT-04) | gsd SessionStart hook (`gsd-tools.cjs`) | - | Non-blocking context out of the SessionStart hook, exempt from the yield |
| bm nudge suppression (D-06) | Build transform (`bin/lib/bm-transform.cjs`) | `bin/build-bm.cjs` | Single-sourced with the Phase 13 transform so the two packages cannot drift |
| Coexistence proof (all four) | CI (`check-drift.yml`, `install-smoke.yml`) | `tests/*.test.cjs` | The Phase 12/13 CI-as-gate pattern extends to single-fire and interleaved-write tests |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (primary-plugin policy):** bm becomes primary WHEN ACTIVE. In any session where
  bm is active, bm owns the single hook fire and drives shared state; the gsd copy yields
  (and nudges). When bm is not active, gsd behaves exactly as today (preserves COMPAT-01).
  Detection keys on "is bm active THIS session", not "bm is installed on disk".
- **D-02 (hook single-fire mechanism):** Deterministic identity election, not a
  first-to-run race. Each hook copy knows whether it is the gsd or bm copy from its
  `CLAUDE_PLUGIN_ROOT` path segment (`.../gsd/...` vs `.../bm/...`). The gsd copy yields
  (exits 0, performs no state-mutating side effects) when bm is active; the bm copy always
  runs. Outcome is a pure function of (my identity, is-bm-active).
- **D-03 (bm-active detection):** A bm self-announced per-session presence marker: the bm
  copy writes a small marker on its first hook fire, keyed on `session_id` in the session
  temp dir. The gsd copy yields only if that marker exists. Correct when bm is
  cache-present-but-DISABLED (no bm hook -> no marker -> gsd runs normally). Accepted
  residual: on the first event of a session where the gsd copy fires before the bm copy
  (notably SessionStart), gsd may run once before the marker lands. At most one
  double-fire at session start, then clean for the rest of the session.
- **D-04 (shared state):** Extend the proven `bin/lib/state.cjs` O_EXCL lock + atomic
  read-modify-write to cover ALL shared-state writers, not just STATE.md. Audit that
  HANDOFF.json and phase-plan writes go through the same lock/atomic path (not a bare
  `writeFileSync`) and close any gap. Add a coexistence test that interleaves gsd and bm
  writes and asserts files stay valid/uncorrupted. No new single-writer coordination
  layer.
- **D-05 (deprecation nudge):** The nudge surfaces once per session via the gsd
  SessionStart hook, emitted as non-blocking context (same channel as the existing resume
  directive). No per-skill edits (editing ~1200 `/gsd:` refs is rejected). Must mention
  `/bm:` and the v5.0 retirement, and must not block the command.
- **D-06 (nudge audience + exemption):** Audience is EVERY gsd session, whether or not bm
  is installed. Once-per-session cadence. The nudge is EXEMPT from the D-02 yield: the gsd
  SessionStart hook still emits the read-only, non-blocking nudge even when it yields the
  stateful session-state work to bm. The bm package suppresses its OWN nudge, single-sourced
  through the existing bm build transform, keyed on plugin identity.

### Claude's Discretion

- Exact marker file path/name and session temp dir (reuse `core.cjs` GSD_TEMP_DIR /
  session conventions).
- Module boundary for the identity-election + bm-active-check helper (new `bin/lib/*`
  helper vs inline). Prefer one shared helper so every hook uses the same election.
- Exact nudge wording, within D-05 constraints (mention `/bm:` + v5.0, non-blocking, plain
  and non-marketing).
- Whether bm nudge-suppression is a build-time strip or a runtime identity guard, as long
  as it is single-sourced with the Phase 13 bm transform and cannot drift.

### Deferred Ideas (OUT OF SCOPE)

- Branding prose "GSD"/"Get Shit Done" -> "Buildomator", README/CHANGELOG/buildomator.com
  copy - Phase 15.
- Retiring `/gsd:` and flipping the authored identity to bm; making bm primary by default
  with no gsd present - v5.0 (breaking).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPAT-01 | `/gsd:*` continues to work with zero re-enable throughout 4.x | Election is a no-op when no bm marker exists (bm not active) -> gsd behaves exactly as today. No gsd command surface, hook, or manifest field changes for a gsd-only user. The election guard is additive and self-neutral. |
| COMPAT-02 | With both enabled, hooks fire exactly once per event | CC dedup is by command string; the D-04 stamped fallback makes gsd/bm strings differ so both fire (premise confirmed). The D-02 election makes the gsd copy yield when the D-03 marker is present, collapsing to a single effective fire (bm's), except the accepted one-event SessionStart residual. |
| COMPAT-03 | With both enabled, project state stays consistent/uncorrupted | Confirmed gap: HANDOFF.json is written via bare `fs.writeFileSync` (checkpoint.cjs:398), bypassing the lock. Generalize `acquireStateLock` to guard it; STATE.md already serializes. Identical code writing identical formats makes serialized last-write-wins consistent. |
| COMPAT-04 | `/gsd:*` surfaces a non-blocking deprecation nudge (mentions `/bm:` + v5.0) | SessionStart `hookSpecificOutput.additionalContext` or plain stdout is the confirmed non-blocking channel (existing resume directive uses stdout). Nudge is exempt from the yield (D-06). bm suppresses its own via the build transform. |
</phase_requirements>

## Standard Stack

This phase adds NO external dependencies. It extends existing project modules with
built-in Node APIs only (`fs`, `path`, `os`). There is no Package Legitimacy Audit,
Standard Stack table, or Environment Availability probe to run: everything needed is
Node's standard library plus code already in the repo.

**Modules extended (all existing):**

| Module | Role in this phase |
|--------|--------------------|
| `bin/lib/state.cjs` | `acquireStateLock` (O_EXCL, ~line 947) + `readModifyWriteStateMd` (~line 1028); generalize the lock to any target path for HANDOFF.json (D-04) |
| `bin/lib/checkpoint.cjs` | `writeCheckpoint` (line 376, bare `writeFileSync` at 398); the COMPAT-03 writer to route through the lock |
| `bin/lib/core.cjs` | `GSD_TEMP_DIR` (line 189) + `ensureGsdTempDir`/`reapStaleTempFiles`; home for the per-session bm-active marker (D-03) |
| `bin/gsd-tools.cjs` | `case 'hook'` dispatch (line 1259: session-start/pre-compact/stop/post-tool-use); where the election + nudge attach |
| `hooks/hooks.json` | 8 event registrations; the JS hook scripts (`hooks/*.js`) also need the election if they mutate shared state |
| `bin/lib/bm-transform.cjs` | `rewriteCommandRefs` + `stampHookFallback`; add nudge suppression here (D-06) |
| `bin/build-bm.cjs` | `generate()` applies the transform per file; drift `--check` gate |

**Verification:** No registry lookup applies (no new packages). Node built-ins `fs`,
`path`, `os` are confirmed available (Node runtime is the plugin's execution environment,
already used throughout `bin/lib/*`). [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```
                    Claude Code session (session_id from stdin JSON)
                                   |
             fires each event (SessionStart, Pre/PostToolUse, Stop, PreCompact, SubagentStop)
                                   |
        +--------------------------+--------------------------+
        |  "Plugin" source tier: BOTH copies fire (parallel)  |
        |  (native dedup skipped: command strings differ via  |
        |   the D-04 stamped /gsd vs /bm fallback literal)     |
        +----------------------+-----------------+------------+
                               |                 |
                    gsd hook copy            bm hook copy
                               |                 |
                 coexist.pluginIdentity(resolvedScriptPath)
                     = "gsd"                  = "bm"
                               |                 |
                               |                 +--> markBmActive(session_id)   (writes/touches marker, FIRST, sync)
                               |                 +--> run full hook work + shared-state writes
                               |
                 isBmActive(session_id)?  (marker present in GSD_TEMP_DIR)
                   |                          |
                  NO (bm not active)        YES (bm active this session)
                   |                          |
             run full hook work         YIELD stateful work (exit 0, no state mutation)
             + emit nudge               BUT still emit nudge  (D-06 exemption, SessionStart only)
                   |                          |
                   +----------> shared-state writers <----------+
                                        |
                        acquireStateLock(targetPath) + atomic RMW
                        guards STATE.md AND HANDOFF.json (D-04)
                                        |
                       .planning/STATE.md , .planning/HANDOFF.json
```

### Recommended Project Structure

```
bin/lib/
  coexist.cjs         # NEW: pluginIdentity(), markBmActive(), isBmActive(), shouldYield()
  state.cjs           # EXTEND: generalize acquireStateLock/RMW to arbitrary target path
  checkpoint.cjs      # EDIT: route HANDOFF.json write through the lock
  core.cjs            # REUSE: GSD_TEMP_DIR for the marker; marker uses a non-reaped prefix or is refreshed
  bm-transform.cjs    # EXTEND: nudge suppression (build-time strip or identity guard)
tests/
  coexist.test.cjs            # NEW: identity election + marker lifecycle (Wave 0)
  hook-single-fire.test.cjs   # NEW: both-active => one effective fire + SessionStart residual
  handoff-write-lock.test.cjs # NEW: interleaved HANDOFF.json + STATE.md writes stay valid
  nudge-emission.test.cjs     # NEW: gsd emits nudge (incl. when yielding); bm never does
```

### Pattern 1: Identity election as a pure function at the top of every hook

**What:** Each hook entry resolves its own identity from the actually-resolved script
path (which contains `/gsd/` or `/bm/`), checks the session marker, and either runs or
yields. Election is `(identity, isBmActive) -> run | yield`, single-sourced.

**When to use:** Every hook entry that performs a state-mutating side effect. The
SessionStart nudge is the one exemption (D-06).

```javascript
// Source: derived from CONTEXT.md D-02/D-03 + core.cjs GSD_TEMP_DIR conventions [ASSUMED]
// bin/lib/coexist.cjs (illustrative shape, not final)
const path = require('path');
const fs = require('fs');
const { GSD_TEMP_DIR, ensureGsdTempDir } = require('./core.cjs');

// Identity from the resolved script path segment, robust when CLAUDE_PLUGIN_ROOT is unset
// (the hooks.json fallback resolves to .../cache/gsd-plugin/{gsd|bm}/<version>/...).
function pluginIdentity(resolvedPath) {
  const p = (resolvedPath || __filename).replace(/\\/g, '/');
  if (/\/cache\/gsd-plugin\/bm\//.test(p) || /\/bm\/bin\//.test(p)) return 'bm';
  return 'gsd'; // default: authored package
}

// Marker keyed on session_id. Use a prefix the 5-min reaper does NOT sweep, OR refresh
// mtime on every bm hook fire so a long session's marker is never reaped mid-session.
function markerPath(sessionId) {
  return path.join(GSD_TEMP_DIR, `bm-active-${sessionId}.marker`);
}
function markBmActive(sessionId) {
  if (!sessionId) return;
  ensureGsdTempDir();
  fs.writeFileSync(markerPath(sessionId), String(Date.now())); // touch each fire
}
function isBmActive(sessionId) {
  if (!sessionId) return false;
  try { return fs.existsSync(markerPath(sessionId)); } catch { return false; }
}
```

### Pattern 2: Per-target-path lock generalization (D-04)

**What:** `acquireStateLock(statePath)` already appends `.lock` to an arbitrary path and
uses O_EXCL with retry/jitter and exit-time cleanup. Generalize its name (or add a thin
`acquireFileLock(targetPath)` alias) and wrap the HANDOFF.json write. Two different files
get two different lock files; that is correct: only writers to the SAME file must serialize.

```javascript
// Source: checkpoint.cjs:398 (current gap) + state.cjs:947 acquireStateLock [VERIFIED: codebase grep]
// checkpoint.cjs writeCheckpoint(), replace the bare write:
//   fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
// with a locked write:
const { acquireStateLock, releaseStateLock } = require('./state.cjs');
const lockPath = acquireStateLock(outPath);      // creates outPath + '.lock'
try {
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
} finally {
  releaseStateLock(lockPath);
}
```

### Pattern 3: Non-blocking nudge from SessionStart

**What:** Emit the nudge on stdout (Claude reads SessionStart stdout as context), matching
the existing resume directive at `gsd-tools.cjs:1301` which uses `process.stdout.write`.
Emit unconditionally for gsd identity, before/independent of the yield decision.

```javascript
// Source: hooks reference (SessionStart additionalContext / stdout) [CITED: code.claude.com/docs/en/hooks]
// gsd copy, SessionStart, exempt from yield:
if (pluginIdentity(resolvedPath) === 'gsd') {
  process.stdout.write(
    '\n\nNote: /gsd: commands are being renamed to /bm: (Buildomator). ' +
    'Both work through the 4.x line; /gsd: retires at v5.0. Try /bm: when convenient.\n'
  );
}
// then proceed to election for the stateful session-state work
```

### Anti-Patterns to Avoid

- **Removing hooks from the bm package to prevent double-fire.** bm must keep its hooks to
  work standalone. The fix is election at the top of each hook, not hook removal.
- **A first-to-run lockfile race for single-fire.** D-02 is deliberately a pure function of
  (identity, marker), not a race. A lockfile-election would reintroduce nondeterminism and
  a lock-contention failure mode on every event.
- **Using the `systemMessage` JSON field to carry the nudge context.** The docs define
  `systemMessage` as a user-facing warning line, not the context channel. Use stdout /
  `hookSpecificOutput.additionalContext` (matching existing code). See Open Questions for
  the user-visibility tradeoff.
- **Keying the election on "bm installed on disk" instead of "bm active this session."**
  A cache-present-but-disabled bm never fires a hook, so no marker is written, so gsd must
  run normally. Disk presence would wrongly suppress a gsd-only-active user (breaks
  COMPAT-01).
- **Letting the 5-minute temp reaper sweep the session marker.** `reapStaleTempFiles`
  removes `gsd-`prefixed temp entries older than 5 minutes; a marker for a multi-hour
  session would be reaped mid-session, silently re-enabling the gsd double-fire. Refresh
  the marker mtime on every bm hook fire, or use a prefix the reaper does not match.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-process write serialization | A new mutex/queue/coordination service | The existing `acquireStateLock` O_EXCL + jitter/retry + exit-cleanup in `state.cjs` | It already handles stale-lock reclaim (10s), exit-time cleanup (#1916), and retry with jitter; generalizing it is a one-line-name change |
| Hook dedup across plugins | A custom "have I already run" flag file per event | Claude Code's native command-string dedup (understood, not fought) + the D-02 election | CC already dedupes identical command strings; the election handles the intentionally-non-identical case cleanly |
| Session identity | A generated GUID or PID-based token | `session_id` from the hook stdin JSON (always present) | It is stable for the session and provided by CC; deriving your own risks collisions across the two plugins |
| Plugin identity detection | Parsing `enabledPlugins` or probing the marketplace | The resolved script path segment (`/gsd/` vs `/bm/`) | There is no native enabled-plugins signal to hooks; the path segment is the only reliable in-hook identity source |
| bm/gsd package divergence for the nudge | Hand-editing dist/bm | The single `bm-transform.cjs` build transform | Any manual dist/bm edit fails the drift `--check` gate; single-sourcing is the whole Phase 12/13 design |

**Key insight:** Every primitive this phase needs already exists in the repo (O_EXCL lock,
session temp dir, deterministic build transform, CI-as-gate). The phase is composition and
coverage-closing, not new infrastructure.

## Runtime State Inventory

> This is not a rename/migration phase, but it introduces per-session runtime state (the
> bm-active marker), so the marker lifecycle is inventoried here.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No datastore keys change. STATE.md / HANDOFF.json formats are unchanged (only their write path is serialized). | None |
| Live service config | None. No external service (n8n, Datadog, etc.) is touched. | None |
| OS-registered state | The per-session marker files in `os.tmpdir()/gsd` (new). Keyed on `session_id`, written by the bm copy. | Ensure cleanup: refresh mtime per fire so the 5-min reaper does not sweep mid-session; markers self-expire after the session via the reaper once writes stop |
| Secrets/env vars | Reads `CLAUDE_PLUGIN_ROOT` (existing) and `session_id` from stdin (existing hook input). No new secret or env var. | None |
| Build artifacts | `dist/bm/` is regenerated by the build; the nudge-suppression transform must be applied so dist/bm carries the suppression. | Regenerate `dist/bm` after the transform change; the drift `--check` gate enforces it |

**Nothing found for Stored data / Live service config:** verified. This phase changes
control flow (election) and write serialization, not any stored string or external config.

## Common Pitfalls

### Pitfall 1: SessionStart parallel race is unavoidable, not a bug to "fix"

**What goes wrong:** An attempt to guarantee bm's marker lands before gsd checks it on the
very first event, e.g. by adding ordering or a pre-check sleep.
**Why it happens:** gsd and bm hooks are in the same "Plugin" source tier, and hooks within
a source run in parallel per the docs. There is no cross-plugin ordering knob.
**How to avoid:** Accept the D-03 residual (at most one gsd double-fire at SessionStart,
then clean). Make bm write the marker at the very TOP of its hook entry, synchronously,
before any other work, to minimize the window for subsequent events. Do not add sleeps.
**Warning signs:** A design that claims "zero double-fire including SessionStart" is
over-promising against the parallel-execution semantics.

### Pitfall 2: HANDOFF.json corruption under interleaved writes

**What goes wrong:** Two plugins (or two sessions) write HANDOFF.json concurrently; one
truncates the other mid-write, leaving invalid JSON.
**Why it happens:** `checkpoint.cjs:398` uses a bare `fs.writeFileSync` with no lock, unlike
STATE.md writes. PostToolUse fires often (throttled to 60s) and PreCompact/manual-pause can
overlap.
**How to avoid:** Route the HANDOFF.json write through `acquireStateLock(outPath)` +
`releaseStateLock` (D-04). Add an interleaved-write test that spawns concurrent writers and
asserts the file always parses as valid JSON afterward.
**Warning signs:** Intermittent "Unexpected end of JSON input" on resume; a HANDOFF.json
that ends without the trailing newline.

### Pitfall 3: Session marker reaped mid-session

**What goes wrong:** A long session's bm-active marker is deleted by the 5-minute temp
reaper, so gsd stops yielding and the double-fire returns silently.
**Why it happens:** `reapStaleTempFiles('gsd-', { maxAgeMs: 5min })` sweeps matching temp
entries. A marker written once at session start ages out.
**How to avoid:** Refresh the marker mtime on every bm hook fire (write the marker at the
top of every bm hook, not only the first), OR give the marker a prefix the reaper does not
match, OR both. The reaper still cleans it up after the session ends (writes stop).
**Warning signs:** Double-fire reappears only in long sessions; marker file mtime is stale
relative to session activity.

### Pitfall 4: Election forgotten by a JS hook script

**What goes wrong:** A hook implemented as a standalone `hooks/*.js` script (not routed
through `gsd-tools.cjs hook`) mutates shared state without the election, so it double-fires.
**Why it happens:** hooks.json registers several JS scripts directly
(`gsd-context-monitor.js`, `gsd-staleness-reminder.js`, etc.) alongside the
`gsd-tools.cjs hook` dispatch. Only the ones with state-mutating side effects need the
election, but which ones those are must be audited.
**How to avoid:** Single-source the election in `bin/lib/coexist.cjs` and audit every
hooks.json entry: classify each as "mutates shared state" (needs election) vs "read-only
advisory" (safe to double-run, or benign). Document the classification so a new hook cannot
silently skip it.
**Warning signs:** Duplicate HANDOFF.json writes or duplicate checkpoint chatter in a
both-active session despite the gsd-tools election being in place.

### Pitfall 5: CLAUDE_PLUGIN_ROOT absent breaks naive identity detection

**What goes wrong:** Identity keyed only on `process.env.CLAUDE_PLUGIN_ROOT` misfires when
the env var is absent (stale-path fallback scenario the hooks.json resolver already handles).
**Why it happens:** The docs note `CLAUDE_PLUGIN_ROOT` "changes on each plugin update" and
the hooks.json resolver already falls back to the newest cached path when it is pruned.
**How to avoid:** Derive identity from the ACTUALLY-RESOLVED script path (the `x` the
resolver picked), which contains `/gsd/` or `/bm/` (the bm fallback literal is stamped to
`/bm` by Phase 13 D-04). This is robust whether or not the env var is set.
**Warning signs:** Election behaves correctly on fresh installs but misfires right after a
plugin upgrade or cache prune.

## Code Examples

### Reading session_id from hook stdin (already the pattern in gsd-tools.cjs)

```javascript
// Source: gsd-tools.cjs:1262-1266 [VERIFIED: codebase grep]
let hookInput = {};
try {
  const stdinData = fs.readFileSync(0, 'utf-8');
  if (stdinData) hookInput = JSON.parse(stdinData);
} catch { /* stdin may not be available or parseable */ }
const sessionId = hookInput.session_id; // always present per the hooks reference
```

### Existing non-blocking SessionStart context emission (nudge template)

```javascript
// Source: gsd-tools.cjs:1301 (existing resume directive) [VERIFIED: codebase grep]
process.stdout.write(systemMsg);                       // reaches Claude as SessionStart context
process.stderr.write('GSD: session checkpoint detected, auto-resuming...\n'); // user-facing note
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Assume both byte-identical hooks fire because CC never dedupes | CC DOES dedupe by command string + args; gsd/bm fire because the D-04 stamp makes their strings differ | Confirmed 2026-07-11 vs live hooks docs | The double-fire is a consequence of the intentional fallback stamp, not a lack of dedup. Keeping the stamp is required; the election handles the rest |
| SessionStart context via `systemMessage` | `hookSpecificOutput.additionalContext` or plain stdout; `systemMessage` is a user warning line | Current hooks reference | Nudge should use stdout/additionalContext for Claude-visible context; systemMessage only if a literal user-facing warning banner is desired |

**Deprecated/outdated:**
- The CONTEXT.md phrase "same channel as the existing resume directive / systemMessage" is
  slightly imprecise: the existing resume directive uses plain `stdout`, not the
  `systemMessage` JSON field. Follow the actual existing code (stdout).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The bm resolved hook path reliably contains `/bm/` (from the D-04 stamp) so `pluginIdentity` can key on it | Pattern 1, Pitfall 5 | If the stamp does not reach the runtime-resolved path, gsd/bm identity is indistinguishable and the election cannot fire. Verify against `dist/bm/hooks/hooks.json` and the resolved cache path during planning |
| A2 | Refreshing the marker mtime per bm hook fire keeps it clear of the 5-min reaper for arbitrarily long sessions | Pattern 1, Pitfall 3 | If a session goes >5 min between ANY bm hook fires, the marker could be reaped. Hook events (PostToolUse etc.) fire frequently enough in practice, but a truly idle session could exceed it. Consider a longer TTL or reaper exclusion |
| A3 | The nudge on plain stdout is the desired UX (Claude relays it) vs a `systemMessage` user banner | Pattern 3, Open Questions | COMPAT-04 says "displays a nudge"; if the intent is a literal user-visible line, systemMessage may be the better channel. Needs a UX decision |
| A4 | Only `checkpoint.cjs` HANDOFF.json write is an unprotected shared-state writer; "phase-plan writes" are done by agents via the Write tool (CC-managed), not a cjs function needing the lock | COMPAT-03 mapping | If some cjs path writes phase-plan JSON with a bare write, it is an additional gap. Audit confirmed only checkpoint.cjs:398; the other two writeFileSync sites are lockfile writers |
| A5 | The identity-election helper covers all state-mutating hooks; read-only advisory JS hooks are safe to double-run | Pitfall 4 | If a read-only hook actually mutates state, it double-fires. Requires the per-hook classification audit in planning |

## Open Questions (RESOLVED)

1. **Nudge channel: stdout/additionalContext vs systemMessage.**
   - What we know: stdout reaches Claude as SessionStart context (existing pattern);
     `systemMessage` renders a user-facing warning line; both are non-blocking.
   - What's unclear: whether COMPAT-04 "displays a nudge" means Claude-relayed context or a
     literal user banner. D-05 references the resume-directive channel (stdout).
   - Recommendation: default to stdout (matches existing code, guaranteed non-blocking,
     Claude surfaces it). Flag the systemMessage alternative to discuss-phase if a
     guaranteed user-visible banner is required.
   - **Resolved:** D-05 + Plan 03 Task 3. The nudge is emitted on plain stdout (mirroring the
     resume directive at `gsd-tools.cjs:1301`), never the `systemMessage` JSON field. It is
     sentinel-wrapped and exempt from the yield.

2. **Marker TTL for very long idle sessions.**
   - What we know: the reaper sweeps `gsd-`prefixed temp files after 5 minutes; refreshing
     mtime per fire keeps an active session's marker alive.
   - What's unclear: behavior across a >5-minute gap with no bm hook fires.
   - Recommendation: refresh per fire AND use a marker prefix outside the `gsd-` reaper
     match (e.g. `bm-active-`), so a quiet stretch cannot reap it; let end-of-session
     inactivity clean it up naturally.
   - **Resolved:** Plan 02 Task 2. The marker uses the `bm-active-` prefix (outside the
     reaper's default `gsd-` match) AND `markBmActive` refreshes its mtime on every bm hook
     fire, so a long or idle session's marker is never reaped mid-session. Reaper-safety is
     asserted in `tests/coexist.test.cjs`.

3. **Which hooks mutate shared state / which are elected.**
   - What we know: hooks.json registers `gsd-tools.cjs hook` plus the `run-bash-hook.cjs`
     bash dispatch and several standalone `hooks/*.js` detectors.
   - What's unclear: the exact per-hook classification.
   - Recommendation: audit each hooks.json entry during planning; document a
     "needs-election / read-only" table so the single-fire guarantee is provably complete.
   - **Resolved:** Plan 03 Task 2. Per the user's widened D-02 election scope, BOTH shared
     dispatch points now enforce the election: the `gsd-tools.cjs hook` branches
     (session-start, post-tool-use, pre-compact, stop) AND the `run-bash-hook.cjs` dispatch
     (session-state, validate-commit, phase-boundary). The full classification table (every
     hooks.json entry, elected vs read-only advisory, with one-line evidence) is embedded in
     Plan 03, closing Pitfall 4.


## Validation Architecture

> nyquist_validation is not disabled in `.planning/config.json` (key absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Zero-dependency Node harness: `node:assert` + a bare `check(name, fn)` / `test(name, fn)` runner with a failure counter and `process.exit(1)` footer (mirrors `tests/bm-parity.test.cjs`, `tests/checkpoint-write-guards.test.cjs`) |
| Config file | none; tests are standalone executable `.cjs` files run directly |
| Quick run command | `node tests/<file>.test.cjs` (single file) |
| Full suite command | The CI jobs run each test as its own `run:` step in `.github/workflows/check-drift.yml`; locally: run each new `tests/*.test.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMPAT-01 | gsd-only (no marker) runs hooks exactly as today; election is a no-op | unit | `node tests/coexist.test.cjs` | Wave 0 |
| COMPAT-02 | With bm marker present, gsd copy yields; bm copy runs; net one effective fire | unit | `node tests/hook-single-fire.test.cjs` | Wave 0 |
| COMPAT-02 | SessionStart residual bounded: at most one gsd fire before the marker | unit | `node tests/hook-single-fire.test.cjs` | Wave 0 |
| COMPAT-03 | Interleaved HANDOFF.json + STATE.md writes leave valid, parseable files | integration | `node tests/handoff-write-lock.test.cjs` | Wave 0 |
| COMPAT-03 | `writeCheckpoint` acquires/releases the lock (no bare write) | unit | `node tests/handoff-write-lock.test.cjs` | Wave 0 |
| COMPAT-04 | gsd SessionStart emits the nudge (mentions `/bm:` + v5.0), incl. when yielding | unit | `node tests/nudge-emission.test.cjs` | Wave 0 |
| COMPAT-04 | bm package (dist/bm) never emits the nudge (suppression applied) | unit + drift | `node tests/nudge-emission.test.cjs` and `node bin/build-bm.cjs --check` | Wave 0 |
| identity | `pluginIdentity` returns gsd/bm from resolved path with and without CLAUDE_PLUGIN_ROOT | unit | `node tests/coexist.test.cjs` | Wave 0 |

### Sampling Rate

- **Per task commit:** the single new test file touched (`node tests/<file>.test.cjs`).
- **Per wave merge:** all new coexistence tests plus `node bin/build-bm.cjs --check` and
  `node tests/bm-parity.test.cjs` (the nudge suppression must not break parity).
- **Phase gate:** the full `check-drift.yml` suite green (all existing tests plus the new
  coexistence jobs), and the extended `install-smoke.yml` coexistence smoke.

### Wave 0 Gaps

- [ ] `tests/coexist.test.cjs` covers identity election + marker lifecycle (COMPAT-01/02)
- [ ] `tests/hook-single-fire.test.cjs` covers both-active single-fire + SessionStart residual (COMPAT-02)
- [ ] `tests/handoff-write-lock.test.cjs` covers interleaved writes + lock acquisition (COMPAT-03)
- [ ] `tests/nudge-emission.test.cjs` covers gsd-emits (incl. yield) + bm-suppresses (COMPAT-04)
- [ ] CI wiring: add each new test as a `run:` step in `.github/workflows/check-drift.yml`
      (bm coexistence section) and extend `install-smoke.yml` with a both-plugins single-fire smoke
- [ ] No framework install needed (zero-dep harness already in use)

## Security Domain

> `security_enforcement` is not disabled in config (absent = enabled). This phase is
> internal plugin control-flow and local-file coordination with no network, auth, or
> untrusted-input surface, so most ASVS categories do not apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface |
| V3 Session Management | no | `session_id` is CC-provided, not a security session |
| V4 Access Control | no | No access-control surface |
| V5 Input Validation | yes (light) | `session_id` from stdin JSON is used to build a temp-file path; sanitize it (reject path separators / restrict to the CC id charset) before using it in `markerPath` to avoid path traversal into an attacker-influenced temp location |
| V6 Cryptography | no | No cryptography; last-write-wins serialization is not a security control |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `session_id` in marker filename | Tampering | Validate `session_id` against a strict allow-list (e.g. `[A-Za-z0-9_-]+`) before composing `markerPath`; fall back to no-marker (run normally) on a malformed id |
| Stale-lock denial (a crashed writer leaves a `.lock`) | Denial of Service | Already mitigated: `acquireStateLock` reclaims locks older than 10s and registers exit-time cleanup (#1916). Reuse, do not reimplement |
| Symlink attack on the temp marker path | Tampering | Marker lives under `os.tmpdir()/gsd` created by `ensureGsdTempDir`; use plain `writeFileSync` (no follow of attacker symlinks in that dir) and treat a read failure as "not active" |

## Sources

### Primary (HIGH confidence)
- `code.claude.com/docs/en/hooks` (Claude Code hooks reference) - hook execution order
  (parallel within a source, sequential across sources), dedup by command string + args,
  full hook input JSON schema (`session_id`, `transcript_path`, `cwd`, `source`,
  `hook_event_name`, etc.), SessionStart `hookSpecificOutput.additionalContext` vs
  `systemMessage`, and confirmation of NO enabled-plugins signal to hooks.
- Codebase grep (VERIFIED): `bin/lib/checkpoint.cjs:398` bare HANDOFF.json write;
  `bin/lib/state.cjs:947` `acquireStateLock` (O_EXCL) + `:1028` `readModifyWriteStateMd`;
  `bin/lib/core.cjs:189` `GSD_TEMP_DIR` + `reapStaleTempFiles`; `bin/gsd-tools.cjs:1259`
  hook dispatch + `:1301` existing stdout context emission; `bin/lib/bm-transform.cjs`
  transform helpers; `tests/*.test.cjs` zero-dep harness pattern; `check-drift.yml` CI wiring.

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01..D-06 and Phase 12/13 CONTEXT decisions (D-04 fallback stamp, D-05 MCP
  keys) - the decided design this research confirms.

### Tertiary (LOW confidence)
- None. All load-bearing hook-behavior claims are backed by the official reference; all
  code claims are grep-verified.

## Metadata

**Confidence breakdown:**
- Hook semantics (order, dedup, input schema, context channel): HIGH - quoted from the
  official hooks reference.
- COMPAT-03 gap + lock reuse: HIGH - grep-verified against the current code.
- Marker lifecycle / reaper interaction: MEDIUM - reasoned from the reaper code; the exact
  TTL behavior over long idle sessions is an assumption (A2) to validate in planning.
- Nudge channel UX choice: MEDIUM - both channels confirmed; the UX intent is an open
  question (A3).

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (30 days; hook semantics are stable but the docs note some
fields are version-gated, e.g. `prompt_id` requires v2.1.196+)
