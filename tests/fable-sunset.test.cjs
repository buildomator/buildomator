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
const fs = require('node:fs');
const path = require('node:path');
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

// Claude Fable 5 was withdrawn ~2026-06-12 (earlier than the planned 06-22),
// so the cutoff was pulled forward. The `fable` tier now falls back to `opus`.
const beforeSunset = new Date('2026-06-11T12:00:00Z');
const lastDay = new Date('2026-06-12T23:59:59Z');     // inclusive — still counted available
const afterSunset = new Date('2026-06-13T00:00:01Z'); // first day of fallback
const wayAfter = new Date('2027-01-01T00:00:00Z');

check('fable cutoff constant is 2026-06-12 (withdrawn early)', () => {
  assert.strictEqual(FABLE_SUNSET_DATE, '2026-06-12');
});

// Parity guard: the live spawn path for `gsd-sdk query init.*` is the SDK
// resolver (sdk/src/query/config-query.ts -> sdk/dist), NOT this CJS module.
// A sunset that exists only in CJS is a no-op on the real path. Lock both in
// step: the SDK source must apply the same fable sunset with the same date.
check('SDK resolver (sdk/src) applies the fable sunset (CJS/SDK parity)', () => {
  const sdkResolver = fs.readFileSync(
    path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-query.ts'),
    'utf8',
  );
  assert.ok(sdkResolver.includes('applyFableSunset'), 'SDK resolver missing applyFableSunset');
  assert.ok(sdkResolver.includes("'2026-06-12'"), 'SDK resolver cutoff out of sync with CJS');
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

// Tunable knob: fable.mode (on/off override) + fable.until (cutoff override).
check('knob mode=on forces fable available even after the cutoff', () => {
  assert.strictEqual(fableAvailable(afterSunset, { mode: 'on' }), true);
  assert.strictEqual(applyFableSunset('fable', afterSunset, { mode: 'on' }), 'fable');
});

check('knob mode=off forces opus even before the cutoff', () => {
  assert.strictEqual(fableAvailable(beforeSunset, { mode: 'off' }), false);
  assert.strictEqual(applyFableSunset('fable', beforeSunset, { mode: 'off' }), 'opus');
});

check('knob until=<future> extends the auto cutoff', () => {
  assert.strictEqual(fableAvailable(afterSunset, { until: '2027-01-01' }), true);
  assert.strictEqual(applyFableSunset('fable', afterSunset, { until: '2027-01-01' }), 'fable');
});

check('knob until=<past> brings the auto cutoff forward', () => {
  assert.strictEqual(fableAvailable(beforeSunset, { until: '2026-06-01' }), false);
});

check('readFableKnob exported; returns {} when no config/knob present', () => {
  assert.strictEqual(typeof core.readFableKnob, 'function');
  const k = core.readFableKnob(__dirname); // tests/ has no .planning/config.json
  assert.deepStrictEqual({ mode: k.mode, until: k.until }, { mode: undefined, until: undefined });
});

// CJS/SDK parity: the knob must exist in the SDK resolver too.
check('SDK resolver reads the fable knob (CJS/SDK parity)', () => {
  const sdk = fs.readFileSync(path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-query.ts'), 'utf8');
  assert.ok(sdk.includes('readFableKnob'), 'SDK resolver missing readFableKnob');
  assert.ok(/fable\.mode|knob\.mode/.test(sdk), 'SDK resolver does not honor the knob mode');
});

if (failures) {
  console.error(`\nfable-sunset: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nfable-sunset: all checks passed');
