'use strict';

// Spec for summary-to-plan pairing in bin/lib/plan-scan.cjs.
//
// summaryCount and completion must count only summaries that pair with a real
// plan file. A stray remediation summary (e.g. 30-FIX-CR02-SUMMARY.md) matches
// no plan and must be excluded, so it can never flip a phase to complete.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const scanPhasePlans = require(path.join(__dirname, '..', 'bin', 'lib', 'plan-scan.cjs'));
const { countMatchedSummaries } = scanPhasePlans;

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

// files may be a string (default fixture body) or [relPath, body] to write a
// specific frontmatter/status into a summary.
function withPhase(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planscan-'));
  const phaseDir = path.join(root, 'phase');
  fs.mkdirSync(phaseDir, { recursive: true });
  for (const entry of files) {
    const [rel, body] = Array.isArray(entry) ? entry : [entry, '# fixture\n'];
    const full = path.join(phaseDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  try {
    return fn(phaseDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function summary(status) {
  return `---\nphase: 40\nplan: 01\nstatus: ${status}\n---\n# Summary\n`;
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

check('paused matched summary is excluded from summaryCount / completed', () => {
  withPhase([
    '40-01-PLAN.md', '40-02-PLAN.md',
    ['40-01-SUMMARY.md', summary('paused')],
    '40-02-SUMMARY.md',
  ], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.planCount === 2, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 1, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === false, 'expected completed false with a paused summary');
  });
});

check('each incomplete status token excludes its matched summary', () => {
  for (const st of ['partial', 'incomplete', 'blocked', 'gaps', 'gaps_found', 'not-complete', 'not_complete']) {
    withPhase([
      '40-01-PLAN.md', '40-02-PLAN.md',
      ['40-01-SUMMARY.md', summary(st)],
      '40-02-SUMMARY.md',
    ], (dir) => {
      const scan = scanPhasePlans(dir);
      assert(scan.summaryCount === 1, `status ${st}: summaryCount ${scan.summaryCount}`);
      assert(scan.completed === false, `status ${st}: expected completed false`);
    });
  }
});

check('status-less and status: complete matched summaries count; phase flips complete', () => {
  withPhase([
    '40-01-PLAN.md', '40-02-PLAN.md',
    '40-01-SUMMARY.md',
    ['40-02-SUMMARY.md', summary('complete')],
  ], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.summaryCount === 2, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === true, 'expected completed true');
  });
});

check('unreadable matched summary is excluded (treated as not complete)', () => {
  withPhase(['40-01-PLAN.md'], (dir) => {
    // Create the summary as a directory so reading it as a file fails.
    fs.mkdirSync(path.join(dir, '40-01-SUMMARY.md'));
    const scan = scanPhasePlans(dir);
    assert(scan.summaryCount === 0, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === false, 'expected completed false for unreadable summary');
  });
});

check('nested paused matched summary resolves status from plans/ subdir', () => {
  withPhase([
    path.join('plans', 'PLAN-01-setup.md'),
    [path.join('plans', 'SUMMARY-01-setup.md'), summary('paused')],
  ], (dir) => {
    const scan = scanPhasePlans(dir);
    assert(scan.planCount === 1, `planCount ${scan.planCount}`);
    assert(scan.summaryCount === 0, `summaryCount ${scan.summaryCount}`);
    assert(scan.completed === false, 'expected completed false for nested paused summary');
  });
});

check('countMatchedSummaries counts only paired summaries', () => {
  assert(countMatchedSummaries(
    ['30-01-PLAN.md', '30-02-PLAN.md'],
    ['30-01-SUMMARY.md', '30-02-SUMMARY.md', '30-FIX-CR02-SUMMARY.md'],
  ) === 2, 'expected 2 matched');
  assert(countMatchedSummaries(['30-01-PLAN.md'], ['30-GAPCLOSURE-SUMMARY.md']) === 0, 'expected 0 matched');
});

// The init completion path (gsd-tools init progress) must take the paired count,
// so a phase with a stray summary is not reported complete.
check('init progress excludes a stray summary from a phase completion', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-initscan-'));
  try {
    const phaseDir = path.join(root, '.planning', 'phases', '30-hardening');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(root, '.planning', 'STATE.md'), '---\nmilestone: v1.0\n---\n');
    fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.md'),
      ['# Roadmap', '', '## v1.0: Hardening', '', '- [ ] Phase 30: hardening', '',
        '### Phase 30: hardening', '', '**Goal:** Harden it', ''].join('\n'));
    fs.writeFileSync(path.join(root, '.planning', 'config.json'), '{"model_profile":"balanced"}');
    fs.writeFileSync(path.join(phaseDir, '30-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '30-02-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '30-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phaseDir, '30-GAPCLOSURE-SUMMARY.md'), '# Stray');

    const out = execFileSync('node', [GSD_TOOLS, 'init', 'progress'], { cwd: root, stdio: 'pipe' }).toString();
    const parsed = JSON.parse(out);
    const phase = (parsed.phases || []).find(p => p.number === '30');
    assert(phase, 'phase 30 must appear in init progress output');
    assert(phase.summary_count === 1, `expected summary_count 1, got ${phase.summary_count}`);
    assert(phase.status !== 'complete', `phase must not be complete, got status ${phase.status}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`plan-scan matched summaries: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
