'use strict';

// Unit spec for bin/lib/bm-autoenable.cjs, the one-time bm auto-enable helper.
//
// The marker means "gsd has observed bm enabled at least once and will never
// auto-manage enabledPlugins again". It is written on BOTH the enable path and
// the already-enabled path, but NOT on the not-cached path. That is what makes a
// later deliberate disable stand.
//
// Every case builds a fresh temp dir for cacheRoot / settingsPath / markerPath
// and cleans up in a finally, so the real ~/.claude is never touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert');

const { autoEnableBm } = require(path.join(__dirname, '..', 'bin', 'lib', 'bm-autoenable.cjs'));

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}

function freshEnv() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-autoenable-'));
  const cacheRoot = path.join(base, 'cache');
  fs.mkdirSync(cacheRoot, { recursive: true });
  return {
    base,
    cacheRoot,
    settingsPath: path.join(base, 'settings.json'),
    markerPath: path.join(base, '.gsd-bm-auto-enabled'),
  };
}

function cacheBm(cacheRoot, marketplace, version) {
  fs.mkdirSync(path.join(cacheRoot, marketplace, 'bm', version || '1.0.0'), { recursive: true });
}

function writeSettings(settingsPath, obj) {
  fs.writeFileSync(settingsPath, JSON.stringify(obj, null, 2));
}

