#!/usr/bin/env node
'use strict';

// Integration tests for the verify drift command (DRIFT-01, DRIFT-02, DRIFT-04).
//
// DRIFT-01: bin/check-vibedrift-release.sh exists, is executable, references
//   the scoped @vibedrift/cli package, and never invokes vibedrift at runtime.
// DRIFT-02: the audit-milestone workflow has an opt-in drift integrity gate
//   that is OFF by default; --fail-on-score is the only hard-exit escalation.
// DRIFT-04: cmdVerifyDrift emits valid JSON (skipped or full payload), exits 0
//   when no failOnScore is set, and sets exitCode=1 only when failOnScore is
//   set and the score is below the threshold.
//
// These behaviors are not unit-testable from the three detector test files alone
// (which cover DRIFT-03/DRIFT-05). This file closes the automation gap for the
// integration/structural checks identified in tasks 11-03-01, 11-04-01, 11-05-01,
// and 11-05-02.
//
// Zero-dep harness: node:assert, a bare check(name, fn) runner, a failure
// counter, and a process.exit(1) footer. CI runs directly via
// `node tests/verify-drift-integration.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── DRIFT-01: check-vibedrift-release.sh is an ops-only cron notifier ───────
// GSD must NEVER invoke vibedrift at runtime. The script is an ops cron notifier
// that the MAINTAINER runs; it must exist, be executable, use the scoped
// @vibedrift/cli package (never the unscoped one), and not call any GSD workflows.

const scriptPath = path.resolve(__dirname, '../bin/check-vibedrift-release.sh');

check('DRIFT-01: bin/check-vibedrift-release.sh exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'bin/check-vibedrift-release.sh must exist');
});

check('DRIFT-01: script is executable', () => {
  const stat = fs.statSync(scriptPath);
  // At least one execute bit must be set (owner/group/other)
  const execBits = 0o111;
  assert.ok((stat.mode & execBits) !== 0, 'script must have an execute bit set');
});

check('DRIFT-01: script references @vibedrift/cli (scoped), never bare vibedrift', () => {
  const src = fs.readFileSync(scriptPath, 'utf8');
  // Must reference the scoped package
  assert.ok(src.includes('@vibedrift/cli'), 'script must reference @vibedrift/cli (scoped)');
  // Must NOT call GSD at runtime (no gsd-tools or gsd-sdk invocations)
  assert.ok(!src.includes('gsd-tools verify'), 'script must not invoke gsd-tools verify (ops-only)');
  assert.ok(!src.includes('gsd-sdk'), 'script must not invoke gsd-sdk (ops-only)');
});

check('DRIFT-01: script passes bash -n syntax check', () => {
  const { execFileSync } = require('child_process');
  // This will throw if the script has syntax errors
  execFileSync('bash', ['-n', scriptPath]);
});

