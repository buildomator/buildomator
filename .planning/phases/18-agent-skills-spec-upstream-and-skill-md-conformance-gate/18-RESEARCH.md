# Phase 18: Agent Skills Spec Upstream and SKILL.md Conformance Gate - Research

**Researched:** 2026-10-11
**Domain:** Plugin-self maintenance tooling (loud-fail ratchet gate + cron upstream watch) and an external spec/linter integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Soft headroom ceiling at **90**; current count **86**. Warn inside the headroom band, hard-fail only when the count would exceed 90.
- **D-02:** Count **SKILL.md files, not `skills/*/` subdirectories.** Glob `skills/*/SKILL.md`. `skills/bundled/` is a bundled-assets dir, not a skill.
- **D-03:** Loud-fail (hard error) only on: missing or empty `name`, missing or empty `description`, and malformed `allowed-tools` when present.
- **D-04:** The spec's other fields (`license`, `compatibility`, `metadata`) are advisory warnings only, never hard failures.
- **D-05:** Description-length cap is a **ratchet**, baseline at the current longest (**380 chars**, `skills/discuss-phase/SKILL.md`), loud-fail on growth past baseline. `--write-baseline` regenerates deliberately; no auto-regen in CI.
- **D-06:** New cron notifier mirroring `bin/check-vibedrift-release.sh`: the npm version of the linter CLI is authoritative; `agentskills/agentskills` GitHub releases are best-effort (`|| exit 0`). Watch only, never vendor, never invoke at runtime.
- **D-07:** Register the watch in the idea-only upstream list in **PROJECT.md** (where VibeDrift as "second upstream" is recorded), not only in a watch-list doc. Reconcile the `upstream-deferred.md` assumption during planning.
- **D-08:** Hybrid. Port the validation rules **natively** into the CJS gate for our own 86 skills (offline, pre-commit + check-drift.yml, callable by the Phase 16 trust gate via `bm-sdk query`). For untrusted external catalog candidates only, allow an optional `npx skills-ref validate` shell-out at assess time (network-dependent, opt-in).

### Claude's Discretion
- Exact warn-band threshold for the soft ceiling (e.g. warn at >=88).
- Exact npm package name for the linter CLI (research confirms below) and the GitHub release endpoint.
- Placement/name of the new watch script (`bin/check-agentskills-release.sh` vs other).
- Whether to surface the spec's optional fields (`compatibility`, `metadata`) as advisory annotations in gate output.
- Whether this phase ships CJS-only or needs an SDK twin (research confirms: CJS-only is sufficient).

### Deferred Ideas (OUT OF SCOPE)
- Runtime external-skill catalog (propose/assess/install at runtime) is a separate feature (seed `jit-external-skill-catalog`, design note `jit-skill-catalog-design-261003.md`). This phase delivers only the validate step that feeds its trust gate.
- The reviewed-but-not-folded todos listed in CONTEXT.md stay on the todo list.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-07 | Track the Agent Skills spec (agentskills.io / agentskills/agentskills) and skills.sh for catalog updates, VibeDrift-style (watch, do not vendor). | Spec repo + npm linter confirmed below; `check-vibedrift-release.sh` is the proven cron-watch template; PROJECT.md is the live register per D-07. |
| CAT-08 | A SKILL.md conformance gate over the 86 plugin skills validates frontmatter against the spec and enforces a description-length cap and total-skill-count ceiling (loud-fail ratchet like jargon/prose). Adopt `skills-ref validate` to also vet catalog candidates (CAT-03). | `check-user-docs-jargon.cjs` / `check-user-docs-prose.cjs` are the ratchet template; reference validator rules extracted below; native port plugs into the Phase 16 trust gate. |
| CAT-03 | Trust gate: safety. Insertion gated structurally plus one-time human approve. | `skills-ref validate` becomes an added structural check for external candidates; native validator for our own skills. Plug point is `assessEntry` in the trust gate. |
</phase_requirements>

## Summary

This phase has two independent deliverables that share no runtime code. The first is a cron notifier that watches the Agent Skills spec and its reference linter for upstream changes, built by cloning `bin/check-vibedrift-release.sh`. The second is a loud-fail ratchet gate over the plugin's own 86 skills, built by cloning the `check-user-docs-jargon.cjs` / `check-user-docs-prose.cjs` shape, wired into `.github/workflows/check-drift.yml` and the pre-commit hook. A thin third strand adopts the external `skills-ref validate` linter as an opt-in check for untrusted external catalog candidates inside the Phase 16 trust gate.

The external spec is real and stable. The spec lives at `agentskills.io/specification` and `github.com/agentskills/agentskills` (description: "Specification and documentation for Agent Skills", last pushed 2026-08-09). The reference linter is published to npm as `skills-ref` (v0.1.5, bin `skills-ref`, subcommand `skills-ref validate <dir>`, exit 1 on errors). The `npx skills add` consumption path is a different package: `skills` (vercel-labs/skills, v1.7.2, homepage skills.sh, ~4.7M weekly downloads).

