'use strict';

// The HANDOFF resume scanner (checkpoint.cjs scanPhasePlans) must classify a
// plan paused at a blocking checkpoint as `remaining`, not `completed`, so
// /bm:resume-work routes back to that plan rather than skipping past it.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanPhasePlans } = require(path.join(__dirname, '..', 'bin', 'lib', 'checkpoint.cjs'));

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
  return `---\nphase: ${phase}\nplan: ${plan}\n---\n<name>Plan ${plan}</name>\n`;
}

function summaryBody(phase, plan, status) {
  const statusLine = status ? `status: ${status}\n` : '';
  return `---\nphase: ${phase}\nplan: ${plan}\n${statusLine}---\n# Summary\n`;
}

function withPhase(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-checkpoint-status-'));
  const phaseDir = path.join(root, '04-demo');
  fs.mkdirSync(phaseDir, { recursive: true });
  try {
    return fn(phaseDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function ids(list) {
  return list.map(e => e.id);
}

check('paused-summary plan A lands in remaining; summary-less plan B also remaining', () => {
  withPhase((phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), planBody(4, '01'));
    fs.writeFileSync(path.join(phaseDir, '04-02-PLAN.md'), planBody(4, '02'));
    fs.writeFileSync(path.join(phaseDir, '04-01-SUMMARY.md'), summaryBody(4, '01', 'paused'));

    const { completed, remaining } = scanPhasePlans(phaseDir);
    assert(!ids(completed).includes('01'), 'A must NOT be in completed');
    assert(ids(remaining).includes('01'), 'A must be in remaining');
    assert(ids(remaining).includes('02'), 'B must be in remaining');
    const a = remaining.find(e => e.id === '01');
    assert(a.status !== 'done', `A status must not be done, got ${a.status}`);
  });
});

check('an unreadable matched summary keeps its plan in remaining', () => {
  withPhase((phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), planBody(4, '01'));
    // Directory in place of the summary file makes reading it fail.
    fs.mkdirSync(path.join(phaseDir, '04-01-SUMMARY.md'));

    const { completed, remaining } = scanPhasePlans(phaseDir);
    assert(!ids(completed).includes('01'), 'A must NOT be in completed');
    assert(ids(remaining).includes('01'), 'A must be in remaining');
  });
});

check('a complete (status-less) matched summary flips its plan to completed', () => {
  withPhase((phaseDir) => {
    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), planBody(4, '01'));
    fs.writeFileSync(path.join(phaseDir, '04-01-SUMMARY.md'), summaryBody(4, '01'));

    const { completed, remaining } = scanPhasePlans(phaseDir);
    assert(ids(completed).includes('01'), 'A must be in completed');
    assert(!ids(remaining).includes('01'), 'A must NOT be in remaining');
  });
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`checkpoint status-aware: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
