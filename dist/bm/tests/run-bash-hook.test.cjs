#!/usr/bin/env node
/**
 * Isolation test for hooks/run-bash-hook.cjs (issue #16).
 *
 * Tests the retry logic without a real Windows+AV environment by pointing the
 * launcher at synthetic fake-hook scripts.
 *
 * Run: node tests/run-bash-hook.test.cjs
 *
 * Test A: fork-failure then success on retry
 *   Fake hook prints the Cygwin fork-failure signature to stderr and exits 1
 *   on the first invocation, then succeeds (exit 0) on the second. Assert that
 *   the launcher retried and ultimately returned exit 0.
 *
 * Test B: exit 2 with non-fork message (validate-commit block must not retry)
 *   Fake hook prints an ordinary error to stderr and exits 2. Assert that the
 *   launcher does NOT retry and propagates exit 2 unchanged. This validates
 *   that gsd-validate-commit.sh commit-blocking is fully preserved.
 *
 * Test C: success on first try (no retry)
 *   Fake hook exits 0. Assert a single invocation and exit 0.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const LAUNCHER = path.join(__dirname, '..', 'hooks', 'run-bash-hook.cjs');
const SCRATCHPAD = process.env.GSD_TEST_SCRATCHPAD ||
  path.join(os.tmpdir(), 'run-bash-hook-test-' + process.pid);

fs.mkdirSync(SCRATCHPAD, { recursive: true });

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error('  FAIL: ' + msg);
    failed++;
  } else {
    console.log('  PASS: ' + msg);
    passed++;
  }
}

/**
 * Run the launcher against a named fake hook and return { code, stderr }.
 * CLAUDE_PLUGIN_ROOT is set to the scratchpad so the launcher finds the fake
 * hook there without touching the real cache.
 */
function runLauncher(hookName, env) {
  const result = cp.spawnSync(process.execPath, [LAUNCHER, hookName], {
    env: Object.assign({}, process.env, { CLAUDE_PLUGIN_ROOT: SCRATCHPAD }, env),
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  const stderr = result.stderr ? result.stderr.toString() : '';
  return { code: result.status !== null ? result.status : 1, stderr };
}

/**
 * Write a bash script into the scratchpad's hooks/ directory.
 */
function writeFakeHook(name, content) {
  const dir = path.join(SCRATCHPAD, 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, { mode: 0o755 });
  return p;
}

// ---------------------------------------------------------------------------
// Test A: Cygwin fork-failure on first run, success on retry
// ---------------------------------------------------------------------------
console.log('\nTest A: fork-failure retry');

(function testA() {
  const counterFile = path.join(SCRATCHPAD, 'testA-counter');
  fs.writeFileSync(counterFile, '0');

  // Bash script: reads and increments counter; on first call emits fork-failure
  // signature and exits 1, on subsequent calls exits 0.
  const script = `#!/usr/bin/env bash
COUNTER_FILE="${counterFile}"
COUNT=$(cat "$COUNTER_FILE")
NEW_COUNT=$((COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"
if [ "$COUNT" -eq 0 ]; then
  echo "fatal error - add_item failed, fork: cygheap allocation failed" >&2
  exit 1
fi
exit 0
`;
  writeFakeHook('fake-fork-failure.sh', script);

  const { code, stderr } = runLauncher('fake-fork-failure.sh');

  const finalCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);

  assert(code === 0, 'launcher ultimately exited 0 after retry (got ' + code + ')');
  assert(finalCount === 2, 'hook was called exactly twice (first run + one retry), got ' + finalCount);
  assert(/retrying/i.test(stderr), 'launcher emitted a retry notice on stderr');
})();

// ---------------------------------------------------------------------------
// Test B: exit 2 with non-fork message must NOT retry (commit-block preserved)
// ---------------------------------------------------------------------------
console.log('\nTest B: exit-2 non-fork message, no retry');

(function testB() {
  const counterFile = path.join(SCRATCHPAD, 'testB-counter');
  fs.writeFileSync(counterFile, '0');

  const script = `#!/usr/bin/env bash
COUNTER_FILE="${counterFile}"
COUNT=$(cat "$COUNTER_FILE")
NEW_COUNT=$((COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"
echo "commit message does not match required format" >&2
exit 2
`;
  writeFakeHook('fake-exit2.sh', script);

  const { code, stderr } = runLauncher('fake-exit2.sh');

  const finalCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);

  assert(code === 2, 'launcher propagated exit 2 unchanged (got ' + code + ')');
  assert(finalCount === 1, 'hook was called exactly once, no retry (got ' + finalCount + ')');
  assert(!/retrying/i.test(stderr), 'launcher did NOT emit a retry notice');
})();

// ---------------------------------------------------------------------------
// Test C: success on first try, no retry
// ---------------------------------------------------------------------------
console.log('\nTest C: success on first try, no retry');

(function testC() {
  const counterFile = path.join(SCRATCHPAD, 'testC-counter');
  fs.writeFileSync(counterFile, '0');

  const script = `#!/usr/bin/env bash
COUNTER_FILE="${counterFile}"
COUNT=$(cat "$COUNTER_FILE")
NEW_COUNT=$((COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"
exit 0
`;
  writeFakeHook('fake-success.sh', script);

  const { code, stderr } = runLauncher('fake-success.sh');

  const finalCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);

  assert(code === 0, 'launcher exited 0 on first-try success (got ' + code + ')');
  assert(finalCount === 1, 'hook was called exactly once (got ' + finalCount + ')');
  assert(!/retrying/i.test(stderr), 'launcher did NOT emit a retry notice');
})();

// ---------------------------------------------------------------------------
// Cleanup and summary
// ---------------------------------------------------------------------------
try { fs.rmSync(SCRATCHPAD, { recursive: true, force: true }); } catch (_) {}

console.log('\n' + (failed === 0 ? 'ALL PASS' : 'FAILURES: ' + failed) +
  ' (' + passed + ' checks passed, ' + failed + ' failed)');
process.exit(failed > 0 ? 1 : 0);
