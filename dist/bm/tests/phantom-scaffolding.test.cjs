#!/usr/bin/env node
'use strict';

// Unit tests for bin/lib/phantom-scaffolding.cjs (Phase 11, plan 11-02).
//
// Covers DRIFT-05: CRUD-named export never imported (ESM + CJS), placeholder
// stub detection (return null + TODO comment), string-safety (blankSpans),
// D-09 noise exclusion (non-CRUD unused exports never flagged).
//
// Zero-dep harness mirroring tests/conventions.test.cjs: node:assert,
// a bare check(name, fn) runner, a failure counter, and a process.exit(1)
// footer. CI runs this directly via `node tests/phantom-scaffolding.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const phantom = require('../bin/lib/phantom-scaffolding.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── exports ─────────────────────────────────────────────────────────────────

check('exports the public functions', () => {
  for (const f of ['detect', 'extractExports', 'extractImportedNames', 'classifyVerb']) {
    assert.strictEqual(typeof phantom[f], 'function', `missing ${f}`);
  }
});

// ─── never-throw shape ───────────────────────────────────────────────────────

check('detect(null) returns {skipped:true, reason, findings:[]}', () => {
  const result = phantom.detect(null);
  assert.strictEqual(result.skipped, true, 'should be skipped');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'reason should be non-empty');
  assert.ok(Array.isArray(result.findings), 'findings should be an array');
  assert.strictEqual(result.findings.length, 0, 'findings should be empty');
});

// ─── classifyVerb ────────────────────────────────────────────────────────────

check('classifyVerb identifies CRUD-named functions', () => {
  assert.ok(phantom.classifyVerb('getUser') !== null, 'getUser should be CRUD');
  assert.ok(phantom.classifyVerb('fetchData') !== null, 'fetchData should be CRUD');
  assert.ok(phantom.classifyVerb('deleteRecord') !== null, 'deleteRecord should be CRUD');
  assert.ok(phantom.classifyVerb('updateProfile') !== null, 'updateProfile should be CRUD');
  assert.ok(phantom.classifyVerb('createItem') !== null, 'createItem should be CRUD');
});

check('classifyVerb returns null for non-CRUD names', () => {
  assert.strictEqual(phantom.classifyVerb('helperConstant'), null, 'helperConstant should not be CRUD');
  assert.strictEqual(phantom.classifyVerb('formatDate'), null, 'formatDate should not be CRUD');
  assert.strictEqual(phantom.classifyVerb('utils'), null, 'utils should not be CRUD');
});

// ─── extractExports ──────────────────────────────────────────────────────────

check('extractExports finds named ESM exports', () => {
  const src = `
export function getUser() { return null; }
export const MAX_RETRIES = 5;
export class UserService {}
`;
  const exports = phantom.extractExports(src);
  const names = exports.map((e) => e.name);
  assert.ok(names.includes('getUser'), 'should find getUser');
  assert.ok(names.includes('MAX_RETRIES'), 'should find MAX_RETRIES');
});

check('extractExports finds brace-form exports', () => {
  const src = `function a() {} function b() {};\nexport { a, b };`;
  const exports = phantom.extractExports(src);
  const names = exports.map((e) => e.name);
  assert.ok(names.includes('a'), 'should find a in brace form');
  assert.ok(names.includes('b'), 'should find b in brace form');
});

// ─── extractImportedNames ────────────────────────────────────────────────────

check('extractImportedNames finds ESM import names', () => {
  const src = `import { getUser, createUser } from './users';\nimport defaultExport from './other';`;
  const names = phantom.extractImportedNames(src);
  assert.ok(names.includes('getUser'), 'should find getUser from ESM import');
  assert.ok(names.includes('createUser'), 'should find createUser from ESM import');
});

check('extractImportedNames finds CJS require names (Pitfall 3)', () => {
  const src = `const { getThing, setThing } = require('./module');\nconst single = require('./other');`;
  const names = phantom.extractImportedNames(src);
  assert.ok(names.includes('getThing'), 'should find getThing from CJS require');
  assert.ok(names.includes('setThing'), 'should find setThing from CJS require');
});

// ─── phantom: CRUD export never imported is flagged ─────────────────────────