Two findings drive the whole design and must reach the planner intact. First, the reference validator is deliberately stricter than our skills can satisfy: it rejects any frontmatter field outside its six-field allowlist, and our skills carry `argument-hint`, `type`, `agent`, `model`, and `argument-instructions` (Claude Code plugin fields). Running `skills-ref validate` against our own skills would fail nearly all of them. That is exactly why D-08 ports a narrow subset natively for our skills and reserves the full `npx skills-ref` for external candidates. Second, the npm `skills-ref` package is published by an individual maintainer (`yc.ma`) with no `repository` field, not visibly by the agentskills org, which is a provenance concern the planner must gate before the opt-in shell-out is trusted.

**Primary recommendation:** Build a CJS-only gate `bin/maintenance/check-skill-conformance.cjs` that globs `skills/*/SKILL.md`, enforces the D-03 hard-fail subset plus the D-01 ceiling and D-05 description ratchet against a new `skill_conformance` section in `tests/drift-baseline.json`, wired into a new `check-drift.yml` job and the pre-commit hook. Separately clone the VibeDrift watch into `bin/check-agentskills-release.sh` keyed on `npm view skills-ref version` with a best-effort GitHub commit fallback. Register the 5th upstream in PROJECT.md. Add the opt-in `npx skills-ref validate` shell-out behind a human-verify gate in the trust gate's external-candidate path only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Own-skill conformance validation | Maintenance tooling (`bin/maintenance/*.cjs`) | CI job + pre-commit hook | Offline, deterministic, ratchet-shaped; same tier as jargon/prose gates. |
| Skill-count ceiling + description ratchet | Maintenance tooling (`bin/maintenance/*.cjs`) | `tests/drift-baseline.json` | Baseline-compare ratchet reuses the committed baseline file convention. |
| Upstream spec/linter watch | Ops cron (`bin/check-*.sh`) | PROJECT.md register | Network-dependent notifier, never on the runtime path (D-06). |
| External-candidate validation (npx) | Trust gate (`bin/lib/skill-trust-gate.cjs` assess path) | opt-in `npx skills-ref` | Third-party fidelity where third-party code warrants it; opt-in and network-gated. |
| CI + pre-commit wiring | `.github/workflows/check-drift.yml` + `pre-commit-drift-baseline.sh` | `install-git-hooks.sh` | Established gate-registration seams. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`, `child_process`) | Node 22 (CI), >=18 | Gate + watch implementation | All existing `bin/maintenance` ratchets are zero-dep Node built-ins. [VERIFIED: repo] |
| A YAML frontmatter parser | (see note) | Parse SKILL.md frontmatter | The existing repo already parses skill frontmatter (`frontmatter-bom` test, init.cjs). Reuse the in-repo parser rather than adding `js-yaml`. [VERIFIED: repo] |

### Supporting (external, watched only, not installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `skills-ref` | 0.1.5 | Reference linter; `skills-ref validate <dir>` | Opt-in `npx` shell-out for UNTRUSTED EXTERNAL candidates only (D-08). Never installed into the repo. [CITED: agentskills.io/specification] [SUS provenance] |
| `skills` | 1.7.2 | `npx skills add <owner/repo>` consumption path (skills.sh) | Documented in README as opt-in only; never automated (D-06, specifics). [VERIFIED: npm registry; repo vercel-labs/skills] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native CJS port of validation rules | Run `npx skills-ref validate` against our own 86 skills | Rejected by D-08 and by hard evidence: the reference validator rejects unknown frontmatter fields, so it fails nearly all our skills (we use `argument-hint`, `type`, `agent`, `model`). Native subset is the only viable path for our own skills. |
| `skills-ref` (npm) | `skref` (Rust), `skills_lint` (Dart), `agent-skills-ts-sdk` | All third-party reimplementations of the same spec. `skills-ref` is the one the official spec page links to. None change the native-port decision. |
| In-repo frontmatter parser | Add `js-yaml` dependency | Adds a runtime dep to a zero-dep maintenance tier; the repo already parses skill frontmatter. Prefer reuse. |

**Verified versions (2026-10-11):**
```
skills-ref        0.1.5   (created 2025-12-26, bin skills-ref -> dist/cli.js, deps commander + js-yaml, engines node>=18)
skills            1.7.2   (vercel-labs/skills, homepage skills.sh, ~4.72M weekly downloads)
```

## Package Legitimacy Audit

> This phase installs NO external packages into the repo. `skills-ref` is invoked only via an opt-in `npx` shell-out for external candidates; `skills` is documented as an opt-in user action. Both are watched, never vendored (D-06).

| Package | Registry | Age | Downloads | Source Repo | Disposition |
|---------|----------|-----|-----------|-------------|-------------|
| `skills` | npm | ~stable (v1.7.2) | ~4.72M/wk | github.com/vercel-labs/skills | Approved (consumption path, opt-in, documented only) |
| `skills-ref` | npm | created 2025-12-26 (v0.1.5) | ~12.6k/wk | none on npm (`repository` undefined); spec links to agentskills/agentskills/tree/main/skills-ref | **Flagged [SUS]** - see below |

**Packages flagged as suspicious [SUS]:** `skills-ref`. The npm package is published by an individual maintainer (`yc.ma <yanchaoma@foxmail.com>`, author `YanchaoMa`) and carries no `repository` field. The official spec page links to the reference library as a subdirectory of `github.com/agentskills/agentskills` (not to this npm package), and that repo cuts no releases or tags. It is plausible the npm `skills-ref` is a third-party republish rather than an official agentskills-org publish. Because D-08 only uses it via opt-in `npx` for external (already-untrusted) candidates and never on our runtime path, the blast radius is bounded, but the planner should: (1) gate the `npx skills-ref` shell-out behind a `checkpoint:human-verify` before first trust, and (2) consider pinning to a specific version or pointing at the git subdirectory instead of the floating npm name. slopcheck was not run this session; treat `skills-ref` as `[ASSUMED]` provenance until human-verified.

## The External Spec (CAT-07, D-06/D-07)

### Confirmed facts
- **Spec site:** `agentskills.io/specification` (frontmatter table reproduced below). [CITED]
- **Spec repo:** `github.com/agentskills/agentskills`, description "Specification and documentation for Agent Skills", last push 2026-08-09, **0 releases, 0 tags**. Latest `main` commit `69ef37e9` (2026-08-09). [VERIFIED: gh api]
- **Reference linter:** npm `skills-ref` v0.1.5. Commands confirmed by inspecting the published tarball (`dist/cli.js`): `validate <skillPath>`, `read-properties <skillPath>`, `to-prompt <skillPaths...>`. `validate` collects an error list and calls `process.exit(1)` when non-empty, exit 0 when clean. Node >=18. [VERIFIED: npm tarball inspection]
- **Consumption path (`npx skills add`):** npm `skills` v1.7.2 = vercel-labs/skills, homepage skills.sh. [VERIFIED: npm + gh api]

### Watch design implication (D-06)
The authoritative signal is `npm view skills-ref version` (mirrors the VibeDrift `npm view @vibedrift/cli version` pattern exactly). The GitHub side is best-effort: since `agentskills/agentskills` publishes **no releases and no tags**, the `gh api .../releases/tags/vX` call used by the VibeDrift script will always 404 here. The best-effort GitHub fallback should instead track the latest commit sha on `main` (`gh api repos/agentskills/agentskills/commits/main --jq .sha`) or simply drop to the npm signal alone, all guarded by `|| exit 0` so cron never wedges. Optionally also watch `npm view skills version` for the skills.sh consumption path.

### Spec frontmatter (reproduced from agentskills.io/specification) [CITED]
| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | 1-64 chars; lowercase Unicode letters, digits, hyphens only; no leading/trailing hyphen; no consecutive `--`; **must match parent directory name**. |
| `description` | Yes | 1-1024 chars; non-empty. |
| `license` | No | License name or reference to a bundled license file. |
| `compatibility` | No | 1-500 chars; environment requirements. |
| `metadata` | No | Map of string keys to string values. |
| `allowed-tools` | No | **Space-separated string** of pre-approved tools, e.g. `Bash(git:*) Bash(jq:*) Read`. Marked Experimental. |

Progressive-disclosure guidance from the spec: `name` + `description` (~100 tokens) load at startup for all skills, which is the exact token tax the ceiling and description ratchet defend against (D-01, D-05).

### Reference validator rules (extracted verbatim from `skills-ref@0.1.5` `dist/validator.js`) [VERIFIED: tarball]
Constants: `MAX_SKILL_NAME_LENGTH = 64`, `MAX_DESCRIPTION_LENGTH = 1024`, `MAX_COMPATIBILITY_LENGTH = 500`.
- `name`: non-empty string; NFKC-normalized; length <= 64; must equal `toLowerCase()`; no leading/trailing hyphen; no `--`; only Unicode letters/digits/hyphens; **directory basename must equal name**.
- `description`: non-empty string; length <= 1024.
- `compatibility`: if present, must be a string; length <= 500.
- **Unknown-field rejection:** any frontmatter key not in `{name, description, license, allowed-tools, metadata, compatibility}` is an error ("Unexpected fields in frontmatter: ...").
- `allowed-tools`: **no validation at all** (it is allowlisted but never checked). So "malformed allowed-tools" in D-03 is OUR rule to define, not the spec's.
- `validate(dir)` also errors on: path missing, not a directory, missing SKILL.md, YAML parse error.

## Internal Patterns to Mirror (CAT-08, D-01..D-05)

### The ratchet template (`check-user-docs-jargon.cjs` / `check-user-docs-prose.cjs`) [VERIFIED: repo]
Both files share one exact shape the new gate must clone:
1. `'use strict'`; parse `--dry` and `--write-baseline` from `process.argv.slice(2)`.
2. **Repo-root guard:** `if (!fs.existsSync('.git') || !fs.existsSync('skills')) { console.error('error: run from repo root ...'); process.exit(2); }`.
3. Scan and aggregate counts.
4. `readBaseline()` reads `tests/drift-baseline.json`, returns `null` on missing/parse-error.
5. `writeBaseline()` reads the existing baseline object, sets ONLY its own top-level key (preserving sibling sections), writes back `JSON.stringify(existing, null, 2) + '\n'`, `fs.mkdirSync('tests', {recursive:true})` first.
6. `--write-baseline`: report then write, return.
7. `--dry`: report, print "not comparing", return.
8. No baseline: report, print "No baseline found (run with --write-baseline)", return (exit 0).
9. Compare: push regressions where `aggregate[k] > (bl[k] ?? 0)`; if any, print `Status: FAIL`, the offending lines, the `--write-baseline` acceptance hint, and `process.exit(1)`.
10. **Exit codes: 0 pass / 1 ratchet regression / 2 usage (wrong cwd).**

### Baseline file convention [VERIFIED: repo]
`tests/drift-baseline.json`, one top-level key per gate. Current committed sections: `file_layout`, `user_docs_prose`. (Note: `user_docs_jargon` is referenced by its gate but is NOT currently a committed section, so that gate presently no-ops with "No baseline found". The new gate should add a `skill_conformance` section.) Each section carries its counts plus a `generated_at` date and a `note`. The new section should hold, at minimum, `skill_count`, `max_description_length`, and the chosen ceiling/warn thresholds.

### The test template (`tests/user-docs-jargon.test.cjs`) [VERIFIED: repo]
Discrimination test using a tmpdir sandbox: `fs.mkdtempSync`, create empty `.git/`, `skills/`, `tests/` markers, write fixtures, run the detector via `spawnSync('node', [DETECTOR, ...flags], {cwd, encoding:'utf-8', timeout})`, assert on `status` and `stdout`. Cases: clean+baseline => exit 0; injected regression => exit 1 with offending category named; (for us) count/description over ceiling => fail; `--write-baseline` preserves sibling baseline sections.

### The watch template (`bin/check-vibedrift-release.sh`) [VERIFIED: repo]
`set -euo pipefail`; a `$HOME/.<name>-last-known-version` state file; robust `npm` resolution (probe `command -v npm`, then Homebrew/node paths, else `exit 0`); a GitHub network pre-check (`curl -sf --max-time 5 https://api.github.com/zen || exit 0`); `LATEST=$(npm view <pkg> version) || exit 0`; first-run seeds the file and exits silent; on change, build a mail body and `ssh "$MAIL_HOST" mail -s ... $RECIPIENT`, then update the state file only after a successful send. Note: the existing script contains em/en dashes; the new script must not (project rule).

