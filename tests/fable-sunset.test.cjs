#!/usr/bin/env node
'use strict';

// Regression test for the Claude Fable 5 sunset (2026-06-22).
//
// Fable is offered only through 2026-06-22. The `fable` tier (quality profile's
// pick for the heaviest agents) must automatically fall back to `opus` after the
// sunset, with no config edit. The downgrade lives in core.cjs resolveModelInternal
// via applyFableSunset(), so every resolution path (alias, resolve_model_ids,
// runtime) sees one consistent effective tier.

const assert = require('node:assert');
const core = require('../bin/lib/core.cjs');

const { applyFableSunset, fableAvailable, FABLE_SUNSET_DATE } = core;

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

const beforeSunset = new Date('2026-06-11T12:00:00Z');
const lastDay = new Date('2026-06-22T23:59:59Z');     // inclusive — still available
const afterSunset = new Date('2026-06-23T00:00:01Z'); // first day of fallback
const wayAfter = new Date('2027-01-01T00:00:00Z');

check('sunset date constant is 2026-06-22', () => {
  assert.strictEqual(FABLE_SUNSET_DATE, '2026-06-22');
});

check('fable is available before the sunset', () => {
  assert.strictEqual(fableAvailable(beforeSunset), true);
});

check('fable is available through the final day (inclusive)', () => {
  assert.strictEqual(fableAvailable(lastDay), true);
});

check('fable is NOT available the day after the sunset', () => {
  assert.strictEqual(fableAvailable(afterSunset), false);
});

check('fable stays unavailable well after the sunset', () => {
  assert.strictEqual(fableAvailable(wayAfter), false);
});

check('applyFableSunset keeps fable before the sunset', () => {
  assert.strictEqual(applyFableSunset('fable', beforeSunset), 'fable');
});

check('applyFableSunset downgrades fable -> opus after the sunset', () => {
  assert.strictEqual(applyFableSunset('fable', afterSunset), 'opus');
});

check('applyFableSunset leaves non-fable tiers untouched after the sunset', () => {
  for (const t of ['opus', 'sonnet', 'haiku', 'inherit', null]) {
    assert.strictEqual(applyFableSunset(t, afterSunset), t);
  }
});

check('invalid "now" is treated as still-available (no accidental fallback)', () => {
  // env override with an unparseable value must not strand callers on opus
  const prev = process.env.GSD_FABLE_SUNSET_NOW;
  process.env.GSD_FABLE_SUNSET_NOW = 'not-a-date';
  try {
    assert.strictEqual(fableAvailable(), true);
    assert.strictEqual(applyFableSunset('fable'), 'fable');
  } finally {
    if (prev === undefined) delete process.env.GSD_FABLE_SUNSET_NOW;
    else process.env.GSD_FABLE_SUNSET_NOW = prev;
  }
});

check('GSD_FABLE_SUNSET_NOW env override pins the date', () => {
  const prev = process.env.GSD_FABLE_SUNSET_NOW;
  process.env.GSD_FABLE_SUNSET_NOW = '2026-12-01T00:00:00Z';
  try {
    assert.strictEqual(fableAvailable(), false);
    assert.strictEqual(applyFableSunset('fable'), 'opus');
  } finally {
    if (prev === undefined) delete process.env.GSD_FABLE_SUNSET_NOW;
    else process.env.GSD_FABLE_SUNSET_NOW = prev;
  }
});

if (failures) {
  console.error(`\nfable-sunset: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nfable-sunset: all checks passed');
