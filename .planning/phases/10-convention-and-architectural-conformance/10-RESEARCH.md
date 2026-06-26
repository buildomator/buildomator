# Phase 10: Convention and Architectural Conformance - Research

**Researched:** 2026-06-26
**Domain:** Deterministic convention derivation + advisory code-review checks over the plugin's own CJS/TS source (no AST, no new runtime deps)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `gsd-pattern-mapper` derives four axes by majority vote: identifier casing, file-name
  casing, export style, and import style. Emit a **named convention only when one variant clearly
  dominates (~>=70%)**. Below that threshold (near-even split / high entropy), emit
  "no dominant convention (high entropy) - author's choice" AND list the axis as a **contested
  hotspot**.
- **D-02:** The derived conventions are written as a new **Conventions** section in PATTERNS.md
  (additive; pattern-mapper's existing analog-mapping output is unchanged).
- **D-03:** `gsd-code-reviewer` gets a **new advisory tier `CONVENTION`**, ranked below WARNING,
  that **never blocks and never gates a merge**. Each finding states the deviation, the derived
  convention it violates, and a suggested fix (recommend-fix framing). All three new checks
  (conformance, verb-vs-body, architectural-split) report at this tier. BLOCKER/WARNING semantics
  untouched.
- **D-04:** Convention derivation lives in a **single shared deterministic module** (in `bin/lib`,
  CJS) — the one source of truth. `gsd-pattern-mapper` calls it to write the PATTERNS.md Conventions
  section; `gsd-code-reviewer` calls it **directly at review time** (no dependency on plan-phase /
  pattern-mapper having run). Phase 11's native fallback reuses the same module. No duplicated
  extraction logic.
- **D-05:** **Language-agnostic architecture, JS/TS rule packs first.** Extraction is a pluggable
  layer. The universally-generalizable axes (**file-name casing**, **identifier casing**) run
  language-agnostically. The idiom checks (**verb-vs-body**, **architectural-split**: DI-vs-env,
  error swallow/throw/wrap) ship as **JS/TS rule packs**; on a language with no pack they
  **skip gracefully**. Covers `.cjs/.js/.mjs/.ts/.tsx`.
- **D-06:** The two low-confidence todo matches (`auto-accept-recommended-default-prompts`,
  `collapse-plan-phase-upstream-gates`) are **NOT folded** — left in pending/.

### Claude's Discretion
- Exact dominance threshold (start ~70%, tune on first run against this repo's CJS/SDK halves).
- The verb taxonomy for verb-vs-body (read-only: get/list/find/read/is/has; mutating:
  set/update/create/delete/save/write) — cherry-pick from VibeDrift, confirm in research.
- The architectural-pattern catalog (which DI-vs-env and error-handling idioms to detect).
- Exact placement/format of the Conventions section in PATTERNS.md and the module's file name.
- The entropy metric formula used to decide "dominant vs contested."

### Deferred Ideas (OUT OF SCOPE)
- Repo-wide drift sweep, optional VibeDrift external gate, `/gsd:scan --drift`, the intentional-dup
  allowlist (`.vibedrift` / `.semdup-allow.json`), `audit-milestone` pre-1.0 gate → **Phase 11**.
- Semantic (Type-4) duplication detection (embeddings / web-tree-sitter pipeline) → Phase 11.
- Consistency-relative security ("N mutating routes lack auth") → future milestone.
- Markdown / workflow instruction-duplication detection → out of scope.
- Non-JS/TS rule packs (Python, Go, etc.) — architecture supports it, packs deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONV-01 | pattern-mapper writes a Conventions section (identifier casing, file-name casing, export style) to PATTERNS.md derived by majority vote with an entropy signal | Module API + majority-vote/entropy formula (§Architecture Patterns, §Code Examples); PATTERNS.md section shape (§Pattern 4) |
| CONV-02 | code-review flags a changed file deviating from the derived convention, passes a conforming one | Per-file conformance check against module output, scoped to the existing `files` list (§Pattern 5); false-positive guards (§Common Pitfalls) |
| CONV-03 | code-review runs a verb-vs-body intent check (name says get, body mutates) | Verb taxonomy + regex body-signal detection, JS/TS rule pack (§Pattern 6) |
| CONV-04 | code-review runs an architectural-split check (DI vs direct env access, error-handling style), no new runtime dep, in existing review path | Regex line-scan idiom detection, no AST/WASM (§No-Dependency Feasibility, §Pattern 7); wired via `node bin/lib/<module>.cjs` Bash call (§Integration Surface) |
</phase_requirements>

## Summary

This phase ports VibeDrift's three highest-signal heuristics — majority-vote convention derivation,
verb-vs-body intent mismatch, and architectural-pattern split — into GSD's own tooling as a single
deterministic CJS module plus advisory `CONVENTION`-tier findings. The work touches the plugin's own
source: `bin/lib/*.cjs` (where deterministic helpers live), two agent markdown files, and the
code-review workflow. There is no web app here; the codebase under analysis IS this repo.

**The critical finding: every Phase 10 check is achievable with regex / line-scanning over source
text. No tree-sitter, no WASM, no `npm install` is needed.** Casing derivation (4 axes) is a pure
tokenizer-over-regex problem. Verb-vs-body needs only function-name extraction plus body-keyword
presence (`return`-only vs assignment/`push`/`await write`). Architectural-split needs only
substring/regex presence of `process.env` vs an injected-config parameter, and `catch {}` vs
`throw`/`wrap`. Accuracy is "good enough for advisory, never-blocking" findings; the never-block tier
(D-03) is precisely what makes regex-level precision acceptable. The web-tree-sitter recommendation
in the semantic-dup research is a **Phase 11** concern (Type-4 duplication), not Phase 10 — Phase 11's
native fallback can layer AST on top of this same module later without rewriting it.

The module follows the established `bin/lib` pattern exactly (pure function, `module.exports`, never
throws, returns a structured result), is wired into `gsd-tools.cjs` as a JSON-emitting subcommand,
and is unit-tested with the repo's zero-dependency `node tests/<name>.test.cjs` harness. Both agents
(which run as subagents with `Bash`) invoke it the same way every other deterministic check is
invoked: `node bin/lib/<module>.cjs ...` (or the `gsd-tools.cjs` subcommand wrapper) and parse JSON.

**Primary recommendation:** Build one `bin/lib/conventions.cjs` module with two public functions —
`deriveConventions(files)` (the 4-axis majority-vote + normalized-entropy derivation) and
`checkConformance(changedFiles, derived)` (per-file deviation + verb-vs-body + architectural-split,
all returning `CONVENTION`-tier findings) — wire it as a `gsd-tools.cjs verify conventions` /
`derive conventions` subcommand pair, and have both agents call it via Bash. Use pure regex; no new
runtime dependency. Mirror `drift.cjs` / `schema-detect.cjs` for structure, error-tolerance, and tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Convention derivation (4-axis majority vote + entropy) | `bin/lib/*.cjs` deterministic module | — | D-04: one source of truth; pure function, no I/O beyond reading the passed file list |
| Per-file conformance check (CONV-02) | `bin/lib/*.cjs` module (logic) | `gsd-code-reviewer` (presentation) | Reviewer scopes to changed `files`, module returns findings |
| Verb-vs-body check (CONV-03) | `bin/lib/*.cjs` module (JS/TS rule pack) | `gsd-code-reviewer` | Idiom check; skips on no-pack languages |
| Architectural-split check (CONV-04) | `bin/lib/*.cjs` module (JS/TS rule pack) | `gsd-code-reviewer` | Idiom check; regex line-scan, no AST |
| Conventions → PATTERNS.md write | `gsd-pattern-mapper` (markdown author) | `bin/lib` module (data) | Mapper owns the doc; module supplies the derived facts |
| Conventions → REVIEW.md findings | `gsd-code-reviewer` (markdown author) | `bin/lib` module (data) | Reviewer owns REVIEW.md; module supplies findings; never blocks (D-03) |
| Subcommand wiring / JSON contract | `bin/gsd-tools.cjs` + `bin/lib/verify.cjs` | — | Existing dispatch pattern (`verify schema-drift`, `verify codebase-drift`) |

## No-Dependency Feasibility (CRITICAL — success criterion 3)

> **Verdict: all four Phase 10 checks run with regex / line-scanning over source text. No AST, no
> WASM, no `npm install`. Per-check breakdown below.** [VERIFIED: codebase grep + design analysis]

The repo currently has **zero runtime `dependencies`** (only `ajv`/`ajv-formats` as devDeps) and a
hard milestone constraint of "no new runtime dependency." [VERIFIED: package.json] Adding
`web-tree-sitter` (~a WASM blob + grammars) would violate that. It is unnecessary for Phase 10.

| Check | Approach | AST needed? | Confidence | Notes |
|-------|----------|-------------|-----------|-------|
| **File-name casing** | Classify each basename (kebab / snake / camel / Pascal) by regex; tally | No | HIGH | Pure string classification; language-agnostic |
| **Identifier casing** | Regex-extract declared identifiers (`function X`, `const X =`, `let X`, `class X`, `X(` defs), classify casing, tally per kind (function vs const vs type) | No | HIGH | Regex misses some edge cases (destructuring, computed names) but advisory tier tolerates it; tally is robust to a few misses |
| **Export style** | Presence of `module.exports` / `exports.X` (CJS) vs `export `/`export default` (ESM) per file | No | HIGH | Substring/regex; the CJS↔SDK split is exactly this axis |
| **Import style** | `require(` (CJS) vs `import … from` (ESM) per file | No | HIGH | Substring/regex |
| **Verb-vs-body (CONV-03)** | Extract function name + its body slice (brace-balance or next-`function` heuristic), classify leading verb (read-only vs mutating), scan body for mutation signals (assignment to params/outer scope, `.push/.pop/.splice`, `await … write/save/update`, `fs.writeFileSync`) | No (brace-counting suffices) | MEDIUM-HIGH | Regex body-slice is approximate; guard with conservative verb list + only flag the **clear** read-verb-but-mutates case to avoid noise |
| **Architectural-split: DI vs env (CONV-04)** | Per-file presence of `process.env` (direct access) vs a config/deps parameter pattern; report the split ratio across changed files | No | MEDIUM-HIGH | `process.env` is a trivially-greppable literal; "DI" is detected as "config passed as an argument" heuristically |
| **Architectural-split: error handling (CONV-04)** | Classify each `catch` block: empty `catch {}`/`catch (e) {}` (swallow) vs `throw` inside (rethrow) vs wrap (`throw new X(…, { cause })` / logs+throws) | No (brace-balance for catch body) | MEDIUM | The three-way classification is the shakiest; keep the taxonomy small and only flag a file whose style differs from the dominant one |

**Where regex is genuinely shaky (be honest):** multi-line function bodies with nested braces inside
strings/regex-literals/template-literals can fool a naive brace counter; the architectural error-style
three-way split is the least precise check. Mitigation is the **advisory, never-block tier** (D-03):
a missed or spurious `CONVENTION` finding costs a reviewer one glance, never a blocked merge. If any
single check proves too noisy on first run, it can be downgraded to "report tally only, suppress
per-file flags" without touching the others. **Architectural-split is the one to ship most
conservatively** (report the split exists; flag individual files only when the dominant style is
clear at ~>=70%).

**Conclusion:** No AST is required for Phase 10. Reserve web-tree-sitter for Phase 11's Type-4
duplication work, where structural extraction is genuinely necessary. [CITED: 10-semantic-dup-research.md
positions web-tree-sitter for Type-4 function extraction, a Phase 11 deferred item]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` / `path` (built-in) | bundled | Read source files, classify paths | Already the only dependency surface in `bin/lib` |
| Node.js regex (built-in) | bundled | Tokenize identifiers, classify casing, detect idioms | No parser needed at advisory precision |
| `node:assert` + bare runner (built-in) | bundled | Unit tests (`tests/*.test.cjs`) | The repo's established zero-dep test pattern [VERIFIED: tests/base-branch-resolver.test.cjs] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bin/lib/shell-command-projection.cjs` `platformWriteSync` | in-repo | Cross-platform file writes if the module ever writes | Only if the module persists output; pattern-mapper/reviewer own the writes, so likely not needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex line-scan | `web-tree-sitter` + JS/TS grammars | Adds a WASM runtime dep (violates constraint), heavier; only justified for Phase 11 Type-4 extraction |
| Regex line-scan | Node's own `vm`/`acorn`-style parse | `acorn` is a new dep; Node has no built-in JS parser exposed for this |
| Bare test runner | `jest` / `vitest` | New devDep; repo deliberately uses zero-dep `node tests/x.test.cjs` [VERIFIED: CI runs `node tests/<f>.test.cjs` directly] |

**Installation:** None. **This phase installs zero packages.** (No Package Legitimacy Audit needed —
see below.)

**Version verification:** N/A — no external packages. Node built-ins only.

## Package Legitimacy Audit

**Not applicable.** This phase installs **no external packages** (success criterion 3: "no new
runtime dependency"). All functionality uses Node.js built-ins (`fs`, `path`, regex, `node:assert`).
slopcheck / npm-registry verification is moot because nothing is installed.

## Project Constraints (from CLAUDE.md)

- All file-changing work must go through a GSD workflow entry point (`/gsd:execute-phase` for planned
  phase work). Plans should assume execution happens under `/gsd:execute-phase`.
- Do **not** make direct repo edits outside a GSD workflow unless explicitly bypassed.
- Keep workflow/skill markdown compact (loaded every invocation) — agent additions to
  `gsd-pattern-mapper.md` / `gsd-code-reviewer.md` should be terse. [MEMORY: minimize workflow tokens]
- No em-dashes in README/CHANGELOG/release notes; never use the word "canonical". [MEMORY]
- Releases: bump BOTH `plugin.json` and `marketplace.json`; ship as git tags; add a row to README's
  "Added features beyond upstream" table for new user-facing capability. [MEMORY] (Release-time, not
  Phase-10-implementation, but the planner should note it for the milestone close.)
- **CJS/SDK dual-resolver awareness:** `gsd-sdk query` runs the SDK (`sdk/dist`); `gsd-tools.cjs` and
  hooks run CJS (`bin/lib`). This Phase-10 module is **CJS-only** (D-04 scopes it to `bin/lib`); it
  does NOT need an SDK twin unless an SDK-side review path needs it (none does for Phase 10). The
  dual resolver is itself the running "intentional contested split" example (D-01). [MEMORY: two
  parallel resolvers]

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
                         │   bin/lib/conventions.cjs  (NEW, CJS)    │
                         │   ── single source of truth (D-04) ──    │
                         │                                          │
  changed/scanned ──────▶│  deriveConventions(files)                │
  source file list       │    ├─ tokenize: filename, identifiers,   │
  (.cjs/.js/.mjs/.ts/tsx) │    │   export/import style per file      │
                         │    ├─ tally variants per axis            │
                         │    ├─ normalized-entropy + dominance     │
                         │    └─▶ { axes:[{name,dominant,share,     │
                         │          entropy,contested,variants}] }  │
                         │                                          │
                         │  checkConformance(changedFiles, derived) │
                         │    ├─ casing deviation (CONV-02)         │
                         │    ├─ verb-vs-body (CONV-03, JS/TS pack) │
                         │    └─ arch-split (CONV-04, JS/TS pack)   │
                         │      ─▶ [{tier:'CONVENTION', file, line, │
                         │          deviation, convention, fix}]    │
                         └──────────────▲───────────────▲──────────┘
                                        │ (Bash: node …)│ (Bash: node …)
            derive at plan time         │               │   derive+check at review time
                                        │               │
        ┌───────────────────────────────┐      ┌────────┴──────────────────────────┐
        │ gsd-pattern-mapper (subagent)  │      │ gsd-code-reviewer (subagent)       │
        │ Step 5.5 (NEW): derive →       │      │ scoped to workflow `files` list    │
        │ write "## Conventions" into    │      │ emit CONVENTION-tier findings into │
        │ {phase}-PATTERNS.md (D-02)     │      │ {phase}-REVIEW.md (D-03, advisory) │
        └───────────────────────────────┘      └─────────▲──────────────────────────┘
                                                          │ passes `files:` list
                                              ┌───────────┴───────────┐
                                              │ workflows/code-review │
                                              │ (existing review path)│
                                              └───────────────────────┘
```

The reviewer derives conventions **at review time** (D-04: standalone, no dependency on the mapper
having run). The mapper writes them into PATTERNS.md for the planner/executor contract. Both call the
**same** module, so there is no second extraction implementation (which would itself be the drift this
milestone targets).

### Recommended Project Structure
```
bin/lib/
├── conventions.cjs          # NEW: deriveConventions + checkConformance (one source of truth, D-04)
├── verify.cjs               # MODIFY: add cmdVerifyConventions (JSON subcommand, mirror schema-drift)
bin/
├── gsd-tools.cjs            # MODIFY: route `verify conventions` / `derive conventions` (1-2 lines)
tests/
├── conventions.test.cjs     # NEW: unit tests (zero-dep runner) — add to CI check-drift.yml
agents/
├── gsd-pattern-mapper.md    # MODIFY: new Step (5.5) + "## Conventions" output format
├── gsd-code-reviewer.md     # MODIFY: CONVENTION tier in <adversarial_stance>; checks in <depth_levels>
workflows/
├── code-review.md           # MODIFY: (optional) note the module call; reviewer can self-invoke via Bash
```

### Pattern 1: Pure, never-throwing `bin/lib` module
**What:** A deterministic CJS module that takes already-collected inputs and returns a structured
result. I/O (running git, spawning agents, writing docs) lives in the CLI/agent layer, not the module.
**When to use:** This is the established `bin/lib` contract.
**Example:**
```js
// Source: bin/lib/drift.cjs (in-repo pattern)
'use strict';
function detectDrift(input) {
  try {
    if (!input || typeof input !== 'object') return skipped('invalid-input');
    // …pure logic…
    return { skipped: false, elements, /* … */ };
  } catch (err) {
    return skipped('exception:' + (err?.message ?? String(err))); // NEVER throws
  }
}
module.exports = { detectDrift, /* … */ };
```
Mirror this exactly: `deriveConventions` and `checkConformance` validate inputs, never throw, and
return `{ skipped: true, reason }` on bad input so the review/plan path is never broken.

### Pattern 2: Pattern table + classifier (file/path classification)
**What:** A frozen list of `{ regex, label }` rules; `classify(x)` returns the first match.
**Source:** `bin/lib/schema-detect.cjs` (`SCHEMA_PATTERNS`) and `bin/lib/drift.cjs` (`classifyFile`).
Use for file-name casing classification and the architectural idiom catalog.
```js
// Source: bin/lib/schema-detect.cjs
const CASING_RULES = [
  { re: /^[a-z0-9]+(-[a-z0-9]+)+$/, label: 'kebab' },
  { re: /^[a-z0-9]+(_[a-z0-9]+)+$/, label: 'snake' },
  { re: /^[a-z][a-zA-Z0-9]*$/,      label: 'camel' },
  { re: /^[A-Z][a-zA-Z0-9]*$/,      label: 'Pascal' },
  { re: /^[A-Z0-9]+(_[A-Z0-9]+)*$/, label: 'CONSTANT' },
];
function classifyCasing(name) {
  for (const { re, label } of CASING_RULES) if (re.test(name)) return label;
  return 'other';
}
```

### Pattern 3: JSON-emitting subcommand wired into gsd-tools/verify
**What:** Expose the module through `gsd-tools.cjs` → `verify.cjs` as a subcommand that `output(...)`s
JSON, exactly like `verify schema-drift` and `verify codebase-drift`.
**Source:** `bin/lib/verify.cjs` `cmdVerifySchemaDrift` (lines ~1188-1262) and `cmdVerifyCodebaseDrift`.
**Why it matters for agents:** Subagents have `Bash`. They invoke the check the same way the workflow
already invokes other deterministic checks — `node "$ROOT/bin/gsd-tools.cjs" verify conventions
--files a,b,c` — and parse the JSON. No need for the workflow to pre-compute and inject; the reviewer
is standalone (D-04).

### Pattern 4: PATTERNS.md "## Conventions" section shape (CONV-01 / D-02)
**What:** Additive section the pattern-mapper writes after its existing analog output.
**Recommended shape:**
```markdown
## Conventions