## Architecture Patterns

### System Architecture Diagram

```
Deliverable 1: Own-skill conformance ratchet (offline, CJS)
---------------------------------------------------------------
  skills/*/SKILL.md ──► check-skill-conformance.cjs ──► parse frontmatter
                                 │                         (name, description,
                                 │                          allowed-tools)
                                 ▼
                         compare vs tests/drift-baseline.json
                           ├─ count > 90 ................► HARD FAIL (D-01)
                           ├─ count in warn band ........► WARN (D-01)
                           ├─ any description > baseline ► HARD FAIL (D-05)
                           ├─ missing/empty name|desc ...► HARD FAIL (D-03)
                           ├─ malformed allowed-tools ...► HARD FAIL (D-03)
                           └─ license/compat/metadata ...► advisory WARN (D-04)
                                 │
      ┌──────────────────────────┼───────────────────────────┐
      ▼                          ▼                           ▼
  pre-commit hook        check-drift.yml job         bm-sdk query (Phase 16
  (no auto-regen)        (CI, node tests/...)         trust gate, own-skill path)

Deliverable 2: Spec/linter upstream watch (cron, ops-only)
---------------------------------------------------------------
  cron ──► check-agentskills-release.sh
             ├─ npm view skills-ref version  (authoritative, D-06)
             ├─ gh commits/main sha          (best-effort, || exit 0)
             └─ on change: ssh mail to maintainer
           (never vendored, never on runtime path)

Deliverable 3: External-candidate validation (opt-in, network)
---------------------------------------------------------------
  external catalog candidate ──► trust gate assessEntry
                                   └─ opt-in: npx skills-ref validate <dir>
                                      (untrusted candidates only; human-verified)
```

