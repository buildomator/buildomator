# Phase 10: Convention and Architectural Conformance - Pattern Map (UAT)

**Mapped:** 2026-06-26
**Files analyzed:** 2 new (`bin/lib/conventions.cjs`, `bin/lib/uat-convention-violator.cjs`)
**Analogs found:** 2 / 2
**Scope of this run:** UAT verification of Step 5.5 (Derive Conventions). This is a UAT-scoped artifact, NOT the planning `10-PATTERNS.md`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bin/lib/conventions.cjs` | utility (deterministic analyzer) | transform / batch | `bin/lib/drift.cjs` | exact (same role + same skip-not-throw contract) |
| `bin/lib/uat-convention-violator.cjs` | test fixture | n/a (static fixture) | existing `bin/lib/*.cjs` corpus member | role-match (CJS module shape) |

## Pattern Assignments

### `bin/lib/conventions.cjs` (utility, transform/batch)

**Analog:** `bin/lib/drift.cjs` (the module's own header names it: "mirrors bin/lib/drift.cjs + bin/lib/schema-detect.cjs").

**Imports pattern** (`drift.cjs` lines 33-34; `conventions.cjs` lines 38-39):
```javascript
const fs = require('node:fs');
const path = require('node:path');
```
Node built-ins only, `node:` prefix, `require` (CJS). Zero new runtime dependency.

**Never-throws skip contract** (`drift.cjs` lines 121-231):
```javascript
function detectDrift(input) {
  try {
    if (!input) return skipped('invalid-input');
    // ...
    return { skipped: false, /* ...result fields... */ };
  } catch (err) {
    return skipped('exception:' + (err && err.message ? err.message : String(err)));
  }
}
function skipped(reason) {
  return { skipped: true, reason, /* success fields emptied so callers never branch on shape */ };
}
```
`conventions.cjs` copies this exactly: `derivedSkipped(reason)` (line 293) and `conformanceSkipped(reason)` (line 464) return the success shape emptied, both public entry points wrap the body in try/catch and never throw.

**Pure-library / sanitized-input pattern** (`drift.cjs` `sanitizePaths` line 292; `conventions.cjs` `sanitizePaths` line 86):
The library is pure - it takes inputs and returns a structured result; the CLI/workflow layer runs git / does I/O. Path arguments are run through a conservative allowlist (no `..`, no absolute) before use.

**Module export style** (`drift.cjs` + `conventions.cjs` line 587):
```javascript
module.exports = { /* named functions */ };
```
Single `module.exports` object literal of named functions - the dominant (100%) `bin/lib` export style.

---

### `bin/lib/uat-convention-violator.cjs` (test fixture)

**Analog:** any existing `bin/lib/*.cjs` module (it must read as a valid member of that corpus for its violations to be meaningful).

**Imports / export shape it inhabits** (lines 4, 17):
```javascript
const fs = require('node:fs');
// ...
module.exports = { get_user_config };
```
It deliberately keeps the CJS `require` / `module.exports` shell (so it passes the export/import axes) while violating the identifier-casing axis (`get_user_config`, `config_obj` are snake_case in a camelCase corpus) and the JS/TS idiom rule packs (a `get`-prefixed read verb that mutates + does I/O, and direct `process.env` access). This is a fixture, not production code, and is "NOT wired into anything."

---

## Conventions

Derived by majority vote across `bin/lib` (68 files, the CJS half of the repo). Named contract at share >= 70%; contested hotspot below 70%.

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab (vs camel) | 56% | 0.723 | contested hotspot |
| identifier casing | camelCase | 98% | 0.093 | named contract |
| export style | CJS (`module.exports`) | 100% | 0.000 | named contract |
| import style | CJS (`require`) | 100% | 0.000 | named contract |

(Derivation command: `node bin/gsd-tools.cjs verify conventions --derive --scope bin/lib`. Entropy is normalized Shannon; the 0.70 dominance gate plus an 8-sample floor decides named vs contested.)

**Named contracts (new `bin/lib` files must conform):**
- **identifier casing -> camelCase** (98% share, 0.093 entropy). `bin/lib/uat-convention-violator.cjs`'s `get_user_config` / `config_obj` deviate on purpose.
- **export style -> CJS `module.exports`** (100%).
- **import style -> CJS `require('node:...')`** (100%).

**Contested hotspot (no named contract -> author's choice):**
- **file-name casing** is split kebab 56% / camel 41% inside `bin/lib` (entropy 0.723, below the 0.70 dominance gate). Because no variant clearly dominates, the pattern-mapper emits "no dominant convention (high entropy) - author's choice" rather than a contract, and flags the axis so Phase 11's repo-wide detection has a head start. A new file may use either casing without being a deviation.

### Contested hotspots (author's choice)

The prototype intentional-contested split this milestone exists to make visible is the **CJS <-> SDK dual resolver**:

- **`bin/lib/**` is the CJS half.** Derivation over this scope returns export style = CJS 100% and import style = CJS 100% (`module.exports` / `require`).
- **`sdk/src/**` is the ESM half.** The same derivation over `sdk/src` returns export style = ESM ~99% (`export`) and import style = ESM ~99% (`import`), with identifier casing still camelCase ~95%.

These two halves are deliberately and consistently different on the module-system axes - not drift. Treating them as one corpus would report a contested module-system split; scoped per-half each is a clean named contract. The convention-derivation module is therefore intentionally written **once in CJS** (`bin/lib/conventions.cjs`, D-04) and called by both the pattern-mapper and the code-reviewer, rather than vendored into a CJS twin and an SDK twin - building those twins would itself be the CJS<->SDK duplication this milestone targets. Any reviewer running against `sdk/src/**` should derive conventions scoped to that half, not against `bin/lib`, so the ESM contract is recognized rather than flagged as a violation of the CJS contract.

## Shared Patterns

### Deterministic-analyzer skip contract
**Source:** `bin/lib/drift.cjs` (`detectDrift` + `skipped`, lines 121-231)
**Apply to:** all new `bin/lib` analyzer modules (here, `conventions.cjs`)
Pure function; never throws; returns `{ skipped: true, reason, ...emptied-success-shape }` on bad input or exception so callers never branch on result shape.

### CJS module conventions
**Source:** entire `bin/lib/*.cjs` corpus (export style 100% CJS, identifier casing 98% camelCase)
**Apply to:** every new `bin/lib` file
`'use strict'`, `const x = require('node:...')` imports, single `module.exports = { ... }` of camelCase named functions.

## No Analog Found

None. Both new files have clear `bin/lib` analogs.

## Metadata

**Analog search scope:** `bin/lib/` (CJS), cross-checked against `sdk/src/` (ESM) for the contested-hotspot example.
**Files scanned:** 68 (`bin/lib`) + 299 (`sdk/src`) via the derivation tool.
**Pattern extraction date:** 2026-06-26
