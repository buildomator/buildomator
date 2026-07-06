#!/usr/bin/env node
'use strict';

// Guard: an interrupted UAT (verify-work status: testing/partial) must be
// surfaced/resumed, not silently abandoned after a detour (quick/add-phase/explore).
// Two mechanisms:
//  1. /bm:next hard invariant (Route 0.5) routes to verify-work before forward work.
//  2. detour commands' Next-Up leads with a "resume UAT" breadcrumb (rule 8 in
//     references/continuation-format.md).
// See feedback_resume_uat_after_detours memory.

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
let failures = 0;
const ok = m => console.log(`  ok - ${m}`);
const fail = m => { console.error(`  FAIL - ${m}`); failures++; };
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (src, n, m) => src.includes(n) ? ok(m) : fail(`${m} (missing: ${n})`);

// 1. next.md partial-UAT invariant
{
  const f = 'workflows/next.md';
  const src = read(f);
  has(src, 'resume_partial_uat', `${f}: has the resume_partial_uat step`);
  has(src, "status:[[:space:]]*(testing|partial)", `${f}: detects testing/partial UAT`);
  has(src, '/bm:verify-work $PARTIAL_UAT_PHASE', `${f}: routes to verify-work for the partial UAT`);
  // runs before forward routing
  has(src, 'continue to `resume_partial_uat`', `${f}: chained after the incomplete-phase invariant`);
}

// 2. shared breadcrumb rule
{
  const f = 'references/continuation-format.md';
  const src = read(f);
  has(src, 'Unfinished-UAT breadcrumb', `${f}: rule 8 breadcrumb present`);
  has(src, 'Unfinished UAT', `${f}: emits an unfinished-UAT resume line`);
  has(src, '/bm:verify-work', `${f}: breadcrumb points at verify-work`);
}

// 3. detour commands apply the breadcrumb
for (const f of ['skills/quick/SKILL.md', 'workflows/add-phase.md', 'workflows/explore.md']) {
  const src = read(f);
  has(src, 'Unfinished-UAT breadcrumb', `${f}: detour applies the UAT breadcrumb`);
}

if (failures) {
  console.error(`\nuat-resume-invariant: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nuat-resume-invariant: all checks passed');