### Recommended file placement
```
bin/maintenance/check-skill-conformance.cjs   # the ratchet gate (CJS-only)
bin/check-agentskills-release.sh              # the cron watch (sibling of check-vibedrift-release.sh)
tests/skill-conformance.test.cjs              # discrimination test (sandbox pattern)
tests/drift-baseline.json                     # add "skill_conformance" section
```

### Pattern: narrow native validation subset (D-08)
The native gate validates ONLY what D-03/D-04 name, NOT the full reference validator. It must NOT port the reference validator's unknown-field rejection (our skills legitimately carry `argument-hint`, `type`, `agent`, `model`, `argument-instructions`). Port only: `name` present/non-empty (hard), `description` present/non-empty (hard), `allowed-tools` well-formed if present (hard), and optionally advisory warnings for `license`/`compatibility`/`metadata` absence or malformation (D-04, never fail). The name-matches-directory rule is advisory at most (see pitfall below).

### Anti-Patterns to Avoid
- **Running `skills-ref validate` against our own skills.** It fails nearly all of them on unknown fields. Native subset only for our skills.
- **Counting `skills/*/` directories.** 87 dirs vs 86 SKILL.md; `skills/bundled/` has no SKILL.md (D-02).
- **Auto-regenerating the baseline in CI.** The whole point is the author pause (feedback_jargon_detector_no_auto_regen). `--write-baseline` is manual only.
- **Hardcoding `/usr/bin/npm` in the watch.** cron has a minimal PATH; probe `command -v npm` first (the VibeDrift fix).
- **Em/en dashes in the new `.sh` and `.cjs` files, or the word "canonical".** Project rules; the existing VibeDrift script violates the dash rule and must not be copied verbatim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ratchet scaffolding (baseline read/write, exit codes, repo guard) | A fresh gate from scratch | Clone `check-user-docs-jargon.cjs` | Exact shape is proven and tested; preserves sibling baseline sections. |
| Cron watch (npm resolution, network pre-check, mail) | A fresh notifier | Clone `check-vibedrift-release.sh` | The npm-PATH and `|| exit 0` wedge-guards were learned the hard way. |
| YAML frontmatter parsing | A regex or `js-yaml` dep | The in-repo frontmatter parser | Zero-dep tier; BOM tolerance already handled (frontmatter-bom test). |
| Spec rule definitions | Inventing field rules | The extracted `skills-ref` validator constants (64/1024/500) | Keeps native subset aligned with the real spec for the fields we do check. |

