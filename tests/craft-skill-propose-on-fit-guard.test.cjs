'use strict';

// Static wiring guard for the propose-on-fit craft-skill surface.
//
// The behavior is spread across three callers (discuss-phase, quick,
// autonomous), one shared procedure reference, and a note in the executor's
// project context. Each piece is plain prose, so a well-meaning edit elsewhere
// can quietly drop a match call, a reference pointer, the release, the
// autonomous allow gate, the quick re-capture ordering, or the executor note
// without any runtime error. This guard turns that prose into a ratchet: it
// reads each file once and asserts the exact tokens and the few orderings that
// the surfaces depend on, so a regression fails CI loudly instead of shipping.
//
// Orderings are checked with indexOf/lastIndexOf on fixed tokens, never with
// regexes built from file content. Every assertion names the file and the
// token it is guarding.
//
// Zero-dep harness: node:assert + a check() runner + a process.exit(1) footer.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

const has = (text, token, file) =>
  assert.ok(text.includes(token), `${file} is missing ${JSON.stringify(token)}`);
const lacks = (text, token, file) =>
  assert.ok(!text.includes(token), `${file} must not contain ${JSON.stringify(token)}`);
const before = (text, a, b, file) =>
  assert.ok(
    text.indexOf(a) !== -1 && text.indexOf(b) !== -1 && text.indexOf(a) < text.indexOf(b),
    `${file}: ${JSON.stringify(a)} must appear before ${JSON.stringify(b)}`,
  );

// --- The shared procedure reference ------------------------------------------
check('reference carries every step heading', () => {
  const file = 'references/craft-skill-propose-on-fit.md';
  const text = read(file);
  for (const heading of [
    '## Step 1: Pre-filter (deterministic)',
    '## Step 2: Relevance (model)',
    '## Step 3a: Interactive accept',
    '## Step 3b: Autonomous auto-insert',
    '## Step 4: Release after the task',
    '## Checkout contract',
    '## Document deliverables',
    '## Per-surface notes',
  ]) has(text, heading, file);
});

check('reference carries the command and gate tokens', () => {
  const file = 'references/craft-skill-propose-on-fit.md';
  const text = read(file);
  for (const token of [
    'craft-skill.match',
    'craft-skill.insert',
    '--approved',
    'craft-skill.release --agent bm-executor --id',
    "verdict === 'allow'",
    'DATA_START',
    'DATA_END',
    'docx',
    'pdf',
    'pptx',
  ]) has(text, token, file);
});

check('reference carries no third-party publisher or license text', () => {
  const file = 'references/craft-skill-propose-on-fit.md';
  const text = read(file);
  for (const marker of ['coreyhaines31', 'marketingskills', 'duckdb-skills', 'Stichting DuckDB'])
    lacks(text, marker, file);
});

// --- discuss-phase: match + reference, records only (never inserts) ----------
check('discuss-phase points at the reference and matches but does not insert', () => {
  const file = 'workflows/discuss-phase.md';
  const text = read(file);
  has(text, '<step name="propose_craft_skill">', file);
  has(text, 'craft-skill.match', file);
  has(text, 'craft-skill-propose-on-fit.md', file);
  lacks(text, 'craft-skill.insert', file);
});

check('discuss-phase context template holds the Craft skills section', () => {
  const file = 'workflows/discuss-phase/templates/context.md';
  has(read(file), '### Craft skills', file);
});

check('discuss-phase chain mode inserts and releases on accept', () => {
  const file = 'workflows/discuss-phase/modes/chain.md';
  const text = read(file);
  has(text, 'craft-skill.insert', file);
  has(text, 'craft-skill.release --agent bm-executor --id', file);
});

// --- quick: match before the executor-skills capture, release before review --
check('quick matches the description and points at the reference', () => {
  const file = 'workflows/quick.md';
  const text = read(file);
  has(text, 'craft-skill.match "$DESCRIPTION"', file);
  has(text, 'craft-skill-propose-on-fit.md', file);
  has(text, 'craft-skill.release --agent bm-executor --id', file);
});

