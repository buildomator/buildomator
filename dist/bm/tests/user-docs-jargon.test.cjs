'use strict';

// Discrimination test for bin/maintenance/check-user-docs-jargon.cjs.
// Drives the detector against a tempdir checkout (minimum viable repo layout
// for the detector's repo-root sanity check) with controlled README and
// CHANGELOG fixtures, then asserts pass/fail.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DETECTOR = path.resolve(__dirname, '..', 'bin', 'maintenance', 'check-user-docs-jargon.cjs');

function withSandbox(setup, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-jargon-test-'));
  // The detector requires .git/ and skills/ at repo root to confirm it's not
  // running from a partial checkout. Create both as empty markers.
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  setup(dir);
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runDetector(cwd, flags) {
  return spawnSync('node', [DETECTOR, ...(flags || [])], {
    cwd,
    encoding: 'utf-8',
    timeout: 5000,
  });
}

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const CLEAN_README = '# My Project\n\nThis project does some stuff.\n';
const CLEAN_CHANGELOG = '# Changelog\n\n## [1.0.0]\n\nInitial release.\n';

check('clean fixture + matching baseline: PASS exit 0', () => {
  withSandbox((dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), CLEAN_README);
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
    // Write a zero baseline so the ratchet has a reference point.
    fs.writeFileSync(path.join(dir, 'tests', 'drift-baseline.json'), JSON.stringify({
      user_docs_jargon: {
        planning_paths: 0,
        artifact_names: 0,
        plan_files: 0,
        generic_phase_num: 0,
      },
    }, null, 2) + '\n');
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('PASS'), `expected PASS in stdout, got:\n${r.stdout}`);
  });
});

check('inject .planning/ ref into README beyond baseline: FAIL exit 1', () => {
  withSandbox((dir) => {
    // Baseline declares zero of everything.
    fs.writeFileSync(path.join(dir, 'tests', 'drift-baseline.json'), JSON.stringify({
      user_docs_jargon: {
        planning_paths: 0,
        artifact_names: 0,
        plan_files: 0,
        generic_phase_num: 0,
      },
    }, null, 2) + '\n');
    // README has TWO planning paths (clearly above baseline 0).
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + '\nState lives in `.planning/STATE.md`. Plans in `.planning/phases/`.\n'
    );
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1 (ratchet failure), got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('FAIL'), `expected FAIL in stdout, got:\n${r.stdout}`);
    assert(
      r.stdout.includes('planning_paths') || r.stdout.includes('artifact_names'),
      `expected the regression line to mention the offending category, got:\n${r.stdout}`
    );
  });
});

check('jargon inside fenced code block does NOT trigger (strip rule)', () => {
  withSandbox((dir) => {
    fs.writeFileSync(path.join(dir, 'tests', 'drift-baseline.json'), JSON.stringify({
      user_docs_jargon: {
        planning_paths: 0,
        artifact_names: 0,
        plan_files: 0,
        generic_phase_num: 0,
      },
    }, null, 2) + '\n');
    // The .planning/ reference is inside a code block, so the stripper
    // should remove it before counting.
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + '\nExample command:\n\n```bash\nls .planning/STATE.md\n```\n'
    );
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0 (code-block-stripped), got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
  });
});

check('writes baseline section without overwriting other baseline keys', () => {
  withSandbox((dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), CLEAN_README);
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
    // Pre-existing baseline has a file_layout section (the sibling detector).
    fs.writeFileSync(path.join(dir, 'tests', 'drift-baseline.json'), JSON.stringify({
      file_layout: { total_dangling: 100, has_plugin_counterpart: 100, genuinely_missing: 0 },
    }, null, 2) + '\n');
  }, (dir) => {
    const r = runDetector(dir, ['--write-baseline']);
    assert(r.status === 0, `expected exit 0 on --write-baseline, got ${r.status}\nstderr:\n${r.stderr}`);
    const updated = JSON.parse(fs.readFileSync(path.join(dir, 'tests', 'drift-baseline.json'), 'utf-8'));
    assert(updated.file_layout, 'expected file_layout section to be preserved');
    assert(updated.file_layout.total_dangling === 100, 'expected file_layout values to be untouched');
    assert(updated.user_docs_jargon, 'expected user_docs_jargon section to be added');
    assert(typeof updated.user_docs_jargon.planning_paths === 'number', 'expected planning_paths to be a number');
  });
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`user-docs-jargon detector: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
