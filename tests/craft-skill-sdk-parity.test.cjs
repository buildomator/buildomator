#!/usr/bin/env node
'use strict';

// Parity guard: the CJS craft-skill twin (bin/lib/craft-skill-insert.cjs,
// driven through bin/gsd-tools.cjs) and the SDK twin (sdk/src/query/craft-skill.ts,
// built into sdk/dist/cli.js) are two independent implementations of the same
// scoped-insertion surface. They MUST behave identically for list, assess and
// release. When they drift, one twin does something the other does not and the
// behavior silently depends on which entry point a workflow happens to call.
//
// This test spawns BOTH real entry points and compares their observable output
// and on-disk effect for list, assess, match and release. The release case
// (release of two ephemeral skills for one agent) is the exact divergence that
// was fixed: a stale config snapshot in the release loop re-added a
// just-released skill, so this case fails against the pre-fix CJS code.
//
// Requires a built SDK at sdk/dist/cli.js (npm --prefix sdk run build).
//
// Zero-dep harness: node:assert + a check() runner + a process.exit(1) footer.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GSD_TOOLS = path.join(REPO_ROOT, 'bin', 'gsd-tools.cjs');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');
const COMMITTED_CATALOG = path.join(REPO_ROOT, 'sdk', 'shared', 'craft-skill-catalog.json');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Drive either twin with the same craft-skill args. The CJS entry takes the
// args verbatim; the SDK entry takes them under its `query` dispatcher. Both
// run in the given project dir with an isolated config home.
function runTwin(twin, root, args) {
  const argv = twin === 'sdk' ? [SDK_CLI, 'query', ...args] : [GSD_TOOLS, ...args];
  const res = spawnSync(process.execPath, argv, {
    cwd: root,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'cfg') },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Drive either twin with an extra directory prepended to PATH, so a shim binary
// (an `npx` stand-in) resolves ahead of the real one. Everything else matches
// runTwin.
function runTwinWithPath(twin, root, args, pathPrefix) {
  const argv = twin === 'sdk' ? [SDK_CLI, 'query', ...args] : [GSD_TOOLS, ...args];
  const res = spawnSync(process.execPath, argv, {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: path.join(root, 'cfg'),
      PATH: pathPrefix + path.delimiter + process.env.PATH,
    },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Create a tmp dir holding an executable `npx` script that records the argv it
// was called with (space-joined, one line per call) to argv.log, optionally
// prints to stderr, and exits with behavior.status. The dir and log path are
// handed to fn; the dir is removed afterward. argv.log is only created when the
// shim actually runs, so its absence proves no spawn happened.
function withNpxShim(behavior, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-npx-shim-'));
  const logPath = path.join(dir, 'argv.log');
  const lines = [
    '#!/usr/bin/env bash',
    `printf '%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
  ];
  if (behavior.stderr) {
    lines.push(`printf '%s\\n' ${JSON.stringify(behavior.stderr)} >&2`);
  }
  lines.push(`exit ${behavior.status}`, '');
  fs.writeFileSync(path.join(dir, 'npx'), lines.join('\n'), { mode: 0o755 });
  try { return fn(dir, logPath); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function firstCatalogId(root) {
  const list = parseJson(runTwin('cjs', root, ['craft-skill', 'list', '--catalog', COMMITTED_CATALOG]));
  return list[0].id;
}

function parseJson(res) {
  try {
    return JSON.parse(res.stdout);
  } catch (err) {
    throw new Error(`stdout is not JSON (${err.message})\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  }
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-craft-parity-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function writeSkill(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n# ${name}\n`);
}

function readConfig(root) {
  const p = path.join(root, '.planning', 'config.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readPins(root) {
  const p = path.join(root, '.planning', 'craft-skills', 'pins.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Guard: the SDK must be built, else the comparison is meaningless.
check('the built SDK CLI is present', () => {
  assert.ok(fs.existsSync(SDK_CLI), `sdk/dist/cli.js missing; run: npm --prefix sdk run build`);
});

// --- 1. list: identical ordered ids ---

check('craft-skill list returns identical ordered ids across twins', () => {
  withProject((root) => {
    const cjs = parseJson(runTwin('cjs', root, ['craft-skill', 'list', '--catalog', COMMITTED_CATALOG]));
    const sdk = parseJson(runTwin('sdk', root, ['craft-skill', 'list', '--catalog', COMMITTED_CATALOG]));
    const cjsIds = cjs.map((e) => e.id);
    const sdkIds = sdk.map((e) => e.id);
    assert.ok(cjsIds.length >= 2, `expected the seed entries: ${JSON.stringify(cjsIds)}`);
    assert.deepStrictEqual(cjsIds, sdkIds, 'list ids diverge between CJS and SDK');
    // The full records must match too, not just the ids.
    assert.deepStrictEqual(cjs, sdk, 'list records diverge between CJS and SDK');
  });
});

// --- 2. assess: identical verdict and prompt/assessment lines ---

for (const id of ['seo-audit', 'duckdb-query']) {
  check(`craft-skill assess ${id} is identical across twins`, () => {
    withProject((root) => {
      const cjs = parseJson(runTwin('cjs', root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG]));
      const sdk = parseJson(runTwin('sdk', root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG]));
      assert.strictEqual(cjs.verdict, sdk.verdict, `verdict diverges for ${id}`);
      assert.deepStrictEqual(cjs.prompt, sdk.prompt, `prompt lines diverge for ${id}`);
      assert.deepStrictEqual(cjs, sdk, `assessment diverges for ${id}`);
    });
  });
}

// --- 2b. match: identical candidates across twins ---

const MATCH_CASES = [
  { scope: 'Audit my site SEO and fix the sitemap', ids: ['seo-audit'], triggers: { 'seo-audit': ['seo', 'sitemap'] } },
  { scope: 'ad-hoc SQL over Parquet files with DuckDB', ids: ['duckdb-query'], triggers: { 'duckdb-query': ['ad-hoc sql', 'duckdb', 'parquet'] } },
  { scope: 'schedule the quarterly team offsite', ids: [], triggers: {} },
];

for (const tc of MATCH_CASES) {
  check(`craft-skill match "${tc.scope}" is identical across twins`, () => {
    withProject((root) => {
      const cjs = parseJson(runTwin('cjs', root, ['craft-skill', 'match', tc.scope, '--catalog', COMMITTED_CATALOG]));
      const sdk = parseJson(runTwin('sdk', root, ['craft-skill', 'match', tc.scope, '--catalog', COMMITTED_CATALOG]));
      assert.strictEqual(cjs.scope, tc.scope, 'CJS echoes the scope verbatim');
      assert.strictEqual(sdk.scope, tc.scope, 'SDK echoes the scope verbatim');
      assert.deepStrictEqual(cjs.candidates.map((c) => c.id), tc.ids, `CJS candidate ids for "${tc.scope}"`);
      assert.deepStrictEqual(sdk.candidates.map((c) => c.id), tc.ids, `SDK candidate ids for "${tc.scope}"`);
      for (const c of cjs.candidates) {
        assert.deepStrictEqual(c.matched_triggers, tc.triggers[c.id], `CJS matched_triggers for ${c.id}`);
        assert.strictEqual(c.verdict, 'allow', `CJS verdict for ${c.id}`);
      }
      assert.deepStrictEqual(cjs, sdk, `match payload diverges for "${tc.scope}"`);
    });
  });
}

check('craft-skill match treats a shell-metachar scope as data in both twins', () => {
  withProject((root) => {
    const scope = '$(echo pwned); seo';
    const cjs = parseJson(runTwin('cjs', root, ['craft-skill', 'match', scope, '--catalog', COMMITTED_CATALOG]));
    const sdk = parseJson(runTwin('sdk', root, ['craft-skill', 'match', scope, '--catalog', COMMITTED_CATALOG]));
    assert.strictEqual(cjs.scope, scope, 'CJS echoes the metachar scope verbatim');
    assert.strictEqual(sdk.scope, scope, 'SDK echoes the metachar scope verbatim');
    assert.deepStrictEqual(cjs.candidates.map((c) => c.id), ['seo-audit'], 'CJS still matches seo-audit');
    assert.deepStrictEqual(sdk.candidates.map((c) => c.id), ['seo-audit'], 'SDK still matches seo-audit');
    assert.deepStrictEqual(cjs, sdk, 'match payload diverges for the metachar scope');
  });
});

// --- 3. release of two ephemeral skills for one agent (the CR-01 case) ---

// Insert two ephemeral skills for the same agent through one twin, release that
// agent in one call, and return the resulting config entry plus the per-record
// released_at stamps. A non-git skill dir keeps pin_verified false so the
// insert is accepted without a HEAD that matches the catalog pin.
function insertTwoThenRelease(twin, root) {
  writeSkill(path.join(root, 's1'), 'seo-audit');
  writeSkill(path.join(root, 's2'), 'query');
  const ins1 = parseJson(runTwin(twin, root, ['craft-skill', 'insert', 'seo-audit', '--agent', 'bm-executor', '--location', 's1', '--approved', '--catalog', COMMITTED_CATALOG]));
  const ins2 = parseJson(runTwin(twin, root, ['craft-skill', 'insert', 'duckdb-query', '--agent', 'bm-executor', '--location', 's2', '--approved', '--catalog', COMMITTED_CATALOG]));
  assert.ok(ins1.inserted === true && ins2.inserted === true, `both inserts should succeed: ${JSON.stringify([ins1, ins2])}`);
  // Both skills are present before release.
  const before = readConfig(root).agent_skills['bm-executor'];
  assert.deepStrictEqual(before.slice().sort(), ['s1', 's2'], `both entries should be present before release: ${JSON.stringify(before)}`);
  const rel = parseJson(runTwin(twin, root, ['craft-skill', 'release', '--agent', 'bm-executor']));
  const after = readConfig(root).agent_skills['bm-executor'];
  const records = readPins(root).records;
  return { rel, after, records };
}

function assertReleaseClean(twin, result) {
  assert.strictEqual(result.rel.released.length, 2, `${twin}: both records should report released: ${JSON.stringify(result.rel)}`);
  assert.strictEqual(result.rel.remaining, 0, `${twin}: no records should remain: ${JSON.stringify(result.rel)}`);
  // The config entry must be empty: neither skill may survive or be re-added.
  assert.deepStrictEqual(result.after, [], `${twin}: agent_skills entry should be empty after release, got ${JSON.stringify(result.after)}`);
  // Both pin records must be marked released.
  assert.strictEqual(result.records.length, 2, `${twin}: expected two pin records: ${JSON.stringify(result.records)}`);
  for (const rec of result.records) {
    assert.ok(typeof rec.released_at === 'string' && !Number.isNaN(Date.parse(rec.released_at)),
      `${twin}: record ${rec.record_id} should carry an ISO released_at, got ${rec.released_at}`);
  }
}

check('releasing two ephemeral skills for one agent clears both (CJS)', () => {
  withProject((root) => assertReleaseClean('cjs', insertTwoThenRelease('cjs', root)));
});

check('releasing two ephemeral skills for one agent clears both (SDK)', () => {
  withProject((root) => assertReleaseClean('sdk', insertTwoThenRelease('sdk', root)));
});

check('both twins reach the same config and release result for the two-skill case', () => {
  withProject((rootCjs) => {
    withProject((rootSdk) => {
      const cjs = insertTwoThenRelease('cjs', rootCjs);
      const sdk = insertTwoThenRelease('sdk', rootSdk);
      assert.deepStrictEqual(cjs.after, sdk.after, 'post-release config entry diverges between twins');
      assert.strictEqual(cjs.rel.released.length, sdk.rel.released.length, 'released count diverges between twins');
      assert.strictEqual(cjs.rel.remaining, sdk.rel.remaining, 'remaining count diverges between twins');
    });
  });
});

// --- 4. validate-external opt-in shell-out (row 18-trust-gate-shellout) ---

check('craft-skill assess --validate-external: a failing linter blocks in both twins', () => {
  withProject((root) => {
    const id = firstCatalogId(root);
    const skillDir = path.join(root, 'candidate');
    writeSkill(skillDir, 'candidate');
    withNpxShim({ status: 1, stderr: 'Unexpected fields in frontmatter: argument-hint' }, (shimDir, logPath) => {
      for (const twin of ['cjs', 'sdk']) {
        const a = parseJson(runTwinWithPath(twin, root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG, '--validate-external', skillDir], shimDir));
        assert.strictEqual(a.verdict, 'block', `${twin} verdict should be block: ${JSON.stringify(a.verdict)}`);
        assert.ok(a.safety.findings.some((f) => f.code === 'external-validate-failed'), `${twin} should carry external-validate-failed: ${JSON.stringify(a.safety.findings)}`);
      }
      const recorded = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      assert.strictEqual(recorded.length, 2, `expected one argv line per twin: ${JSON.stringify(recorded)}`);
      for (const line of recorded) {
        assert.strictEqual(line, `--yes skills-ref@0.1.5 validate ${skillDir}`, `recorded argv: ${line}`);
      }
    });
  });
});

check('craft-skill assess --validate-external: a clean linter keeps the plain verdict in both twins', () => {
  withProject((root) => {
    const id = firstCatalogId(root);
    const skillDir = path.join(root, 'candidate');
    writeSkill(skillDir, 'candidate');
    const plain = {};
    for (const twin of ['cjs', 'sdk']) {
      plain[twin] = parseJson(runTwin(twin, root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG])).verdict;
    }
    withNpxShim({ status: 0, stderr: '' }, (shimDir) => {
      for (const twin of ['cjs', 'sdk']) {
        const a = parseJson(runTwinWithPath(twin, root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG, '--validate-external', skillDir], shimDir));
        assert.strictEqual(a.verdict, plain[twin], `${twin} verdict should match the plain assess verdict`);
        assert.ok(a.prompt.includes('External validate: skills-ref@0.1.5 clean'), `${twin} prompt should record the clean check: ${JSON.stringify(a.prompt)}`);
      }
    });
  });
});

check('craft-skill assess --validate-external with no directory fails loud (and never spawns npx) in both twins', () => {
  withProject((root) => {
    const id = firstCatalogId(root);
    withNpxShim({ status: 0, stderr: '' }, (shimDir, logPath) => {
      for (const twin of ['cjs', 'sdk']) {
        const res = runTwinWithPath(twin, root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG, '--validate-external'], shimDir);
        assert.notStrictEqual(res.status, 0, `${twin} should exit non-zero on a bare --validate-external: ${JSON.stringify(res)}`);
        assert.ok(
          /--validate-external requires an existing skill directory/.test(res.stdout + res.stderr),
          `${twin} should report the usage error: ${JSON.stringify({ stdout: res.stdout, stderr: res.stderr })}`,
        );
      }
      assert.ok(!fs.existsSync(logPath), `argv.log should be absent: a bare flag must fail before any npx spawn: ${fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''}`);
    });
  });
});

check('craft-skill assess/list/match never spawn npx without --validate-external (both twins)', () => {
  withProject((root) => {
    const id = firstCatalogId(root);
    withNpxShim({ status: 0, stderr: '' }, (shimDir, logPath) => {
      for (const twin of ['cjs', 'sdk']) {
        runTwinWithPath(twin, root, ['craft-skill', 'assess', id, '--catalog', COMMITTED_CATALOG], shimDir);
        runTwinWithPath(twin, root, ['craft-skill', 'list', '--catalog', COMMITTED_CATALOG], shimDir);
        runTwinWithPath(twin, root, ['craft-skill', 'match', 'audit my site seo', '--catalog', COMMITTED_CATALOG], shimDir);
      }
      assert.ok(!fs.existsSync(logPath), `argv.log should be absent when the flag is not passed: ${fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''}`);
    });
  });
});

// footer
if (failures) {
  console.error(`\ncraft-skill-sdk-parity: ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\ncraft-skill-sdk-parity: all checks passed');
}
