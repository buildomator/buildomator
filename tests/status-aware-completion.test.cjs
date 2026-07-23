'use strict';

// Status-aware phase/plan completion: a plan paused at a blocking checkpoint
// (a partial SUMMARY with status: paused) must never count as complete, be
// skipped on resume, or have its successor dispatched early.
//
// Verifies the shared scanner (scanPhasePlans) and the phase-plan-index CLI
// both treat a paused-summary plan as incomplete, and that resolving the
// summary flips the phase complete.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const scanPhasePlans = require(path.join(__dirname, '..', 'bin', 'lib', 'plan-scan.cjs'));
const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

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

function planBody(phase, plan) {
  return `---\nphase: ${phase}\nplan: ${plan}\n---\n<objective>Do ${plan}</objective>\n<tasks><task type="auto"><name>T</name></task></tasks>\n`;
}

function summaryBody(phase, plan, status) {
  const statusLine = status ? `status: ${status}\n` : '';
  return `---\nphase: ${phase}\nplan: ${plan}\n${statusLine}---\n# Summary\n`;
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-status-aware-'));
  const phaseDir = path.join(root, '.planning', 'phases', '40-demo');
  fs.mkdirSync(phaseDir, { recursive: true });
  try {
    return fn(root, phaseDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function phasePlanIndex(root) {
  const out = execFileSync('node', [GSD_TOOLS, 'phase-plan-index', '40'], { cwd: root, stdio: 'pipe' }).toString();
  return JSON.parse(out);
}

check('scanPhasePlans reports a paused-summary plan A as incomplete; phase not complete', () => {
  withProject((root, phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '40-01-PLAN.md'), planBody(40, '01'));
    fs.writeFileSync(path.join(phaseDir, '40-02-PLAN.md'), planBody(40, '02'));
    fs.writeFileSync(path.join(phaseDir, '40-01-SUMMARY.md'), summaryBody(40, '01', 'paused'));
    // Plan B has no summary.

    const scan = scanPhasePlans(phaseDir);
    assert(scan.planCount === 2, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 0, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === false, 'expected completed false');
  });
});

check('phase-plan-index puts A in incomplete with complete:false and does not skip B', () => {
  withProject((root, phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '40-01-PLAN.md'), planBody(40, '01'));
    fs.writeFileSync(path.join(phaseDir, '40-02-PLAN.md'), planBody(40, '02'));
    fs.writeFileSync(path.join(phaseDir, '40-01-SUMMARY.md'), summaryBody(40, '01', 'paused'));

    const idx = phasePlanIndex(root);
    const a = idx.plans.find(p => p.id === '40-01');
    const b = idx.plans.find(p => p.id === '40-02');
    assert(a && a.has_summary === true, 'A should have a summary');
    assert(a && a.complete === false, 'A must be complete:false (paused)');
    assert(b && b.complete === false, 'B must be complete:false (no summary)');
    assert(idx.incomplete.includes('40-01'), 'incomplete must include 40-01');
    assert(idx.incomplete.includes('40-02'), 'incomplete must include 40-02');
  });
});

check('completing A (status-less summary) flips A complete and drops it from incomplete', () => {
  withProject((root, phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '40-01-PLAN.md'), planBody(40, '01'));
    fs.writeFileSync(path.join(phaseDir, '40-02-PLAN.md'), planBody(40, '02'));
    fs.writeFileSync(path.join(phaseDir, '40-01-SUMMARY.md'), summaryBody(40, '01'));
    fs.writeFileSync(path.join(phaseDir, '40-02-SUMMARY.md'), summaryBody(40, '02'));

    const scan = scanPhasePlans(phaseDir);
    assert(scan.summaryCount === 2, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === true, 'expected completed true');

    const idx = phasePlanIndex(root);
    assert(idx.plans.find(p => p.id === '40-01').complete === true, 'A should be complete');
    assert(idx.incomplete.length === 0, `incomplete should be empty, got ${JSON.stringify(idx.incomplete)}`);
  });
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`status-aware completion: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
