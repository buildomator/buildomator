#!/usr/bin/env node
'use strict';

// Regression test for #13: skill docs referenced a hardcoded
// `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` path that does not exist
// in the plugin (flat) install layout, so every documented CJS invocation
// in intel/graphify/from-gsd2 was broken on a real plugin install.
//
// The fix repoints them to the plugin-resolver pattern used by resume-work:
//   ${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/bin/gsd-tools.cjs
//
// Guards:
//   1. No skill doc may reference the legacy get-shit-done/bin path.
//   2. Skills that invoke gsd-tools.cjs must use the CLAUDE_PLUGIN_ROOT resolver.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

const LEGACY = 'get-shit-done/bin/gsd-tools.cjs';
// gsd-tools.cjs must be reached through a CLAUDE_PLUGIN_ROOT-rooted path. Two
// accepted fallback forms: the legacy 'current' symlink default, or the
// versioned-dir glob default (v3.4.10, robust when CLAUDE_PLUGIN_ROOT is unset
// and there is no 'current' symlink). Either satisfies #13.
const RESOLVER_RE = /\$\{CLAUDE_PLUGIN_ROOT:-[^}]*\}\/bin\/gsd-tools\.cjs/;

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    console.error(`  FAIL - ${name}`);
    failures++;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const skillDocs = walk(SKILLS_DIR);

// 1. No legacy path anywhere in skill docs.
const offenders = skillDocs.filter((f) => fs.readFileSync(f, 'utf8').includes(LEGACY));
check(
  `no skill doc references legacy ${LEGACY}`,
  offenders.length === 0,
);
if (offenders.length) {
  for (const f of offenders) console.error(`      offender: ${path.relative(ROOT, f)}`);
}

// 2. The three docs fixed by #13 must use the resolver for gsd-tools.cjs.
for (const rel of ['intel/SKILL.md', 'graphify/SKILL.md', 'from-gsd2/SKILL.md']) {
  const full = path.join(SKILLS_DIR, rel);
  const body = fs.readFileSync(full, 'utf8');
  if (!body.includes('gsd-tools.cjs')) continue; // nothing to assert
  check(`${rel} uses CLAUDE_PLUGIN_ROOT resolver`, RESOLVER_RE.test(body));
}

if (failures) {
  console.error(`\nskill-cjs-path-resolution: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nskill-cjs-path-resolution: all checks passed');
