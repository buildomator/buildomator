# Phase 18: Agent Skills Spec Upstream and SKILL.md Conformance Gate - Pattern Map

**Mapped:** 2026-10-11
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `bin/maintenance/check-skill-conformance.cjs` | utility (maintenance gate) | batch / transform | `bin/maintenance/check-user-docs-jargon.cjs` | exact |
| NEW `bin/check-agentskills-release.sh` | config (ops cron notifier) | event-driven (poll) | `bin/check-vibedrift-release.sh` | exact |
| NEW `tests/skill-conformance.test.cjs` | test | batch (sandbox spawn) | `tests/user-docs-jargon.test.cjs` | exact |
| MOD `tests/drift-baseline.json` | config (baseline) | file-I/O | existing `user_docs_prose` / `file_layout` sections | exact |
| MOD `.github/workflows/check-drift.yml` | config (CI) | request-response (job) | `user-docs-prose` job (lines 177-188) | exact |
| MOD `bin/maintenance/pre-commit-drift-baseline.sh` | config (git hook) | event-driven | prose no-auto-regen block (lines 116-143) | exact |
| MOD `bin/maintenance/check-drift.cjs` | utility (orchestrator) | batch | `detectors[]` registry (lines 42-75) | exact |
| MOD `bin/lib/skill-trust-gate.cjs` + `sdk/src/skill-trust-gate.ts` | service (trust gate, twinned) | transform (assess) | `checkSafety` / `assessEntry` (both twins) | exact |
| MOD `.planning/PROJECT.md` | doc (upstream register) | n/a | VibeDrift "second upstream" rows (lines 48, 128) | exact |

All analog paths below are absolute under `/Users/jnuyens/src/gsd-plugin/`.

---

## Pattern Assignments

### `bin/maintenance/check-skill-conformance.cjs` (utility, batch/transform)

**Analog:** `bin/maintenance/check-user-docs-jargon.cjs` (203 lines, read in full). Clone its exact skeleton; swap the pattern-scan for SKILL.md frontmatter checks.

**Shebang + header + arg parse + repo-root guard** (lines 1, 33-45) -- copy verbatim, retitle:
```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WRITE_BASELINE = args.includes('--write-baseline');

if (!fs.existsSync('.git') || !fs.existsSync('skills')) {
  console.error('error: run from repo root (expected .git/ and skills/)');
  process.exit(2);
}
```

**Scan source (REPLACE the jargon `TARGETS`/`PATTERNS` with the SKILL.md glob, D-02)** -- from RESEARCH.md "Globbing SKILL.md files" example; `skills/bundled/` drops out because it has no SKILL.md:
```js
const skillFiles = fs.readdirSync('skills', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => path.join('skills', d.name, 'SKILL.md'))
  .filter(p => fs.existsSync(p));   // 86 today; drops skills/bundled/
```

**readBaseline()** (lines 93-102) -- copy verbatim, returns `null` on missing/parse-error:
```js
function readBaseline() {
  const p = 'tests/drift-baseline.json';
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}
```

**writeBaseline() — sibling-preserving pattern** (lines 104-123) -- copy the shape exactly; it reads the existing object, sets ONLY its own top-level key, and writes back with trailing newline. Change `user_docs_jargon` to `skill_conformance` and the payload to `{ skill_count, max_description_length, ceiling, warn_at, generated_at, note }`:
```js
function writeBaseline(payload) {
  const existing = readBaseline() || {};
  existing.skill_conformance = {
    ...payload,
    generated_at: new Date().toISOString().slice(0, 10),
    note: '...describe the ceiling + description ratchet; no auto-regen in CI...',
  };
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(
    'tests/drift-baseline.json',
    JSON.stringify(existing, null, 2) + '\n',
    'utf-8'
  );
  console.log('Wrote tests/drift-baseline.json (skill_conformance section).');
}
```