function readSettings(settingsPath) {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

function cleanup(env) {
  try { fs.rmSync(env.base, { recursive: true, force: true }); } catch { /* already gone */ }
}

// Test 1: enable once.
check('Test 1: cached + not enabled + no marker enables bm and writes the marker', () => {
  const env = freshEnv();
  try {
    cacheBm(env.cacheRoot, 'gsd-plugin');
    writeSettings(env.settingsPath, { enabledPlugins: { 'gsd@gsd-plugin': true } });

    const result = autoEnableBm(env);

    assert.strictEqual(result.acted, true, 'must act on a cached, not-enabled bm');
    assert.strictEqual(result.marketplace, 'gsd-plugin', 'marketplace must be gsd-plugin');
    const settings = readSettings(env.settingsPath);
    assert.strictEqual(settings.enabledPlugins['bm@gsd-plugin'], true, 'bm must be enabled in settings');
    assert.strictEqual(settings.enabledPlugins['gsd@gsd-plugin'], true, 'existing keys preserved');
    assert.ok(fs.existsSync(env.markerPath), 'marker must be written on the enable path');
  } finally {
    cleanup(env);
  }
});

// Test 2: marker respected.
check('Test 2: marker present is a no-op even when bm is cached but disabled', () => {
  const env = freshEnv();
  try {
    cacheBm(env.cacheRoot, 'gsd-plugin');
    writeSettings(env.settingsPath, { enabledPlugins: { 'bm@gsd-plugin': false } });
    fs.writeFileSync(env.markerPath, new Date().toISOString());
    const before = fs.readFileSync(env.settingsPath);

    const result = autoEnableBm(env);

    assert.strictEqual(result.acted, false, 'must not act when the marker exists');
    assert.strictEqual(result.reason, 'marker-exists', 'reason must be marker-exists');
    const after = fs.readFileSync(env.settingsPath);
    assert.ok(before.equals(after), 'settings.json must be byte-unchanged');
  } finally {
    cleanup(env);
  }
});

// Test 3: not cached.
check('Test 3: bm not cached is a no-op and writes NO marker', () => {
  const env = freshEnv();
  try {
    writeSettings(env.settingsPath, { enabledPlugins: { 'gsd@gsd-plugin': true } });
    const before = fs.readFileSync(env.settingsPath);

    const result = autoEnableBm(env);

    assert.strictEqual(result.acted, false, 'must not act when bm is not cached');
    assert.strictEqual(result.reason, 'not-cached', 'reason must be not-cached');
    assert.ok(!fs.existsSync(env.markerPath), 'no marker when there is nothing to enable yet');
    const after = fs.readFileSync(env.settingsPath);
    assert.ok(before.equals(after), 'settings unchanged');
  } finally {
    cleanup(env);
  }
});

// Test 4: fail-soft on missing / malformed settings.
check('Test 4: missing or malformed settings never throws and writes no marker', () => {
  // Missing settings file.
  const env1 = freshEnv();
  try {
    cacheBm(env1.cacheRoot, 'gsd-plugin');
    let r1;
    assert.doesNotThrow(() => { r1 = autoEnableBm(env1); }, 'missing settings must not throw');
    assert.strictEqual(r1.acted, false, 'missing settings must not act');
    assert.ok(!fs.existsSync(env1.markerPath), 'no marker on a read error');
  } finally {
    cleanup(env1);
  }

  // Malformed JSON.
  const env2 = freshEnv();
  try {
    cacheBm(env2.cacheRoot, 'gsd-plugin');
    fs.writeFileSync(env2.settingsPath, '{ this is not valid json ');
    let r2;
    assert.doesNotThrow(() => { r2 = autoEnableBm(env2); }, 'malformed settings must not throw');
    assert.strictEqual(r2.acted, false, 'malformed settings must not act');
    assert.ok(!fs.existsSync(env2.markerPath), 'no marker on a parse error');
  } finally {
    cleanup(env2);
  }
});

// Test 5: already enabled writes the marker.
check('Test 5: bm already enabled writes the marker without changing settings', () => {
  const env = freshEnv();
  try {
    cacheBm(env.cacheRoot, 'gsd-plugin');
    writeSettings(env.settingsPath, { enabledPlugins: { 'bm@gsd-plugin': true } });
    const before = fs.readFileSync(env.settingsPath);

    const result = autoEnableBm(env);

    assert.strictEqual(result.acted, false, 'must not act when bm is already enabled');
    assert.strictEqual(result.reason, 'already-enabled', 'reason must be already-enabled');
    const after = fs.readFileSync(env.settingsPath);
    assert.ok(before.equals(after), 'settings must not change on the already-enabled branch');
    assert.ok(fs.existsSync(env.markerPath), 'the marker MUST be written on the already-enabled branch');
  } finally {
    cleanup(env);
  }
});

// Test 6: marketplace preference.
check('Test 6: bm under both marketplaces resolves to bm@buildomator', () => {
  const env = freshEnv();
  try {
    cacheBm(env.cacheRoot, 'gsd-plugin');
    cacheBm(env.cacheRoot, 'buildomator');
    writeSettings(env.settingsPath, { enabledPlugins: {} });

    const result = autoEnableBm(env);

    assert.strictEqual(result.acted, true, 'must act');
    assert.strictEqual(result.marketplace, 'buildomator', 'buildomator must be preferred');
    const settings = readSettings(env.settingsPath);
    assert.strictEqual(settings.enabledPlugins['bm@buildomator'], true, 'bm@buildomator must be enabled');
    assert.ok(!('bm@gsd-plugin' in settings.enabledPlugins), 'only the preferred marketplace key is written');
  } finally {
    cleanup(env);
  }
});

// Test 7: deliberate disable after a manual enable is respected.
check('Test 7: a manual enable then disable is NOT re-enabled on the next run', () => {
  const env = freshEnv();
  try {
    cacheBm(env.cacheRoot, 'gsd-plugin');
    // The user manually enabled bm; no marker yet.
    writeSettings(env.settingsPath, { enabledPlugins: { 'bm@gsd-plugin': true } });

    // First run records that gsd observed bm enabled (writes the marker).
    const first = autoEnableBm(env);
    assert.strictEqual(first.acted, false, 'first run must not act (already enabled)');
    assert.strictEqual(first.reason, 'already-enabled', 'first run reason is already-enabled');
    assert.ok(fs.existsSync(env.markerPath), 'first run writes the marker');

    // The user now deliberately disables bm.
    writeSettings(env.settingsPath, { enabledPlugins: { 'bm@gsd-plugin': false } });

    // Second run must respect the disable via the marker gate.
    const second = autoEnableBm(env);
    assert.strictEqual(second.acted, false, 'second run must not re-enable bm');
    assert.strictEqual(second.reason, 'marker-exists', 'second run is gated by the marker');
    const settings = readSettings(env.settingsPath);
    assert.strictEqual(settings.enabledPlugins['bm@gsd-plugin'], false, 'a deliberate disable must stand');
  } finally {
    cleanup(env);
  }
});

// ── summary (fail-loud) ──────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`bm auto-enable: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
