'use strict';

// Regression test for #PLUGIN-AGENTS-DIR (bin/lib/core.cjs::getAgentsDir).
// The patch makes getAgentsDir() flat-layout-aware: it prefers
// <plugin-root>/agents when that directory exists, before falling back to
// upstream's `__dirname/../../../agents` traversal which is one level too
// high for the plugin's flat layout. Without this patch, every plugin
// install reports `agents_installed: false` and a noisy warning gate fires.
// The patches inventory says this has been wiped or contested across 3 sync
// cycles, so a regression test on master is overdue.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CORE = path.resolve(__dirname, '..', 'bin', 'lib', 'core.cjs');

function freshGetAgentsDir() {
  delete require.cache[CORE];
  return require(CORE).getAgentsDir;
}

function withSavedEnv(keys, fn) {
  const saved = {};
  for (const k of keys) saved[k] = process.env[k];
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

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

check('GSD_AGENTS_DIR env override wins absolutely', () => {
  withSavedEnv(['GSD_AGENTS_DIR', 'CLAUDE_PLUGIN_ROOT'], () => {
    process.env.GSD_AGENTS_DIR = '/explicit/override/path';
    delete process.env.CLAUDE_PLUGIN_ROOT;
    const getAgentsDir = freshGetAgentsDir();
    const got = getAgentsDir();
    assert(
      got === '/explicit/override/path',
      `expected env override to win, got "${got}"`
    );
  });
});

check('plugin-layout detection: returns <plugin-root>/agents when CLAUDE_PLUGIN_ROOT points at a plugin tree', () => {
  withSavedEnv(['GSD_AGENTS_DIR', 'CLAUDE_PLUGIN_ROOT'], () => {
    delete process.env.GSD_AGENTS_DIR;
    const pluginRoot = path.resolve(__dirname, '..');
    process.env.CLAUDE_PLUGIN_ROOT = pluginRoot;
    const expected = path.join(pluginRoot, 'agents');
    // Sanity: the plugin checkout this test runs against does have agents/.
    assert(fs.existsSync(expected), `precondition failed: expected ${expected} to exist`);
    const getAgentsDir = freshGetAgentsDir();
    const got = getAgentsDir();
    assert(
      got === expected,
      `expected "${expected}" (plugin flat layout), got "${got}"`
    );
  });
});

check('upstream-layout fallback: when CLAUDE_PLUGIN_ROOT points at a dir without agents/, falls through to upstream traversal', () => {
  withSavedEnv(['GSD_AGENTS_DIR', 'CLAUDE_PLUGIN_ROOT'], () => {
    delete process.env.GSD_AGENTS_DIR;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-no-plugin-marker-'));
    try {
      // Tempdir deliberately has NO agents/ subdir, so the patch's plugin
      // detection must fall through to upstream's __dirname-based traversal.
      process.env.CLAUDE_PLUGIN_ROOT = tmp;
      const getAgentsDir = freshGetAgentsDir();
      const got = getAgentsDir();
      // Upstream behavior: path.join(__dirname, '..', '..', '..', 'agents')
      // where __dirname is <plugin>/bin/lib/. That resolves to a path one
      // level above the plugin root. The exact path is host-dependent, but
      // it MUST NOT equal <tmp>/agents (that would mean the plugin detection
      // wrongly accepted the empty tempdir).
      assert(
        got !== path.join(tmp, 'agents'),
        `expected fallthrough to upstream traversal, but got tempdir path "${got}"`
      );
      // It must also not be the env override or a falsy.
      assert(got && typeof got === 'string', `expected non-empty string, got ${got}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`#PLUGIN-AGENTS-DIR regression: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