check('quick matches before the final executor-skills capture', () => {
  const file = 'workflows/quick.md';
  const text = read(file);
  const matchAt = text.indexOf('craft-skill.match');
  const captureAt = text.lastIndexOf('AGENT_SKILLS_EXECUTOR=$(bm-sdk query agent-skills bm-executor)');
  assert.ok(matchAt !== -1 && captureAt !== -1, `${file}: missing match or capture token`);
  assert.ok(matchAt < captureAt, `${file}: craft-skill.match must precede the last AGENT_SKILLS_EXECUTOR capture`);
});

check('quick releases before the code-review step', () => {
  before(read('workflows/quick.md'), 'craft-skill.release', '**Step 6.25', 'workflows/quick.md');
});

// --- autonomous: allow gate, no sticky, ordered insert and release -----------
check('autonomous matches, applies the allow gate, approves and releases', () => {
  const file = 'workflows/autonomous.md';
  const text = read(file);
  has(text, 'craft-skill.match', file);
  has(text, 'craft-skill-propose-on-fit.md', file);
  has(text, "verdict === 'allow'", file);
  has(text, '--approved', file);
  has(text, 'craft-skill.release --agent bm-executor --id', file);
});

check('autonomous never uses the sticky flag', () => {
  lacks(read('workflows/autonomous.md'), '--sticky', 'workflows/autonomous.md');
});

check('autonomous matches before it dispatches the executor', () => {
  before(read('workflows/autonomous.md'), 'craft-skill.match', 'Skill(skill="gsd-execute-phase"', 'workflows/autonomous.md');
});

check('autonomous releases in post-execution routing', () => {
  before(read('workflows/autonomous.md'), '**3d. Post-Execution Routing**', 'craft-skill.release', 'workflows/autonomous.md');
});

// --- executor project context carries the document-deliverable routing note --
check('executor project context routes document deliverables to built-in skills', () => {
  const file = 'agents/bm-executor.md';
  const text = read(file);
  const start = text.indexOf('<project_context>');
  const end = text.indexOf('</project_context>');
  assert.ok(start !== -1 && end !== -1 && end > start, `${file}: project_context block not found`);
  const block = text.slice(start, end);
  for (const token of ['Document deliverables', 'docx', 'pdf', 'pptx', 'built-in'])
    assert.ok(block.includes(token), `${file} project_context is missing ${JSON.stringify(token)}`);
});

// --- startup-path guards: the catalog stays off the session-start cost --------
check('no SKILL.md references craft-skill', () => {
  const dir = path.join(ROOT, 'skills');
  const offenders = [];
  if (fs.existsSync(dir)) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const skillFile = path.join(dir, ent.name, 'SKILL.md');
      if (fs.existsSync(skillFile) && fs.readFileSync(skillFile, 'utf8').includes('craft-skill'))
        offenders.push(`skills/${ent.name}/SKILL.md`);
    }
  }
  assert.strictEqual(offenders.length, 0, `craft-skill leaked into: ${offenders.join(', ')}`);
});

check('no hooks file references craft-skill', () => {
  const dir = path.join(ROOT, 'hooks');
  const offenders = [];
  const walk = (abs, rel) => {
    if (!fs.existsSync(abs)) return;
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const childAbs = path.join(abs, ent.name);
      const childRel = `${rel}/${ent.name}`;
      if (ent.isDirectory()) walk(childAbs, childRel);
      else if (ent.isFile()) {
        try { if (fs.readFileSync(childAbs, 'utf8').includes('craft-skill')) offenders.push(childRel); }
        catch { /* unreadable, skip */ }
      }
    }
  };
  walk(dir, 'hooks');
  assert.strictEqual(offenders.length, 0, `craft-skill leaked into: ${offenders.join(', ')}`);
});

// --- Report ------------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall propose-on-fit wiring checks passed');
