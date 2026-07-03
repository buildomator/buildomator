#!/usr/bin/env node
'use strict';

// Regression guard for the legacy `.claude/get-shit-done/` install-path sweep.
//
// The plugin ships in a flat layout; the legacy `$HOME/.claude/get-shit-done/`
// (and `~/...`) install path does not exist on a plugin install. Operational
// references to it dangle silently. The sweep repointed them to the plugin-local
// forms:
//   - @-includes  -> @${CLAUDE_PLUGIN_ROOT}/<sub>
//   - bash/prose  -> ${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/<sub>
//
// This guard fails if a NEW broken install-path reference is introduced in
// operational content (workflows/skills/agents/references). It targets only the
// `.claude/get-shit-done/` install-path family and the executed `get-shit-done`
// require/invoke forms, so intentional bare `get-shit-done/` mentions
// (legacy-install detection in update.md, few-shot example data, source-location
// citations) are deliberately NOT matched.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['workflows', 'skills', 'agents', 'references'];

let failures = 0;
function fail(msg) { console.error(`  FAIL - ${msg}`); failures++; }

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// Broken install-path patterns (operational dangling refs the sweep removed).
const BANNED = [
  { re: /@\$HOME\/\.claude\/get-shit-done\//, label: '@$HOME/.claude/get-shit-done/ @-include' },
  { re: /@~\/\.claude\/get-shit-done\//, label: '@~/.claude/get-shit-done/ @-include' },
  { re: /@\.\/\.claude\/get-shit-done\//, label: '@./.claude/get-shit-done/ @-include' },
  { re: /\$HOME\/\.claude\/get-shit-done\/bin\/gsd-tools\.cjs/, label: '$HOME/.claude/get-shit-done/bin/gsd-tools.cjs bash path' },
  { re: /require\((['"])\.\/get-shit-done\//, label: "require('./get-shit-done/...) executed path" },
];

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
let scanned = 0;
for (const file of files) {
  scanned++;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { re, label } of BANNED) {
      if (re.test(line)) {
        fail(`${path.relative(ROOT, file)}:${i + 1} contains banned ${label}`);
      }
    }
  });
}

if (failures) {
  console.error(`\nlegacy-path-sweep: ${failures} banned reference(s) across ${scanned} files`);
  process.exit(1);
}
console.log(`  ok - no banned legacy install-path references in ${scanned} operational docs`);
console.log('\nlegacy-path-sweep: all checks passed');