## Phase 16 Trust-Gate Integration (D-08, CAT-03)

### Current call path [VERIFIED: repo]
- Entry: `bm-sdk query craft-skill.assess` (and spaced `craft-skill assess`), registered in `sdk/src/query/command-static-catalog-domain.ts` lines 106-107, handler `craftSkillAssess` in `sdk/src/query/craft-skill.ts`.
- CJS twin: `gsd-tools.cjs craft-skill <sub>` dispatches to `bin/lib/craft-skill-insert.cjs` `cmdCraftSkill` (gsd-tools.cjs line 685-686).
- The assessment itself is `assessEntry(entry, catalog)` -> `EntryAssessment`, present in both twins: `sdk/src/skill-trust-gate.ts` and `bin/lib/skill-trust-gate.cjs`. It combines a safety axis (`checkSafety`: publisher allowlist, bundled-scripts ban, pinned commit) and a license axis (`classifyLicense`), producing verdict `allow|flag|block` plus a human-readable `prompt[]`.

### Where the new validation plugs in
- **Own skills (native, offline):** the new CJS validator is a standalone `bin/maintenance` gate. It does not need to touch `assessEntry`. The Phase 16 trust gate can call it over `bm-sdk query` only if an own-skill assessment is ever needed; for the 86 skills the gate runs in pre-commit/CI, not through the trust gate.
- **External candidates (opt-in npx):** add an optional structural check inside the external-candidate assess path. The `npx skills-ref validate <dir>` shell-out belongs behind the existing safety axis, gated so it runs only for not-yet-trusted external entries and only when network/opt-in is enabled. A non-empty error list from the linter should downgrade the verdict (feed a safety finding), never silently pass.

### CJS-only vs SDK twin (Discretion, resolved)
**CJS-only is sufficient.** The gate is a `bin/maintenance` ratchet, which the repo treats as CJS-only and not twinned (CONTEXT.md established pattern; `check-drift.cjs`, jargon, prose are all CJS-only). The trust gate IS twinned (CJS `bin/lib/skill-trust-gate.cjs` + SDK `sdk/src/skill-trust-gate.ts` with a parity test), so if the external-candidate `npx` shell-out is added into `assessEntry`, that one change must land in both twins to keep `tests/craft-skill-sdk-parity.test.cjs` green. The ratchet gate itself stays CJS-only. Net: no new SDK twin for the ratchet; mind parity only if touching the shared `assessEntry`.

