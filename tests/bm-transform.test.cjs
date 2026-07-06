#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/bm-transform.cjs, the pure string helpers that make the
// generated bm package self-consistent:
//   rewriteCommandRefs  -- /gsd:<skill> command self-refs become /bm:<skill>
//   stampHookFallback   -- the hook cache-fallback plugin segment becomes bm
//
// Zero-dep harness mirroring tests/build-bm-drift.test.cjs: node:assert, a bare
// check(name, fn) runner, a failure counter, and a process.exit(1) footer. Run
// directly via `node tests/bm-transform.test.cjs`.

const assert = require('node:assert');

const { rewriteCommandRefs, stampHookFallback } = require('../bin/lib/bm-transform.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── rewriteCommandRefs: full command coverage ───────────────────────────────

check('rewriteCommandRefs rewrites /gsd:plan-phase', () => {
  assert.strictEqual(rewriteCommandRefs('run /gsd:plan-phase now'), 'run /bm:plan-phase now');
});

// The four commands the old skill-name alternation under-covered (RESEARCH F-1).
check('rewriteCommandRefs rewrites /gsd:capture', () => {
  assert.strictEqual(rewriteCommandRefs('use /gsd:capture'), 'use /bm:capture');
});

check('rewriteCommandRefs rewrites /gsd:local-patches', () => {
  assert.strictEqual(rewriteCommandRefs('use /gsd:local-patches'), 'use /bm:local-patches');
});

check('rewriteCommandRefs rewrites /gsd:edit-phase', () => {
  assert.strictEqual(rewriteCommandRefs('use /gsd:edit-phase'), 'use /bm:edit-phase');
});

check('rewriteCommandRefs rewrites /gsd:extract-learnings', () => {
  assert.strictEqual(rewriteCommandRefs('use /gsd:extract-learnings'), 'use /bm:extract-learnings');
});

// ─── rewriteCommandRefs: boundary contexts ───────────────────────────────────

check('rewriteCommandRefs rewrites at string start', () => {
  assert.strictEqual(rewriteCommandRefs('/gsd:next'), '/bm:next');
});

check('rewriteCommandRefs rewrites after whitespace', () => {
  assert.strictEqual(rewriteCommandRefs('then /gsd:next'), 'then /bm:next');
});

check('rewriteCommandRefs rewrites after a backtick', () => {
  assert.strictEqual(rewriteCommandRefs('`/gsd:next`'), '`/bm:next`');
});

check('rewriteCommandRefs rewrites after a paren', () => {
  assert.strictEqual(rewriteCommandRefs('(/gsd:next)'), '(/bm:next)');
});

check('rewriteCommandRefs rewrites every occurrence on a line', () => {
  assert.strictEqual(
    rewriteCommandRefs('/gsd:plan-phase then /gsd:execute-phase'),
    '/bm:plan-phase then /bm:execute-phase',
  );
});

// ─── rewriteCommandRefs: sparing (identity strings, not command self-refs) ────

check('rewriteCommandRefs spares gsd://config and gsd://state (no leading slash)', () => {
  assert.strictEqual(rewriteCommandRefs('gsd://config'), 'gsd://config');
  assert.strictEqual(rewriteCommandRefs('read gsd://state now'), 'read gsd://state now');
});

check('rewriteCommandRefs spares gsd-tools.cjs, gsd-sdk, gsd-session-state.sh', () => {
  assert.strictEqual(rewriteCommandRefs('bin/gsd-tools.cjs'), 'bin/gsd-tools.cjs');
  assert.strictEqual(rewriteCommandRefs('call gsd-sdk query'), 'call gsd-sdk query');
  assert.strictEqual(rewriteCommandRefs('gsd-session-state.sh'), 'gsd-session-state.sh');
});

check('rewriteCommandRefs spares the cache path literal cache/gsd-plugin/gsd', () => {
  assert.strictEqual(rewriteCommandRefs('cache/gsd-plugin/gsd'), 'cache/gsd-plugin/gsd');
});

check('rewriteCommandRefs spares a bare gsd: with an identifier char before it', () => {
  assert.strictEqual(rewriteCommandRefs('abcgsd:foo'), 'abcgsd:foo');
});

check('rewriteCommandRefs rewrites a /gsd: path segment (plugin-owned artifact path)', () => {
  assert.strictEqual(
    rewriteCommandRefs('$HOME/.config/kilo/gsd:local-patches'),
    '$HOME/.config/kilo/bm:local-patches',
  );
});

check('rewriteCommandRefs rewrites /gsd: adjacent to an escaped newline', () => {
  assert.strictEqual(rewriteCommandRefs('Run this.\\n/gsd:analyze --deep'), 'Run this.\\n/bm:analyze --deep');
});

check('rewriteCommandRefs is idempotent', () => {
  const once = rewriteCommandRefs('run /gsd:plan-phase and /gsd:capture');
  assert.strictEqual(rewriteCommandRefs(once), once);
});

// ─── stampHookFallback: hooks.json resolver line (slash form) ────────────────

const HOOKS_RESOLVER_LINE =
  "\"command\": \"node -e \\\"const o=require('os'),p=require('path');" +
  "const d=p.join(o.homedir(),'.claude/plugins/cache/gsd-plugin/gsd');" +
  "if(process.env.CLAUDE_PLUGIN_ROOT)require('fs');" +
  "process.stderr.write('GSD: plugin path stale');" +
  "require('bin/gsd-tools.cjs');require('run-bash-hook.cjs');" +
  "\\\" gsd-session-state.sh gsd-validate-commit.sh\"";

check('stampHookFallback stamps the hooks.json slash-form literal, sparing identity tokens', () => {
  const out = stampHookFallback(HOOKS_RESOLVER_LINE);
  assert.ok(out.includes('cache/gsd-plugin/bm'), 'plugin segment must become bm');
  assert.ok(!out.includes('cache/gsd-plugin/gsd'), 'no gsd-form cache literal may remain');
  assert.ok(out.includes('gsd-tools.cjs'), 'gsd-tools.cjs must survive');
  assert.ok(out.includes('run-bash-hook.cjs'), 'run-bash-hook.cjs must survive');
  assert.ok(out.includes('GSD: plugin path stale'), 'GSD: stderr prefix must survive');
  assert.ok(out.includes('gsd-session-state.sh'), '.sh filename args must survive');
  assert.ok(out.includes('gsd-validate-commit.sh'), '.sh filename args must survive');
});

check('stampHookFallback replaces all N slash-form occurrences', () => {
  const text = 'a cache/gsd-plugin/gsd b cache/gsd-plugin/gsd c';
  const out = stampHookFallback(text);
  assert.strictEqual((out.match(/cache\/gsd-plugin\/bm/g) || []).length, 2);
  assert.strictEqual((out.match(/cache\/gsd-plugin\/gsd/g) || []).length, 0);
});

// ─── stampHookFallback: run-bash-hook.cjs resolveCandidates (quoted form) ────

const RUN_BASH_HOOK_LINE =
  "  const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'gsd-plugin', 'gsd');";

check('stampHookFallback stamps the resolveCandidates quoted argument pair', () => {
  const out = stampHookFallback(RUN_BASH_HOOK_LINE);
  assert.ok(out.includes("'gsd-plugin', 'bm'"), 'quoted plugin segment must become bm');
  assert.ok(!out.includes("'gsd-plugin', 'gsd'"), 'no gsd-form quoted pair may remain');
  // The marketplace segment 'gsd-plugin' must still be present.
  assert.ok(out.includes("'gsd-plugin'"), "marketplace segment 'gsd-plugin' must survive");
  assert.ok(out.includes('os.homedir()'), 'os.homedir() call must survive');
});

// ─── stampHookFallback: check-plugin-update.sh PLUGIN_CACHE line ─────────────

const CHECK_UPDATE_SNIPPET =
  'REPO="jnuyens/gsd-plugin"\n' +
  'PLUGIN_CACHE="$HOME/.claude/plugins/cache/gsd-plugin/gsd"\n' +
  'NOTIFIED_FILE="$HOME/.gsd-plugin-last-notified"';

check('stampHookFallback stamps PLUGIN_CACHE, sparing repo and notified-file identifiers', () => {
  const out = stampHookFallback(CHECK_UPDATE_SNIPPET);
  assert.ok(out.includes('cache/gsd-plugin/bm'), 'PLUGIN_CACHE must point at the bm cache dir');
  assert.ok(!out.includes('cache/gsd-plugin/gsd'), 'no gsd-form cache literal may remain');
  assert.ok(out.includes('jnuyens/gsd-plugin'), 'REPO identifier must survive');
  assert.ok(out.includes('.gsd-plugin-last-notified'), 'NOTIFIED_FILE name must survive');
});

// ─── stampHookFallback: idempotence for both shapes ──────────────────────────

check('stampHookFallback is idempotent for the slash form', () => {
  const once = stampHookFallback(HOOKS_RESOLVER_LINE);
  assert.strictEqual(stampHookFallback(once), once);
});

check('stampHookFallback is idempotent for the quoted form', () => {
  const once = stampHookFallback(RUN_BASH_HOOK_LINE);
  assert.strictEqual(stampHookFallback(once), once);
});

// ─── footer ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll bm-transform tests passed');
