#!/usr/bin/env node
'use strict';

// Regression test for the /bm:version command.
//
// /bm:version is a read-only command that prints the installed plugin version
// and checks GitHub (git tags) for the latest, then shows update guidance only
// when behind. The logic is INLINED in skills/version/SKILL.md (no separate
// workflow.md @-include) to keep the per-invocation token cost minimal.

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

const SKILL = read('skills/version/SKILL.md');

check('SKILL.md: gsd:version, Bash tool, effort: low', () => {
  assert.ok(/^name:\s*gsd:version\s*$/m.test(SKILL), 'frontmatter name is not gsd:version');
  assert.ok(/allowed-tools:/.test(SKILL) && /\bBash\b/.test(SKILL), 'Bash not in allowed-tools');
  assert.ok(/^effort:\s*low\s*$/m.test(SKILL), 'effort: low missing (cheap read-only report)');
});

check('SKILL.md is self-contained (inline bash, no workflow @-include)', () => {
  assert.ok(/```bash/.test(SKILL), 'no inline bash block');
  assert.ok(!SKILL.includes('workflows/version.md'), 'still delegates to a separate workflow (token cost)');
});

check('SKILL.md resolves the installed version from plugin.json (CLAUDE_PLUGIN_ROOT, no node)', () => {
  assert.ok(SKILL.includes('.claude-plugin/plugin.json'), 'does not read plugin.json version');
  assert.ok(SKILL.includes('CLAUDE_PLUGIN_ROOT'), 'does not prefer CLAUDE_PLUGIN_ROOT');
  assert.ok(SKILL.includes('cache/gsd-plugin/gsd/') && SKILL.includes('sort -V'),
    'does not fall back to the newest versioned cache dir');
  assert.ok(!/node\s+-e|require\(/.test(SKILL), 'parses with node (should be grep/sed so it works when node is broken)');
});

check('SKILL.md checks GitHub by tags (not Releases) and is best-effort', () => {
  assert.ok(SKILL.includes('git ls-remote --tags'), 'does not check tags via git ls-remote');
  assert.ok(/jnuyens\/gsd-plugin/.test(SKILL), 'does not target the plugin repo');
  assert.ok(!/gh release view/.test(SKILL), 'still uses gh release view (lags behind tags)');
});

check('SKILL.md update guidance: gated, /plugins flow + /reload-plugins (not /plugin install)', () => {
  assert.ok(/Update available/.test(SKILL), 'guidance not gated on update-available');
  assert.ok(SKILL.includes('/plugins') && /Marketplace/i.test(SKILL), 'does not use the /plugins Marketplace flow');
  assert.ok(SKILL.includes('/reload-plugins'), 'missing reload step');
  assert.ok(!SKILL.includes('/plugin install gsd@gsd-plugin'), 'still shows the deprecated /plugin install step');
});

check('help.md lists /bm:version', () => {
  assert.ok(read('workflows/help.md').includes('/bm:version'), 'help.md does not list the command');
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
