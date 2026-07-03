#!/usr/bin/env node
'use strict';

// Guard for the "Less GSD housekeeping prompts" feature
// (`.planning/notes/minimize-gsd-plumbing-interactions.md`).
//
// Bucket-3 / sub-class-2: blocking prompts that rubber-stamp a recommendation or
// a flow-control step GSD already knows the default for. Each collapse below
// removes the AskUserQuestion and auto-proceeds (announced + overridable), while
// the SCOPE GUARD keeps build/discussion prompts interactive (NOT touched here).
//
// One file, one check per collapsed prompt — extend as the sweep continues.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function ok(m) { console.log(`  ok - ${m}`); }
function fail(m) { console.error(`  FAIL - ${m}`); failures++; }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function has(src, needle, m) { src.includes(needle) ? ok(m) : fail(`${m} (missing: ${needle})`); }
function absent(src, needle, m) { src.includes(needle) ? fail(`${m} (still present: ${needle})`) : ok(m); }

// --- Collapse 1: plan-phase research gate (was unconditional "Recommended" prompt) ---
{
  const f = 'workflows/plan-phase.md';
  const src = read(f);
  has(src, 'research_enabled` true (default):**', `${f}: auto-research default branch present`);
  has(src, 'workflow.research=true', `${f}: reuses existing workflow.research (no new knob)`);
  has(src, '[research] Auto', `${f}: auto-research announced (not silent)`);
  has(src, '--skip-research', `${f}: --skip-research per-run escape preserved`);
  absent(src, 'Research before planning Phase {X}: {phase_name}?', `${f}: blocking research prompt removed`);
  absent(src, 'workflow.research_default', `${f}: no redundant research_default knob`);
}

// --- Collapse 2: discuss-phase "explore more / ready for context?" gate ---
{
  const f = 'workflows/discuss-phase/modes/default.md';
  const src = read(f);
  has(src, 'Writing CONTEXT.md...', `${f}: announces auto-proceed to context`);
  has(src, 'explore more', `${f}: soft "explore more" escape preserved`);
  absent(src, '"Explore more gray areas" / "I\'m ready for context"',
    `${f}: blocking ready-for-context AskUserQuestion removed`);
}

// --- Collapse 3: new-project setup gauntlet -> single defaults-or-customize gate ---
{
  const f = 'workflows/new-project.md';
  const src = read(f);
  has(src, 'Recommended defaults', `${f}: built-in recommended defaults branch present`);
  has(src, '"granularity": "coarse"', `${f}: built-in defaults seed values present`);
  // First-time users must reach the single gate, not fall through to the gauntlet.
  absent(src, "or `~/.gsd/defaults.json` doesn't exist:** proceed with the questions",
    `${f}: first-time gauntlet fall-through removed`);
}

if (failures) {
  console.error(`\nhousekeeping-prompt-reduction: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nhousekeeping-prompt-reduction: all checks passed');