**main() control flow — the ratchet order** (lines 148-201) -- preserve exactly: WRITE_BASELINE branch (report then write then return) -> read baseline -> report -> DRY branch (print "not comparing", return) -> no-baseline branch (print "No baseline found (run with --write-baseline)", return exit 0) -> compare -> on regression print `Status: FAIL`, the offending lines, the `--write-baseline` accept hint, then `process.exit(1)`. Exit codes 0 pass / 1 regression / 2 usage. The regression-compare block to adapt (lines 174-193):
```js
const bl = baseline.skill_conformance;
const regressions = [];
// D-01: skill_count > ceiling hard-fails (warn band handled separately, exit 0)
// D-05: max_description_length > bl.max_description_length hard-fails (grow-only)
// D-03: per-file missing/empty name|description, malformed allowed-tools -> push
if (regressions.length) {
  console.log('Status: FAIL, SKILL.md conformance regressed beyond baseline');
  for (const r of regressions) console.log(`  ${r}`);
  // ...accept-hint: node bin/maintenance/check-skill-conformance.cjs --write-baseline
  process.exit(1);
}
```

**New logic this gate adds (NOT in the analog) — keep it narrow per D-03/D-04/D-08:**
- Frontmatter parse: reuse the in-repo frontmatter parser (zero-dep; BOM-tolerant per `frontmatter-bom` test). Do NOT add `js-yaml`, do NOT `eval` (V5 input validation, RESEARCH Security Domain).
- Hard-fail (D-03): missing/empty `name`; missing/empty `description`; `allowed-tools` malformed WHEN PRESENT.
- `allowed-tools` malformed definition (Pitfall 1): accept all three live shapes -- YAML list, empty inline `[]`, comma/space inline string. Only unparseable / non-string-non-list is malformed. Do NOT normalize on spaces alone (would mis-tokenize `reapply-patches`' `Read,`).
- Ceiling (D-01): `CEILING = 90`, warn at `>= 88` (Discretion A2); `> 90` hard-fail, warn band advisory + exit 0.
- Description ratchet (D-05): baseline 380 (`skills/discuss-phase/SKILL.md`); fail when any description grows past baseline.
- Advisory-only, NEVER hard-fail (D-04): `license` / `compatibility` / `metadata`. Also keep name-matches-directory and name-charset ADVISORY (Pitfall 2: `skills/extract_learnings/` has `name: extract-learnings`; a verbatim spec port would hard-fail it).
- Anti-pattern (do NOT copy from the reference validator): unknown-field rejection. Our skills legitimately carry `argument-hint`, `type`, `agent`, `model`, `argument-instructions` (Pitfall 3).

---

### `bin/check-agentskills-release.sh` (config, ops cron notifier)

**Analog:** `bin/check-vibedrift-release.sh` (108 lines, read in full). Clone, but STRIP every em/en dash (the existing script uses them at lines 6, 15, 92-104; project rule forbids them in the new file).

**set + state file + robust npm resolution** (lines 2, 12-24) -- copy verbatim, rename the state file:
```bash
set -euo pipefail
VERSION_FILE="$HOME/.agentskills-last-known-version"
NPM="$(command -v npm 2>/dev/null || true)"
if [ -z "$NPM" ]; then
  for cand in /opt/homebrew/bin/npm /usr/local/bin/npm /opt/homebrew/opt/node@22/bin/npm; do
    [ -x "$cand" ] && NPM="$cand" && break
  done
fi
[ -n "$NPM" ] || exit 0
CURL="/usr/bin/curl"
SSH="/usr/bin/ssh"
RECIPIENT="jnuyens"
MAIL_HOST="m1.linuxbe.com"
```

**Network pre-check + authoritative npm probe** (lines 30-42) -- copy; swap the package to `skills-ref` (D-06, authoritative). `|| exit 0` wedge-guard throughout:
```bash
$CURL -sf --max-time 5 https://api.github.com/zen >/dev/null 2>&1 || exit 0
LATEST=$($NPM view skills-ref version 2>/dev/null) || exit 0
if [ -z "$LATEST" ]; then exit 0; fi
```

**First-run seed + compare** (lines 44-56) -- copy verbatim (seeds file silently on first run, exits when unchanged).

**GitHub best-effort side (CHANGE from the analog, Pitfall 4):** the analog's `gh api repos/.../releases/tags/vX` (lines 66-69) always 404s for `agentskills/agentskills` (0 releases, 0 tags). Replace with a commit-sha probe, still `|| exit 0`:
```bash
GH="/opt/homebrew/bin/gh"
SHA=""
if [ -x "$GH" ]; then
  SHA=$($GH api repos/agentskills/agentskills/commits/main --jq .sha 2>/dev/null || true)
fi
```
Optionally add a second `npm view skills version` line for the skills.sh consumption path (Open Question 2; Discretion).

**Mail body + send + state-update-after-send** (lines 83-107) -- copy the shape (ssh to `$MAIL_HOST`, `mail -s`, update `$VERSION_FILE` ONLY after a successful send). Rewrite the body text to reference the Agent Skills spec, no dashes, and note "watch, do not vendor, never invoke at runtime" (D-06).

---

### `tests/skill-conformance.test.cjs` (test, sandbox spawn)

**Analog:** `tests/user-docs-jargon.test.cjs` (147 lines, read in full). Clone the sandbox harness exactly.

**Sandbox + runner + micro-assert harness** (lines 13-47) -- copy verbatim, point `DETECTOR` at the new gate. The sandbox creates `.git/`, `skills/`, `tests/` markers (the gate's repo-root guard needs `.git/` and `skills/`):
```js
const DETECTOR = path.resolve(__dirname, '..', 'bin', 'maintenance', 'check-skill-conformance.cjs');
function withSandbox(setup, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-skillconf-test-'));
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  setup(dir);
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function runDetector(cwd, flags) {
  return spawnSync('node', [DETECTOR, ...(flags || [])], { cwd, encoding: 'utf-8', timeout: 5000 });
}
```

**Case shape** (lines 52-70 clean/pass; 72-98 inject-regression/fail; 123-140 sibling-preserve) -- each case writes fixture `skills/<name>/SKILL.md` files + a `drift-baseline.json` with a `skill_conformance` section, runs, asserts on `r.status` and `r.stdout`. Cases to cover (RESEARCH Test Map, Wave 0): count <= ceiling passes; count > 90 exit 1; warn band exits 0; description grows past baseline exit 1; `--write-baseline` preserves sibling sections (clone lines 123-140 verbatim, assert `file_layout` untouched + `skill_conformance` added); missing/empty name|desc exit 1; all three allowed-tools shapes pass + unparseable fails; license/compat/metadata never hard-fail; wrong cwd exit 2.

**Footer tally + exit** (lines 142-146) -- copy verbatim.

---

### `tests/drift-baseline.json` (config, file-I/O)

**Analog:** the existing sections in the same file (read in full, 16 lines). Add one top-level sibling key, do NOT touch `file_layout` or `user_docs_prose`. Current shape (each section = counts + `generated_at` + `note`):
```json
{
  "file_layout": { "total_dangling": 136, "has_plugin_counterpart": 136, "genuinely_missing": 0, "generated_at": "2026-07-23", "note": "..." },
  "user_docs_prose": { "em_en_dash": 155, "marketing_words": 4, "cliche_openers": 0, "generated_at": "2026-09-15", "note": "..." }
}
```
New section to add (write via `node bin/maintenance/check-skill-conformance.cjs --write-baseline`, never by hand):
```json
  "skill_conformance": {
    "skill_count": 86,
    "max_description_length": 380,
    "ceiling": 90,
    "warn_at": 88,
    "generated_at": "2026-10-11",
    "note": "..."
  }
```
Note: `user_docs_jargon` is referenced by its gate but is NOT a committed section (that gate no-ops with "No baseline found"). Do not rely on it as a shape reference; use `user_docs_prose`.

---

### `.github/workflows/check-drift.yml` (config, CI job)

**Analog:** the `user-docs-prose` job (lines 177-188, read directly). Each job is independent: `checkout@v4` + `setup-node@v4` (node 22) + two `node` run-steps (gate then test). Add a sibling job:
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

---

### `bin/maintenance/pre-commit-drift-baseline.sh` (config, git hook)

**Analog:** the prose no-auto-regen block (lines 116-143, read directly). Add a new block AFTER the prose block and BEFORE the final `exit 0` (line 145). Clone the prose block exactly: run the gate, on non-zero print the error + `--write-baseline` accept hint + `exit 1`. NO auto-regen (unlike the file-layout branch at lines 76-85). Model:
```bash
SKILL_CONF_SCRIPT="bin/maintenance/check-skill-conformance.cjs"
if [ -f "$SKILL_CONF_SCRIPT" ] && command -v node >/dev/null 2>&1; then
  if ! node "$SKILL_CONF_SCRIPT" >/dev/null 2>&1; then
    echo "" >&2
    echo "ERROR: SKILL.md conformance ratchet regressed." >&2
    echo "" >&2
    node "$SKILL_CONF_SCRIPT" >&2 || true
    echo "" >&2
    echo "If the growth is intentional (e.g., a new skill within the ceiling):" >&2
    echo "  node bin/maintenance/check-skill-conformance.cjs --write-baseline" >&2
    echo "  git add tests/drift-baseline.json" >&2
    echo "  # then re-run the commit" >&2
    echo "" >&2
    echo "Override entirely: git commit --no-verify" >&2
    exit 1
  fi
fi
```
`install-git-hooks.sh` needs NO change (it symlinks this script; the new block is picked up automatically).

---

### `bin/maintenance/check-drift.cjs` (utility, orchestrator) — OPTIONAL

**Analog:** the `detectors[]` registry (lines 42-75, read directly). To register the gate, push one more object. Note the jargon/prose gates are NOT in this umbrella either, so leaving it out matches current practice (Discretion; CI + pre-commit are the required wirings). If registered:
```js
{
  name: 'SKILL.md conformance ratchet',
  cmd: 'node',
  args: ['bin/maintenance/check-skill-conformance.cjs'],
  parser: null,  // exit code is the whole story (0 pass / 1 regression)
},
```
The repo-root guard here checks `.git/` + `bin/maintenance/` (line 37), different from the gate's `.git/` + `skills/` guard; leave it as-is.

---

### `bin/lib/skill-trust-gate.cjs` + `sdk/src/skill-trust-gate.ts` (service, twinned) — D-08 external-candidate path

**Analogs:** `assessEntry` (CJS lines 210-278, SDK lines 281-340) and `checkSafety` (CJS lines 140-196, SDK line 210+), read directly. Both twins are structurally identical. The two-axis assessment combines `checkSafety` (returns `{ safe, findings, scripts_banned }`) and `classifyLicense`, producing `verdict = block|flag|allow`.

**Current safety finding mechanism to mirror** (CJS lines 145-158): findings are pushed to an array; a non-empty `findings` makes `safe === false`, which forces `verdict = 'block'` in `assessEntry` (CJS lines 226-233 / SDK 297-304):
```js
const findings = [];
if (!Object.prototype.hasOwnProperty.call(cat.publishers, entry.publisher)) {
  findings.push(finding('publisher-not-allowlisted'));
}
// ...
return { safe: findings.length === 0, findings, scripts_banned };
```

**Where the npx shell-out lands (D-08, external candidates only):** add an OPTIONAL structural check inside the safety path that runs `npx --yes skills-ref@0.1.5 validate <dir>` ONLY for not-yet-trusted external entries and ONLY when network/opt-in is enabled. A non-empty linter error list pushes a safety finding (downgrades the verdict), never silently passes. Gate first use behind `checkpoint:human-verify` (Pitfall 5: `skills-ref` provenance is [SUS]).

**Parity constraint:** this is the ONE change that must land in BOTH twins to keep `tests/craft-skill-sdk-parity.test.cjs` green (confirmed present). The ratchet gate itself stays CJS-only (it is a `bin/maintenance` tool, not twinned); mind parity ONLY when touching shared `assessEntry` / `checkSafety`. The own-skill native validator does NOT touch `assessEntry` -- for the 86 skills the gate runs in pre-commit/CI, not through the trust gate.

---

### `.planning/PROJECT.md` (doc, upstream register) — D-07

**Analog:** the VibeDrift "second upstream" entries (read directly). Record the Agent Skills spec as the 5th idea-only upstream following this wording, in BOTH places:
- Validated-features list, line 48: `- ✓ VibeDrift adopted as a second upstream: heuristics ported natively (pinned v0.14.0 baseline), repo watched, never invoked at runtime (DRIFT-01) — v4.0.0 (Phase 11)` (note: this existing line uses an em dash; the NEW line must not).
- Decisions table, line 128: `| VibeDrift as a second upstream (native port, never run) | ... | ✓ Good — ... |`.

There is NO `upstream-deferred.md` in the repo (the folded todo's assumption is stale); the live register is PROJECT.md + the `bin/check-*.sh` cron scripts. Add `bin/check-agentskills-release.sh` as the watch script and reference `skills-ref` (npm, authoritative) + `agentskills/agentskills` (best-effort commit-sha).

---

## Shared Patterns

### Loud-fail ratchet with committed baseline, NO auto-regen in CI
**Source:** `bin/maintenance/check-user-docs-jargon.cjs` (lines 104-201) + prose block in `bin/maintenance/pre-commit-drift-baseline.sh` (lines 116-143)
**Apply to:** the new gate, its test, the pre-commit block, the CI job.
`--write-baseline` is manual only. The author pause is the whole point (`feedback_jargon_detector_no_auto_regen`). Exit codes are uniform: 0 pass / 1 regression / 2 usage (wrong cwd).

### Sibling-preserving baseline write
**Source:** `writeBaseline()` in `check-user-docs-jargon.cjs` (lines 104-123); regression-asserted by `tests/user-docs-jargon.test.cjs` (lines 123-140)
**Apply to:** the gate's `writeBaseline()` and the test's `--write-baseline` case.
Read existing object, set ONLY your own top-level key, `JSON.stringify(existing, null, 2) + '\n'`, `fs.mkdirSync('tests', {recursive:true})` first.

### Cron wedge-guard discipline
**Source:** `bin/check-vibedrift-release.sh` (lines 18-24 npm probe, 32 network pre-check, every `|| exit 0`)
**Apply to:** the new watch script.
Probe `command -v npm` before fallback paths; never hardcode `/usr/bin/npm`; `|| exit 0` on every network/tool call so cron never wedges; update the state file only after a successful mail send.

### Watch-don't-vendor, never-on-runtime-path
**Source:** VibeDrift D-01 posture, recorded in `.planning/PROJECT.md` (lines 48, 128)
**Apply to:** the watch script, the PROJECT.md register, and the trust-gate npx shell-out (opt-in, off runtime path).

### Twin parity
**Source:** `bin/lib/skill-trust-gate.cjs` <-> `sdk/src/skill-trust-gate.ts`, enforced by `tests/craft-skill-sdk-parity.test.cjs`
**Apply to:** ONLY the external-candidate `npx` change inside `assessEntry`/`checkSafety`. Everything else this phase ships is CJS-only.

---

## No Analog Found

None. Every new/modified file has a direct in-repo analog (the ratchet gate, the cron watch, the sandbox test, the baseline file, the CI job, the hook block, the orchestrator registry, the trust-gate twins, and the PROJECT.md register are all present and were read this session).

---

## Conventions

Derived via `gsd-tools.cjs verify conventions --derive --scope bin/maintenance` (the new gate's home directory).

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| file-name casing | kebab (`check-skill-conformance.cjs`) | 100% (8/8) | 0 | named contract |
| identifier casing | camelCase (`writeBaseline`, `scanAll`) | 100% (38/38) | 0 | named contract |
| export style | CJS `module.exports` | n/a (1 sample, insufficient-data) | n/a | follow CJS |
| import style | CJS `require()` | 100% (8/8) | 0 | named contract |

All four axes are uncontested named contracts in `bin/maintenance`: kebab-case file names, camelCase identifiers, `require()` imports. The new `.cjs` gate must match. The `.sh` watch script lives in `bin/` (sibling of `check-vibedrift-release.sh`): match that sibling's `kebab-case.sh` naming and bash style.

### Contested hotspots (author's choice)

The repo-wide **CJS <-> SDK dual resolver** is the prototype intentional-contested split: `bin/lib/**` and `bin/maintenance/**` are CJS (`module.exports` / `require`), while `sdk/src/**` is ESM (`export` / `import`). Each half is internally consistent per-directory and contested only when measured repo-wide. For this phase: the ratchet gate, watch, and test are CJS (match `bin/` local style); the one trust-gate edit must be mirrored in BOTH the CJS twin (`bin/lib/skill-trust-gate.cjs`, `require`/`module.exports`) and the ESM twin (`sdk/src/skill-trust-gate.ts`, `import`/`export`) to keep the parity test green. Match the directory's local style, not a single repo-wide rule.

---

## Metadata

**Analog search scope:** `bin/maintenance/`, `bin/`, `tests/`, `.github/workflows/`, `bin/lib/`, `sdk/src/`, `.planning/`
**Files scanned (read this session):** `check-user-docs-jargon.cjs`, `check-vibedrift-release.sh`, `user-docs-jargon.test.cjs`, `pre-commit-drift-baseline.sh`, `drift-baseline.json`, `check-drift.yml` (jargon/prose jobs), `check-drift.cjs`, `skill-trust-gate.cjs`, `skill-trust-gate.ts`, `PROJECT.md` (upstream rows), plus live greps of the three `allowed-tools` shapes.
**Pattern extraction date:** 2026-10-11
