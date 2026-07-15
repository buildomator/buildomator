---
phase: quick-260716-0ao
verified: 2026-07-16T00:00:00Z
status: passed
score: 7/7 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Quick Task 260716-0ao: bm auto-enable from gsd SessionStart Verification Report

**Task Goal:** One-time auto-enable of the bm plugin from the gsd SessionStart hook. When gsd runs and bm is installed-but-not-enabled, gsd enables bm once (atomic settings.json write), records a durable one-time marker, prints a stderr notice, fully fail-soft, and NEVER fights a later deliberate disable.
**Verified:** 2026-07-16
**Status:** passed
**Method:** Live test execution + direct source read against the merged `master` branch (not SUMMARY.md claims).

## Goal Achievement

### Observable Truths (must_haves from PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | bm cached but not enabled and no marker -> enabled exactly once, marker written | VERIFIED | `node tests/bm-autoenable.test.cjs` Test 1 passes live; independently re-ran the enable path in an ad-hoc script (see below) with the same result. |
| 2 | Marker means "gsd has observed bm enabled at least once": written on enable path AND already-enabled path | VERIFIED | Code read: `bin/lib/bm-autoenable.cjs` lines 94-97 write `markerPath` in the already-enabled branch; lines 108-112 write it in the enable branch. Test 5 (marker written on already-enabled, settings unchanged) passes live. |
| 3 | Manual enable -> marker written -> later disable is NOT re-enabled | VERIFIED | Test 7 passes live: first run (already-enabled) writes marker; settings then flipped to `false`; second run returns `acted:false, reason:'marker-exists'` and settings still show `bm@gsd-plugin: false`. |
| 4 | Malformed/missing settings.json, failed cache scan, or failed write is swallowed; never throws, never breaks session start | VERIFIED | Test 4 passes live (missing file + malformed JSON, `assert.doesNotThrow`). Independently constructed a case where `bm` IS cached AND settings.json is malformed (`'{ totally broken json,,, [[['`) and confirmed via a standalone script: `threw: false`, `result: {"acted":false,"reason":"error"}`, marker not written, settings file byte-unchanged. Entire helper body is one `try { ... } catch { return {acted:false, reason:'error'} }` (lines 43-117), with additional inner guards around `readdirSync` and `JSON.parse`. |
| 5 | Cached under both gsd-plugin and buildomator -> resolves to bm@buildomator | VERIFIED | Test 6 passes live; `chooseMarketplace()` (lines 29-35) checks `['buildomator', 'gsd-plugin']` in that order first. |
| 6 | Reload notice to stderr only, never stdout | VERIFIED | `bin/gsd-tools.cjs` line 1313: `process.stderr.write(...)`. Regex check from the plan's own Task 2 verify command (`process.stdout.write` must NOT appear near `autoEnableBm`) ran live and printed "explicit gsd-guard wrapper ok". |
| 7 | Call wrapped in its OWN explicit `if (hookIdentity === 'gsd')` block in gsd-tools.cjs (distinct from the BM-NUDGE guard), inert in dist/bm, `build-bm.cjs --check` green | VERIFIED | Read `bin/gsd-tools.cjs` lines 1278-1318: BM-NUDGE guard closes at line 1287; a separate, later `if (hookIdentity === 'gsd') { try { ... autoEnableBm ... } catch {} }` block starts at line 1300, placed after the `shouldYield` break (line 1291), matching the plan's exact required shape. `node bin/build-bm.cjs --check` ran live: "bm drift check: PASS". |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/lib/bm-autoenable.cjs` | Injectable `autoEnableBm({cacheRoot, settingsPath, markerPath})`, fail-soft, marker on enable+already-enabled | VERIFIED | 121 lines (>= min_lines 60). Exports `autoEnableBm`. All 3 params injectable, confirmed by tests and my own ad-hoc script using fully synthetic temp-dir paths (never touched real `~/.claude`). |
| `tests/bm-autoenable.test.cjs` | Zero-dep node:assert spec, seven cases | VERIFIED | 226 lines (>= min_lines 90). All 7 cases present and pass live (7/7, exit 0). |
| `bin/gsd-tools.cjs` | Dedicated `if (hookIdentity === 'gsd') { try { autoEnableBm(...) } catch {} }` block | VERIFIED | Confirmed at lines 1300-1318, distinct from the pre-existing BM-NUDGE guard (1281-1287). Contains `autoEnableBm`. |
| `dist/bm/bin/lib/bm-autoenable.cjs` | Regenerated bm copy, inert | VERIFIED | Exists; only diff vs source is the expected doc-comment command-rewrite transform (`/gsd:` -> `/bm:` in text), which `build-bm.cjs --check` treats as the committed, non-drifting state (PASS). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/gsd-tools.cjs` (new explicit `hookIdentity === 'gsd'` guard) | `bin/lib/bm-autoenable.cjs` `autoEnableBm` | `require + call, wrapped in try/catch inside the guard` | WIRED | Confirmed by direct read (lines 1300-1317): `require('./lib/bm-autoenable.cjs')` then `autoEnableBm({...})` inside `try {} catch {}` inside the `if (hookIdentity === 'gsd')` block. |
| `bin/lib/bm-autoenable.cjs` | `~/.claude/settings.json` | `read-modify-write with temp-file + atomic rename` | WIRED | Lines 109-111: `tmp = settingsPath + '.gsd-tmp-' + process.pid`, `writeFileSync(tmp, ...)`, `renameSync(tmp, settingsPath)`. |
| `bin/lib/bm-autoenable.cjs` | `~/.claude/.gsd-bm-auto-enabled` (or `CLAUDE_PLUGIN_DATA`) | `one-time marker written on enable AND already-enabled branches` | WIRED | Marker path computed in caller (`bin/gsd-tools.cjs` lines 1304-1310) using `CLAUDE_PLUGIN_DATA` override else homedir, explicitly NOT `resolveGsdDataDir` (which falls back to the versioned cache) — matches the plan's explicit requirement to keep the marker outside the versioned plugin cache. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit spec | `node tests/bm-autoenable.test.cjs` | `bm auto-enable: 7/7 checks passed`, exit 0 | PASS |
| dist/bm drift | `node bin/build-bm.cjs --check` | `bm drift check: PASS (committed dist/bm matches a fresh build).`, exit 0 | PASS |
| Sibling regression: nudge emission | `node tests/nudge-emission.test.cjs` | `All nudge-emission tests passed`, exit 0 | PASS |
| Sibling regression: coexist | `node tests/coexist.test.cjs` | `25/25 checks passed`, exit 0 | PASS |
| Syntax check | `node -c bin/gsd-tools.cjs` | `parse OK` | PASS |
| Plan's own guard-shape regex (Task 2 verify) | inline `node -e` regex from PLAN.md | `explicit gsd-guard wrapper ok` | PASS |
| Independent fail-soft probe: bm cached + malformed settings.json | ad-hoc script (see truth #4) | `threw: false`, `result: {"acted":false,"reason":"error"}`, marker absent, settings byte-unchanged | PASS |
| Independent fail-soft probe: bm cached + missing settings.json | ad-hoc script (see truth #4) | `threw: false`, `result: {"acted":false,"reason":"error"}`, marker absent | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-260716-0ao | 260716-0ao-PLAN.md | One-time bm auto-enable from gsd SessionStart | SATISFIED | All 7 must_haves truths verified; all tests pass live; git log confirms commits 1f24603, 6ca90a5, bfada96 are present on the current branch. |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in `bin/lib/bm-autoenable.cjs` or the new block in `bin/gsd-tools.cjs`. No empty-implementation patterns (`return null`, `return {}`, `=> {}`) beyond the intentional fail-soft `catch { return {acted:false, reason:'error'} }`, which is the documented and tested design, not a stub.

### Human Verification Required

None. All must-haves are mechanically verifiable via the unit spec, source read, and independent probes; no visual, real-time, or external-service behavior is involved.

### Gaps Summary

No gaps. Every truth in must_haves.truths, every artifact, and every key_link was independently verified against the actual merged code (not the SUMMARY narrative):

- Ran the live test suite myself (`node tests/bm-autoenable.test.cjs`) rather than trusting the SUMMARY's "PASS (7/7)" claim — confirmed 7/7, exit 0.
- Read `bin/lib/bm-autoenable.cjs` in full and confirmed the exact ordering (marker gate first, cache scan, guarded settings read, already-enabled branch writes marker, enable branch does atomic temp+rename then marker-last) matches the plan's specified logic verbatim.
- Read `bin/gsd-tools.cjs` around the session-start block and confirmed there are genuinely TWO separate `if (hookIdentity === 'gsd')` blocks — the pre-existing BM-NUDGE one (closes at line 1287) and a new, distinct one for `autoEnableBm` (lines 1300-1318) — matching the plan's explicit warning that "being in the session-start block" is not sufficient.
- Ran `node bin/build-bm.cjs --check` myself and got PASS, confirming dist/bm carries the new helper with no drift.
- Constructed an independent fail-soft probe (bm cached + malformed settings.json, and bm cached + missing settings.json) outside the existing test suite and confirmed no throw, no marker write, no settings corruption in both cases.
- Confirmed the marker path avoids the versioned plugin cache (uses `CLAUDE_PLUGIN_DATA` or homedir, never `resolveGsdDataDir`).
- Confirmed the stderr-only notice via both source read and the plan's own regex check.
- Ran the sibling regression suites (`nudge-emission.test.cjs`, `coexist.test.cjs`) to confirm no collateral breakage from the new wiring.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
