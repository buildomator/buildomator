'use strict';

// Regression test for the writeCheckpoint() guards added to fix issue #17.
//
// writeCheckpoint() must no-op (never create files/dirs) when:
//   (a) .planning/ does not exist -- the cwd is not a GSD project
//   (b) the checkpoint data is trivial (phase:null, task:null) for an
//       automatic source (auto-postool, auto-compact)
//
// And it must still write when:
//   (c) there is an active phase/task and .planning/ exists

const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeCheckpoint } = require(path.join(__dirname, '..', 'bin', 'lib', 'checkpoint.cjs'));

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

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-checkpoint-guard-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── (a) No .planning/ dir -> no-op, directory must not be created ────────────

check('no-op when .planning/ does not exist (non-GSD dir)', () => {
  withTempDir((dir) => {
    const planningDir = path.join(dir, '.planning');
    assert(!fs.existsSync(planningDir), 'precondition: .planning must not exist');

    writeCheckpoint(dir, { source: 'auto-postool' });

    assert(
      !fs.existsSync(planningDir),
      '.planning/ must not be created for a non-GSD directory'
    );
    assert(
      !fs.existsSync(path.join(planningDir, 'HANDOFF.json')),
      'HANDOFF.json must not be created for a non-GSD directory'
    );
  });
});

check('no-op when .planning/ does not exist -- auto-compact source', () => {
  withTempDir((dir) => {
    writeCheckpoint(dir, { source: 'auto-compact' });
    assert(
      !fs.existsSync(path.join(dir, '.planning')),
      '.planning/ must not be created by auto-compact in a non-GSD directory'
    );
  });
});

// ── (b) Trivial checkpoint (phase:null, task:null) -> no-op for auto sources ─

check('no-op when checkpoint is trivial for auto-postool source', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.planning'));
    // No STATE.md -> generateCheckpoint returns phase:null, task:null

    const handoffPath = path.join(dir, '.planning', 'HANDOFF.json');
    writeCheckpoint(dir, { source: 'auto-postool' });

    assert(
      !fs.existsSync(handoffPath),
      'HANDOFF.json must not be written for a trivial auto-postool checkpoint'
    );
  });
});

check('no-op when checkpoint is trivial for auto-compact source', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.planning'));

    const handoffPath = path.join(dir, '.planning', 'HANDOFF.json');
    writeCheckpoint(dir, { source: 'auto-compact' });

    assert(
      !fs.existsSync(handoffPath),
      'HANDOFF.json must not be written for a trivial auto-compact checkpoint'
    );
  });
});

check('trivial guard does NOT block manual-pause source', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.planning'));

    const handoffPath = path.join(dir, '.planning', 'HANDOFF.json');
    writeCheckpoint(dir, { source: 'manual-pause' });

    assert(
      fs.existsSync(handoffPath),
      'HANDOFF.json should be written for manual-pause even when checkpoint is trivial'
    );
    const parsed = JSON.parse(fs.readFileSync(handoffPath, 'utf-8'));
    assert(parsed.source === 'manual-pause', 'source field should be manual-pause');
  });
});

check('trivial guard preserves existing hand-authored HANDOFF.json', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.planning'));

    const handoffPath = path.join(dir, '.planning', 'HANDOFF.json');
    const handAuthored = JSON.stringify({ custom: 'content', phase: '5' }, null, 2);
    fs.writeFileSync(handoffPath, handAuthored);

    writeCheckpoint(dir, { source: 'auto-postool' });

    const after = fs.readFileSync(handoffPath, 'utf-8');
    assert(
      after.trim() === handAuthored.trim(),
      'auto-postool must not overwrite an existing HANDOFF.json with a trivial skeleton'
    );
  });
});

// ── (c) .planning/ exists and source is not automatic -> writes normally ──────

check('writes HANDOFF.json when .planning/ exists and source is manual-pause', () => {
  // Guard (b) only applies to automatic sources (auto-postool, auto-compact).
  // manual-pause must always write so /bm:pause-work works in idle projects.
  withTempDir((dir) => {
    const planningDir = path.join(dir, '.planning');
    fs.mkdirSync(planningDir);

    const handoffPath = path.join(planningDir, 'HANDOFF.json');
    writeCheckpoint(dir, { source: 'manual-pause' });

    assert(
      fs.existsSync(handoffPath),
      'HANDOFF.json should be written for manual-pause when .planning/ exists'
    );
    const parsed = JSON.parse(fs.readFileSync(handoffPath, 'utf-8'));
    assert(parsed.source === 'manual-pause', `expected source "manual-pause", got: ${parsed.source}`);
    assert(parsed.version === '1.0', `expected version "1.0", got: ${parsed.version}`);
  });
});

check('no-op for auto-postool but writes for manual-pause in same directory', () => {
  // Demonstrates that guard (b) is source-specific: auto-postool skips, manual-pause writes.
  withTempDir((dir) => {
    const planningDir = path.join(dir, '.planning');
    fs.mkdirSync(planningDir);
    const handoffPath = path.join(planningDir, 'HANDOFF.json');

    writeCheckpoint(dir, { source: 'auto-postool' });
    assert(!fs.existsSync(handoffPath), 'auto-postool must not write trivial checkpoint');

    writeCheckpoint(dir, { source: 'manual-pause' });
    assert(fs.existsSync(handoffPath), 'manual-pause must write even in idle project');
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`checkpoint write guards: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
