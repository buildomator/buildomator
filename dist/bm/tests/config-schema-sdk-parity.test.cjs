#!/usr/bin/env node
'use strict';

// Parity guard: the CJS config schema (bin/lib/config-schema.cjs) and the SDK
// config schema (sdk/src/query/config-schema.ts) are two independent resolvers
// that MUST accept the same config keys. `gsd-sdk query config-set` validates
// against the SDK list; bin/gsd-tools.cjs validates against the CJS list. When
// they drift, a documented key is accepted by one resolver and rejected by the
// other. This test reads the SDK source as text (no build needed) and compares.
//
// Zero-dep harness: node:assert + a check() runner + a process.exit(1) footer.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cjs = require('../bin/lib/config-schema.cjs');
const sdkSrc = fs.readFileSync(
  path.resolve(__dirname, '../sdk/src/query/config-schema.ts'),
  'utf8'
);

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Extract the quoted string literals from a `<name> ... new Set([ ... ])` block.
function extractSetLiterals(src, name) {
  const start = src.indexOf(name);
  assert.ok(start !== -1, `${name} not found in SDK config-schema.ts`);
  const open = src.indexOf('[', start);
  const close = src.indexOf('])', open);
  assert.ok(open !== -1 && close !== -1, `${name} Set block malformed in SDK`);
  const block = src.slice(open, close);
  return new Set([...block.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]));
}

function assertSetParity(name) {
  const sdk = extractSetLiterals(sdkSrc, name);
  const c = cjs[name];
  const onlyCjs = [...c].filter((k) => !sdk.has(k));
  const onlySdk = [...sdk].filter((k) => !c.has(k));
  assert.deepStrictEqual(onlyCjs, [], `${name} keys only in CJS: ${onlyCjs.join(', ')}`);
  assert.deepStrictEqual(onlySdk, [], `${name} keys only in SDK: ${onlySdk.join(', ')}`);
}

check('VALID_CONFIG_KEYS parity (CJS <-> SDK)', () => assertSetParity('VALID_CONFIG_KEYS'));
check('RUNTIME_STATE_KEYS parity (CJS <-> SDK)', () => assertSetParity('RUNTIME_STATE_KEYS'));

check('dynamic key patterns accept the same sample keys (incl. fable tier)', () => {
  const samples = [
    'model_profile_overrides.claude.fable',
    'model_profile_overrides.claude.opus',
    'model_profile_overrides.codex.sonnet',
    'model_profile_overrides.copilot.haiku',
  ];
  // Reconstruct the SDK dynamic regexes from `test: (k) => /.../.test(k)`.
  const sdkRegexes = [...sdkSrc.matchAll(/test:\s*\(k\)\s*=>\s*\/(.+?)\/\.test\(k\)/g)]
    .map((m) => new RegExp(m[1]));
  assert.ok(sdkRegexes.length >= 1, 'no SDK dynamic-key regexes could be extracted');
  for (const k of samples) {
    assert.ok(cjs.isValidConfigKey(k), `CJS should accept dynamic key ${k}`);
    assert.ok(sdkRegexes.some((re) => re.test(k)), `SDK dynamic patterns should accept ${k}`);
  }
});

// footer
if (failures) {
  console.error(`\nconfig-schema-sdk-parity: ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\nconfig-schema-sdk-parity: all checks passed');
}
