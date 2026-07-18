'use strict';

// Spec for config-set value coercion in bin/lib/config.cjs (cmdConfigSet).
//
// Two coercion hazards are guarded:
//   - "Infinity"/"-Infinity" must stay literal strings. Number('Infinity') is a
//     valid number, but JSON.stringify writes it as null, silently losing data.
//   - Free-string keys (e.g. project_code) must keep numeric-looking values
//     verbatim, so "007" stays "007" and never becomes the number 7.
//   - Control: a genuine numeric value on an ordinary key still coerces.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

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

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfgset-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function configSet(root, key, value) {
  execFileSync('node', [GSD_TOOLS, 'config-set', key, value], { cwd: root, stdio: 'pipe' });
}

function readConfig(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.planning', 'config.json'), 'utf8'));
}

check('workflow.inline_plan_threshold "Infinity" persists as the string "Infinity", not null', () => {
  withProject((root) => {
    configSet(root, 'workflow.inline_plan_threshold', 'Infinity');
    const cfg = readConfig(root);
    assert(cfg.workflow && cfg.workflow.inline_plan_threshold === 'Infinity',
      `expected string "Infinity", got ${JSON.stringify(cfg.workflow && cfg.workflow.inline_plan_threshold)}`);
  });
});

check('workflow.inline_plan_threshold "-Infinity" persists as the string "-Infinity"', () => {
  withProject((root) => {
    configSet(root, 'workflow.inline_plan_threshold', '-Infinity');
    const cfg = readConfig(root);
    assert(cfg.workflow && cfg.workflow.inline_plan_threshold === '-Infinity',
      `expected string "-Infinity", got ${JSON.stringify(cfg.workflow && cfg.workflow.inline_plan_threshold)}`);
  });
});

check('project_code "007" persists as the string "007"', () => {
  withProject((root) => {
    configSet(root, 'project_code', '007');
    const cfg = readConfig(root);
    assert(cfg.project_code === '007', `expected string "007", got ${JSON.stringify(cfg.project_code)}`);
  });
});

check('control: a genuine numeric value still coerces to a number', () => {
  withProject((root) => {
    configSet(root, 'learnings.max_inject', '5');
    const cfg = readConfig(root);
    assert(cfg.learnings && cfg.learnings.max_inject === 5,
      `expected number 5, got ${JSON.stringify(cfg.learnings && cfg.learnings.max_inject)}`);
  });
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`config-set coercion: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
