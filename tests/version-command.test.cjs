#!/usr/bin/env node
'use strict';

// Regression test for the /gsd:version command (v3.4.9).
//
// /gsd:version is a read-only command that prints the installed plugin version
// and checks GitHub for the latest release, then shows update guidance when
// relevant. Locks: the skill exists with correct frontmatter, the workflow
// carries the version-resolution + tag-based online-check + guidance logic, and
// help.md lists the command.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

check('skills/version/SKILL.md exists with name gsd:version + Bash tool', () => {
  const s = read('skills/version/SKILL.md');
  assert.ok(/^name:\s*gsd:version\s*$/m.test(s), 'frontmatter name is not gsd:version');
  assert.ok(/allowed-tools:/.test(s) && /\bBash\b/.test(s), 'Bash not in allowed-tools');
  assert.ok(
    s.includes('@${CLAUDE_PLUGIN_ROOT}/workflows/version.md'),
    'skill does not delegate to the plugin-local workflow',
  );
});

check('workflows/version.md resolves the installed version from plugin.json', () => {
  const w = read('workflows/version.md');
  assert.ok(w.includes('.claude-plugin/plugin.json'), 'does not read plugin.json version');
  assert.ok(
    w.includes('${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}'),
    'does not use the plugin-root resolver with fallback',
  );
});

check('workflows/version.md checks GitHub by tags (not Releases) and is best-effort', () => {
  const w = read('workflows/version.md');
  assert.ok(w.includes('git ls-remote --tags'), 'does not check tags via git ls-remote');
  assert.ok(/jnuyens\/gsd-plugin/.test(w), 'does not target the plugin repo');
  // must NOT depend on gh release view, which lags when Releases are unpublished
  assert.ok(!/gh release view/.test(w), 'still uses gh release view (lags behind tags)');
});

check('workflows/version.md shows update guidance only when behind/unknown', () => {
  const w = read('workflows/version.md');
  assert.ok(w.includes('/plugin install gsd@gsd-plugin'), 'missing update install step');
  assert.ok(w.includes('/reload-plugins'), 'missing reload step');
  assert.ok(/behind|unknown/.test(w), 'guidance not gated on update-available/unknown status');
});

check('help.md lists /gsd:version', () => {
  assert.ok(read('workflows/help.md').includes('/gsd:version'), 'help.md does not list the command');
});

check('plugin.json and marketplace.json versions agree', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json')).version;
  const market = JSON.parse(read('.claude-plugin/marketplace.json')).plugins[0].version;
  assert.strictEqual(market, plugin, `marketplace.json (${market}) != plugin.json (${plugin})`);
});

if (failures) {
  console.error(`\nversion-command: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nversion-command: all checks passed');
