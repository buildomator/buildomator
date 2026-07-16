'use strict';

// Unit spec for scanQuickTasks classification in bin/lib/audit.cjs.
//
// A quick task is flagged as open only when its SUMMARY is missing, unreadable,
// or carries a status in the incomplete set. A readable SUMMARY with no status
// field (or status complete) counts as done. Covers:
//   - Case A: prefixed <dir>-SUMMARY.md with no status field -> not flagged
//   - Case B: no SUMMARY at all -> flagged with status missing
//   - Case C: prefixed SUMMARY with status incomplete / BLOCKED -> flagged
//   - Case D: bare SUMMARY.md with no status field -> not flagged (back compat)

const fs = require('fs');
const os = require('os');
const path = require('path');

const { auditOpenArtifacts } = require(path.join(__dirname, '..', 'bin', 'lib', 'audit.cjs'));

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Build a throwaway project with .planning/quick/ dirs covering cases A-D.
function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-audit-open-'));
  const quick = path.join(root, '.planning', 'quick');
  fs.mkdirSync(quick, { recursive: true });

  const writeDir = (dirName, summaryName, body) => {
    const dir = path.join(quick, dirName);
    fs.mkdirSync(dir, { recursive: true });
    if (summaryName) fs.writeFileSync(path.join(dir, summaryName), body);
  };

  // Case A: prefixed SUMMARY, phase but no status. This is the original bug shape.
  writeDir('case-a-clean', 'case-a-clean-SUMMARY.md', '---\nphase: quick-x\n---\n\nDone.\n');
  // Case B: no SUMMARY file at all.
  writeDir('case-b-no-summary', null, '');
  // Case C: prefixed SUMMARY, status incomplete.
  writeDir('case-c-incomplete', 'case-c-incomplete-SUMMARY.md', '---\nstatus: incomplete\n---\n\nWIP.\n');
  // Case C uppercase variant: status BLOCKED.
  writeDir('case-c-blocked', 'case-c-blocked-SUMMARY.md', '---\nstatus: BLOCKED\n---\n\nStuck.\n');
  // Case D: bare SUMMARY.md, no status field.
  writeDir('case-d-bare', 'SUMMARY.md', '---\nphase: quick-y\n---\n\nDone.\n');

  return root;
}

function statusFor(quickTasks, slug) {
  const hit = quickTasks.find(t => t.slug === slug);
  return hit ? hit.status : undefined;
}

const fixtureRoot = buildFixture();
try {
  const result = auditOpenArtifacts(fixtureRoot);
  const quickTasks = result.items.quick_tasks.filter(t => !t.scan_error);
  const flagged = new Set(quickTasks.map(t => t.slug));

  check('case A (prefixed SUMMARY, no status) is not flagged', () => {
    assert(!flagged.has('case-a-clean'), 'case A must count as complete');
  });

  check('case B (no SUMMARY) is flagged with status missing', () => {
    assert(flagged.has('case-b-no-summary'), 'case B must be flagged');
    assert(statusFor(quickTasks, 'case-b-no-summary') === 'missing', 'case B status must be missing');
  });

  check('case C (status incomplete) is flagged with status incomplete', () => {
    assert(flagged.has('case-c-incomplete'), 'case C incomplete must be flagged');
    assert(statusFor(quickTasks, 'case-c-incomplete') === 'incomplete', 'case C status must be incomplete');
  });

  check('case C uppercase (status BLOCKED) is flagged with status blocked', () => {
    assert(flagged.has('case-c-blocked'), 'case C blocked must be flagged');
    assert(statusFor(quickTasks, 'case-c-blocked') === 'blocked', 'case C status must lowercase to blocked');
  });

  check('case D (bare SUMMARY.md, no status) is not flagged', () => {
    assert(!flagged.has('case-d-bare'), 'case D must count as complete');
  });

  check('exactly the flagged cases appear (B and both C variants)', () => {
    assert(flagged.size === 3, `expected 3 flagged, got ${flagged.size}: ${[...flagged].join(', ')}`);
  });
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`audit-open quick tasks: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
