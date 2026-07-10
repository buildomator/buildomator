#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/bm-transform.cjs, the pure string helpers that make the
// generated bm package self-consistent:
//   rewriteCommandRefs  -- every bm: namespace prefix (slash-commands, agent refs,
//                          frontmatter names) becomes bm:, plus the /bm[:-] SDK
//                          headless-sanitizer literal becomes /bm[:-]; gsd:// URIs spared
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

check('rewriteCommandRefs rewrites /bm:plan-phase', () => {
  assert.strictEqual(rewriteCommandRefs('run /bm:plan-phase now'), 'run /bm:plan-phase now');
});

// The four commands the old skill-name alternation under-covered (RESEARCH F-1).
check('rewriteCommandRefs rewrites /bm:capture', () => {
  assert.strictEqual(rewriteCommandRefs('use /bm:capture'), 'use /bm:capture');
});

check('rewriteCommandRefs rewrites /bm:local-patches', () => {
  assert.strictEqual(rewriteCommandRefs('use /bm:local-patches'), 'use /bm:local-patches');
});

check('rewriteCommandRefs rewrites /bm:edit-phase', () => {
  assert.strictEqual(rewriteCommandRefs('use /bm:edit-phase'), 'use /bm:edit-phase');
});

check('rewriteCommandRefs rewrites /bm:extract-learnings', () => {
  assert.strictEqual(rewriteCommandRefs('use /bm:extract-learnings'), 'use /bm:extract-learnings');
});

// ─── rewriteCommandRefs: boundary contexts ───────────────────────────────────

check('rewriteCommandRefs rewrites at string start', () => {
  assert.strictEqual(rewriteCommandRefs('/bm:next'), '/bm:next');
});

check('rewriteCommandRefs rewrites after whitespace', () => {
  assert.strictEqual(rewriteCommandRefs('then /bm:next'), 'then /bm:next');
});

check('rewriteCommandRefs rewrites after a backtick', () => {
  assert.strictEqual(rewriteCommandRefs('`/bm:next`'), '`/bm:next`');
});

check('rewriteCommandRefs rewrites after a paren', () => {
  assert.strictEqual(rewriteCommandRefs('(/bm:next)'), '(/bm:next)');
});

check('rewriteCommandRefs rewrites every occurrence on a line', () => {
  assert.strictEqual(
    rewriteCommandRefs('/bm:plan-phase then /bm:execute-phase'),
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

check('rewriteCommandRefs rewrites a /bm: path segment (plugin-owned artifact path)', () => {
  assert.strictEqual(
    rewriteCommandRefs('$HOME/.config/kilo/bm:local-patches'),
    '$HOME/.config/kilo/bm:local-patches',
  );
});

check('rewriteCommandRefs rewrites /bm: adjacent to an escaped newline', () => {
  assert.strictEqual(rewriteCommandRefs('Run this.\\n/bm:analyze --deep'), 'Run this.\\n/bm:analyze --deep');
});

check('rewriteCommandRefs is idempotent', () => {
  const once = rewriteCommandRefs('run /bm:plan-phase and /bm:capture');
  assert.strictEqual(rewriteCommandRefs(once), once);
});

// ─── rewriteCommandRefs: broadened namespace scope (D-08) ────────────────────

check('rewriteCommandRefs flips a subagent_type agent ref, sparing the dash name', () => {
  assert.strictEqual(
    rewriteCommandRefs('subagent_type=bm:gsd-executor'),
    'subagent_type=bm:gsd-executor',
  );
});

check('rewriteCommandRefs flips a type= agent ref', () => {
  assert.strictEqual(rewriteCommandRefs('type: bm:gsd-planner'), 'type: bm:gsd-planner');
});

check('rewriteCommandRefs flips a frontmatter name: bm:<x>', () => {
  assert.strictEqual(rewriteCommandRefs('name: bm:plan-phase'), 'name: bm:plan-phase');
});

check('rewriteCommandRefs flips the SDK regex token /bm:\\S+ so zero-leak holds', () => {
  assert.strictEqual(rewriteCommandRefs('/bm:\\S+'), '/bm:\\S+');
});

check('rewriteCommandRefs spares gsd:// even without a leading slash (real URI)', () => {
  assert.strictEqual(rewriteCommandRefs('gsd://config'), 'gsd://config');
  assert.strictEqual(rewriteCommandRefs('uri: gsd://phase/3'), 'uri: gsd://phase/3');
});

// ─── rewriteCommandRefs: SDK headless-sanitizer literal (CR-02) ──────────────

check('rewriteCommandRefs rewrites the /bm[:-] sanitizer literal to /bm[:-]', () => {
  const out = rewriteCommandRefs('const RE = /\\n\\s*\\/bm[:-]\\S+/g;');
  assert.ok(out.includes('/bm[:-]'), 'sanitizer literal must become /bm[:-]');
  assert.ok(!out.includes('/bm[:-]'), 'no /bm[:-] literal may remain');
});

check('rewriteCommandRefs handles the /bm: command and the /bm[:-] literal together', () => {
  const out = rewriteCommandRefs('run /bm:next; strip /bm[:-] lines');
  assert.strictEqual(out, 'run /bm:next; strip /bm[:-] lines');
});

check('rewriteCommandRefs is idempotent across the broadened scope', () => {
  const once = rewriteCommandRefs('subagent_type=bm:gsd-executor and /bm:next and /bm[:-]');
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