Derived by majority vote over {N} source files. A convention is **named** only at >=70% dominance;
below that the axis is a **contested hotspot** (already inconsistent — Phase 11 detection territory).

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| File-name casing | kebab-case | 100% | 0.00 | named contract |
| Identifier casing (functions) | camelCase | 96% | 0.18 | named contract |
| Identifier casing (constants) | UPPER_SNAKE | 91% | 0.30 | named contract |
| Export style | (split) | 59% module.exports | 0.97 | **contested hotspot** |
| Import style | (split) | 59% require() | 0.97 | **contested hotspot** |

**Contested hotspots (author's choice — no dominant convention):**
- **Export/import style** — `bin/lib/**` is 100% CJS (`module.exports`/`require`), `sdk/src/**` is
  100% ESM (`export`/`import`). This is the **intentional CJS↔SDK dual resolver**, the prototype
  "intentional, contested split." When measured per-directory each half is internally consistent;
  repo-wide the axis is contested. Reviewers/planners: match the **directory's** local style.
```
**Design note (important):** Measured **repo-wide**, export/import are ~even and look contested.
Measured **per-directory** (`bin/lib` vs `sdk/src`) each is 100% consistent. [VERIFIED: 63 files use
`module.exports` in bin/lib, 242 `require(` calls; sdk/src uses `export`/`import` — codebase grep]
Recommend the module accept an optional **scope** (e.g. derive within the changed file's directory
subtree) so a new `bin/lib/*.cjs` file is judged against CJS, not against the whole repo. At minimum,
surface the per-directory split in the contested-hotspot note so the dual resolver reads as
intentional, not as drift. This directly satisfies CONTEXT.md's "make the CJS↔SDK dual resolver
visible as the prototype intentional-contested split."

### Pattern 5: Conformance check scoped to changed files (CONV-02)
**What:** `checkConformance(changedFiles, derived)` flags only files in the reviewer's `files` list
that deviate from a **named** convention (skip contested axes — you cannot deviate from "author's
choice"). The workflow already passes the explicit changed-`files` list to the reviewer
[VERIFIED: workflows/code-review.md `files:` block], so scoping is free.

### Pattern 6: Verb-vs-body intent check (CONV-03, JS/TS rule pack)
**Verb taxonomy** (cherry-picked from VibeDrift, confirmed reasonable for CJS/TS):
- **Read-only leading verbs:** `get`, `list`, `find`, `read`, `is`, `has`, `should`, `can`, `to`,
  `compute`, `derive`, `select`, `resolve`, `parse`, `format`, `build` (build is borderline — treat
  as read-only-returning).
- **Mutating leading verbs:** `set`, `update`, `create`, `delete`, `remove`, `save`, `write`, `push`,
  `add`, `insert`, `apply`, `mutate`, `upsert`, `sync`, `commit`, `register`.
- **Flag only the clear mismatch:** a function whose name leads with a **read-only** verb but whose
  body contains a strong **mutation signal**: assignment to a parameter or outer-scope variable,
  `.push(`/`.pop(`/`.splice(`/`.shift(` on an argument, `await`ed `*.write*`/`*.save*`/`*.update*`,
  `fs.writeFileSync`/`writeFile`, or `process.env.X =`. Do **not** flag the reverse (mutating verb +
  read-only body) — that is benign and noisy.
**Why this direction only:** the eval's value was "name says `get`, body mutates" — a correctness
smell. The reverse is harmless. Restricting to one direction roughly halves false positives.

### Pattern 7: Architectural-split check (CONV-04, JS/TS rule pack)
**DI-vs-env axis:** classify each changed file as `direct-env` if it contains `process.env` access,
vs `injected` if config arrives as a function parameter / constructor arg (heuristic: file has no
`process.env` and receives a `config`/`deps`/`options` parameter). Report the split across the
**derived** corpus; flag a changed file only when it uses `process.env` directly while the dominant
style (>=70%) is injection (or vice-versa).
**Error-handling axis:** for each `catch` block, classify body as:
- `swallow` — empty or only a `console.*`/comment, no `throw`/`return err`.
- `rethrow` — contains `throw`.
- `wrap` — `throw new <Error>(… , { cause })` or logs-then-throws.
Flag a changed file whose dominant catch style differs from the corpus's dominant style. **Ship this
axis most conservatively** (least precise); when in doubt, report the split tally without per-file flags.

### Anti-Patterns to Avoid
- **Repo-wide casing verdict that ignores the dual resolver:** flagging every new `bin/lib/*.cjs`
  file for using `require()` because "the repo also has ESM." Scope to directory or surface the
  contested hotspot (Pattern 4).
- **Blocking on a CONVENTION finding:** D-03 — never. No `(Recommended)` rubber-stamp prompt either
  (prior project steer: recommended outcomes must be silent / recommend-fix framing).
- **A second extraction implementation in the SDK or in the reviewer:** D-04 — one module only.
- **Flagging the benign verb-vs-body direction** (mutating verb + pure body): noise.
- **Naming a convention below the dominance threshold:** emit "author's choice / contested" instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File classification | Ad-hoc `if/else` per casing | Frozen `{re,label}` table + `classify()` | Matches `schema-detect.cjs`/`drift.cjs`; testable, extensible (D-05 rule packs) |
| JSON subcommand plumbing | New CLI entrypoint | `gsd-tools.cjs` → `verify.cjs` `output(...)` pattern | Existing dispatch; agents already call it via Bash |
| Cross-platform writes (if needed) | `fs.writeFileSync` directly | `platformWriteSync` from `shell-command-projection.cjs` | Repo's CRLF/Windows-safe write helper |
| Test harness | jest/vitest | `node:assert` + bare `check()` runner | Zero-dep; CI runs `node tests/<f>.test.cjs` |
| Entropy / dominance | Bespoke "is it consistent?" heuristic | Normalized Shannon entropy (standard) | Documented, defensible, single threshold to tune |

**Key insight:** The whole milestone is about NOT re-implementing things differently across sessions.
The module must itself be the single source of truth — building a CJS twin and an SDK twin of the
derivation would be the exact CJS↔SDK duplication this phase exists to make visible. D-04 is
load-bearing: one module, called from two places.

## Common Pitfalls

### Pitfall 1: Repo-wide derivation mislabels the intentional CJS↔SDK split as drift
**What goes wrong:** ~38% of VibeDrift's gsd-plugin dup findings were the deliberate dual resolver.
The casing/export/import axes will show export+import as "contested" repo-wide.
**Why it happens:** The repo legitimately runs two module systems in two subtrees.
**How to avoid:** Derive per-directory scope (or at least surface the per-directory split in the
contested-hotspot note). Never name a single repo-wide export/import convention. [VERIFIED: bin/lib
100% CJS, sdk/src ESM]
**Warning signs:** A new `bin/lib/*.cjs` file flagged for `require()`/`module.exports`.

### Pitfall 2: Regex brace-counting fooled by braces inside strings/templates/regex literals
**What goes wrong:** Function-body slicing for verb-vs-body / catch-classification over-/under-reads.
**Why it happens:** `{` inside a string or template literal is not a block brace.
**How to avoid:** Strip string/template/regex/comment spans before brace counting (a cheap
pre-pass that blanks `"…"`, `'…'`, `` `…` ``, `/*…*/`, `//…`), then count. Accept residual error
because the tier never blocks.
**Warning signs:** Findings citing a line far past the function's real end.

### Pitfall 3: Low file count → entropy/dominance is statistically meaningless
**What goes wrong:** With 2-3 changed files, "70% dominance" is one file.
**Why it happens:** Conformance runs on a small changed set; derivation should run on the **corpus**
(repo or directory), not just the changed files.
**How to avoid:** Derive conventions from a **broad corpus** (the directory subtree or repo), then
**check** the small changed set against that derived contract. Add a `minSamples` guard (e.g. require
>= ~8 observations on an axis before naming a convention; below that → "insufficient data").
**Warning signs:** Convention flips between runs as different files change.

### Pitfall 4: Verb-vs-body false positives on legit read-builders
**What goes wrong:** `buildMessage()` that locally constructs and `.push()`es into a *local* array
gets flagged as "mutates."
**Why it happens:** Local mutation of a freshly-declared local is not a side effect.
**How to avoid:** Only count mutation of **parameters** or **outer-scope/module** names, or
side-effecting I/O calls — not assignments/pushes to variables declared inside the same function.
**Warning signs:** Pure formatting/builder helpers flagged.

### Pitfall 5: Suppressed-but-silent contested axes
**What goes wrong:** Hiding contested axes entirely loses the Phase 11 head start.
**Why it happens:** Over-eager noise suppression.
**How to avoid:** Contested axes are **reported as hotspots** (D-01), not dropped — they hand Phase 11
detection a seed list without doing repo-wide detection here.

## Runtime State Inventory

> This is a rename/refactor-adjacent phase (it adds tooling, does not rename runtime state). Included
> for completeness; most categories are empty.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore keys involved | None |
| Live service config | None — no external service config | None |
| OS-registered state | None | None |
| Secrets/env vars | None added/renamed (the module *reads* source text for `process.env` literals as a signal; it does not consume env vars itself) | None |
| Build artifacts | **`command-aliases.generated.cjs`** and `state-document.generated.cjs` exist; if a new `verify conventions` subcommand needs an alias, the generated alias map may need regeneration. Verify whether `gsd-tools.cjs` subcommand additions require regenerating `command-aliases.generated.cjs`. | Check alias-generation step during planning |

**Nothing found** in Stored data / Live service config / OS-registered state — verified by inspecting
the module's pure-function design (no I/O beyond reading the passed file list).

## Code Examples

### Normalized Shannon entropy + dominance (the derivation core)
```js
// Normalized Shannon entropy over a variant tally. 0 = single variant (fully
// concentrated), 1 = perfectly even split. Dominance = max share.
// Source: standard normalized entropy H_norm = -Σ p_i·log(p_i) / log(n)
//   (mc-stan.org/posterior entropy ref; emergentmind Normalized Shannon Entropy)
function summarizeAxis(counts /* { variant: n } */, opts = {}) {
  const minSamples = opts.minSamples ?? 8;
  const dominanceThreshold = opts.dominanceThreshold ?? 0.70;
  const variants = Object.entries(counts).filter(([, n]) => n > 0);
  const total = variants.reduce((s, [, n]) => s + n, 0);
  if (total < minSamples || variants.length === 0) {
    return { status: 'insufficient-data', total, dominant: null, share: 0, entropy: null, variants };
  }
  // dominant variant + share
  variants.sort((a, b) => b[1] - a[1]);
  const [domName, domN] = variants[0];
  const share = domN / total;
  // normalized entropy
  let H = 0;
  for (const [, n] of variants) { const p = n / total; H -= p * Math.log(p); }
  const Hnorm = variants.length > 1 ? H / Math.log(variants.length) : 0;
  const contested = share < dominanceThreshold;
  return {
    status: contested ? 'contested' : 'named',
    dominant: contested ? null : domName,
    share, entropy: Number(Hnorm.toFixed(3)), contested, total,
    variants: Object.fromEntries(variants),
  };
}
```
Single tunable: `dominanceThreshold` (start 0.70 per D-01/Discretion). Entropy is reported as the
signal; the **share >= threshold** test is the decision (entropy and share agree, but share is the
human-legible knob).

### Identifier extraction (regex, no AST)
```js
// Extract declared identifiers by kind. Approximate by design (advisory tier).
function extractIdentifiers(src) {
  const noStrings = blankSpans(src); // strip "…" '…' `…` /*…*/ //… first
  const fns = [...noStrings.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  const consts = [...noStrings.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]);
  const classes = [...noStrings.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  return { fns, consts, classes };
}
```

### Agent invocation (from a subagent's Bash)
```bash
# Both pattern-mapper and code-reviewer call the SAME module this way (D-04).
ROOT="${CLAUDE_PLUGIN_ROOT:-$(ls -d "$HOME/.claude/plugins/cache/gsd-plugin/gsd/"*/ 2>/dev/null|sort -V|tail -1)}"
# derive (mapper): JSON of the 4 axes for the corpus
node "$ROOT/bin/gsd-tools.cjs" verify conventions --derive --scope bin/lib
# check (reviewer): CONVENTION-tier findings for the changed files
node "$ROOT/bin/gsd-tools.cjs" verify conventions --check --files "bin/lib/foo.cjs,bin/lib/bar.cjs"
```
Mirror `cmdVerifySchemaDrift`'s `output({...}, raw)` JSON contract so the agent parses a stable shape.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded style rules (eslint-style configs) | Derive the convention from the codebase by majority vote + entropy, flag deviations | VibeDrift's contribution (2026) | Conventions reflect what the code *actually does*, not an imposed ruleset; the "different AI sessions" framing is explicit |
| Block on style violations | Advisory, never-block `CONVENTION` tier (recommend-fix) | This phase (D-03) | Consistency nits never drown out real bugs |
| AST/token clone tools for everything | Regex line-scan for casing/idioms; reserve AST for Type-4 dup only | This phase vs Phase 11 | Phase 10 ships zero-dep; AST deferred to where it is actually required |

**Deprecated/outdated:**
- The stale `.planning/codebase/*.md` maps describe a *different* TS/Bun/React codebase — **do not
  trust them** for convention derivation. Derive from the real repo. [CITED: CONTEXT.md code_context]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The verb taxonomy lists (read-only vs mutating leading verbs) are reasonable for CJS/TS | Pattern 6 | A poorly-chosen verb causes noisy or missed verb-vs-body findings; advisory tier limits damage; tune on first run |
| A2 | `minSamples >= 8` and `dominanceThreshold = 0.70` are sensible starting values | Code Examples / D-01 | Too-low minSamples names a convention on thin evidence; tune on this repo's halves (explicitly a Discretion item) |
| A3 | Regex string/template-blanking pre-pass yields acceptable brace-counting accuracy for advisory findings | Pitfall 2 | Mis-sliced function bodies → occasional wrong line numbers; never-block tier tolerates it |
| A4 | Per-directory scoping (or surfaced per-directory split) correctly frames the CJS↔SDK resolver as intentional | Pattern 4 / Pitfall 1 | If derivation stays strictly repo-wide, every new bin/lib file is mis-flagged; mitigation is the contested-hotspot note at minimum |
| A5 | Adding a `verify conventions` subcommand does not require regenerating `command-aliases.generated.cjs` (or that regeneration is a known step) | Runtime State Inventory | A missing alias means the subcommand isn't reachable by its short form; verify during planning |

## Open Questions (RESOLVED)

1. **Derivation scope: per-directory vs repo-wide vs changed-file-subtree.** **RESOLVED (Plan 10-01):**
   `deriveConventions(files, opts)` takes an optional `opts.scope` directory subtree; conformance
   defaults to the changed file's directory, the PATTERNS.md overview derives repo-wide with the
   per-directory split surfaced as a contested hotspot.

2. **Does `gsd-tools.cjs` subcommand addition require alias regeneration?** **RESOLVED (Plan 10-02):**
   Yes — `bin/lib/command-aliases.generated.cjs` carries `VERIFY_SUBCOMMANDS` (feeds the
   unknown-subcommand error list), so `verify.conventions` must be added there mirroring the
   `verify.schema-drift` entry. CAVEAT (verified during plan-check): the only generator
   (`sdk/scripts/gen-command-aliases.ts`) emits the SDK `.ts` twin, NOT the `bin/lib` `.cjs`, and
   the freshness checker `sdk/scripts/check-command-aliases-fresh.mjs` resolves a non-existent
   `get-shit-done/…command-aliases.generated.cjs` path (pre-existing breakage in this flat plugin
   layout — out of Phase 10 scope). Plan 10-02 therefore adds the manifest entry + the `.cjs`
   entry directly and verifies functionally (`verify conventions` routes + `conventions` appears in
   the subcommand list) rather than via the broken freshness script.

3. **Should the reviewer self-derive every run, or reuse a cached PATTERNS.md derivation?**
   **RESOLVED (Plan 10-03, per D-04):** self-derive each run (cheap regex over a directory); never
   depend on PATTERNS.md existing — optionally read its Conventions table as a hint if present.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | module + tests | ✓ (repo runs on Node; CI uses it) | repo CI Node | — |
| `node:fs` / `node:path` / `node:assert` | module + tests | ✓ built-in | — | — |
| Git | (only if scoping by diff; reviewer already gets `files`) | ✓ | — | reviewer `files` list (no git needed) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None needed — zero external dependencies (the whole point).

## Validation Architecture

> `workflow.nyquist_validation` not explicitly false → section included. This phase is highly
> unit-testable (a deterministic pure module), so test-driven validation is strongly warranted.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:assert` + bare `check(name, fn)` runner (zero-dep) |
| Config file | none — convention is `tests/<name>.test.cjs`, run directly |
| Quick run command | `node tests/conventions.test.cjs` |
| Full suite command | `for f in tests/*.test.cjs; do node "$f" || exit 1; done` |

CI runs individual test files via `node tests/<f>.test.cjs` in `.github/workflows/check-drift.yml`
[VERIFIED: workflow file]. **Add `node tests/conventions.test.cjs` to that workflow** as part of the
phase so the new module is gated in CI.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | `deriveConventions` returns named convention at >=70% dominance | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-01 | `deriveConventions` returns contested hotspot below threshold (e.g. CJS/SDK export split) | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-01 | normalized entropy ≈ 0 for single variant, ≈ 1 for even split | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-02 | `checkConformance` flags a deviating changed file, passes a conforming one | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-02 | conformance never emits a finding for a contested axis | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-03 | verb-vs-body flags read-verb + body-mutation; passes mutating-verb + pure body | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| CONV-04 | arch-split flags `process.env` file when dominant style is injection; classifies catch swallow/rethrow/wrap | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| D-03 | all findings carry tier `CONVENTION` and never mark `blocking: true` | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| D-05 | non-JS/TS input skips idiom checks gracefully (returns no idiom findings, not an error) | unit | `node tests/conventions.test.cjs` | ❌ Wave 0 |
| (integration) | `gsd-tools.cjs verify conventions --check --files …` emits valid JSON | integration | `node tests/conventions.test.cjs` (spawn gsd-tools) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/conventions.test.cjs`
- **Per wave merge:** `for f in tests/*.test.cjs; do node "$f" || exit 1; done`
- **Phase gate:** full suite green + the new test added to `check-drift.yml` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/conventions.test.cjs` — covers CONV-01..04, D-03, D-05 (new)
- [ ] Add `node tests/conventions.test.cjs` to `.github/workflows/check-drift.yml`
- [ ] (No framework install — zero-dep harness already in use)

## Security Domain

> `security_enforcement` absent in config → treated as enabled. This phase is low-attack-surface
> (a read-only static analyzer over local source text), but two input-handling controls apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Local tooling only |
| V5 Input Validation | yes | File paths from `--files` must be validated (no traversal); module must tolerate malformed source without throwing (`{skipped:true}` pattern) |
| V6 Cryptography | no | No crypto |

### Known Threat Patterns for {Node CJS static analyzer}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `--files` (`../../etc/...`) | Tampering | Reuse the workflow's existing path guard (`realpath -m` within repo root; `SAFE_PATH_RE` in `drift.cjs`); reject paths outside the repo |
| ReDoS via pathological identifier regexes on hostile source | DoS | Keep regexes linear (avoid nested quantifiers / catastrophic backtracking); cap per-file scan size |
| Crash on malformed/binary file fed as source | DoS | Never-throw contract (`{skipped:true, reason}`), wrap per-file scan in try/catch, skip non-text |
| Splicing a file path into a shell/agent prompt | Injection | The module returns data only; the agent/CLI layer does interpolation — reuse `sanitizePaths` from `drift.cjs` before any path reaches a prompt |

## Sources

### Primary (HIGH confidence)
- In-repo: `bin/lib/drift.cjs`, `bin/lib/schema-detect.cjs`, `bin/lib/verify.cjs`
  (`cmdVerifySchemaDrift`) — module structure, never-throw contract, JSON subcommand pattern,
  path-sanitization helpers.
- In-repo: `tests/base-branch-resolver.test.cjs` — zero-dep test harness pattern.
- In-repo: `workflows/code-review.md` — reviewer gets explicit `files:` list; three-tier scoping.
- In-repo: `agents/gsd-pattern-mapper.md` (Step 5/6 insertion point), `agents/gsd-code-reviewer.md`
  (`<adversarial_stance>` classification, `<depth_levels>` rule-pack home).
- In-repo: `.github/workflows/check-drift.yml` — CI runs `node tests/<f>.test.cjs`.
- Codebase grep: bin/lib 100% CJS (`module.exports`/`require`), sdk/src ESM; bin/lib filenames 100%
  kebab-case; functions camelCase, constants UPPER_SNAKE — validates the derivation premise.
- `package.json` — zero runtime dependencies (only `ajv`/`ajv-formats` devDeps), confirming the
  "no new runtime dependency" constraint is currently satisfied and must stay so.

### Secondary (MEDIUM confidence)
- Normalized Shannon entropy formula `H_norm = -Σ p_i·log(p_i) / log(n)`:
  [mc-stan.org posterior entropy ref](https://mc-stan.org/posterior/reference/entropy.html),
  [Normalized Shannon Entropy (emergentmind)](https://www.emergentmind.com/topics/normalized-shannon-entropy).
- `.planning/milestones/v1.3-vibedrift-evaluation.md` — verb-vs-body and architectural-split
  heuristics, noise-to-suppress list, the ~38% intentional-dup caveat.
- `.planning/milestones/v1.3-semantic-dup-research.md` — positions web-tree-sitter for Phase 11
  Type-4 extraction (confirming it is NOT needed in Phase 10).

### Tertiary (LOW confidence)
- Verb taxonomy specifics (A1) — derived from VibeDrift's heuristic + training knowledge; tune on
  first run.

## Metadata

**Confidence breakdown:**
- No-dependency feasibility: HIGH — verified by codebase grep + design analysis; every check maps to
  a regex/line-scan the repo already does elsewhere.
- Module structure / integration surface: HIGH — directly mirrors `drift.cjs`/`schema-detect.cjs` and
  the existing `verify schema-drift` subcommand; agents already invoke CJS via Bash.
- Majority-vote + entropy: HIGH for the formula (standard); MEDIUM for threshold values (tunable, a
  declared Discretion item).
- Verb-vs-body / architectural-split heuristics: MEDIUM — cherry-picked and reasonable, but precision
  is bounded by regex; advisory never-block tier is the safety margin.

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable — in-repo patterns and Node built-ins; no fast-moving external deps)
