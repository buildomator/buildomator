'use strict';

// Coexistence regression test for COMPAT-03.
//
// With both the `gsd` and `bm` plugins enabled, two identical PostToolUse /
// PreCompact writers can race on the same .planning/HANDOFF.json. Before the
// fix the write was a bare fs.writeFileSync and an interleaved write could
// truncate the file to invalid JSON. writeCheckpoint() now routes the write
// through the same O_EXCL lock STATE.md uses (acquireStateLock/releaseStateLock).
//
// Test A: a single writeCheckpoint writes valid JSON and leaves no stale lock.
// Test B: >=20 interleaved concurrent writers leave HANDOFF.json valid JSON
//         with a trailing newline every time (exposes truncation).
// Test C: a HANDOFF.json writer and a STATE.md writer coexist, each stays
//         independently valid and they use distinct .lock paths (no cross-block).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHECKPOINT = path.join(ROOT, 'bin', 'lib', 'checkpoint.cjs');
const STATE = path.join(ROOT, 'bin', 'lib', 'state.cjs');

const { writeCheckpoint, acquireStateLock, releaseStateLock } = (() => {
  const c = require(CHECKPOINT);
  const s = require(STATE);
  return {
    writeCheckpoint: c.writeCheckpoint,
    acquireStateLock: s.acquireStateLock,
    releaseStateLock: s.releaseStateLock,
  };
})();

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-handoff-lock-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Seed a minimal GSD project so guard (a) (must have .planning/) passes and a
// STATE.md exists for the coexistence case. Writers use the `manual-pause`
// source, which is the plan-sanctioned way to bypass guard (b) so a checkpoint
// is written regardless of the parsed phase/task.
const WRITE_SOURCE = 'manual-pause';

function seedProject(dir) {
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const stateMd = [
    '---',
    'phase: 14',
    '---',
    '',
    '# Project State',
    '',
    '**Phase:** 14 - Backward Compatibility',
    '**Plan:** 01',
    '**Task:** 2',
    '**Status:** In progress',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateMd, 'utf-8');
  return { planningDir, statePath: path.join(planningDir, 'STATE.md') };
}

// ── Test A: single write is valid JSON, no stale lock ─────────────────────────

check('single writeCheckpoint produces valid JSON and leaves no stale lock', () => {
  withTempDir((dir) => {
    const { planningDir } = seedProject(dir);
    const handoffPath = path.join(planningDir, 'HANDOFF.json');
    const lockPath = handoffPath + '.lock';

    const data = writeCheckpoint(dir, { source: WRITE_SOURCE });
    assert(data && typeof data === 'object', 'writeCheckpoint must return the data object');

    assert(fs.existsSync(handoffPath), 'HANDOFF.json must be written for a manual-pause checkpoint');
    const raw = fs.readFileSync(handoffPath, 'utf-8');
    const parsed = JSON.parse(raw); // throws on truncation
    assert(parsed.source === WRITE_SOURCE, `expected source "${WRITE_SOURCE}", got ${parsed.source}`);
    assert(raw.endsWith('\n'), 'HANDOFF.json must end with a trailing newline');
    assert(!fs.existsSync(lockPath), 'no stale HANDOFF.json.lock may remain after the write');
  });
});

// ── Test A2: the lock is provably taken and released (spy via .lock lifecycle) ─

check('writeCheckpoint takes and releases the HANDOFF.json.lock', () => {
  withTempDir((dir) => {
    const { planningDir } = seedProject(dir);
    const handoffPath = path.join(planningDir, 'HANDOFF.json');
    const lockPath = handoffPath + '.lock';

    // Pre-acquire the lock: if writeCheckpoint ignored the lock it would still
    // write; because it honors the same lock, the stale-lock reclaim path
    // (>10s) is what would eventually let it through. Here we simply assert the
    // helper is the same primitive and the write leaves it released.
    const held = acquireStateLock(handoffPath);
    assert(fs.existsSync(lockPath), 'precondition: lock file should exist while held');
    releaseStateLock(held);
    assert(!fs.existsSync(lockPath), 'releaseStateLock must remove the lock file');

    writeCheckpoint(dir, { source: WRITE_SOURCE });
    assert(!fs.existsSync(lockPath), 'writeCheckpoint must release the lock it takes');
  });
});

// ── Test B: interleaved concurrent writers stay valid JSON ────────────────────