## CI + Pre-commit Wiring (exact insertion points)

### `.github/workflows/check-drift.yml` [VERIFIED: repo]
Jobs are independent, each `actions/checkout@v4` + `actions/setup-node@v4` (node 22), then `node <script>`. The jargon/prose jobs (lines 164-188) are the template. Add a new job mirroring `user-docs-prose`:
```yaml
  skill-conformance:
    name: SKILL.md conformance + ceiling ratchet
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Run SKILL.md conformance gate
        run: node bin/maintenance/check-skill-conformance.cjs
      - name: Run SKILL.md conformance discrimination test
        run: node tests/skill-conformance.test.cjs
```

### `bin/maintenance/pre-commit-drift-baseline.sh` [VERIFIED: repo]
After the prose block (ends ~line 143, before `exit 0`), add a new block cloning the prose block exactly: run the gate, on non-zero print the "regressed" error with the `--write-baseline` acceptance hint and `exit 1`. NO auto-regen (unlike the file-layout branch). The jargon and prose blocks are the precise model.

### `bin/maintenance/install-git-hooks.sh`
No change required. It symlinks `pre-commit-drift-baseline.sh` into `.git/hooks/pre-commit`; adding a block to that script is picked up automatically.

### `bin/maintenance/check-drift.cjs`
Optional. This local umbrella orchestrator currently runs four detectors and is deliberately offline/deterministic. Adding the conformance gate here is reasonable (it is offline), but note the jargon/prose gates are NOT in this umbrella either, so leaving it out matches current practice. Planner's call; CI + pre-commit are the required wirings.

## Upstream Register Reconciliation (D-07)

- The live idea-only upstream register is **`.planning/PROJECT.md`**, where VibeDrift is recorded as "second upstream" in two places: the Validated-features list (~line 46: "VibeDrift adopted as a second upstream ... never invoked at runtime (DRIFT-01)") and the decisions table (~line 128: "VibeDrift as a second upstream (native port, never run)"). [VERIFIED: repo]
- There is **no `upstream-deferred.md`** in the repo; the todo's assumption is stale. The register is PROJECT.md plus the `bin/check-*.sh` cron scripts. Record the Agent Skills spec as the 5th idea-only upstream in PROJECT.md following the VibeDrift wording, and add `bin/check-agentskills-release.sh` as its watch script. [VERIFIED: repo - no such file]

## Runtime State Inventory

This is a greenfield tooling phase (new gate script, new watch script, new test, additive edits to CI/hook/PROJECT.md). No rename, migration, or stored-state rewrite. Not applicable; omitted.

## Common Pitfalls

### Pitfall 1: `allowed-tools` format is heterogeneous in our own skills
**What goes wrong:** D-03 hard-fails on "malformed allowed-tools when present", but our 86 skills do not use the spec's space-separated-string format. Live scan: 84 use a YAML list (`allowed-tools:\n  - Read`), `skills/join-discord/SKILL.md` uses `allowed-tools: []`, and `skills/reapply-patches/SKILL.md` uses a comma-separated inline string (`allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion`). NONE match the spec's space-separated form.
**Why it happens:** Claude Code plugin skills predate and diverge from the spec's experimental `allowed-tools` string format.
**How to avoid:** Define "malformed" against OUR accepted forms (YAML sequence, empty inline array, comma/space inline string that parses to a non-empty tool list), NOT strict spec conformance. Normalizing on spaces alone would mis-tokenize the comma form (`Read,`). The gate must accept all three existing shapes or all 86 skills fail immediately. [VERIFIED: live scan]

### Pitfall 2: One skill fails the spec's name-matches-directory and name-charset rules
**What goes wrong:** `skills/extract_learnings/` has `name: extract-learnings`. The directory uses an underscore; the spec name rule forbids underscores and requires the directory basename to equal the name. A verbatim port of the reference validator would hard-fail this one skill.
**Why it happens:** Pre-existing dir naming with an underscore while the skill name uses a hyphen.
**How to avoid:** D-03 does NOT list name-matches-directory as a hard failure, so keep that rule advisory (warn), or exclude it from the native subset. Do not block the phase on a pre-existing wrinkle. If the planner wants it clean, a separate rename of the directory is out of scope for this phase. All other 85 names are spec-valid charset-wise (live scan found no uppercase/consecutive-hyphen/lead-trail violations). [VERIFIED: live scan]

### Pitfall 3: The reference validator rejects our legitimate frontmatter fields
**What goes wrong:** `skills-ref validate` errors on any field outside `{name, description, license, allowed-tools, metadata, compatibility}`. Our skills carry `argument-hint` (67), `type` (6), `agent` (2), `model` (1), `argument-instructions` (1). The linter would report "Unexpected fields" for almost every skill.
**How to avoid:** Never run the external linter against our own skills (D-08). The native subset does not implement unknown-field rejection. [VERIFIED: tarball + live scan]