check('DRIFT-01: README documents VibeDrift as a second upstream', () => {
  const readmePath = path.resolve(__dirname, '../README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  // README must mention vibedrift/VibeDrift so users know GSD has a second upstream
  assert.ok(/vibedrift/i.test(readme), 'README must mention VibeDrift');
  // It must clarify that GSD does NOT run it at runtime
  assert.ok(/never.*vibedrift|vibedrift.*never/i.test(readme) ||
    /GSD never.*vibedrift|vibedrift.*GSD never/i.test(readme) ||
    /does NOT install or.*vibedrift/i.test(readme),
    'README must state that GSD never runs vibedrift at runtime');
});

// ─── DRIFT-02: audit-milestone §5.6 drift gate is opt-in, OFF by default ─────
// The gate must: exist in audit-milestone.md, be OFF by default (no auto-block),
// and document that --fail-on-score is the only hard-exit escalation.

check('DRIFT-02: audit-milestone.md contains the Drift Integrity Gate section', () => {
  const wfPath = path.resolve(__dirname, '../workflows/audit-milestone.md');
  const src = fs.readFileSync(wfPath, 'utf8');
  assert.ok(src.includes('Drift Integrity Gate'), 'audit-milestone.md must have a Drift Integrity Gate section');
});

check('DRIFT-02: gate is controlled by workflow.drift_gate config key', () => {
  const wfPath = path.resolve(__dirname, '../workflows/audit-milestone.md');
  const src = fs.readFileSync(wfPath, 'utf8');
  assert.ok(src.includes('drift_gate'), 'audit-milestone.md must reference drift_gate config key');
});

check('DRIFT-02: gate is documented as OFF by default', () => {
  const wfPath = path.resolve(__dirname, '../workflows/audit-milestone.md');
  const src = fs.readFileSync(wfPath, 'utf8');
  // The gate must be explicitly called out as off/disabled by default
  assert.ok(/OFF by default|disabled.*default|default.*false/i.test(src),
    'audit-milestone.md must document the gate is OFF by default');
});

check('DRIFT-02: --fail-on-score is described as the only hard-exit escalation', () => {
  const wfPath = path.resolve(__dirname, '../workflows/audit-milestone.md');
  const src = fs.readFileSync(wfPath, 'utf8');
  assert.ok(src.includes('--fail-on-score') || src.includes('fail_on_score'),
    'audit-milestone.md must document the --fail-on-score escalation path');
  // The gate must NOT block the milestone by default
  assert.ok(/Never blocks|never blocks|not block/i.test(src),
    'audit-milestone.md must state the gate never blocks by default');
});

// ─── DRIFT-04: verify drift CLI emits valid JSON and respects failOnScore ─────
// Run via child process so fs.writeSync(1, ...) is captured correctly.
// output() in core.cjs uses fs.writeSync(fd=1) not process.stdout.write, so
// a write intercept inside the same process does not work. Use execFileSync.

const { execFileSync, execSync } = require('child_process');
const gsdTools = path.resolve(__dirname, '../bin/gsd-tools.cjs');

let tmpDir;
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-drift-integration-test-'));
  // Write a minimal corpus that will parse cleanly (no near-clones expected)
  fs.writeFileSync(path.join(tmpDir, 'alpha.cjs'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(tmpDir, 'beta.cjs'), "'use strict';\nmodule.exports = { name: 'beta' };\n");
} catch (e) {
  console.error('FATAL: could not create temp dir:', e.message);
  process.exit(1);
}

check('DRIFT-04: verify drift --json emits valid JSON with required fields', () => {
  let raw;
  try {
    raw = execFileSync(process.execPath, [gsdTools, 'verify', 'drift', '--scope', '.', '--json'], {
      cwd: tmpDir,
      timeout: 30000,
    }).toString();
  } catch (e) {
    // execFileSync throws on non-zero exit; capture stdout from error
    raw = e.stdout ? e.stdout.toString() : '';
    assert.fail(`verify drift exited non-zero (exit ${e.status}): ${raw.slice(0, 300)}`);
  }
  let emitted;
  try {
    emitted = JSON.parse(raw.trim());
  } catch (e) {
    assert.fail(`verify drift did not emit valid JSON: ${e.message}. Got: ${raw.slice(0, 200)}`);
  }
  assert.ok(typeof emitted === 'object' && emitted !== null, 'payload must be an object');
  assert.ok('skipped' in emitted, 'payload must have a skipped field');
  if (!emitted.skipped) {
    assert.ok('score' in emitted, 'non-skipped payload must have a score field');
    assert.ok(typeof emitted.score === 'number', 'score must be a number');
    assert.ok(Array.isArray(emitted.findings), 'payload must have findings array');
    assert.ok(Array.isArray(emitted.suppressed), 'payload must have suppressed array');
    assert.ok('counts' in emitted, 'payload must have counts');
  }
});

check('DRIFT-04: verify drift without --fail-on-score exits 0 (never blocks by default)', () => {
  // Must exit 0 with no failOnScore (DRIFT-02: never block unless explicit escalation)
  try {
    execFileSync(process.execPath, [gsdTools, 'verify', 'drift', '--scope', '.', '--json'], {
      cwd: tmpDir,
      timeout: 30000,
    });
    // If execFileSync completes without throwing, exit was 0
  } catch (e) {
    assert.fail(`verify drift without --fail-on-score must exit 0, got exit ${e.status}`);
  }
});

check('DRIFT-04: verify drift with --fail-on-score 999 exits 1 when score < 999', () => {
  // score on a minimal 2-file corpus will be 100 (no findings) which is still < 999
  let exitCode = 0;
  try {
    execFileSync(process.execPath,
      [gsdTools, 'verify', 'drift', '--scope', '.', '--json', '--fail-on-score', '999'],
      { cwd: tmpDir, timeout: 30000 }
    );
  } catch (e) {
    exitCode = e.status || 1;
  }
  assert.strictEqual(exitCode, 1,
    '--fail-on-score 999 must exit 1 when score < 999 (DRIFT-04 hard-gate)');
});

check('DRIFT-04: verify drift with --fail-on-score -1 exits 0 (score >= 0 always clears)', () => {
  // Score is always >= 0; threshold of -1 must never trigger the hard gate
  try {
    execFileSync(process.execPath,
      [gsdTools, 'verify', 'drift', '--scope', '.', '--json', '--fail-on-score', '-1'],
      { cwd: tmpDir, timeout: 30000 }
    );
  } catch (e) {
    assert.fail(`--fail-on-score -1 must exit 0 (score always >= 0), got exit ${e.status}`);
  }
});

check('DRIFT-04: verify drift with unsafe scope emits skipped:true and exits 0', () => {
  let raw;
  try {
    raw = execFileSync(process.execPath,
      [gsdTools, 'verify', 'drift', '--scope', '../../../etc', '--json'],
      { cwd: tmpDir, timeout: 30000 }
    ).toString();
  } catch (e) {
    assert.fail(`verify drift with unsafe scope must exit 0, got exit ${e.status}`);
  }
  let emitted;
  try { emitted = JSON.parse(raw.trim()); } catch (e) {
    assert.fail(`not valid JSON: ${raw.slice(0,200)}`);
  }
  assert.strictEqual(emitted.skipped, true, 'unsafe scope must produce skipped:true');
});

// ─── DRIFT-04: scan.md documents --drift flag ─────────────────────────────────

check('DRIFT-04: scan.md documents the --drift flag and verify drift command', () => {
  const scanPath = path.resolve(__dirname, '../workflows/scan.md');
  const src = fs.readFileSync(scanPath, 'utf8');
  assert.ok(src.includes('--drift'), 'scan.md must document the --drift flag');
  assert.ok(src.includes('verify drift'), 'scan.md must reference the verify drift command');
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (e) {
  console.error('  warn: could not clean up temp dir:', e.message);
}

process.exitCode = 0; // Reset before footer
if (failures) {
  console.error(`\nverify-drift-integration: ${failures} failure(s)`);
  process.exit(1);
} else {
  console.log('\nverify-drift-integration: all checks passed');
}
