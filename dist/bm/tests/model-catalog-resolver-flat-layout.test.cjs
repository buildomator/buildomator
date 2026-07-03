'use strict';

// Regression test for #PLUGIN-MODEL-CATALOG-PATH (bin/lib/model-catalog.cjs).
// The patch prepends a flat-layout candidate to the resolver's candidate list
// so that the module resolves the plugin's `sdk/shared/model-catalog.json`
// from `bin/lib/__dirname`. Without it, the resolver falls back to upstream's
// source-repo dev path which is one ".." too high in the plugin's flat
// layout. Symptom of regression: agents silently fall back to a default
// model because the module load fails. Hard to detect in production.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MODEL_CATALOG_CJS = path.resolve(__dirname, '..', 'bin', 'lib', 'model-catalog.cjs');
const SDK_CATALOG_JSON = path.resolve(__dirname, '..', 'sdk', 'shared', 'model-catalog.json');

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

check('module loads and exposes a non-null catalog object', () => {
  delete require.cache[MODEL_CATALOG_CJS];
  const mod = require(MODEL_CATALOG_CJS);
  assert(mod, 'require() returned falsy');
  assert(mod.catalog && typeof mod.catalog === 'object',
    `expected catalog to be an object, got ${typeof mod.catalog}`);
  assert(mod.catalog.runtimeTierDefaults && typeof mod.catalog.runtimeTierDefaults === 'object',
    'expected catalog.runtimeTierDefaults to be an object');
});

check('catalog has plugin-canonical runtime tier defaults for Anthropic-compatible runtimes', () => {
  delete require.cache[MODEL_CATALOG_CJS];
  const { catalog } = require(MODEL_CATALOG_CJS);
  for (const runtime of ['claude', 'opencode', 'copilot', 'hermes']) {
    const tier = catalog.runtimeTierDefaults[runtime];
    assert(tier, `expected runtime ${runtime} to be defined in runtimeTierDefaults`);
    assert(
      tier.opus && typeof tier.opus.model === 'string' && tier.opus.model.length > 0,
      `expected ${runtime}.opus.model to be a non-empty string, got ${JSON.stringify(tier.opus)}`
    );
  }
});

check('structural invariant: candidate #0 (plugin-flat prepend) resolves to the on-disk SDK catalog', () => {
  // The patch prepends:
  //   path.resolve(__dirname, '..', '..', 'sdk', 'shared', 'model-catalog.json')
  // where __dirname is <plugin-root>/bin/lib/. The patched candidate must
  // therefore resolve to <plugin-root>/sdk/shared/model-catalog.json. If a
  // future sync wipes the prepend, this file system invariant still holds
  // but the test below (env-override smoke) catches the regression by
  // forcing a controlled module-reload path.
  assert(
    fs.existsSync(SDK_CATALOG_JSON),
    `precondition: expected ${SDK_CATALOG_JSON} to exist on disk`
  );

  // Spawn a fresh node to require the module with GSD_MODEL_CATALOG pointed
  // at a known custom path. The patched resolver tries candidate #0 first;
  // if it succeeds (it should, plugin layout), env override is irrelevant.
  // We verify the module loads cleanly under this env, which means the
  // resolver's candidate cascade is intact. If the patched candidate were
  // stripped AND the env path were also bogus, the module would throw at
  // load time.
  const spawnCheck = spawnSync(
    'node',
    ['-e', `const m = require(${JSON.stringify(MODEL_CATALOG_CJS)}); if (!m.catalog) process.exit(2); console.log('ok');`],
    { encoding: 'utf-8', timeout: 5000, env: Object.assign({}, process.env, { GSD_MODEL_CATALOG: '/nonexistent/bogus/path.json' }) }
  );
  assert(
    spawnCheck.status === 0,
    `module require failed under bogus GSD_MODEL_CATALOG (means flat-layout candidate was not reachable). stderr:\n${spawnCheck.stderr}`
  );
  assert(
    spawnCheck.stdout.includes('ok'),
    `expected "ok" on stdout, got "${spawnCheck.stdout}"`
  );
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`#PLUGIN-MODEL-CATALOG-PATH regression: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
