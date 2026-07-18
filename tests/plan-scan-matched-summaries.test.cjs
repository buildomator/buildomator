'use strict';

// Spec for summary-to-plan pairing in bin/lib/plan-scan.cjs.
//
// summaryCount and completion must count only summaries that pair with a real
// plan file. A stray remediation summary (e.g. 30-FIX-CR02-SUMMARY.md) matches
// no plan and must be excluded, so it can never flip a phase to complete.

const fs = require('fs');
const os = require('os');
const path = require('path');

const scanPhasePlans = require(path.join(__dirname, '..', 'bin', 'lib', 'plan-scan.cjs'));
const { countMatchedSummaries } = scanPhasePlans;

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

function withPhase(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planscan-'));
  const phaseDir = path.join(root, 'phase');
  fs.mkdirSync(phaseDir, { recursive: true });
  for (const rel of files) {
    const full = path.join(phaseDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '# fixture\n');
  }
  try {
    return fn(phaseDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

check('3 plans + 3 plan summaries + 1 stray reports summaryCount 3 and completed', () => {
  withPhase([
    '30-01-PLAN.md', '30-02-PLAN.md', '30-03-PLAN.md',
    '30-01-SUMMARY.md', '30-02-SUMMARY.md', '30-03-SUMMARY.md',
    '30-FIX-CR02-SUMMARY.md',
  ], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.planCount === 3, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 3, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === true, 'expected completed true');
  });
});

check('1 plan + only a stray summary reports summaryCount 0 and not completed', () => {
  withPhase(['31-01-PLAN.md', '31-GAPCLOSURE-SUMMARY.md'], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.planCount === 1, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 0, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === false, 'expected completed false');
  });
});

check('bare PLAN.md pairs with bare SUMMARY.md', () => {
  withPhase(['PLAN.md', 'SUMMARY.md'], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.summaryCount === 1, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === true, 'expected completed true');
  });
});

check('nested stray SUMMARY is excluded', () => {
  withPhase([
    path.join('plans', 'PLAN-01-setup.md'),
    path.join('plans', 'SUMMARY-01-setup.md'),
    path.join('plans', 'SUMMARY-99-orphan.md'),
  ], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.planCount === 1, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 1, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === true, 'expected completed true');
  });
});

check('countMatchedSummaries counts only paired summaries', () => {
  assert(countMatchedSummaries(
    ['30-01-PLAN.md', '30-02-PLAN.md'],
    ['30-01-SUMMARY.md', '30-02-SUMMARY.md', '30-FIX-CR02-SUMMARY.md'],
  ) === 2, 'expected 2 matched');
  assert(countMatchedSummaries(['30-01-PLAN.md'], ['30-GAPCLOSURE-SUMMARY.md']) === 0, 'expected 0 matched');
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`plan-scan matched summaries: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
