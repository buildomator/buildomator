---
phase: 17-v1-capability-wiring-and-propose-on-fit
reviewed: 2026-10-06T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .github/workflows/check-drift.yml
  - README.md
  - agents/bm-executor.md
  - bin/lib/craft-skill-insert.cjs
  - references/craft-skill-propose-on-fit.md
  - sdk/src/query/QUERY-HANDLERS.md
  - sdk/src/query/command-static-catalog-domain.ts
  - sdk/src/query/craft-skill.test.ts
  - sdk/src/query/craft-skill.ts
  - skills/autonomous/SKILL.md
  - skills/quick/SKILL.md
  - tests/craft-skill-insertion.test.cjs
  - tests/craft-skill-propose-on-fit-guard.test.cjs
  - tests/craft-skill-sdk-parity.test.cjs
  - workflows/autonomous.md
  - workflows/discuss-phase.md
  - workflows/discuss-phase/modes/chain.md
  - workflows/discuss-phase/templates/context.md
  - workflows/quick.md
findings:
  critical: 0
  warning: 3
  info: 0
  convention: 1
  total: 4
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-10-06
**Depth:** standard
**Files Reviewed:** 19 (focused review of the CJS/TS twins, their tests, and the CI drift workflow; the markdown workflows/references/agents/README are instructional content and were read for wiring, not as product source)
**Status:** issues_found

## Summary

The propose-on-fit surface (`craft-skill match`) and its wiring are well built. The read-only match pre-filter treats scope text as data (no regex/path/shell expansion), the trust gate and path/pin validation on `insert` are sound, approval is correctly bound to id+pinned_commit, and the catalog is kept off the session-start cost path. I verified the three CJS suites (`craft-skill-insertion`, `craft-skill-propose-on-fit-guard`, `craft-skill-sdk-parity`) all pass against the committed `sdk/dist/cli.js`, and the standalone conventions check returns no findings on the changed JS/TS files.

No security vulnerability or data-loss bug was found in normal operation. The three warnings below are twin-divergence and robustness defects: one validation gap that writes a garbage config key (reachable from the documented CLI), and two concurrency/atomicity divergences between the CJS and SDK twins that the parity suite does not exercise. These matter because the twins are explicitly meant to "behave identically," and the parity test only covers well-formed, single-process invocations.

No structural pre-pass (`<structural_findings>`) was provided, so this report is narrative findings only.

## Narrative Findings (AI reviewer)

### WR-01: CJS `insert` accepts a value-less `--agent` and writes a bogus `agent_skills.true` entry; the SDK twin rejects it

**File:** `bin/lib/craft-skill-insert.cjs:186-192` (and dispatch at `420-432`)
**Issue:** `cmdCraftSkill` passes the raw parsed flag through (`agent: flags.agent`). When `--agent` is given with no value (e.g. `craft-skill insert seo-audit --agent --location .claude/skills/seo-audit --approved`), `parseFlags` sets `flags.agent = true` (boolean) because the next token starts with `--`. The guard `if (!o.id || !o.agent || !o.location)` passes because `true` is truthy, and `normalizeAgentName(true)` returns the string `"true"`, so the skill is inserted under the nonexistent agent `agent_skills.true`.

I reproduced this end to end: a value-less `--agent --approved` insert produced `config.agent_skills` keys `["true"]`. The SDK twin rejects the identical invocation with the usage error, because its handlers coerce every flag through `asString()` (`sdk/src/query/craft-skill.ts:591-593, 618-634`), turning a boolean flag into `undefined` so the `!o.agent` guard fires. The same raw pass-through affects `--location`, `--id`, and `--catalog` on the CJS side.

This breaks the asserted "behave identically" parity contract (`tests/craft-skill-sdk-parity.test.cjs:4-9`) and pollutes config with a junk key. The parity suite misses it because it only tests well-formed invocations.

**Fix:** Coerce flags in the CJS dispatcher the same way the SDK does, so a value-less flag is treated as absent rather than as the string `"true"`. For example add a helper mirroring `asString` and apply it in `cmdCraftSkill`:
```js
const asStr = (v) => (typeof v === 'string' ? v : undefined);
// ...
insertCraftSkill(cwd, {
  id: positional[0],
  agent: asStr(flags.agent),
  location: asStr(flags.location),
  sticky: !!flags.sticky,
  approved: !!flags.approved,
  catalog: asStr(flags.catalog),
});
```
Apply the same to the `release` (`id`, `agent`), `list`, `assess`, and `match` (`catalog`) cases, and add a parity case that feeds a value-less `--agent` to both twins.

### WR-02: SDK writes `pins.json` with no planning lock, while the CJS twin wraps both writes in `withPlanningLock`

**File:** `sdk/src/query/craft-skill.ts:424-426` (insert) and `489` (release)
**Issue:** The CJS twin wraps every `pins.json` write in `withPlanningLock` (`bin/lib/craft-skill-insert.cjs:266-270` and `324-326`). The SDK twin performs the equivalent `writePins(planningDir, ...)` with no lock at all. The SDK header comment acknowledges only the config write is locked ("through the existing locked config path (configSet)") and leaves the audit-log write unprotected. Under two concurrent `insert`/`release` runs against the same project, the SDK can interleave read-modify-write on `pins.json` and silently drop a record, where the CJS twin is serialized. This is a robustness divergence between twins that the parity suite (single-process) does not catch.

**Fix:** Route the SDK `pins.json` writes through the same planning-lock primitive the config path uses (or the SDK equivalent of `withPlanningLock`) so insert and release serialize their audit-log writes, matching the CJS twin.

### WR-03: `release` mutates a once-read pins object instead of re-reading fresh inside the write, unlike `insert`

**File:** `bin/lib/craft-skill-insert.cjs:303-327`; `sdk/src/query/craft-skill.ts:468-490`
**Issue:** `insert` deliberately re-reads `pins` fresh inside the critical section before appending (`const fresh = readPins(...); fresh.records.push(record); writePins(...)`), so a concurrent write is not clobbered. `release` does the opposite: it reads `pins` once at the top, mutates `record.released_at` on that in-memory object across the loop, and then writes the stale object back (CJS inside the lock but without a fresh re-read; SDK with no lock). A record inserted by another process after `release`'s initial `readPins` is lost when `release` writes its stale snapshot. The asymmetry between the two code paths is itself a smell: one path is TOCTOU-hardened and the sibling is not.

**Fix:** Make `release` re-read `pins` inside the locked critical section and apply the `released_at` stamps to the freshly read records (match by `record_id`), mirroring `insert`'s read-modify-write-under-lock pattern, in both twins.

## Conventions

### CV-01: Em-dash in a reviewed source file violates the project no-dash rule

**File:** `sdk/src/query/command-static-catalog-domain.ts:121`
**Deviation:** The comment `// ── MVP umbrella (#2826) — centralized resolution seams ──` contains an em-dash (U+2014) between "(#2826)" and "centralized". The project rule forbids em-dashes and en-dashes everywhere, including code comments. (The surrounding box-drawing characters `──` are U+2500 and are not dashes, so they are fine.)
**Convention:** Project CLAUDE.md / user instruction: never use em-dashes or en-dashes in any output, including code comments; use a comma, colon, or parentheses instead.
**Note:** This line is pre-existing (introduced in commit `cf4382c`, not by this phase), so it does not gate this work. Recommend fixing opportunistically.
**Suggested fix:** Replace the em-dash with a colon or comma, e.g. `// MVP umbrella (#2826): centralized resolution seams`.

---

_Reviewed: 2026-10-06_
_Reviewer: Claude (bm-code-reviewer)_
_Depth: standard_
