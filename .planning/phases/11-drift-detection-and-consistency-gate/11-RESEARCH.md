# Phase 11: Drift Detection and Consistency Gate - Research

**Researched:** 2026-06-27
**Domain:** Native (zero-dep Node) static drift detection — structural near-clone detection (MinHash+LCS), cross-file phantom-scaffolding detection, release-gate wiring, second-upstream watch
**Confidence:** HIGH (the VibeDrift algorithm was read directly from the published `@vibedrift/cli@0.14.4` bundle; all reuse targets read from the live repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Detection is 100% native — GSD never shells out to the `vibedrift` CLI at runtime. No `npx`/PATH probe, no graceful-degrade branch, no privacy surface.
- **D-02:** VibeDrift is treated as a **second upstream project** (like gsd-core): interesting heuristics are ported natively, and its repo is added to the periodic upstream-watch. Pin **v0.14.0** as the idea-source baseline.
- **D-03:** Full native port. Three layers: (1) reuse Phase 10 `bin/lib/conventions.cjs` repo-wide; (2) NEW phantom-scaffolding / placeholder-stub detector (CRUD-named exports never imported/routed; `TBD`/`todo`/placeholder returns); (3) NEW native MinHash + LCS structural semantic-dup (Type-3 near-clones — NOT embeddings).
- **D-04:** DRIFT-05 reframed from "fallback" to "native detection heuristics" (primary sweep).
- **D-05:** The pre-1.0 `audit-milestone` integrity gate is **opt-in, warn-first**: config-gated **OFF by default**. When enabled, reports composite score + findings with recommended-fix framing and **never blocks**.
- **D-06:** `--fail-on-score N` is an explicit escalation to a hard exit-code gate, never imposed silently.
- **D-07:** Ship a **pre-seeded allowlist committed to the repo** suppressing the CJS↔SDK dual resolver (~38% of raw dup findings). **Reuse the `.vibedrift` allowlist format** for upstream-portability. Suppressions stay auditable — listed in the report, not silently dropped.
- **D-08:** `/gsd:scan --drift` produces a **ranked top-N markdown report to stdout** (lighter than `/gsd:map-codebase`), ranked by severity/composite contribution.
- **D-09:** Do NOT surface low-signal noise raw: "functions exceed 50 lines", "unreachable after return/throw", "exported symbols unused", comment-density.
- Zero new runtime deps (Node built-ins only), never-throw, non-blocking-by-default — same contracts as Phase 10.

### Claude's Discretion
- Exact MinHash band/shingle parameters and the LCS similarity threshold (tune during research — **answered below from the upstream source**).
- Internal module layout for the new detectors (`bin/lib/*.cjs`) and how `/gsd:scan --drift` routes to them (likely mirrors the Phase 10 `verify conventions` router pattern).
- Whether the upstream-watch wiring (D-02) is its own plan/wave vs folded into the gate plan.

### Deferred Ideas (OUT OF SCOPE)
- **Consistency-relative security** (VibeDrift heuristic #5: "N mutating routes lack auth while the codebase uses auth elsewhere") — its own future scope.
- **More programming-language rule packs** for convention/idiom checks — future v1.x; JS/TS packs ship first.
- Recap/plan-phase UX todos (matched on weak keywords only) — unrelated, not folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRIFT-01 | 100% native detection; VibeDrift as a second upstream (port heuristics, add to periodic watch, pin v0.14.0) | §State of the Art (no runtime CLI), §Second-Upstream Watch (extend `check-gsd-release.sh` + `check-upstream-schema.cjs`); the npm package `@vibedrift/cli@0.14.4` exists but is **never installed** by GSD |
| DRIFT-02 | audit-milestone opt-in, OFF-by-default, warn-first integrity gate; `--fail-on-score N` explicit hard escalation | §Architecture Patterns (gate insertion point at audit-milestone §5.5→new §5.6), §Standard Stack (config keys), §Code Examples (composite score) |
| DRIFT-03 | committed pre-seeded allowlist reusing the `.vibedrift` format; suppresses CJS↔SDK; auditable in report | §The `.vibedrift` Allowlist Format (actual upstream schema decoded from the bundle), §Don't Hand-Roll |
| DRIFT-04 | `/gsd:scan --drift` ranked top-N markdown to stdout | §Architecture Patterns (`scan.md` --drift branch + router), §Code Examples |
| DRIFT-05 | native heuristics primary: conventions.cjs reuse + phantom/placeholder + MinHash+LCS | §Standard Stack, §Architecture Patterns, §Code Examples (full ported algorithm) |
</phase_requirements>

## Summary

Phase 11 ports three detection layers into pure-CJS `bin/lib/*` modules, then surfaces them through `/gsd:scan --drift` and an opt-in `audit-milestone` gate. The single largest research risk — "what are the MinHash band/row/shingle parameters and the LCS threshold?" — is **fully resolved**: the published `@vibedrift/cli@0.14.4` bundle ships its algorithm in readable (un-minified-enough) form, and I read the exact constants and functions directly. This converts the "Claude's Discretion: tune during research" item into concrete, copyable values rather than guesses.

The key correction to prior research: `.planning/milestones/v1.3-semantic-dup-research.md` recommends an **embedding-based** detector (`@huggingface/transformers`, `web-tree-sitter`, etc.) for Type-4 clones. **That approach is superseded by D-03** (MinHash+LCS, zero-dep, Type-3 structural). The embedding research remains useful only as a record of *why* Type-4 is out of scope — do not follow its build plan. The native approach catches the GSD failure mode (a helper re-written in a slightly different shape across sessions) as a Type-3 near-clone, runs in seconds with no model download, and is deterministic. The one genuine limitation to document: two functions that compute the same thing with *zero* shared operation-sequence (true Type-4) will not be caught — this is an accepted tradeoff of the locked decision, not a defect.

The phantom-scaffolding detector and the allowlist format are also decoded from the upstream bundle: the real format is **`.vibedrift/config.json`** (score floor + report format) plus a **`.vibedriftignore`** file in gitignore syntax (VibeDrift parses it with the `ignore` npm package). Reusing "the `.vibedrift` format" (D-07) means our native reader should accept a gitignore-syntax ignore file and a JSON config sidecar — but because GSD needs **pair-wise** suppression (CJS↔SDK), a path-based ignore file alone is insufficient; the plan must extend it with an explicit intentional-pair allowlist (documented below).

**Primary recommendation:** Build `bin/lib/semantic-dup.cjs` (ports the exact MinHash+LCS constants below) and `bin/lib/phantom-scaffolding.cjs` (import-graph + CRUD-name + placeholder-return), wire both plus the existing `conventions.cjs` through a new `verify drift` subcommand (mirror `cmdVerifyConventions`), consume that from `/gsd:scan --drift` and a new opt-in `audit-milestone` §5.6 gate. Honor all Phase 10 contracts verbatim (never-throw, never-exit-nonzero, `SAFE_PATH_RE`, `MAX_SCAN_BYTES`, zero deps, CJS↔SDK schema parity).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Convention sweep (repo-wide) | `bin/lib/conventions.cjs` (existing) | `verify drift` router | Already the single source of truth (Phase 10 D-04); reuse, do not re-implement |
| Structural near-clone detection | NEW `bin/lib/semantic-dup.cjs` | `verify drift` router | Pure compute over function bodies; library tier owns it |
| Phantom/placeholder detection | NEW `bin/lib/phantom-scaffolding.cjs` | `verify drift` router | Cross-file import graph + per-file regex; library tier |
| Allowlist load + suppression | NEW `bin/lib/drift-allowlist.cjs` (or folded into semantic-dup) | both detectors | Shared concern; one loader both detectors consult |
| Composite score + ranking | `verify drift` handler in `verify.cjs` | — | Aggregation belongs at the CLI/orchestration seam, like `cmdVerifyConventions` |
| `--drift` report rendering | `workflows/scan.md` + handler markdown emit | — | Presentation tier; scan skill owns stdout report |
| Release gate decision | `workflows/audit-milestone.md` §5.6 | `verify drift` (data) + config (policy) | Workflow tier reads detector data + config, decides warn/fail |
| Second-upstream notification | `bin/check-gsd-release.sh` (cron) | `bin/maintenance/check-upstream-schema.cjs` family | Ops/maintenance tier; out of the runtime path entirely |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs`, `node:path` | built-in | File walk, reads | Zero-dep contract (D-09 / Phase 10 T-10-SC) [VERIFIED: codebase grep — conventions.cjs/drift.cjs use only these] |
| `child_process` (`execGit`) | built-in | git diff for scoped/changed-file mode (optional) | Already used by `cmdVerifyCodebaseDrift` [VERIFIED: verify.cjs:1308] |

**No new runtime dependencies.** This is a locked decision (D-09) and a Phase 10 security control (T-10-SC). The MinHash+LCS algorithm, the FNV-1a hash, the LSH banding, and the import-graph are all implemented in ~150 lines of pure JS (ported from the upstream bundle, see Code Examples).

### Reuse (existing modules — do NOT re-implement)
| Module | What to reuse | Source |
|--------|---------------|--------|
| `bin/lib/conventions.cjs` | `deriveConventions`, `checkConformance`, `blankSpans` (string/comment-safe pre-pass), `sanitizePaths`, `extractIdentifiers`, `SAFE_PATH_RE`, `MAX_SCAN_BYTES` | [VERIFIED: read in full] |
| `bin/lib/drift.cjs` | `SAFE_PATH_RE`, `sanitizePaths`, `parseFrontmatter` | [VERIFIED: read in full] |
| `bin/lib/verify.cjs` `collectConventionCorpus` | the bounded (budget 5000) repo walker that skips `node_modules/.git/dist/build/coverage` and dot-dirs | [VERIFIED: verify.cjs:1516] |
| `bin/lib/verify-command-router.cjs` | the subcommand dispatch pattern (mirror the `conventions` case) | [VERIFIED: read in full] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MinHash+LCS (D-03) | Embedding similarity (`@huggingface/transformers` + `web-tree-sitter`) — the prior semdup research's plan | Catches Type-4, but needs ~300MB model download, non-deterministic, multi-dep. **Rejected by D-03/D-09.** Keep only as the documented reason Type-4 is out of scope. |
| Pure-regex function extraction | `web-tree-sitter` AST extraction (what VibeDrift actually uses) | tree-sitter is a runtime dep (violates D-09). Use a brace-balanced regex extractor over `blankSpans`-cleaned source (same approach `verbBodyViolations`/`classifyArchitecture` already use). Slightly lower extraction precision; acceptable for advisory tier. |
| `.vibedriftignore` (gitignore syntax via `ignore` pkg) | A native minimatch-lite or the existing `SAFE_PATH_RE`-style prefix match | The `ignore` package is a dep; gitignore-glob is complex to re-implement faithfully. For Phase 11, a **simpler committed pair-allowlist** (glob-prefix pairs) covers the actual need (CJS↔SDK) without a glob engine. See §Allowlist Format. |

**Installation:** none — zero new dependencies.

## Package Legitimacy Audit

> Phase 11 **installs no external packages** (zero-dep, D-09). The only external package referenced is the *idea source*, never a runtime dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@vibedrift/cli` | npm | active (v0.14.4 published 2026-06-27; 80 versions) | not checked | vibedrift.ai (MIT, 8 deps) | unavailable | **Idea source only — NEVER installed.** Read locally via `npm pack` for research. [ASSUMED legitimacy — slopcheck could not run] |
| `vibedrift` (unscoped) | npm | v0.1.3 | — | — | unavailable | **AVOID — not the real tool.** The real package is the scoped `@vibedrift/cli`. Cross-name confusion vector. [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none (none installed).
**Packages flagged as suspicious [SUS]:** none installed. Note: the unscoped `vibedrift` is a different package; any future watch tooling must reference the scoped `@vibedrift/cli` repo, never the unscoped name.

*slopcheck was unavailable at research time. This is immaterial to Phase 11 because no package is installed at runtime — the legitimacy gate exists to protect installs, and there are none. The maintainer reads the upstream repo manually (D-02) and ports code by hand.*

## The `.vibedrift` Allowlist Format (DRIFT-03 — decoded from `@vibedrift/cli@0.14.4`)

Decoded directly from the published bundle (`dist/tools-core/index.js`, `dist/cli/index.js`):

- **`.vibedrift/config.json`** — written by VibeDrift's `init` tool. Holds the default report format and the CI score floor (`failOnScore`). [VERIFIED: bundle string "WRITES .vibedrift/config.json (default report format, CI score floor)"]
- **`.vibedriftignore`** — a **gitignore-syntax** exclusion file. VibeDrift parses it with the `ignore` npm package (`ignore: ^7.0.5` in its deps). Used to exclude fixture/generated/non-production paths from scanning. [VERIFIED: bundle deps + strings "writes .vibedriftignore exclusions", "Auto-detects fixture/generated paths"]
- VibeDrift's exclusion model is **single-path** (exclude a file/dir from analysis), NOT **pair-wise** (this file is a deliberate duplicate of that file).

**Implication for D-07 (CRITICAL):** "Reuse the `.vibedrift` format" cannot be taken literally for the CJS↔SDK suppression, because VibeDrift has no pair-suppression concept — its ignore file would have to *exclude `sdk/src` entirely from dup analysis*, which is too blunt (it would hide genuine drift inside `sdk/src`). The plan should:
1. **Accept a `.vibedriftignore`-compatible exclusion list** (gitignore-style path globs) for fixture/generated/dist paths — this is the format-compatible part and keeps us portable if VibeDrift ships cross-referenceable config later.
2. **Add a GSD-native pair-allowlist** for intentional duplicates, expressed as glob *pairs* (the shape the prior semdup research already sketched):
   ```json
   { "intentional": [
     { "a": "bin/lib/**", "b": "sdk/src/**",
       "reason": "Dual CJS/SDK runtime resolver — duplicated on purpose (two-resolver split)" }
   ] }
   ```
   A suspect pair `(fileA, fileB)` is suppressed iff `(a matches A && b matches B)` or the symmetric case. **Suppressed pairs are never dropped** — they are emitted in a `suppressed: [...]` section of the report (D-07 auditability; mirrors VibeDrift's own `--show-suppressed` and the prior research's principle).
3. Commit both files at the repo root (or under a `.gsd/` dir) pre-seeded with the dual-resolver rule.

**Recommendation:** keep the file name/format honest — call the GSD pair-allowlist what it is (e.g. `.gsd/drift-allowlist.json`) rather than overloading `.vibedrift/config.json`, since the semantics differ. Document the `.vibedriftignore` compatibility as the portable surface. Flag this format-divergence to the planner as the one place where "reuse the format" needs a judgment call.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
  /gsd:scan --drift │  workflows/scan.md  (--drift branch)         │
  ─────────────────▶│  parses --drift, --top N, --fail-on-score    │
                    └───────────────┬─────────────────────────────┘
                                    │ Bash: gsd-tools verify drift --scope . [--json]
                                    ▼
  audit-milestone   ┌─────────────────────────────────────────────┐
  §5.6 gate ───────▶│  routeVerifyCommand  →  cmdVerifyDrift       │  (verify.cjs)
  (opt-in, OFF)     │  - read config (drift_gate, fail_on_score)   │
                    │  - collectConventionCorpus (bounded walk)    │
                    │  - load allowlist (.gsd/drift-allowlist.json)│
                    └───┬───────────────┬───────────────┬─────────┘
                        │               │               │
            ┌───────────▼──┐  ┌─────────▼────────┐  ┌───▼──────────────────┐
            │ conventions  │  │ semantic-dup.cjs │  │ phantom-scaffolding  │
            │ .cjs (reuse) │  │ extract→shingle→ │  │ .cjs  import-graph + │
            │ deriveConv / │  │ minhash→LSH band→│  │ CRUD-name + TBD/todo │
            │ checkConform │  │ LCS verify       │  │ placeholder-return   │
            └───────┬──────┘  └────────┬─────────┘  └──────────┬───────────┘
                    │ findings[]       │ pairs[] (suppressed[])│ findings[]
                    └──────────────┬───┴───────────────────────┘
                                   ▼
                    ┌─────────────────────────────────────────────┐
                    │  composite score + severity rank + suppress  │
                    │  emit { skipped, score, findings, suppressed }│  (never-throw,
                    │  raw=JSON  OR  ranked top-N markdown          │   never exit≠0)
                    └───────────────┬─────────────────────────────┘
                                    ▼
              stdout markdown report  /  JSON for the gate decision
```

### Recommended Project Structure
```
bin/lib/
├── conventions.cjs            # EXISTING (Phase 10) — reused repo-wide
├── drift.cjs                  # EXISTING — SAFE_PATH_RE, sanitizePaths reused
├── semantic-dup.cjs           # NEW — MinHash+LCS structural near-clone (D-03 layer 3)
├── phantom-scaffolding.cjs    # NEW — CRUD-exports-never-routed + placeholder (D-03 layer 2)
├── drift-allowlist.cjs        # NEW — load + apply pair-allowlist + ignore globs (D-07)
├── verify.cjs                 # EXTEND — add cmdVerifyDrift (mirror cmdVerifyConventions)
└── verify-command-router.cjs  # EXTEND — add 'drift' case

sdk/src/query/command-manifest.verify.ts  # ADD verify.drift entry (CJS↔SDK parity)
bin/lib/config-schema.cjs                  # ADD drift gate config keys
sdk/src/query/config-schema.ts             # ADD same keys (two-resolver gotcha)

workflows/scan.md            # EXTEND — --drift branch
workflows/audit-milestone.md # EXTEND — new §5.6 opt-in integrity gate
.gsd/drift-allowlist.json    # NEW — pre-seeded CJS↔SDK rule (committed, D-07)
.vibedriftignore             # NEW (optional) — gitignore-syntax exclusions (portable surface)

tests/semantic-dup.test.cjs        # NEW — zero-dep harness (mirror conventions.test.cjs)
tests/phantom-scaffolding.test.cjs # NEW
tests/drift-allowlist.test.cjs     # NEW
.github/workflows/check-drift.yml  # EXTEND — add a `drift-detectors` job (no npm ci)

bin/check-gsd-release.sh                   # EXTEND — second REPO watch (D-02)
bin/maintenance/check-upstream-schema.cjs  # reference pattern for a vibedrift-watch sibling
```

### Pattern 1: Mirror `cmdVerifyConventions` for the new `verify drift` subcommand
**What:** A JSON-emitting subcommand that wraps the detector libraries, never throws, never exits non-zero.
**When to use:** This is the integration seam for both `/gsd:scan --drift` and the audit-milestone gate.
**Example:** see Code Examples "verify drift handler skeleton". The handler: builds the corpus via `collectConventionCorpus`, loads the allowlist, runs all three detectors, computes the composite score, and emits either JSON (`--json`/`raw`) or lets the caller render markdown. Every failure path emits `{ skipped:true, reason }` (T-10-05 contract). [VERIFIED: verify.cjs:1416 pattern]

### Pattern 2: Opt-in gate at audit-milestone §5.6 (after §5.5 Nyquist)
**What:** A config-gated block that runs `verify drift`, reports score + findings with recommended-fix framing, and only fails when `--fail-on-score`/config cutoff is explicit.
**When to use:** DRIFT-02.
**Example:** mirrors §5.5 Nyquist Compliance Discovery exactly — read a config flag, skip entirely if disabled, otherwise gather + report. Default OFF (`workflow.drift_gate` absent/`false` ⇒ skip). The cutoff only fails the milestone when `workflow.drift_fail_on_score` is set AND the score is below it. Add a `drift:` block to the audit YAML and a section to the markdown report. [CITED: audit-milestone.md §5.5 as the template]

### Pattern 3: `--drift` branch in scan.md (parse args, run, render top-N)
**What:** `scan.md` already parses `--focus`; add a parallel `--drift` mode that bypasses the mapper-agent path and instead shells `gsd-tools verify drift --scope . --top N`, then prints the ranked markdown to stdout.
**When to use:** DRIFT-04.
**Why this fits:** scan is explicitly "lighter than map-codebase" (SKILL.md:3) and outputs to stdout/`.planning/codebase/`. `--drift` is a non-agent, pure-compute mode — no `gsd-codebase-mapper` spawn needed.

### Anti-Patterns to Avoid
- **Excluding `sdk/src` wholesale from dup analysis** to suppress the dual-resolver. This hides genuine intra-`sdk/src` drift. Use the pair-allowlist instead (§Allowlist Format).
- **Surfacing the D-09 noise findings.** Do not port VibeDrift's `MAX_LINES_PER_FUNCTION = 60` finding, unreachable-after-return, unused-export, or comment-density signals. The bundle has them (`MAX_LINES_PER_FUNCTION = 60` is right there); skip them.
- **Re-implementing `deriveConventions`.** Phase 10's T-10-06 specifically warns against a CJS twin / SDK twin of the derivation — that twin *would itself be the drift this milestone exists to surface*. Reuse `conventions.cjs`.
- **Throwing or exiting non-zero from any detector or the handler.** Phase 10 T-10-05/T-10-03 contracts apply identically.
- **Reading source without `sanitizePaths` + `MAX_SCAN_BYTES`.** T-10-01/T-10-02 path-safety + DoS caps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String/comment/regex-safe scanning | A new tokenizer that re-handles quotes/templates/comments | `conventions.blankSpans(src)` | Already linear, no backtracking (T-10-02), battle-tested in Phase 10 |
| Repo walk with skip-dirs + budget | A new recursive `readdirSync` | `verify.collectConventionCorpus(root, cwd)` | Bounded (budget 5000), skips `node_modules/.git/dist/...`, returns cwd-relative paths matching `sanitizePaths` |
| Path safety | A new validator | `conventions.sanitizePaths` / `SAFE_PATH_RE` | Reject `..`/absolute/metachars (T-10-01) |
| Identifier/export extraction | A new regex set | `conventions.extractIdentifiers` + the bundle's `EXPORT_NAMED_PATTERNS`/`IMPORT_PATTERNS` (port) | Proven shapes; import patterns cover ESM + require |
| MinHash/LSH/LCS | Your own clone math from scratch | Port the **exact** constants + functions below | The upstream values are tuned and published; reinventing risks worse recall/precision |
| Convention derivation | A repo-wide re-derivation | `conventions.deriveConventions(corpus)` | Single source of truth (D-04); a twin is the drift itself (T-10-06) |

**Key insight:** Almost every primitive this phase needs already exists in `conventions.cjs`/`drift.cjs`/`verify.cjs` from Phase 10, and the one genuinely-new algorithm (MinHash+LCS) is published verbatim in the VibeDrift bundle. This is a *port + wire* phase, not an invent phase.

## Runtime State Inventory

> Phase 11 is **additive code + config**, not a rename/refactor/migration. No stored data, live-service config, OS-registered state, or build artifacts carry a string being changed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: no datastore keyed on a renamed string; this phase adds new files only | none |
| Live service config | One *additive* item: the cron-driven `bin/check-gsd-release.sh` gains a second `REPO` watch (D-02). The **live cron copy** at `~/claude-code-gsd` (per memory `260608-vk9`) must be synced after the repo edit, and `~/.gsd-last-known-version` has a sibling seed file for the new upstream (e.g. `~/.vibedrift-last-known-version`) so the first run fires no spurious email. | manual: sync live cron copy + seed the new version file |
| OS-registered state | None — the cron entry already exists (`260417-x7a`); no new task registration, only the script body changes | none |
| Secrets/env vars | None — no new secrets; the watch uses the same `gh`/`ssh` mail path | none |
| Build artifacts | `bin/lib/command-aliases.generated.cjs` is regenerated from the TS manifest when `verify.drift` is added. Run `npm run check:alias-drift` (in `sdk/`) or regen the generated file; the test `command-seam-coverage.test.ts` + the freshness check guard it. | regenerate generated aliases + rebuild `sdk/dist` if SDK schema touched |

**The key question — what runtime state has the old string after files change?** Only the **live cron copy** of `check-gsd-release.sh` (it is a *copy*, not a symlink, per memory). Everything else is new code with no pre-existing runtime footprint.

## Common Pitfalls

### Pitfall 1: MinHash/LCS false positives on boilerplate
**What goes wrong:** Getters, 3-line wrappers, `module.exports` shims, guard clauses all shingle alike and flag as near-clones.
**Why it happens:** Short token sequences collide.
**How to avoid:** Port VibeDrift's `MIN_BODY_TOKENS = 15` floor (skip functions whose normalized token count < 15) AND the length-ratio guards: `shorter/longer < 0.6` skip before LCS, and `lcsSimilarity` returns 0 when `minLen/maxLen < 0.5`. Also skip same-file pairs (`a.fn.file === b.fn.file`). [VERIFIED: bundle `findDuplicatePairs`/`indexFunctions`]
**Warning signs:** A first run dominated by tiny helpers — raise `MIN_BODY_TOKENS`.

### Pitfall 2: The 38%-intentional-dup problem (CJS↔SDK)
**What goes wrong:** Without the allowlist, ~129/338 dup findings (38%) on gsd-plugin are just the deliberate dual resolver; the report drowns and gets ignored.
**Why it happens:** `bin/lib/*.cjs` and `sdk/src/**` are *meant* to be parallel.
**How to avoid:** Pre-seed the pair-allowlist (D-07, §Allowlist Format) and ship it committed. Verify on first run that the dual-resolver pairs land in `suppressed:`, not `findings:`.
**Warning signs:** `resolveModel`/`config`/`init` pairs appearing as top findings.

### Pitfall 3: Cross-file graph cost + ESM/CJS dual parsing
**What goes wrong:** Building a full import graph over ~440 files naively is O(files²); and `bin/lib` is CJS (`require`) while `sdk/src` is ESM (`import`) — a single import regex misses half.
**Why it happens:** Two module systems in one repo.
**How to avoid:** Port the bundle's `IMPORT_PATTERNS` (covers both `import {..} from`, default/namespace import, AND `const {..} = require(..)` / `const x = require(..)`) and `EXPORT_NAMED_PATTERNS` + re-export patterns. Build a flat `Set` of all imported names once (single pass over all files), then a phantom = an exported CRUD-named symbol absent from that set. Linear, not quadratic. [VERIFIED: bundle import-graph.ts patterns]
**Warning signs:** A `require`-only file's exports all flagged phantom (means ESM-only import regex).

### Pitfall 4: LCS on long functions blowing up time/memory
**What goes wrong:** Naive O(n·m) LCS over thousands of token pairs is slow.
**Why it happens:** LCS is quadratic.
**How to avoid:** LSH banding does candidate *selection* first (only same-bucket pairs reach LCS), and the bundle's `lcsSimilarity` uses **two rolling `Int32Array` rows** (not a full matrix) + the `minLen/maxLen < 0.5` early-out. Port both. Target seconds on 440 files / 107k lines (VibeDrift itself runs 30–60s with tree-sitter; pure-regex extraction is lighter). [VERIFIED: bundle `lcsSimilarity`]
**Warning signs:** Runtime in tens of seconds — check that LSH banding is actually pruning before LCS.

### Pitfall 5: Determinism / never-throw
**What goes wrong:** A scan that flags different pairs run-to-run, or that throws on one malformed file, breaks the gate contract.
**How to avoid:** Fixed `PERM_SEEDS` (deterministic FNV-1a seeds, no `Math.random`), sorted output, per-file try/catch skip, top-level try/catch returning `{ skipped:true, reason }`. Same contracts as `conventions.cjs`. [VERIFIED: bundle uses a deterministic seeded permutation table]

### Pitfall 6: CJS↔SDK config-schema drift (the two-resolver gotcha)
**What goes wrong:** A new config key added only to `bin/lib/config-schema.cjs` is rejected by `gsd-sdk query config-set` (which validates against `sdk/src/query/config-schema.ts`), and vice versa.
**How to avoid:** Add every new key to BOTH files and rebuild `sdk/dist`. There is a parity guard test pattern; follow it. [VERIFIED: memory `260611-pab`; both schema files read — they are hand-mirrored lists]

## Code Examples

### The MinHash + LCS structural-clone algorithm (port verbatim from `@vibedrift/cli@0.14.4`)
```javascript
// Source: @vibedrift/cli@0.14.4  dist/tools-core/index.js  (read locally via npm pack)
// Ported constants — these are the answers to "Claude's Discretion: tune the params".
const DEFAULT_SHINGLE_SIZE = 5;     // operation-sequence k-gram size
const DEFAULT_PERMUTATIONS = 128;   // MinHash signature length
const DEFAULT_LSH_BANDS    = 16;    // bands × rows = 128 (16×8)
const DEFAULT_LSH_ROWS     = 8;
const MIN_BODY_TOKENS      = 15;    // skip tiny functions (Pitfall 1)
const FLAG_THRESHOLD       = 0.7;   // LCS-similarity flag cutoff
// (Note: a second "sampler" path in the bundle uses 32 bands × 4 rows with a
//  0.55–0.8 band; the primary semantic-duplication path is 16×8 + LCS≥0.7.)

// shingles = k-grams of NORMALIZED tokens (identifiers renamed to a placeholder,
// numbers→NUM, call targets preserved). Normalization is what makes it Type-2/3
// (renamed-identifier and near-miss) tolerant rather than exact-text.
function buildShingles(tokens, size = DEFAULT_SHINGLE_SIZE) {
  if (tokens.length < size) return [tokens.join('\t')];
  const out = new Array(tokens.length - size + 1);
  for (let i = 0; i < out.length; i++) out[i] = tokens.slice(i, i + size).join('\t');
  return out;
}

// Deterministic seeded FNV-1a permutations (no Math.random → reproducible).
const PERM_SEEDS = (() => {
  const arr = new Uint32Array(DEFAULT_PERMUTATIONS);
  for (let i = 0; i < DEFAULT_PERMUTATIONS; i++)
    arr[i] = Math.imul(2166136261 ^ (i * 2654435769), 16777619) >>> 0;
  return arr;
})();
function fnv1aWithSeed(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function minHashSignature(shingles, perms = DEFAULT_PERMUTATIONS) {
  const sig = new Uint32Array(perms); sig.fill(0xFFFFFFFF);
  for (const sh of shingles)
    for (let p = 0; p < perms; p++) {
      const h = fnv1aWithSeed(sh, PERM_SEEDS[p % PERM_SEEDS.length]);
      if (h < sig[p]) sig[p] = h;
    }
  return sig;
}

// LSH banding: only functions sharing a full band become candidate pairs.
function findLshCandidatePairs(signatures, bands = DEFAULT_LSH_BANDS, rows = DEFAULT_LSH_ROWS) {
  const candidates = new Set();
  for (let b = 0; b < bands; b++) {
    const buckets = new Map();
    for (let i = 0; i < signatures.length; i++) {
      let key = '';
      for (let r = 0; r < rows; r++) key += (r ? '|' : '') + signatures[i][b * rows + r].toString(36);
      (buckets.get(key) || buckets.set(key, []).get(key)).push(i);
    }
    for (const bucket of buckets.values())
      for (let x = 0; x < bucket.length; x++)
        for (let y = x + 1; y < bucket.length; y++) {
          const a = bucket[x], c = bucket[y];
          candidates.add(a < c ? `${a}-${c}` : `${c}-${a}`);
        }
  }
  return candidates;
}

// LCS verification on the actual token sequences (memory-light: two rolling rows).
function lcsSimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.5) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let prev = new Int32Array(shorter.length + 1);
  let curr = new Int32Array(shorter.length + 1);
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++)
      curr[j] = longer[i - 1] === shorter[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    prev.set(curr);
  }
  return (2 * prev[shorter.length]) / (a.length + b.length);
}

// Pairing: candidate → length-ratio guard → LCS ≥ FLAG_THRESHOLD, cross-file only.
function findDuplicatePairs(indexed) {
  const pairs = [];
  for (const key of findLshCandidatePairs(indexed.map(i => i.signature))) {
    const [aStr, bStr] = key.split('-');
    const a = indexed[+aStr], b = indexed[+bStr];
    if (a.fn.file === b.fn.file) continue;                                   // same-file skip
    if (Math.min(a.tokens.length, b.tokens.length) /
        Math.max(a.tokens.length, b.tokens.length) < 0.6) continue;         // ratio guard
    const sim = lcsSimilarity(a.tokens, b.tokens);
    if (sim >= FLAG_THRESHOLD) pairs.push({ a, b, similarity: sim });
  }
  return pairs;
}
```

### Phantom-scaffolding: import-graph + CRUD-name (port shapes from the bundle)
```javascript
// Source: @vibedrift/cli@0.14.4  dist/tools-core/index.js  (import-graph.ts + phantom-scaffolding.ts)
// Covers BOTH module systems (Pitfall 3).
const EXPORT_NAMED_PATTERNS = [
  /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g,
  /export\s*\{([^}]+)\}/g,
];
const IMPORT_PATTERNS = [
  /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
  /import\s+(?:type\s+)?(\w+)\s+from\s*['"]([^'"]+)['"]/g,
  /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
  /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g,  // CJS!
  /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g,        // CJS!
];
// CRUD intent classification (the verb buckets VibeDrift uses):
//   data_retrieval : fetch|get|load|read|find|query|list|search
//   data_mutation  : create|insert|add|save|store|write|put|post
//   data_update    : update|patch|modify|edit|set
//   data_deletion  : delete|remove|destroy|drop|revoke
// Phantom = an exported symbol whose name matches a CRUD verb but appears in NO
// file's imported-names set (never imported, never routed). Aggregate per-dir.
// Severity by dead-share: ≥0.5 error, ≥0.2 warning, else info.
```
Run all `blankSpans`-cleaned source through these (so commented-out code isn't counted). Placeholder-stub detection: scan production-file function bodies (after `blankSpans`) for `return null/undefined/{}/[]` paired with a `TODO`/`TBD`/`FIXME`/`not implemented` comment — reuse `conventions.blankSpans` so a `TODO` *inside a string* is never matched.

### `verify drift` handler skeleton (mirror `cmdVerifyConventions`)
```javascript
// Source: pattern from bin/lib/verify.cjs:1416 cmdVerifyConventions (read in full)
function cmdVerifyDrift(cwd, opts, raw) {
  const emit = (p) => output(p, raw);
  try {
    const corpus = collectConventionCorpus(cwd, cwd);          // reuse bounded walker
    const allow  = require('./drift-allowlist.cjs').load(cwd);  // never-throw loader
    const conv    = require('./conventions.cjs').deriveConventions(corpus, { cwd });
    const dup     = require('./semantic-dup.cjs').detect(corpus, { cwd, allow });
    const phantom = require('./phantom-scaffolding.cjs').detect(corpus, { cwd });
    // composite score + rank; D-09 noise excluded at the detector level.
    emit({ skipped:false, score, findings, suppressed: dup.suppressed, counts });
  } catch (err) {
    emit({ skipped:true, reason: 'exception: ' + (err && err.message || String(err)) });
  }
}
```

### Adding the subcommand to the router + manifest (CJS↔SDK parity)
```javascript
// bin/lib/verify-command-router.cjs — add alongside the 'conventions' case:
} else if (subcommand === 'drift') {
  const rest = args.slice(2);
  const o = { scope: undefined, top: undefined, json: rest.includes('--json'), failOnScore: undefined };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--scope') o.scope = rest[++i];
    else if (rest[i] === '--top') o.top = +rest[++i];
    else if (rest[i] === '--fail-on-score') o.failOnScore = +rest[++i];
  }
  verify.cmdVerifyDrift(cwd, o, raw);
}
```
```typescript
// sdk/src/query/command-manifest.verify.ts — add (then regen generated aliases):
{ family:'verify', canonical:'verify.drift', aliases:['verify drift'], mutation:false, outputMode:'json' },
```
Then regenerate `bin/lib/command-aliases.generated.cjs` from the TS manifest and run the freshness check (`sdk/` `check:alias-drift`). [VERIFIED: command-manifest.verify.ts:15 + command-aliases.generated.cjs flow]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DRIFT-01 "optional external VibeDrift gate + npx/PATH probe + graceful-degrade" | 100% native; VibeDrift = second upstream (port + watch) | 2026-06-27 (Phase 11 discuss, D-01/D-02) | No runtime CLI call, no privacy surface, no graceful-degrade branch |
| DRIFT-05 "native *fallback* heuristics when VibeDrift absent" | native heuristics are the *primary* sweep | 2026-06-27 (D-04) | The native detectors are the product, not a backup |
| semdup via embeddings (`@huggingface/transformers` + `web-tree-sitter`, Type-4) | MinHash+LCS structural (Type-3), zero-dep | 2026-06-27 (D-03) | No model download, deterministic, faster; Type-4-only clones not caught (accepted) |

**Deprecated/outdated:**
- The build plan in `.planning/milestones/v1.3-semantic-dup-research.md` (embedding pipeline, `tools/semdup/*.mjs`, `.semdup-allow.json`) — **superseded by D-03.** Keep that doc only as the rationale for excluding Type-4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@vibedrift/cli` / `vibedrift` legitimacy is `[ASSUMED]` (slopcheck unavailable) | Package Legitimacy Audit | None at runtime — package is never installed; only read locally for porting |
| A2 | The 16×8 bands/rows + LCS≥0.7 + SHINGLE 5 + MIN_BODY_TOKENS 15 values port cleanly to a regex-based (non-tree-sitter) extractor with comparable precision | Code Examples / Standard Stack | First-run noise may need MIN_BODY_TOKENS/FLAG_THRESHOLD bumped; mitigated by calibration on the gsd-plugin repo (a Wave 0 calibration task) |
| A3 | A committed pair-allowlist (glob pairs) + a `.vibedriftignore`-style path exclusion satisfies "reuse the `.vibedrift` format" (D-07) better than overloading `.vibedrift/config.json` | Allowlist Format | If the user wants literal `.vibedrift/config.json` reuse, the format must be reconciled — flag in discuss/plan |
| A4 | The live cron copy of `check-gsd-release.sh` at `~/claude-code-gsd` still needs manual sync (per memory `260608-vk9`) | Runtime State Inventory | If the cron now reads the repo directly, the manual sync step is unnecessary |

**If this table is empty:** it is not — A1–A4 need confirmation, but A1 is immaterial (no install) and A2 is calibration, not a blocking unknown.

## Open Questions

1. **Literal `.vibedrift` format reuse vs. GSD-native pair-allowlist (D-07).**
   - What we know: VibeDrift's actual files are `.vibedrift/config.json` (score floor/format) + `.vibedriftignore` (gitignore-syntax path exclusions, parsed by the `ignore` pkg). Neither expresses *pair* suppression.
   - What's unclear: whether "reuse the format" means byte-compatible config files or just "be portable/familiar."
   - Recommendation: ship a `.vibedriftignore`-compatible exclusion list (portable surface) PLUS a GSD-native `.gsd/drift-allowlist.json` pair-allowlist; surface the divergence in plan-phase for a one-line confirmation.

2. **Function-extraction fidelity without tree-sitter.**
   - What we know: VibeDrift extracts function bodies via `web-tree-sitter`; D-09 forbids that dep.
   - What's unclear: how much recall a brace-balanced regex extractor (over `blankSpans`-cleaned source) loses vs. AST.
   - Recommendation: a Wave 0 calibration task that runs the ported detector on gsd-plugin itself and eyeballs the ranked list; tune `MIN_BODY_TOKENS`/`FLAG_THRESHOLD` to keep the dual-resolver-suppressed report signal-rich.

3. **Where the second-upstream watch lives (D-02, Claude's discretion).**
   - Recommendation: a small standalone watch (sibling of `check-gsd-release.sh`, watching the `@vibedrift/cli` repo/npm tag) is cleaner than overloading the gsd-core watch; can be its own thin plan/wave. Reference `check-upstream-schema.cjs`'s `gh release view` pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all detectors + tests | ✓ | ≥18 (repo uses node:test-style harness, CI node 22) | — |
| `git` (`execGit`) | optional changed-file/scoped mode | ✓ | system | full-repo walk (no git needed for `--scope .`) |
| `gh` CLI | second-upstream watch (D-02, ops only) | ✓ (used by existing watch) | system | watch silently no-ops if absent (existing pattern) |
| `@vibedrift/cli` | NOT required at runtime | n/a (idea source) | 0.14.x read locally | n/a — never invoked |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking — every runtime path uses Node built-ins.

## Validation Architecture

> Nyquist validation enabled for this phase (no `workflow.nyquist_validation:false` in config).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Zero-dep CJS harness — `node:assert` + a bare `check(name, fn)` runner + `process.exit(1)` footer (mirrors `tests/conventions.test.cjs`) [VERIFIED: tests/conventions.test.cjs:1] |
| Config file | none — each test file is self-contained and run directly by `node` |
| Quick run command | `node tests/semantic-dup.test.cjs` (per detector) |
| Full suite command | `node tests/conventions.test.cjs && node tests/semantic-dup.test.cjs && node tests/phantom-scaffolding.test.cjs && node tests/drift-allowlist.test.cjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRIFT-05 | MinHash+LCS flags a cross-file near-clone above threshold; skips tiny + same-file + low-ratio | unit | `node tests/semantic-dup.test.cjs` | ❌ Wave 0 |
| DRIFT-05 | determinism: same input → identical pairs across two runs | unit | `node tests/semantic-dup.test.cjs` | ❌ Wave 0 |
| DRIFT-05 | never-throw on malformed/binary source → `{skipped:true}` | unit | `node tests/semantic-dup.test.cjs` | ❌ Wave 0 |
| DRIFT-05 | phantom: CRUD export never imported (ESM AND require) flagged; wired-up export not flagged | unit | `node tests/phantom-scaffolding.test.cjs` | ❌ Wave 0 |
| DRIFT-05 | placeholder: `return null` + `TODO` comment flagged; `TODO` inside a string NOT flagged | unit | `node tests/phantom-scaffolding.test.cjs` | ❌ Wave 0 |
| DRIFT-03 | dual-resolver pair lands in `suppressed`, not `findings`; suppressed list non-empty + auditable | unit | `node tests/drift-allowlist.test.cjs` | ❌ Wave 0 |
| DRIFT-03/05 | D-09 noise (50-line, unused-export, unreachable, comment-density) never emitted | unit | `node tests/semantic-dup.test.cjs` / phantom test | ❌ Wave 0 |
| DRIFT-02 | gate OFF by default → audit-milestone skips; ON → reports score, never fails unless `--fail-on-score` set | integration | `node tests/...` exercising `cmdVerifyDrift` exit code | ❌ Wave 0 |
| DRIFT-04 | `verify drift --json` emits valid JSON; `--top N` ranks; never exits non-zero | integration | `node bin/gsd-tools.cjs verify drift --scope . --json` | ❌ Wave 0 (smoke) |
| DRIFT-01/05 | CJS↔SDK manifest + config-schema parity (verify.drift + new keys in both) | unit | parity guard (mirror existing schema-parity test) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant single detector test (`node tests/<detector>.test.cjs`).
- **Per wave merge:** full detector suite + `verify drift --json` smoke.
- **Phase gate:** full suite green + `check-drift.yml` `drift-detectors` job green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/semantic-dup.test.cjs` — DRIFT-05 (MinHash+LCS, determinism, never-throw, noise-exclusion)
- [ ] `tests/phantom-scaffolding.test.cjs` — DRIFT-05 (CRUD-export-never-routed across ESM+CJS, placeholder, string-safety)
- [ ] `tests/drift-allowlist.test.cjs` — DRIFT-03 (pair suppression + auditability)
- [ ] CJS↔SDK parity guard for `verify.drift` + new config keys (mirror existing parity test)
- [ ] **Calibration task** (not a test): run the ported detector on gsd-plugin itself; confirm dual-resolver suppressed and the top-N is signal-rich; tune `MIN_BODY_TOKENS`/`FLAG_THRESHOLD`
- [ ] `.github/workflows/check-drift.yml` — add a `drift-detectors` job running the new tests with no `npm ci` (zero-dep, mirrors the `conventions` job)

## Security Domain

> `security_enforcement` not disabled in config → included. This phase reads arbitrary repo source and splices paths into a subcommand — same trust boundaries as Phase 10.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface |
| V3 Session Management | no | none |
| V4 Access Control | no | local CLI only |
| V5 Input Validation | yes | `sanitizePaths` / `SAFE_PATH_RE` on every path arg (T-10-01/04); `MAX_SCAN_BYTES` size cap (T-10-02); allowlist JSON parsed never-throw |
| V6 Cryptography | n/a | FNV-1a here is a *non-cryptographic* hash for MinHash bucketing only — not a security primitive; do not present it as one |

### Known Threat Patterns for {pure-Node static analyzer over untrusted repo source}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal / absolute path in `--scope`/`--files` | Tampering | `sanitizePaths` + `SAFE_PATH_RE` before any fs read (reuse Phase 10) |
| ReDoS on adversarial source via the import/export/CRUD regexes | DoS | Keep all regexes linear (no nested quantifiers, like `blankSpans`); cap per-file bytes (`MAX_SCAN_BYTES`); bounded repo walk (budget 5000) |
| Detector throwing/exiting non-zero fails the milestone gate | DoS / EoP | Never-throw + never-exit-nonzero contract (T-10-03/05): every path emits `{skipped:true,reason}` and returns 0; the gate only fails on an *explicit* `--fail-on-score` |
| Supply chain (a new dep) | Tampering | Zero new deps (T-10-SC); CI `drift-detectors` job runs without `npm ci` |
| `TODO`/path strings *inside* source strings causing false matches | Tampering (data) | Run all body scans through `conventions.blankSpans` first |
| CJS↔SDK schema/manifest drift introduced by this phase | Tampering | Parity guard test (T-10-06 pattern) for `verify.drift` + new config keys |

A Phase 11 SECURITY.md should be authored mirroring 10-SECURITY.md, re-using T-10-01..06/SC threat IDs as T-11-xx, with `asvs_level: 1` and `threats_open: 0` target.

## Sources

### Primary (HIGH confidence)
- `@vibedrift/cli@0.14.4` npm package — read locally via `npm pack`; `dist/tools-core/index.js` contains the un-obfuscated MinHash/LSH/LCS/shingle/import-graph/phantom-scaffolding implementations and the `.vibedrift/config.json` + `.vibedriftignore` strings. [VERIFIED: npm registry + local unpack]
- `bin/lib/conventions.cjs`, `bin/lib/drift.cjs`, `bin/lib/verify.cjs`, `bin/lib/verify-command-router.cjs`, `bin/lib/config-schema.cjs`, `sdk/src/query/config-schema.ts`, `sdk/src/query/command-manifest.verify.ts`, `workflows/scan.md`, `workflows/audit-milestone.md`, `bin/check-gsd-release.sh`, `bin/maintenance/check-upstream-schema.cjs`, `.github/workflows/check-drift.yml`, `tests/conventions.test.cjs` — read in full from the live repo. [VERIFIED]
- `.planning/phases/11-.../11-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/milestones/v1.3-vibedrift-evaluation.md`, `.planning/milestones/v1.3-semantic-dup-research.md`, `10-SECURITY.md` — read in full. [VERIFIED]

### Secondary (MEDIUM confidence)
- VibeDrift product site + the dev.to introduction article (the five detection dimensions, `--fail-on-score`, Code DNA naming). [CITED: vibedrift.ai, dev.to/skaaz]

### Tertiary (LOW confidence)
- slopcheck verdict for `@vibedrift/cli` — could not run; immaterial (no install).

## Metadata

**Confidence breakdown:**
- Standard stack (zero-dep + reuse map): HIGH — every reuse target read from the live repo
- MinHash+LCS algorithm + parameters: HIGH — read verbatim from the published bundle (resolves the only Discretion item)
- Phantom-scaffolding + import-graph: HIGH — regex shapes read from the bundle
- `.vibedrift` allowlist format: HIGH on what the format *is* (decoded from bundle); MEDIUM on how D-07 "reuse the format" should be interpreted (Open Question 1)
- Gate / scan / router wiring: HIGH — existing Phase 10 patterns are exact templates
- Extraction fidelity without tree-sitter: MEDIUM — needs a Wave 0 calibration pass (Open Question 2)

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable — internal patterns + a published algorithm; revisit if VibeDrift ships a major version with new heuristics, which is exactly what the D-02 watch is for)
