#!/usr/bin/env node
'use strict';

// Regression guard for gsd-core #5137: detectDrift must never emit an absolute,
// traversal, or shell-metacharacter path in affectedPaths or in the egress line
// of the message (the auto-remap line and the `/gsd:map-codebase --paths` line
// spliced into a mapper command). Element building is deliberately untouched.
//
// Zero-dep harness requiring bin/lib/drift.cjs directly.

const assert = require('node:assert');
const path = require('node:path');

const { detectDrift } = require(path.join(__dirname, '..', 'bin', 'lib', 'drift.cjs'));

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

const HOSTILE_INPUT = {
  addedFiles: ['src/new/thing.ts', '../escape/x.ts', '/abs/y.ts', 'ok;rm -rf /.ts', 'packages/good/a.ts'],
  modifiedFiles: [],
  deletedFiles: [],
  structureMd: '# Structure\n\n(maps nothing)\n',
  threshold: 1,
  action: 'auto-remap',
};

// The egress line is the one that would be spliced into a mapper command.
function egressLine(message) {
  return message.split('\n').find((l) => /Auto-remap scheduled for paths:|--paths/.test(l)) || '';
}

check('affectedPaths contains exactly packages/good and src (sorted, sanitized)', () => {
  const r = detectDrift(HOSTILE_INPUT);
  assert.deepStrictEqual(r.affectedPaths, ['packages/good', 'src'],
    `affectedPaths: ${JSON.stringify(r.affectedPaths)}`);
});

check('the auto-remap egress line has no traversal, absolute, or shell-metacharacter path', () => {
  const line = egressLine(detectDrift(HOSTILE_INPUT).message);
  assert.ok(line.includes('packages/good') && line.includes('src'), `egress line: ${line}`);
  assert.ok(!line.includes('..'), `egress line has ..: ${line}`);
  assert.ok(!line.includes('/abs'), `egress line has absolute path: ${line}`);
  assert.ok(!line.includes(';'), `egress line has ;: ${line}`);
});

check('the warn-action --paths egress line is also sanitized', () => {
  const line = egressLine(detectDrift({ ...HOSTILE_INPUT, action: 'warn' }).message);
  assert.ok(line.includes('packages/good,src'), `egress line: ${line}`);
  assert.ok(!line.includes('..'), `egress line has ..: ${line}`);
  assert.ok(!line.includes('/abs'), `egress line has absolute path: ${line}`);
  assert.ok(!line.includes(';'), `egress line has ;: ${line}`);
});

check('element building is untouched: counts.added is 5 and the classifiable paths are still listed', () => {
  const r = detectDrift(HOSTILE_INPUT);
  assert.strictEqual(r.counts.added, 5, `counts.added: ${r.counts.added}`);
  const listed = new Set(r.elements.map((e) => e.path));
  // The safe relative files and the traversal/metachar files remain as elements;
  // only the egress array/line is sanitized.
  for (const f of ['src/new/thing.ts', 'packages/good/a.ts', '../escape/x.ts', 'ok;rm -rf /.ts']) {
    assert.ok(listed.has(f), `missing element: ${f}`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll drift-path-egress tests passed');
