#!/usr/bin/env node
'use strict';

// Regression guard: extractOneLinerFromBody must only extract from a
// summary-shaped heading (text mentioning summary/overview/accomplishments).
// A rule-list or deviation-note heading at the top of a SUMMARY previously
// leaked its first bold run verbatim into MILESTONES.md accomplishments and the
// one_liner field. When no summary-shaped heading yields a value, it returns
// null rather than the wrong text.
//
// Zero-dep Node harness mirroring tests/mktemp-portable.test.cjs. CI runs it
// via `node tests/one-liner-summary-heading.test.cjs`.

const assert = require('node:assert');
const { extractOneLinerFromBody } = require('../bin/lib/core.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

check('skips a leading non-summary heading and reads the labeled Summary heading', () => {
  const doc = `## Deviation rules

**Some rule bold run**

# Phase 4: Foo Summary

**One-liner:** real prose here.
`;
  assert.strictEqual(extractOneLinerFromBody(doc), 'real prose here.');
});

check('bare-bold form under a Summary heading returns the bold text', () => {
  const doc = `# Phase 4: Foo Summary

**JWT auth with refresh rotation.**
`;
  assert.strictEqual(extractOneLinerFromBody(doc), 'JWT auth with refresh rotation.');
});

check('no summary-shaped heading returns null', () => {
  const doc = `## Deviation rules

**Some rule bold run**

## Notes

**Another bold run**
`;
  assert.strictEqual(extractOneLinerFromBody(doc), null);
});

check('labeled form with empty prose under Summary, nothing after, returns null', () => {
  const doc = `# Phase 4: Foo Summary

**One-liner:**
`;
  assert.strictEqual(extractOneLinerFromBody(doc), null);
});

check('happy path: summary heading first is unchanged', () => {
  const doc = `# Overview

**A substantive one-liner.**
`;
  assert.strictEqual(extractOneLinerFromBody(doc), 'A substantive one-liner.');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll one-liner-summary-heading tests passed');
