#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/bm-transform.cjs, the pure string helpers that make the
// generated bm package self-consistent:
//   rewriteCommandRefs  -- every gsd: namespace prefix (slash-commands, agent refs,
//                          frontmatter names) becomes bm:, plus the /gsd[:-] SDK
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

// ─── rewriteCommandRefs: broadened namespace scope (D-08) ────────────────────

check('rewriteCommandRefs flips a subagent_type agent ref, sparing the dash name', () => {
  assert.strictEqual(
    rewriteCommandRefs('subagent_type=gsd:gsd-executor'),
    'subagent_type=bm:gsd-executor',
  );
});

check('rewriteCommandRefs flips a type= agent ref', () => {
  assert.strictEqual(rewriteCommandRefs('type: gsd:gsd-planner'), 'type: bm:gsd-planner');
});

check('rewriteCommandRefs flips a frontmatter name: gsd:<x>', () => {
  assert.strictEqual(rewriteCommandRefs('name: gsd:plan-phase'), 'name: bm:plan-phase');
});

check('rewriteCommandRefs flips the SDK regex token /gsd:\\S+ so zero-leak holds', () => {
  assert.strictEqual(rewriteCommandRefs('/gsd:\\S+'), '/bm:\\S+');
});

check('rewriteCommandRefs spares gsd:// even without a leading slash (real URI)', () => {
  assert.strictEqual(rewriteCommandRefs('gsd://config'), 'gsd://config');
  assert.strictEqual(rewriteCommandRefs('uri: gsd://phase/3'), 'uri: gsd://phase/3');
});

// ─── rewriteCommandRefs: SDK headless-sanitizer literal (CR-02) ──────────────

check('rewriteCommandRefs rewrites the /gsd[:-] sanitizer literal to /bm[:-]', () => {
  const out = rewriteCommandRefs('const RE = /\\n\\s*\\/gsd[:-]\\S+/g;');
  assert.ok(out.includes('/bm[:-]'), 'sanitizer literal must become /bm[:-]');
  assert.ok(!out.includes('/gsd[:-]'), 'no /gsd[:-] literal may remain');
});

check('rewriteCommandRefs handles the /gsd: command and the /gsd[:-] literal together', () => {
  const out = rewriteCommandRefs('run /gsd:next; strip /gsd[:-] lines');
  assert.strictEqual(out, 'run /bm:next; strip /bm[:-] lines');
});

check('rewriteCommandRefs is idempotent across the broadened scope', () => {
  const once = rewriteCommandRefs('subagent_type=gsd:gsd-executor and /gsd:next and /gsd[:-]');
  assert.strictEqual(rewriteCommandRefs(once), once);
});

// ─── stampHookFallback: hooks.json inline resolver (g='gsd' assignment) ──────

// The marketplace segment is a runtime readdirSync wildcard now; the ONLY
// plugin-name literal in each inline resolver is the assignment g='gsd'.
const HOOKS_RESOLVER_LINE =
  "\"command\": \"node -e \\\"const f=require('fs'),p=require('path'),o=require('os');" +
  "const b=p.join(o.homedir(),'.claude/plugins/cache'),g='gsd',t=[];" +
  "for(const m of f.readdirSync(b))t.push(p.join(b,m,g,'bin/gsd-tools.cjs'));" +
  "process.stderr.write('GSD: plugin path stale');" +
  "\\\" hook session-start\"";

check('stampHookFallback flips the hooks.json g=gsd assignment, sparing identity tokens', () => {
  const out = stampHookFallback(HOOKS_RESOLVER_LINE);
  assert.ok(out.includes("g='bm'"), "the plugin-name assignment must become g='bm'");
  assert.ok(!out.includes("g='gsd'"), "no g='gsd' assignment may remain");
  assert.ok(out.includes('gsd-tools.cjs'), 'gsd-tools.cjs must survive');
  assert.ok(out.includes('GSD: plugin path stale'), 'GSD: stderr prefix must survive');
  assert.ok(out.includes("'.claude/plugins/cache'"), 'the marketplace-root path must survive');
});

check('stampHookFallback replaces every g=gsd occurrence (17-resolver shape)', () => {
  const text = "x g='gsd' y g='gsd' z";
  const out = stampHookFallback(text);
  assert.strictEqual((out.match(/g='bm'/g) || []).length, 2);
  assert.strictEqual((out.match(/g='gsd'/g) || []).length, 0);
});

// ─── stampHookFallback: run-bash-hook.cjs resolveCandidates (pkgSegment) ─────

const RUN_BASH_HOOK_LINE = "  const pkgSegment = 'gsd';";

check('stampHookFallback flips the run-bash-hook pkgSegment assignment', () => {
  const out = stampHookFallback(RUN_BASH_HOOK_LINE);
  assert.ok(out.includes("const pkgSegment = 'bm'"), "pkgSegment must become 'bm'");
  assert.ok(!out.includes("const pkgSegment = 'gsd'"), "no gsd-form pkgSegment may remain");
});

// ─── stampHookFallback: check-plugin-update.sh PKG_SEGMENT line ──────────────

const CHECK_UPDATE_SNIPPET =
  'REPO="buildomator/buildomator"\n' +
  'CACHE_ROOT="$HOME/.claude/plugins/cache"\n' +
  'PKG_SEGMENT="gsd"\n' +
  'NOTIFIED_FILE="$HOME/.gsd-plugin-last-notified"';

check('stampHookFallback flips PKG_SEGMENT, sparing repo, cache-root, and notified-file identifiers', () => {
  const out = stampHookFallback(CHECK_UPDATE_SNIPPET);
  assert.ok(out.includes('PKG_SEGMENT="bm"'), 'PKG_SEGMENT must point at the bm package dir');
  assert.ok(!out.includes('PKG_SEGMENT="gsd"'), 'no gsd-form PKG_SEGMENT may remain');
  assert.ok(out.includes('buildomator/buildomator'), 'REPO identifier must survive');
  assert.ok(out.includes('.claude/plugins/cache"'), 'CACHE_ROOT path must survive');
  assert.ok(out.includes('.gsd-plugin-last-notified'), 'NOTIFIED_FILE name must survive');
});

// ─── stampHookFallback: legacy slash form (kept for deferred reference docs) ──

check('stampHookFallback still flips the legacy cache/gsd-plugin/gsd slash form', () => {
  const text = 'a cache/gsd-plugin/gsd b cache/gsd-plugin/gsd c';
  const out = stampHookFallback(text);
  assert.strictEqual((out.match(/cache\/gsd-plugin\/bm/g) || []).length, 2);
  assert.strictEqual((out.match(/cache\/gsd-plugin\/gsd/g) || []).length, 0);
});

// ─── stampHookFallback: idempotence for every shape ──────────────────────────

check('stampHookFallback is idempotent for the g=gsd shape', () => {
  const once = stampHookFallback(HOOKS_RESOLVER_LINE);
  assert.strictEqual(stampHookFallback(once), once);
});

check('stampHookFallback is idempotent for the pkgSegment shape', () => {
  const once = stampHookFallback(RUN_BASH_HOOK_LINE);
  assert.strictEqual(stampHookFallback(once), once);
});

check('stampHookFallback is idempotent for the PKG_SEGMENT shape', () => {
  const once = stampHookFallback(CHECK_UPDATE_SNIPPET);
  assert.strictEqual(stampHookFallback(once), once);
});

// ─── footer ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll bm-transform tests passed');
