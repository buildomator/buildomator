#!/usr/bin/env node
'use strict';

// Regression test for the workflow.ultracode orchestration signal (v3.4.8).
//
// ultracode is an opt-in, Claude-Code-only config knob that tells the
// orchestrating agent to run the good-fit heavy commands at maximum multi-agent
// depth. It is a signal, not a mechanism — each good-fit workflow carries an
// <ultracode_gate> block that reads the flag. This test locks: the config key is
// accepted, the gate is wired into the three target workflows, and the
// reference doc + settings entry exist.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { isValidConfigKey, VALID_CONFIG_KEYS } = require('../bin/lib/config-schema.cjs');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}: ${e.message}`);
    failures++;
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

check('workflow.ultracode is an accepted config key (CJS schema)', () => {
  assert.ok(VALID_CONFIG_KEYS.has('workflow.ultracode'), 'not in VALID_CONFIG_KEYS');
  assert.strictEqual(isValidConfigKey('workflow.ultracode'), true);
});

// Parity guard: gsd-sdk query (the workflow spawn path) validates config-set
// against the SDK's OWN key list (sdk/src/query/config-schema.ts), NOT the CJS
// one. A key added only to the CJS schema is rejected by `config-set` on the
// real path. Lock both schemas in step.
check('workflow.ultracode is in the SDK config schema (sdk/src parity)', () => {
  const sdkSchema = read('sdk/src/query/config-schema.ts');
  assert.ok(sdkSchema.includes("'workflow.ultracode'"), 'missing from sdk/src/query/config-schema.ts');
});

// Gate must be wired into the three good-fit workflows.
const GATED_WORKFLOWS = [
  'workflows/map-codebase.md',
  'workflows/code-review.md',
  'workflows/plan-review-convergence.md',
];
for (const wf of GATED_WORKFLOWS) {
  check(`${path.basename(wf)} carries an <ultracode_gate>`, () => {
    const body = read(wf);
    assert.ok(body.includes('<ultracode_gate>'), 'missing <ultracode_gate> block');
    assert.ok(
      body.includes('config-get workflow.ultracode'),
      'gate does not read workflow.ultracode',
    );
  });
  check(`${path.basename(wf)} gate encodes the 2026-06-22 auto window`, () => {
    const body = read(wf);
    // explicit-override default + date window are the two halves of the gate
    assert.ok(body.includes('--default auto'), 'gate does not default to auto');
    assert.ok(body.includes('2026-06-22'), 'gate does not reference the 2026-06-22 cutoff');
    assert.ok(body.includes('date +%F'), 'gate does not compare today\'s date');
  });
}

check('reference doc references/ultracode-mode.md exists and documents the auto window', () => {
  const body = read('references/ultracode-mode.md');
  assert.ok(body.includes('workflow.ultracode'), 'doc does not mention the flag');
  assert.ok(body.includes('2026-06-22'), 'doc does not state the 2026-06-22 cutoff');
  // truth table must cover both the auto-on window and the explicit override
  assert.ok(/auto/i.test(body) && /override/i.test(body), 'doc does not explain auto + override');
});

check('/gsd:settings documents workflow.ultracode', () => {
  const body = read('workflows/settings.md');
  assert.ok(body.includes('workflow.ultracode'), 'settings.md does not list the key');
});

if (failures) {
  console.error(`\nultracode-signal: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nultracode-signal: all checks passed');