### Pitfall 4: GitHub best-effort watch always 404s on releases
**What goes wrong:** Cloning the VibeDrift script's `gh api repos/.../releases/tags/vX` call against `agentskills/agentskills` always 404s because that repo has 0 releases and 0 tags.
**How to avoid:** Make the npm `skills-ref` version the authoritative signal (D-06). For the GitHub best-effort side, track the latest `main` commit sha instead of releases, or drop it; guard with `|| exit 0`. [VERIFIED: gh api]

### Pitfall 5: `skills-ref` npm provenance
**What goes wrong:** The opt-in `npx skills-ref validate` pulls an npm package published by an individual with no repository link, not clearly the agentskills org.
**How to avoid:** Gate the first use behind human-verify; pin a version or point at the official git subdirectory; keep it opt-in and off the runtime path (D-08). [VERIFIED: npm maintainers]

## Code Examples

### Globbing SKILL.md files and counting (D-02)
```js
// Count SKILL.md files, NOT skills/*/ dirs. skills/bundled/ has no SKILL.md.
const fs = require('fs');
const path = require('path');
const dirs = fs.readdirSync('skills', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => path.join('skills', d.name, 'SKILL.md'))
  .filter(p => fs.existsSync(p));   // drops skills/bundled/ automatically
const skillCount = dirs.length;      // expect 86
```

### Ceiling with warn band (D-01)
```js
const CEILING = 90;
const WARN_AT = 88;                  // Discretion: warn inside headroom
if (skillCount > CEILING) { /* push HARD FAIL */ }
else if (skillCount >= WARN_AT) { /* print advisory WARN, exit 0 */ }
```

### Description ratchet (D-05), reusing the baseline convention
```js
// max observed description length across all SKILL.md; baseline = 380 today.
// FAIL when maxLen > baseline.max_description_length (grow-fail only).
```

### Reference validator invocation (external candidates only, D-08)
```bash
# opt-in, untrusted external candidate only, human-verified, off runtime path
npx --yes skills-ref@0.1.5 validate ./candidate-skill   # exit 1 => validation errors
```
Note: the research protocol warns against `npx --yes` auto-download of unverified packages; this is precisely why the shell-out is opt-in, version-pinned, and human-verified, and why `skills-ref` carries a [SUS] provenance flag above. The planner should weigh pinning to the git subdirectory instead.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No cross-tool SKILL.md spec | Agent Skills spec at agentskills.io + reference linter | spec repo active through 2026-08 | A shared frontmatter contract exists to validate against. |
| Ad-hoc skill frontmatter | `name`/`description` required, startup-token-priced | spec formalized | Justifies the ceiling + description ratchet (token tax). |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `skills-ref` npm package is a trustworthy stand-in for the official reference linter | Package Legitimacy | Opt-in npx would run unofficial third-party code; bounded by opt-in + human-verify. Mitigation: pin or use git subdir. |
| A2 | Warn band at >=88 is the right headroom threshold | Code Examples (D-01) | Cosmetic only; discretion item, easily tuned. |
| A3 | The in-repo frontmatter parser is reusable for the gate without a new dep | Standard Stack | If it is tightly coupled to skill-loading, the gate may need a small local parser; still zero-dep. |

## Open Questions

