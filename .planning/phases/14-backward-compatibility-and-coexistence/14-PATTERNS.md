# Phase 14: Backward Compatibility and Coexistence - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 11 (4 new, 7 modified)
**Analogs found:** 11 / 11

All new files land in `bin/lib/`, `tests/`, and `.github/workflows/` - every one of them has a strong existing analog in-repo. This phase is composition and coverage-closing over proven primitives (O_EXCL lock, session temp dir, deterministic build transform, zero-dep test harness, CI-as-gate). No external dependencies.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bin/lib/coexist.cjs` (NEW) | utility / lib | event-driven (per-session marker + identity election) | `bin/lib/core.cjs` (GSD_TEMP_DIR, ensureGsdTempDir, reapStaleTempFiles) | role-match |
| `bin/lib/state.cjs` (MODIFY) | lib (locking) | file-I/O (O_EXCL serialized write) | itself - `acquireStateLock` at line 947 is the template to generalize | exact (self) |
| `bin/lib/checkpoint.cjs` (MODIFY) | lib (state writer) | file-I/O (HANDOFF.json write) | `writeStateMd`/`readModifyWriteStateMd` in `state.cjs` (locked write pattern) | exact |
| `bin/gsd-tools.cjs` (MODIFY) | hook dispatch / controller | event-driven (request-response per hook event) | itself - `case 'hook'` at line 1259 (existing session-start dispatch) | exact (self) |
| `hooks/hooks.json` (MODIFY, maybe none) | config | event-driven (hook registration) | itself - inline Node resolver already branches on plugin path | exact (self) |
| `bin/lib/bm-transform.cjs` (MODIFY) | lib (build transform) | transform (pure string rewrite) | itself - `rewriteCommandRefs`/`stampHookFallback` at lines 46/62 | exact (self) |
| `bin/build-bm.cjs` (MODIFY, likely none) | build script | transform (per-file generate loop) | itself - `generate()` at line 170 applies each transform | exact (self) |
| `tests/coexist.test.cjs` (NEW) | test | unit | `tests/checkpoint-write-guards.test.cjs` (zero-dep harness) | exact |
| `tests/hook-single-fire.test.cjs` (NEW) | test | unit | `tests/checkpoint-write-guards.test.cjs` | exact |
| `tests/handoff-write-lock.test.cjs` (NEW) | test | integration | `tests/checkpoint-write-guards.test.cjs` + `tests/bm-parity.test.cjs` (spawnSync) | exact |
| `tests/nudge-emission.test.cjs` (NEW) | test | unit | `tests/bm-parity.test.cjs` (spawnSync + dist/bm assertions) | exact |
| `.github/workflows/check-drift.yml` (MODIFY) | CI config | event-driven (per-test run: step) | itself - `bm-build-drift` job at line 127 | exact (self) |
| `.github/workflows/install-smoke.yml` (MODIFY) | CI config | event-driven (smoke step) | itself - `bm-package-smoke` job at line 111 | exact (self) |

## Pattern Assignments

### `bin/lib/coexist.cjs` (NEW - utility, event-driven)

**Analog:** `bin/lib/core.cjs` (temp-dir conventions) + `bin/lib/bm-transform.cjs` (module shape: pure helpers, single `module.exports` at bottom).

**Temp-dir + marker pattern** - reuse the exact GSD_TEMP_DIR machinery, `core.cjs:189-219`:
```javascript
const GSD_TEMP_DIR = path.join(require('os').tmpdir(), 'gsd');
function ensureGsdTempDir() { platformEnsureDir(GSD_TEMP_DIR); }
function reapStaleTempFiles(prefix = 'gsd-', { maxAgeMs = 5 * 60 * 1000, dirsOnly = false } = {}) {
  // sweeps entries whose name startsWith(prefix) older than maxAgeMs
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;   // <-- KEY: reaper only matches its prefix arg
    ...
  }
}
```
Load-bearing consequence for the marker (Pitfall 3 / Assumption A2): the default reaper matches `gsd-`. The bm-active marker MUST either (a) use a prefix outside `gsd-` (research recommends `bm-active-`) so `reapStaleTempFiles()` never sweeps it, and/or (b) be re-touched (mtime refresh) on every bm hook fire. Import `GSD_TEMP_DIR` + `ensureGsdTempDir` from `./core.cjs`; do not re-derive the temp path.

**Module shape** - copy `bm-transform.cjs` exactly: `'use strict';`, JSDoc per function, pure helpers, `module.exports = { pluginIdentity, markBmActive, isBmActive, shouldYield };` at the bottom (`bm-transform.cjs:68`). CJS `require`/`module.exports`, camelCase identifiers (see Conventions).

**Identity from resolved script path** (D-02, robust when `CLAUDE_PLUGIN_ROOT` is absent - Pitfall 5). Key on the `/gsd/` vs `/bm/` cache-segment that Phase 13's `stampHookFallback` writes (`bm-transform.cjs:32` `cache/gsd-plugin/gsd` -> `cache/gsd-plugin/bm`). The identity check must recognize the SAME literal the stamp produces:
```javascript
function pluginIdentity(resolvedPath) {
  const p = (resolvedPath || __filename).replace(/\\/g, '/');
  if (/\/cache\/gsd-plugin\/bm\//.test(p) || /\/bm\/bin\//.test(p)) return 'bm';
  return 'gsd'; // authored default
}
```

**session_id input validation** (Security V5 / path-traversal): validate `session_id` against `[A-Za-z0-9_-]+` before composing the marker filename; on a malformed id, fall back to "not active" (run normally). Never interpolate a raw id into a path.

---

### `bin/lib/state.cjs` (MODIFY - generalize the lock, D-04)

**Analog:** itself. `acquireStateLock`/`releaseStateLock` are already path-generic - they append `.lock` to whatever `statePath` is passed. No behavior change is needed to the lock itself; the work is exposing/reusing it for HANDOFF.json.

**Lock primitive to reuse verbatim** (`state.cjs:947-988`):
```javascript
function acquireStateLock(statePath) {
  const lockPath = statePath + '.lock';        // <-- already arbitrary-path
  const maxRetries = 10; const retryDelay = 200;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
      _heldStateLocks.add(lockPath);            // exit-time cleanup (#1916)
      return lockPath;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // reclaim locks older than 10s, else retry with jitter
        ...
      }
      return lockPath; // non-EEXIST - proceed without lock (fail-open)
    }
  }
}
function releaseStateLock(lockPath) {
  _heldStateLocks.delete(lockPath);
  try { fs.unlinkSync(lockPath); } catch {}
}
```

**Locked-write wrapper pattern to mirror** (`state.cjs:1002-1007` inside `writeStateMd`):
```javascript
const lockPath = acquireStateLock(statePath);
try {
  platformWriteSync(statePath, synced);
} finally {
  releaseStateLock(lockPath);
}
```
Discretion (research Pattern 2): either keep the name `acquireStateLock` (it is already generic) or add a thin `acquireFileLock(targetPath)` alias in the exports (`state.cjs:1931` module.exports block) for readability. Both `acquireStateLock` and `releaseStateLock` must be exported for `checkpoint.cjs` to require.

---

### `bin/lib/checkpoint.cjs` (MODIFY - close the COMPAT-03 gap, D-04)

**Analog:** `state.cjs` `writeStateMd` locked-write (above). This is the single confirmed unprotected shared-state writer.

**The gap** (`checkpoint.cjs:397-398`, inside `writeCheckpoint`):
```javascript
const outPath = path.join(planningDirPath, 'HANDOFF.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');   // <-- bare, no lock
```

**The fix** - wrap it in the same acquire/try/finally/release as `writeStateMd`:
```javascript
const { acquireStateLock, releaseStateLock } = require('./state.cjs');
const outPath = path.join(planningDirPath, 'HANDOFF.json');
const lockPath = acquireStateLock(outPath);
try {
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
} finally {
  releaseStateLock(lockPath);
}
```
Preserve the two existing guards above it (`checkpoint.cjs:381-395`: refuse to create `.planning/`, skip trivial auto checkpoints) and the surrounding `try { ... } catch { data.partial = true; }` (the 5s PreCompact budget must not crash - `checkpoint.cjs:399-402`). Note A4: the audit confirmed this is the ONLY bare shared-state write; the other two `writeFileSync` sites in checkpoint are lockfile writers, and phase-plan writes go through the agent Write tool (CC-managed), not a cjs function.

---

### `bin/gsd-tools.cjs` (MODIFY - election + nudge at the hook dispatch)

**Analog:** itself, `case 'hook'` at line 1259. The existing session-start branch already reads stdin JSON and emits non-blocking stdout context - both templates you need are in this same block.

**session_id read pattern to reuse** (`gsd-tools.cjs:1262-1266`):
```javascript
let hookInput = {};
try {
  const stdinData = fs.readFileSync(0, 'utf-8');
  if (stdinData) hookInput = JSON.parse(stdinData);
} catch { /* stdin may not be available or parseable */ }
const sessionId = hookInput.session_id; // always present per the hooks reference
```

**Non-blocking nudge template** (D-05/D-06) - mirror the existing resume-directive emit at `gsd-tools.cjs:1301`:
```javascript
process.stdout.write(systemMsg);   // reaches Claude as SessionStart context (non-blocking)
process.stderr.write('GSD: session checkpoint detected, auto-resuming...\n'); // user-facing note
```
The nudge is emitted the same way (plain stdout), from the gsd copy only, and is EXEMPT from the yield (D-06): emit it before/independent of the election decision. Must mention `/bm:` and the v5.0 retirement, plain and non-marketing (no em-dashes). NOT via the `systemMessage` JSON field (that field is a user-warning line, not the context channel - research anti-pattern).

**Election placement** (D-02, Pitfall 4): call `coexist` at the TOP of each state-mutating hook branch. The state-mutating branches are `session-start`, `pre-compact`, `stop`, `post-tool-use` (all of which reach `writeCheckpoint`). Shape:
```javascript
const { pluginIdentity, markBmActive, isBmActive } = require('./lib/coexist.cjs');
const identity = pluginIdentity(__filename);
if (identity === 'bm') markBmActive(sessionId);      // bm self-announces FIRST, synchronously
// (gsd copy, session-start only) emit nudge here - exempt from yield
if (identity === 'gsd' && isBmActive(sessionId)) {
  // yield: skip state-mutating work, exit 0, no side effects
  return; // but the nudge above has already been emitted
}
// ... existing hook work (checkpoint writes, workspace.json, etc.)
```

---

### `hooks/hooks.json` (MODIFY - likely NO change; audit only)

**Analog:** itself. The inline Node resolver (`hooks.json:9`) already resolves the actual on-disk script path (`bin/gsd-tools.cjs` or a `hooks/*.js`) and Phase 13's `stampHookFallback` rewrites the `cache/gsd-plugin/gsd` segment to `.../bm` in the bm copy. That means `__filename` inside the resolved script already carries the `/gsd/` vs `/bm/` identity - no hooks.json edit is required for identity.

**Audit requirement** (Pitfall 4 / research Open Question 3): classify every hooks.json entry as "mutates shared state" (needs election) vs "read-only advisory" (safe to double-run). From this file:
- Route through `gsd-tools.cjs hook` (election added in gsd-tools.cjs): `session-start`, `pre-tool-use`, `post-tool-use`, `pre-compact`, `stop`. Of these, the state-mutating ones (checkpoint writers) are `session-start`, `post-tool-use`, `pre-compact`, `stop`.
- Standalone JS scripts (all read-only advisory - guards/detectors/monitors/reminders, safe to double-run): `run-bash-hook.cjs` targets, `gsd-shadowing-sdk-detector.js`, `gsd-staleness-reminder.js`, `gsd-prompt-guard.js`, `gsd-workflow-guard.js`, `gsd-read-guard.js`, `gsd-auth-detector.js`, `gsd-read-injection-scanner.js`, `gsd-context-monitor.js`.
Document this classification table in the plan so a future hook cannot silently skip the election.

---

### `bin/lib/bm-transform.cjs` (MODIFY - bm nudge suppression, D-06)

**Analog:** itself. Add a third pure transform alongside `rewriteCommandRefs` and `stampHookFallback`, single-sourced so gsd/bm cannot drift.

**Existing transform shape to copy** (`bm-transform.cjs:32-66`) - exact-literal `split().join()`, never a broad regex, idempotent, documented:
```javascript
const FALLBACK_SLASH_FROM = 'cache/gsd-plugin/gsd';
const FALLBACK_SLASH_TO   = 'cache/gsd-plugin/bm';
function stampHookFallback(text) {
  return String(text)
    .split(FALLBACK_SLASH_FROM).join(FALLBACK_SLASH_TO)
    .split(FALLBACK_QUOTED_FROM).join(FALLBACK_QUOTED_TO);
}
module.exports = { rewriteCommandRefs, stampHookFallback };
```
Discretion (D-06): suppression may be a build-time strip (a `suppressNudge(text)` transform that removes/neutralizes the nudge emit block by an exact literal) OR a runtime identity guard (the nudge already only fires for `identity === 'gsd'`, so the bm copy - resolving to `/bm/` - never emits it). The runtime guard is nearly free and is the natural consequence of the D-06 exemption being gsd-only; a build-time strip is the belt-and-suspenders option. Either way it must be single-sourced through this file/`build-bm.cjs`, and `node tests/bm-parity.test.cjs` + `node bin/build-bm.cjs --check` must stay green.

---

### `bin/build-bm.cjs` (MODIFY - likely NO change if runtime guard; wire transform if build strip)

**Analog:** itself, `generate()` at line 170. If suppression is a build-time strip, add the new transform into the per-file loop next to the existing two (`build-bm.cjs:179-180`):
```javascript
if (!COMMAND_REWRITE_EXCLUDE.has(rel)) text = rewriteCommandRefs(text);
if (!STAMP_EXCLUDE.has(rel))          text = stampHookFallback(text);
// (if build-strip chosen) text = suppressNudge(text);
```
If the runtime identity guard is chosen, no build-bm.cjs change is needed. The `--check` drift gate (`check()` at line 247) already regenerates-and-diffs, so any transform added here is automatically enforced.

---

### Tests (NEW - zero-dep Node harness)

**Analog:** `tests/checkpoint-write-guards.test.cjs` (unit shape) and `tests/bm-parity.test.cjs` (spawnSync + dist/bm assertions).

**Harness boilerplate to copy verbatim** (`checkpoint-write-guards.test.cjs:19-41`):
```javascript
const checks = [];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-<name>-test-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
```
Plus the fail-loud footer from `bm-parity.test.cjs`:
```javascript
if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll <name> tests passed');
```

Per-file focus (from RESEARCH Validation table):
- `tests/coexist.test.cjs` - `pluginIdentity` returns gsd/bm from resolved path with and without `CLAUDE_PLUGIN_ROOT`; marker lifecycle (`markBmActive`/`isBmActive`); reaper-safe prefix; malformed `session_id` -> not-active fallback.
- `tests/hook-single-fire.test.cjs` - marker present => gsd yields, bm runs => one effective fire; SessionStart residual bounded to at most one gsd fire before the marker lands.
- `tests/handoff-write-lock.test.cjs` - spawn concurrent/interleaved HANDOFF.json + STATE.md writers (use `spawnSync`/child procs like bm-parity), assert both files always parse as valid JSON/frontmatter afterward; assert `writeCheckpoint` acquires/releases the lock (no bare write).
- `tests/nudge-emission.test.cjs` - gsd SessionStart emits the nudge (mentions `/bm:` + v5.0) INCLUDING when yielding; the bm package (`dist/bm`) never emits it (drift-gate style assertion).

---

### CI (MODIFY - extend the existing bm jobs)

**Analog:** `check-drift.yml` `bm-build-drift` job (line 127) and `install-smoke.yml` `bm-package-smoke` job (line 111).

**check-drift.yml pattern** - one `run:` step per test, following `check-drift.yml:138-145`:
```yaml
      - name: Run build-bm drift test (unit + integration)
        run: node tests/build-bm-drift.test.cjs
      - name: Run bm command-inventory parity test
        run: node tests/bm-parity.test.cjs
```
Add the four new coexistence tests as `run:` steps (either extend the `bm-build-drift` job or add a sibling `bm-coexistence` job). Per RESEARCH: per-wave-merge also runs `node bin/build-bm.cjs --check` + `node tests/bm-parity.test.cjs` so nudge suppression cannot break byte-parity.

**install-smoke.yml pattern** - extend `bm-package-smoke` (line 111) with a both-plugins single-fire smoke, following the existing `CLAUDE_PLUGIN_ROOT="$PWD/dist/bm"` step shape (`install-smoke.yml:141-161`).

## Shared Patterns

### O_EXCL lock + atomic write (COMPAT-03)
**Source:** `bin/lib/state.cjs:947` (`acquireStateLock`) + `:1002-1007` (locked-write wrapper in `writeStateMd`).
**Apply to:** `checkpoint.cjs` HANDOFF.json write; any future shared-state writer. Never a bare `fs.writeFileSync` on a `.planning/` shared file. The lock reclaims stale locks (>10s), registers exit-time cleanup (#1916), and fails open on non-EEXIST errors - reuse, do not reimplement.

### Non-blocking SessionStart context via stdout (COMPAT-04)
**Source:** `bin/gsd-tools.cjs:1301` (existing resume directive).
**Apply to:** the deprecation nudge. `process.stdout.write(msg)` reaches Claude as context and never blocks the command. Not `systemMessage`.

### Deterministic single-sourced build transform (D-06)
**Source:** `bin/lib/bm-transform.cjs:46/62` + `bin/build-bm.cjs:179-180`, gated by `node bin/build-bm.cjs --check`.
**Apply to:** any gsd-only behavior that must be absent from bm (the nudge). Exact-literal `split().join()`, idempotent, JSDoc'd. Never hand-edit `dist/bm` - the drift gate fails it.

### Session temp dir + reaper (D-03 marker lifecycle)
**Source:** `bin/lib/core.cjs:189-219` (`GSD_TEMP_DIR`, `ensureGsdTempDir`, `reapStaleTempFiles`).
**Apply to:** the bm-active per-session marker. The reaper only sweeps entries matching its `prefix` arg (default `gsd-`), so a `bm-active-` prefix survives the default reap; refresh mtime per bm fire for long sessions.

### Zero-dep test harness + CI-as-gate
**Source:** `tests/checkpoint-write-guards.test.cjs` (unit), `tests/bm-parity.test.cjs` (spawnSync + dist assertions), `check-drift.yml` (one `run:` per test).
**Apply to:** all four new coexistence tests and their CI wiring. No framework, `node:assert` + `check()` + fail-loud footer, standalone executable `.cjs`.

## No Analog Found

None. Every file has a strong in-repo analog. The single genuinely new module (`bin/lib/coexist.cjs`) composes two existing patterns (`core.cjs` temp-dir + `bm-transform.cjs` module shape).

## Conventions

Derived via `gsd-tools.cjs verify conventions --derive --scope bin/lib` (the same deterministic module the code-reviewer uses). New product code lands in `bin/lib/` (`coexist.cjs`) and `tests/`.

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab | 58% | 0.714 | contested hotspot |
| identifier casing | camel | 98% | 0.127 | named contract |
| export style | cjs (`module.exports`) | 100% | 0.000 | named contract |
| import style | cjs (`require`) | 100% | 0.000 | named contract |

**Named contracts (must match):** camelCase identifiers, CommonJS `require` / `module.exports` throughout `bin/lib/**`. `coexist.cjs` must be `.cjs`, CJS, camelCase functions (`pluginIdentity`, `markBmActive`, `isBmActive`, `shouldYield`).

**Contested hotspots (author's choice):** file-name casing in `bin/lib/` is split (kebab 41 / camel 28), so it is contested repo-wide and you cannot deviate from local precedent. The dominant and correct choice for a lock/state/transform sibling is lowercase kebab: `coexist.cjs` matches `state.cjs`, `core.cjs`, `checkpoint.cjs`, `bm-transform.cjs` (single-word lowercase / hyphenated). Test files follow `tests/*.test.cjs` kebab (`coexist.test.cjs`, `hook-single-fire.test.cjs`, `handoff-write-lock.test.cjs`, `nudge-emission.test.cjs`).

**CJS<->SDK dual resolver (the prototype intentional-contested split):** the repo runs two parallel resolvers - `bin/lib/**` is CommonJS (`module.exports`/`require`), `sdk/src/**` is ESM (`export`/`import`). Each half is internally consistent per-directory and is contested only when measured repo-wide. Everything in Phase 14 is `bin/lib/**` CJS, so match the CJS half: no ESM `import`/`export` in any new file here.

## Metadata

**Analog search scope:** `bin/lib/`, `bin/`, `hooks/`, `tests/`, `.github/workflows/`
**Files scanned (read in full or targeted):** `state.cjs`, `checkpoint.cjs`, `core.cjs`, `gsd-tools.cjs` (hook dispatch), `hooks.json`, `bm-transform.cjs`, `build-bm.cjs`, `checkpoint-write-guards.test.cjs`, `bm-parity.test.cjs`, `check-drift.yml`, `install-smoke.yml`
**Pattern extraction date:** 2026-07-11
