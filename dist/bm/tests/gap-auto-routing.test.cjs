#!/usr/bin/env node
'use strict';

// Guard for Stream B5 of "Less GSD housekeeping prompts": auto gap-handling.
// Blocking gaps (break the phase goal) auto-escalate; minor-only gaps auto-park.
// No "How should these gaps be handled? (Recommended)" rubber-stamp prompt.
// Signal: has_blocking_gaps in VERIFICATION.md frontmatter (verifier-written),
// parsed by check.verification-status.

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
let failures = 0;
const ok = m => console.log(`  ok - ${m}`);
const fail = m => { console.error(`  FAIL - ${m}`); failures++; };
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (src, n, m) => src.includes(n) ? ok(m) : fail(`${m} (missing: ${n})`);
const absent = (src, n, m) => src.includes(n) ? fail(`${m} (still present: ${n})`) : ok(m);

// --- Handler: execute-phase auto-routes, no blocking gap prompt ---
{
  const f = 'workflows/execute-phase.md';
  const src = read(f);
  has(src, 'AUTO-routed by severity', `${f}: gaps auto-routed by severity`);
  has(src, 'has_blocking_gaps', `${f}: reads has_blocking_gaps signal`);
  has(src, 'Auto-escalated', `${f}: blocking gaps auto-escalate`);
  has(src, 'auto-park', `${f}: minor-only gaps auto-park`);
  absent(src, 'How should these {N} gap(s) be handled?',
    `${f}: blocking gap-handling AskUserQuestion removed`);
  absent(src, 'Park to backlog (Recommended)',
    `${f}: (Recommended) rubber-stamp option removed`);
}

// --- Verifier + template emit the signal ---
{
  const v = read('agents/gsd-verifier.md');
  has(v, 'has_blocking_gaps', `gsd-verifier.md: writes has_blocking_gaps`);
  has(v, 'severity: blocking', `gsd-verifier.md: per-gap severity tagging`);

  const t = read('templates/verification-report.md');
  has(t, 'has_blocking_gaps', `verification-report.md: frontmatter has_blocking_gaps`);
}

if (failures) {
  console.error(`\ngap-auto-routing: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\ngap-auto-routing: all checks passed');
