---
phase: 16-catalog-and-trust-gate-foundation
reviewed: 2026-10-05T03:59:49Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - bin/gsd-tools.cjs
  - bin/lib/config.cjs
  - bin/lib/craft-skill-catalog.cjs
  - bin/lib/craft-skill-insert.cjs
  - bin/lib/skill-trust-gate.cjs
  - sdk/shared/craft-skill-catalog.json
  - sdk/src/craft-skill-catalog.ts
  - sdk/src/craft-skill-catalog.test.ts
  - sdk/src/query/QUERY-HANDLERS.md
  - sdk/src/query/command-static-catalog-domain.ts
  - sdk/src/query/craft-skill.ts
  - sdk/src/query/craft-skill.test.ts
  - sdk/src/skill-trust-gate.ts
  - sdk/src/skill-trust-gate.test.ts
  - tests/craft-skill-catalog.test.cjs
  - tests/craft-skill-insertion.test.cjs
  - tests/craft-skill-no-vendoring.test.cjs
  - tests/skill-trust-gate.test.cjs
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-10-05T03:59:49Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The trust-gate logic itself (`skill-trust-gate.cjs`/`.ts`) is well built: it is a pure structural
check over catalog metadata, never opens a skill file body, never does network/path I/O, and both
twins are in fact byte-identical in the parts I diffed by hand. The catalog loader's closed-schema
validation (exact key set, 40-hex pin requirement, forbidden-key smuggling guard, 400-char string
cap, https-only source) is a solid first line of defense for the "metadata and pins only" invariant
at the top level of a skill entry.