1. **Exact "malformed allowed-tools" definition.**
   - What we know: three shapes exist in-repo (YAML list, `[]`, comma-string).
   - What's unclear: whether the planner wants to also normalize `reapply-patches` to a list for consistency.
   - Recommendation: accept all three shapes; treat only unparseable/non-string-non-list as malformed. Optionally a separate cleanup normalizes `reapply-patches` (out of this gate's hard-fail scope).

2. **Whether to also watch `npm view skills` (skills.sh consumption path).**
   - Recommendation: watch `skills-ref` as primary; optionally add `skills` as a second npm line in the same script.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | gate + test | Yes | v22 in CI, local present | none needed |
| `npm` | watch script (version probe) | Yes (cron must probe PATH) | - | `|| exit 0` wedge-guard |
| `gh` CLI | best-effort GitHub side of watch | Yes locally | - | `|| exit 0`; npm signal is authoritative |
| `curl` | watch network pre-check | Yes | - | `|| exit 0` |
| `ssh` + mail host | watch notification | maintainer host `m1.linuxbe.com` | - | n/a (ops-only) |
| network / `npx` | opt-in external-candidate validate | only at assess time | - | native subset is the default; npx is opt-in |

**Missing dependencies with no fallback:** none. The gate and test are offline Node built-ins; the watch is cron-guarded; the npx path is opt-in.

## Validation Architecture

> nyquist_validation is not disabled in config (`workflow` has no `nyquist_validation` key); treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node assertion scripts (no runner), `spawnSync` sandbox pattern |
| Config file | none; tests are standalone `.cjs` run via `node tests/<name>.test.cjs` |
| Quick run command | `node tests/skill-conformance.test.cjs` |
| Full suite command | the individual `node tests/*.cjs` steps in check-drift.yml (no `npm test` aggregator exists) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-08 | count <= ceiling passes; count > 90 hard-fails | unit (sandbox) | `node tests/skill-conformance.test.cjs` | Wave 0 |
| CAT-08 | count in warn band warns but exits 0 | unit | same | Wave 0 |
| CAT-08 | description growth past baseline hard-fails | unit | same | Wave 0 |
| CAT-08 | `--write-baseline` preserves sibling baseline sections | unit | same | Wave 0 |
| CAT-08 | missing/empty name or description hard-fails (D-03) | unit | same | Wave 0 |
| CAT-08 | all three allowed-tools shapes pass; unparseable fails | unit | same | Wave 0 |
| CAT-08 | license/compatibility/metadata never hard-fail (D-04) | unit | same | Wave 0 |
| CAT-08 | wrong cwd exits 2 | unit | same | Wave 0 |
| CAT-08 | all 86 real skills pass the gate (integration) | integration | `node bin/maintenance/check-skill-conformance.cjs` | Wave 0 |
| CAT-07 | watch script wedge-guards (npm absent, network down, 404 release) exit 0 | unit (optional) | `node tests/agentskills-watch.test.cjs` or bash harness | Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `node tests/skill-conformance.test.cjs` plus the gate itself (pre-commit hook runs the gate).
- **Per wave merge:** run the new CI job's two steps.
- **Phase gate:** the gate passes on the real 86 skills, the discrimination test is green, and the watch script exits 0 under the three wedge conditions.

### Wave 0 Gaps
- [ ] `tests/skill-conformance.test.cjs` covers CAT-08 (clone `tests/user-docs-jargon.test.cjs` sandbox shape).
- [ ] `tests/drift-baseline.json` gains a `skill_conformance` section (via `--write-baseline`).
- [ ] Optional `tests/agentskills-watch.test.cjs` or a bash harness for CAT-07 wedge-guards (the VibeDrift watch has no committed test; a lightweight guard is the gap).

## Security Domain

> This is maintenance tooling; `security_enforcement` is not set in config. One real security surface exists: the opt-in `npx skills-ref validate` shell-out executes third-party code.

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation | yes | The gate itself validates untrusted SKILL.md frontmatter; parse defensively, never `eval` YAML. |
| V10/V14 Malicious code / supply chain | yes | `npx skills-ref` provenance is unverified; pin version or git subdir, human-verify, keep opt-in and off the runtime path (D-08). |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Running an unverified npm package via npx | Elevation / Tampering | Opt-in only, version-pinned, human-verified, bounded to external-candidate assess path; never installed into the repo. |
| Cron watch leaking or wedging | Denial of Service | `|| exit 0` wedge-guards throughout (VibeDrift lesson); no secrets in the script. |

## Sources

### Primary (HIGH confidence)
- agentskills.io/specification - full frontmatter table, field rules, `skills-ref validate` invocation. [CITED]
- github.com/agentskills/agentskills - repo existence, description, 0 releases/0 tags, latest main commit (gh api). [VERIFIED]
- npm `skills-ref@0.1.5` tarball - `dist/cli.js` subcommands, `dist/validator.js` rules and constants, bin, engines, maintainers. [VERIFIED]
- npm `skills@1.7.2` + github vercel-labs/skills - skills.sh consumption path. [VERIFIED]
- Repo files read this session: `bin/maintenance/check-user-docs-jargon.cjs`, `check-user-docs-prose.cjs`, `check-drift.cjs`, `pre-commit-drift-baseline.sh`, `install-git-hooks.sh`, `bin/check-vibedrift-release.sh`, `.github/workflows/check-drift.yml`, `tests/user-docs-jargon.test.cjs`, `sdk/src/skill-trust-gate.ts`, `sdk/src/query/command-static-catalog-domain.ts`, `.planning/PROJECT.md`, live scans of `skills/*/SKILL.md`. [VERIFIED]

### Secondary (MEDIUM confidence)
- WebSearch for the spec field list (cross-confirmed against the official spec page). [VERIFIED by primary]

### Tertiary (LOW confidence)
- WebSearch listings of alternative linters (skref, skills_lint, madskills) - informational only, not adopted.

## Metadata

**Confidence breakdown:**
- External spec + linter: HIGH - official spec page plus direct inspection of the published tarball and gh api.
- Internal patterns + wiring: HIGH - every template file read directly, counts verified live (86 SKILL.md, 380-char longest, bundled/ excluded).
- Package provenance: MEDIUM - `skills-ref` exists and works but is published by an individual without a repo link; flagged [SUS].

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 for internal patterns (stable); 2026-10-25 for the external npm/spec surface (early-stage, v0.1.x moves fast).
