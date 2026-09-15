'use strict';

// Discrimination test for bin/maintenance/check-user-docs-prose.cjs.
// Drives the detector against a tempdir checkout (minimum viable repo layout
// for the detector's repo-root sanity check) with controlled README and
// CHANGELOG fixtures, then asserts pass/fail. Every dash in a fixture is a
// JavaScript backslash-u escape (U+2014 em, U+2013 en), never a literal
// character, so this test file itself stays free of dash characters.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DETECTOR = path.resolve(__dirname, '..', 'bin', 'maintenance', 'check-user-docs-prose.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const ZERO_BASELINE = {
  user_docs_prose: { em_en_dash: 0, marketing_words: 0, cliche_openers: 0 },
};

function withSandbox(setup, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-prose-test-'));
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

function writeZeroBaseline(dir) {
  fs.writeFileSync(
    path.join(dir, 'tests', 'drift-baseline.json'),
    JSON.stringify(ZERO_BASELINE, null, 2) + '\n'
  );
}

check('clean fixture + matching baseline: PASS exit 0', () => {
  withSandbox((dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), CLEAN_README);
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
    writeZeroBaseline(dir);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('PASS'), `expected PASS in stdout, got:\n${r.stdout}`);
  });
});

check('em-dash and en-dash beyond baseline: FAIL exit 1 naming em_en_dash', () => {
  withSandbox((dir) => {
    writeZeroBaseline(dir);
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + `\nA line ${EM} with a break, and a range ${EN} here.\n`
    );
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('FAIL'), `expected FAIL in stdout, got:\n${r.stdout}`);
    assert(r.stdout.includes('em_en_dash'), `expected em_en_dash in the regression line, got:\n${r.stdout}`);
  });
});

check('marketing filler words beyond baseline: FAIL exit 1 naming marketing_words', () => {
  withSandbox((dir) => {
    writeZeroBaseline(dir);
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + '\nBuild a seamless, robust workflow that leverages the tooling.\n'
    );
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('FAIL'), `expected FAIL in stdout, got:\n${r.stdout}`);
    assert(r.stdout.includes('marketing_words'), `expected marketing_words in the regression line, got:\n${r.stdout}`);
  });
});

check('cliche openers beyond baseline: FAIL exit 1 naming cliche_openers', () => {
  withSandbox((dir) => {
    writeZeroBaseline(dir);
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + '\nWhen it comes to setup, at the end of the day it just runs.\n'
    );
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CLEAN_CHANGELOG);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('FAIL'), `expected FAIL in stdout, got:\n${r.stdout}`);
    assert(r.stdout.includes('cliche_openers'), `expected cliche_openers in the regression line, got:\n${r.stdout}`);
  });
});

check('all offenders inside a fenced code block do NOT trigger (strip rule)', () => {
  withSandbox((dir) => {
    writeZeroBaseline(dir);
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      CLEAN_README + `\nExample:\n\n\`\`\`bash\n# seamless ${EM} leverage this snippet\necho hi\n\`\`\`\n`
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
    // Pre-existing baseline carries sibling sections that must survive.
    fs.writeFileSync(path.join(dir, 'tests', 'drift-baseline.json'), JSON.stringify({
      file_layout: { total_dangling: 100, has_plugin_counterpart: 100, genuinely_missing: 0 },
      user_docs_jargon: { planning_paths: 0, artifact_names: 0, plan_files: 0, generic_phase_num: 0 },
    }, null, 2) + '\n');
  }, (dir) => {
    const r = runDetector(dir, ['--write-baseline']);
    assert(r.status === 0, `expected exit 0 on --write-baseline, got ${r.status}\nstderr:\n${r.stderr}`);
    const updated = JSON.parse(fs.readFileSync(path.join(dir, 'tests', 'drift-baseline.json'), 'utf-8'));
    assert(updated.file_layout, 'expected file_layout section to be preserved');
    assert(updated.file_layout.total_dangling === 100, 'expected file_layout values to be untouched');
    assert(updated.user_docs_jargon, 'expected user_docs_jargon section to be preserved');
    assert(updated.user_docs_jargon.planning_paths === 0, 'expected user_docs_jargon values to be untouched');
    assert(updated.user_docs_prose, 'expected user_docs_prose section to be added');
    assert(typeof updated.user_docs_prose.em_en_dash === 'number', 'expected em_en_dash to be a number');
  });
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`user-docs-prose detector: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