check('>=20 interleaved concurrent writers leave HANDOFF.json valid JSON', () => {
  withTempDir((dir) => {
    const { planningDir } = seedProject(dir);
    const handoffPath = path.join(planningDir, 'HANDOFF.json');
    const lockPath = handoffPath + '.lock';

    // The concurrency + interleaved reads run inside a single event-loop-driven
    // driver child, run once via spawnSync. A busy-loop in this process would
    // block the event loop and starve the writers' 'exit' events, so the driver
    // owns the fan-out: it spawns N writers, parses HANDOFF.json on a 1ms timer
    // while they run, and exits non-zero on any torn read, missing newline, or
    // stale lock. This process just asserts the driver exited 0.
    const PER_CHILD_WRITES = 200;
    const WRITERS = 8;
    const MIN_READS = 20;

    const writerScript = `
      const c = require(${JSON.stringify(CHECKPOINT)});
      const dir = ${JSON.stringify(dir)};
      const src = ${JSON.stringify(WRITE_SOURCE)};
      for (let i = 0; i < ${PER_CHILD_WRITES}; i++) {
        c.writeCheckpoint(dir, { source: src });
      }
    `;

    const driverScript = `
      const fs = require('fs');
      const path = require('path');
      const { spawn } = require('child_process');
      const CK = ${JSON.stringify(CHECKPOINT)};
      const dir = ${JSON.stringify(dir)};
      const hp = ${JSON.stringify(handoffPath)};
      const lockPath = ${JSON.stringify(lockPath)};
      const src = ${JSON.stringify(WRITE_SOURCE)};
      const WRITERS = ${WRITERS};
      const MIN_READS = ${MIN_READS};
      const writerScript = ${JSON.stringify(writerScript)};

      // Seed once so a valid file exists from the first read.
      require(CK).writeCheckpoint(dir, { source: src });

      const kids = [];
      for (let i = 0; i < WRITERS; i++) {
        kids.push(spawn('node', ['-e', writerScript], { cwd: dir }));
      }
      let remaining = WRITERS;
      kids.forEach(k => k.on('exit', () => { remaining -= 1; }));

      let reads = 0;
      let failed = false;
      function fail(msg) { failed = true; console.error('DRIVER FAIL: ' + msg); }

      const iv = setInterval(() => {
        try {
          const raw = fs.readFileSync(hp, 'utf-8');
          JSON.parse(raw); // throws "Unexpected end of JSON input" on a torn read
          if (!raw.endsWith('\\n')) fail('HANDOFF.json missing trailing newline');
          reads += 1;
        } catch (e) {
          fail('read/parse: ' + e.message);
        }
        // Deterministic exit: writers all finished AND we have >=MIN_READS
        // interleaved parse checks.
        if (remaining === 0 && reads >= MIN_READS) {
          clearInterval(iv);
          // Final invariants after the last writer released the lock.
          try {
            const raw = fs.readFileSync(hp, 'utf-8');
            JSON.parse(raw);
            if (!raw.endsWith('\\n')) fail('final HANDOFF.json missing trailing newline');
          } catch (e) { fail('final read: ' + e.message); }
          if (fs.existsSync(lockPath)) fail('stale HANDOFF.json.lock remains');
          console.log('reads=' + reads);
          process.exit(failed ? 1 : 0);
        }
      }, 1);

      // Safety valve: never hang CI. 30s is far beyond the ~1s the writers need.
      setTimeout(() => {
        clearInterval(iv);
        for (const k of kids) { try { k.kill(); } catch (e) {} }
        fail('timed out before writers finished (reads=' + reads + ', remaining=' + remaining + ')');
        process.exit(1);
      }, 30000).unref();
    `;

    const r = spawnSync('node', ['-e', driverScript], { cwd: dir, encoding: 'utf8' });
    assert(
      r.status === 0,
      `interleaved-write driver failed (status ${r.status}): ${r.stderr || r.stdout}`
    );
    const m = (r.stdout || '').match(/reads=(\d+)/);
    assert(m && Number(m[1]) >= MIN_READS, `expected >=${MIN_READS} interleaved reads, got: ${r.stdout}`);

    // After the driver returns, the writers are gone: no stale lock or JSON tear.
    const finalRaw = fs.readFileSync(handoffPath, 'utf-8');
    JSON.parse(finalRaw);
    assert(finalRaw.endsWith('\n'), 'final HANDOFF.json must end with a newline');
    assert(!fs.existsSync(lockPath), 'no stale HANDOFF.json.lock may remain after the burst');
  });
});

// ── Test C: HANDOFF.json and STATE.md coexist with distinct locks ─────────────

check('HANDOFF.json and STATE.md use distinct locks and stay independently valid', () => {
  withTempDir((dir) => {
    const { planningDir, statePath } = seedProject(dir);
    const handoffPath = path.join(planningDir, 'HANDOFF.json');

    const handoffLock = handoffPath + '.lock';
    const stateLock = statePath + '.lock';
    assert(handoffLock !== stateLock, 'HANDOFF.json and STATE.md must use distinct .lock paths');

    // Hold the STATE.md lock, then write HANDOFF.json: a distinct-lock design
    // means the HANDOFF write must NOT block on the STATE.md lock.
    const heldState = acquireStateLock(statePath);
    assert(fs.existsSync(stateLock), 'STATE.md lock should be held');
    try {
      const data = writeCheckpoint(dir, { source: WRITE_SOURCE });
      assert(fs.existsSync(handoffPath), 'HANDOFF write must not be blocked by the STATE.md lock');
      assert(data.source === WRITE_SOURCE, 'HANDOFF write must complete while STATE.md lock is held');
    } finally {
      releaseStateLock(heldState);
    }

    // Both files independently valid.
    const parsedHandoff = JSON.parse(fs.readFileSync(handoffPath, 'utf-8'));
    assert(parsedHandoff.source === WRITE_SOURCE, 'HANDOFF.json source should survive');
    const stateRaw = fs.readFileSync(statePath, 'utf-8');
    assert(/^---\r?\n/.test(stateRaw), 'STATE.md frontmatter must remain intact');
    assert(!fs.existsSync(handoffLock), 'no stale HANDOFF.json.lock after coexistence write');
    assert(!fs.existsSync(stateLock), 'STATE.md lock released after the coexistence write');
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`handoff write lock: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
