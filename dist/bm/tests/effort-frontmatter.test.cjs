#!/usr/bin/env node
'use strict';

// Guard for the `effort: low` skill frontmatter on the quick-status reads
// (adapted slice of upstream gsd-core #820 / #769).
//
// progress and stats are cheap status reads — running them at low reasoning
// effort saves tokens with no quality cost. Claude Code parses `effort:` from
// skill frontmatter natively (values low|medium|high|xhigh|max). This guard
// fails if the field is dropped or changed away from `low`.
//
// We deliberately do NOT pin effort on the heavy orchestrators
// (execute-phase/plan-phase/autonomous) — a static high effort there is an
// un-gated cost floor and does not reach the subagents doing the real work.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

let failures = 0;
function fail(msg) { console.error(`  FAIL - ${msg}`); failures++; }
function ok(msg) { console.log(`  ok - ${msg}`); }

function frontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

const SHOULD_BE_LOW = ['skills/progress/SKILL.md', 'skills/stats/SKILL.md', 'skills/version/SKILL.md'];

for (const rel of SHOULD_BE_LOW) {
  const fm = frontmatter(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  if (/^effort:\s*low\s*$/m.test(fm)) {
    ok(`${rel}: effort: low present`);
  } else {
    fail(`${rel}: expected \`effort: low\` in frontmatter (cheap status read). See #820/#769.`);
  }
}

if (failures) {
  console.error(`\neffort-frontmatter: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\neffort-frontmatter: all checks passed');