check('phantom: CRUD-named export in NO file\'s imported-names is flagged', () => {
  // Set up a corpus: file A exports deleteUser but nobody imports it
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'users.cjs');
    const fileB = path.join(tmpDir, 'other.cjs');
    fs.writeFileSync(fileA, `
function deleteUser(id) { return true; }
module.exports = { deleteUser };
`);
    fs.writeFileSync(fileB, `
const utils = require('./utils');
console.log('nothing here');
`);
    const corpus = ['users.cjs', 'other.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    assert.strictEqual(result.skipped, false, 'should not be skipped');
    // deleteUser should be flagged as phantom
    const phantomFindings = result.findings.filter((f) => f.kind === 'phantom-export' && f.name === 'deleteUser');
    assert.ok(phantomFindings.length > 0, 'deleteUser never imported should be flagged as phantom-export');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('phantom: CRUD export that IS imported via ESM is NOT flagged', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'users.cjs');
    const fileB = path.join(tmpDir, 'main.cjs');
    fs.writeFileSync(fileA, `
export function getUser(id) { return id; }
`);
    fs.writeFileSync(fileB, `
import { getUser } from './users.cjs';
getUser(1);
`);
    const corpus = ['users.cjs', 'main.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    // getUser IS imported — should NOT be flagged
    const phantomFindings = result.findings.filter((f) => f.kind === 'phantom-export' && f.name === 'getUser');
    assert.strictEqual(phantomFindings.length, 0, 'getUser IS imported via ESM — should not be flagged');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('phantom: CRUD export imported via CJS require is NOT flagged (Pitfall 3)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'users.cjs');
    const fileB = path.join(tmpDir, 'main.cjs');
    fs.writeFileSync(fileA, `
function getThing() { return 42; }
module.exports = { getThing };
`);
    fs.writeFileSync(fileB, `
const { getThing } = require('./users.cjs');
getThing();
`);
    const corpus = ['users.cjs', 'main.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    // getThing IS imported via CJS require — should NOT be flagged
    const phantomFindings = result.findings.filter((f) => f.kind === 'phantom-export' && f.name === 'getThing');
    assert.strictEqual(phantomFindings.length, 0, 'getThing imported via CJS require — should not be flagged');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('D-09: non-CRUD-named unused export is NOT flagged (only CRUD names qualify)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'utils.cjs');
    const fileB = path.join(tmpDir, 'other.cjs');
    fs.writeFileSync(fileA, `
function helperConstant() { return 42; }
module.exports = { helperConstant };
`);
    fs.writeFileSync(fileB, `
const stuff = require('./nothing');
`);
    const corpus = ['utils.cjs', 'other.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    // helperConstant is NOT a CRUD verb — must NOT be flagged
    const noisy = result.findings.filter((f) => f.kind === 'phantom-export' && f.name === 'helperConstant');
    assert.strictEqual(noisy.length, 0, 'non-CRUD unused export (helperConstant) must not be flagged (D-09)');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── placeholder: return null + TODO flagged ─────────────────────────────────

check('placeholder: function body with return null + // TODO comment is flagged', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'stub.cjs');
    fs.writeFileSync(fileA, `
// TODO: implement this
function processData(input) {
  return null;
}
module.exports = { processData };
`);
    const corpus = ['stub.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    const stubs = result.findings.filter((f) => f.kind === 'placeholder-stub');
    assert.ok(stubs.length > 0, 'function with return null + TODO comment should be flagged as placeholder-stub');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('placeholder: function body with return {} + /* FIXME */ is flagged', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'stub.cjs');
    fs.writeFileSync(fileA, `
function buildResult() {
  /* FIXME: not implemented */
  return {};
}
module.exports = { buildResult };
`);
    const corpus = ['stub.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    const stubs = result.findings.filter((f) => f.kind === 'placeholder-stub');
    assert.ok(stubs.length > 0, 'function with return {} + FIXME comment should be flagged as placeholder-stub');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('placeholder: real return value with no TODO is NOT flagged', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'real.cjs');
    fs.writeFileSync(fileA, `
function processData(input) {
  return input.map((x) => x * 2);
}
module.exports = { processData };
`);
    const corpus = ['real.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    const stubs = result.findings.filter((f) => f.kind === 'placeholder-stub');
    assert.strictEqual(stubs.length, 0, 'real function with no TODO should not be flagged');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('placeholder string-safety: TODO inside a string literal is NOT flagged (blankSpans protection)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-test-'));
  try {
    const fileA = path.join(tmpDir, 'notastub.cjs');
    // The string "TODO: nothing" is NOT a comment-TODO; blankSpans must blank it
    fs.writeFileSync(fileA, `
function processData(input) {
  const message = "TODO: nothing";
  return message;
}
module.exports = { processData };
`);
    const corpus = ['notastub.cjs'];
    const result = phantom.detect(corpus, { cwd: tmpDir });
    const stubs = result.findings.filter((f) => f.kind === 'placeholder-stub');
    assert.strictEqual(stubs.length, 0, 'TODO inside a string literal must not trigger placeholder detection (blankSpans)');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// footer
if (failures) {
  console.error(`\nphantom-scaffolding: ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\nphantom-scaffolding: all checks passed');
}