However, the **write side has a real, reproduced data-integrity bug in the CJS twin only**: releasing
more than one craft-skill for the same agent in a single `craft-skill release` call silently
re-adds an entry that had just been removed, while the CLI output and the `pins.json` audit trail
both claim it was released. This is a trust-boundary failure (a "released" skill keeps being
injected into the agent's context) and it is exactly the kind of CJS/SDK divergence the review was
asked to focus on — the SDK twin does not have this bug. I reproduced it below.

I also found that the catalog's body-smuggling guard (forbidden keys + 400-char cap) only applies to
an entry's top-level fields, not to the nested `tooling[]` or `scripts_review` objects, in both
twins. And despite source comments in three files explicitly stating the CJS/SDK twins must be
parity-tested, no such parity test exists for this feature (unlike `config-schema`, which has one).

## Critical Issues

### CR-01: `craft-skill release` silently un-releases an earlier record for the same agent (CJS only)

**File:** `bin/lib/craft-skill-insert.cjs:313-325`

**Issue:** `releaseCraftSkills` loads `config` **once**, before the loop over `selected` records:

```js
if (selected.length > 0) {
  const config = loadConfig(cwd);                                   // loaded once
  for (const record of selected) {
    const current = toArray(lookupByAgentName(config.agent_skills, record.agent)); // stale read
    const next = current.filter((e) => e !== record.entry);
    setConfigValue(cwd, 'agent_skills.' + record.agent, next);       // writes to disk immediately
    record.released_at = now;
    released.push(record.record_id);
  }
  ...
}
```

`setConfigValue` (`bin/lib/config.cjs:359-394`) re-reads `config.json` from disk and writes back on
every call — it does not use the `config` object passed by the caller. So when two records for the
**same agent** are released in one call, the second iteration's `current` is computed from the
pre-loop snapshot, which still contains the entry the first iteration already removed from disk.
`next` for the second record therefore re-includes the first record's entry, and the final
`setConfigValue` call writes it straight back — undoing the first release while the function still
reports both record ids as `released` and stamps both pin records' `released_at`.

I reproduced this directly against the real CLI (two skills inserted for `bm-executor`, then a
single `craft-skill release --agent bm-executor`):

```
config before release: {"agent_skills":{"bm-executor":[".claude/skills/seo-audit",".claude/skills/query"]}}
release: {"released":["seo-audit@bm-executor@...","duckdb-query@bm-executor@..."],"remaining":0}
config after release:  {"agent_skills":{"bm-executor":[".claude/skills/seo-audit"]}}
```

`seo-audit` is reported as released and its pin record is stamped `released_at`, but it is still
present in `agent_skills.bm-executor` and will still be read into the agent's context by
`agent-skills` — a silent trust-gate bypass of the release/revocation path, and a lying audit log.

The SDK twin (`sdk/src/query/craft-skill.ts:477-487`) does **not** have this bug: it calls
`await loadConfig(projectDir, workstream)` **inside** the loop on every iteration, so each
iteration sees the previous iteration's write.

**Fix:** Reload config (or re-derive `current` from the freshly-written config) on every iteration,
matching the SDK twin:

```js
if (selected.length > 0) {
  for (const record of selected) {
    const config = loadConfig(cwd);   // reload every iteration, not once before the loop
    const current = toArray(lookupByAgentName(config.agent_skills, record.agent));
    const next = current.filter((e) => e !== record.entry);
    setConfigValue(cwd, 'agent_skills.' + record.agent, next);
    record.released_at = now;
    released.push(record.record_id);
  }
  withPlanningLock(cwd, () => { writePins(cwd, pins); });
}
```

Add a regression test mirroring the SDK test file's coverage but with two records for the same
agent released in one `--all`/`--agent` call, asserting the config ends up empty for that agent.

## Warnings

### WR-01: Body-smuggling guard does not reach nested `tooling[]` / `scripts_review` objects

**File:** `bin/lib/craft-skill-catalog.cjs:181-208` (mirrored in `sdk/src/craft-skill-catalog.ts:245-272`)

**Issue:** `validateCraftSkillCatalog` enforces the closed key set (`ENTRY_KEYS`), the
`FORBIDDEN_KEYS` smuggling guard, and the `MAX_STRING_LENGTH` (400-char) body-smuggling cap only
against an entry's **top-level** fields:

```js
for (const [field, value] of Object.entries(entry)) {
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) { ... }
}
...
for (const tool of entry.tooling) {
  if (!isPlainObject(tool) || typeof tool.name !== 'string' || typeof tool.license !== 'string') {
    errors.push(`skill ${key} tooling items must have string name and license`);
  }
}
```

Neither the `tooling[]` items nor the `scripts_review` object are checked for unknown/forbidden
keys, and `tool.note` / `scripts_review.note` have no length cap at all (they are typed as `string`
in the TS interfaces but validated only for `typeof`, never for size or extra keys). A catalog entry
can carry, e.g., `tooling: [{ name: "x", license: "MIT", note: "<10kb of arbitrary text>", body: "..." }]`
and `validateCraftSkillCatalog` accepts it. Today nothing renders `note`/extra tool keys into the
trust-gate prompt, so this is not yet reachable as an injection into agent-facing text, but it
directly undermines the stated design goal ("exactly these keys... checkable property rather than a
promise") and the existing no-vendoring test suite only asserts smuggling rejection at the top level
(`tests/craft-skill-catalog.test.cjs:100`, `tests/craft-skill-no-vendoring.test.cjs`).

**Fix:** Recurse the forbidden-key and length-cap checks into `tooling[]` items and `scripts_review`,
and add a negative fixture (`tooling[0].body = '...'` / oversized `tooling[0].note`) to both
`tests/craft-skill-catalog.test.cjs` and `sdk/src/craft-skill-catalog.test.ts`.

### WR-02: No CJS/SDK parity test exists, despite source comments claiming one

**File:** `sdk/src/skill-trust-gate.ts:7-9`, `sdk/src/query/craft-skill.ts:10-11`, `sdk/src/craft-skill-catalog.ts:118-119`

**Issue:** All three SDK modules carry comments asserting the two twins "must stay byte-identical in
behavior so a parity test can compare whole assessment objects across them" / "so a parity test can
compare them." No such test exists anywhere in `tests/` or `sdk/src/` for `craft-skill-catalog`,
`skill-trust-gate`, or `craft-skill-insert` — unlike `config-schema`, which has
`tests/config-schema-sdk-parity.test.cjs` doing exactly this. This is precisely the gap that let
CR-01 ship: a parity test running `releaseCraftSkills` through both twins against the same fixture
(two records, same agent) would have caught the divergence immediately.

**Fix:** Add a parity test (e.g. `tests/craft-skill-sdk-parity.test.cjs`) that round-trips a shared
catalog fixture through both `bin/lib/skill-trust-gate.cjs`/`craft-skill-insert.cjs` and the compiled
SDK twins and diffs the resulting assessment/pin-record objects, including a release scenario with
multiple records for one agent.

### WR-03: The human-approval gate is a self-asserted boolean, not an enforced human step

**File:** `bin/lib/craft-skill-insert.cjs:184-220`, `sdk/src/query/craft-skill.ts:333-369`

**Issue:** `insertCraftSkill` requires `o.approved === true` (or a prior recorded approval) before
writing anything for a non-`block` verdict. `o.approved` is nothing more than the presence of a
`--approved` CLI flag parsed by `parseFlags`. The license-policy comments describe a `flag` verdict
(e.g. copyleft, source-available) as one where "a human must decide," but nothing in this code
distinguishes a flag set by a human-reviewed workflow step from one set by the same autonomous
process that is trying to insert the skill — any caller of the CLI (including a model-driven agent
script) can pass `--approved` on the very first call and self-approve a flagged entry. The resulting
`pins.json` record stores `approved_at` as if it reflects a genuine review decision. This may be
fully intentional (the real gate is presumed to live in whatever workflow drives the CLI, outside
this phase's files), but as shipped in the reviewed files there is no code-enforced distinction
between "a human clicked approve" and "a script passed --approved," which is worth calling out given
this is explicitly a trust/licensing gate.

**Fix:** At minimum, document in the pin record or the approval flow where the human approval signal
is expected to originate (e.g. require the flag to be threaded only from a workflow step that used
`AskUserQuestion`), or record something beyond a boolean (e.g. an approver identity) so the audit
trail in `pins.json` can distinguish a genuine review from a self-approval.

## Info

### IN-01: Cosmetic non-commercial/proprietary mislabeling risk in `classifyOne`

**File:** `bin/lib/skill-trust-gate.cjs:86-89` (mirrored `sdk/src/skill-trust-gate.ts:156-159`)

**Issue:** `const category = /nc/i.test(canon) || /noncommercial/i.test(canon) ? 'non-commercial' : 'proprietary';`
classifies any blocked SPDX id containing the substring `"nc"` anywhere, case-insensitively, as
`non-commercial`. This only affects the human-readable `category` field (the `verdict` stays
`block` either way), but a future addition to `licensePolicy.block` whose id happens to contain
`"nc"` for unrelated reasons (e.g. a hypothetical `LicenseRef-Encrypted`) would be mislabeled in the
rendered assessment prompt.

**Fix:** Match on a curated list of non-commercial SPDX ids (e.g. ids already known to contain
`-NC-` or `Noncommercial`) rather than a bare substring test, or accept the current behavior as
good-enough for a cosmetic field and leave as-is with a one-line comment acknowledging the tradeoff.

## Convention Notes (advisory, non-blocking)

Derived via the shared `verify conventions` rule packs, scoped to the files in this review:

- `bin/gsd-tools.cjs:1277`, `:1279`, `:1323`, `:1336`, `:1363`, `:1448`, `:1472` — empty/swallowing
  `catch` blocks (architectural-split: error-handling convention). These are pre-existing patterns
  in this large file, not new in the craft-skill command family; flagged for completeness since the
  file was in scope. Suggested fix: rethrow, wrap with `{ cause }`, or log-and-handle deliberately.
- `bin/lib/config.cjs:159`, `:162`, `:434` — same empty/swallowing `catch` pattern. Two of the three
  (`:159`, `:162`) are pre-existing `buildNewProjectConfig` migration code untouched by this phase;
  `:434` is the `config-set` JSON-array/object coercion fallback (`try { parsedValue = JSON.parse(value); } catch { /* keep as string */ }`), which is a deliberate, already-commented fallback rather than a hidden failure.

---

_Reviewed: 2026-10-05T03:59:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
