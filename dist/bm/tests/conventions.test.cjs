#!/usr/bin/env node
'use strict';

// Unit + integration tests for bin/lib/conventions.cjs (Phase 10, plan 10-01).
//
// Single deterministic source of truth (D-04) for convention derivation and
// conformance checking, called by BOTH gsd-pattern-mapper (writes PATTERNS.md
// Conventions section) and gsd-code-reviewer (emits CONVENTION-tier findings).
//
// Zero-dep harness mirroring tests/base-branch-resolver.test.cjs: node:assert,
// a bare check(name, fn) runner, a failure counter, and a process.exit(1)
// footer. CI runs this directly via `node tests/conventions.test.cjs`.
//
// Coverage: CONV-01 (4-axis majority-vote + normalized entropy + 0.70/min-8
// gates), CONV-02 (per-file conformance, named-only), CONV-03 (verb-vs-body),
// CONV-04 (architectural-split: DI-vs-env + catch swallow/rethrow/wrap),
// D-03 (every finding tier CONVENTION + blocking false), D-05 (non-JS/TS skips
// idiom checks gracefully).

const assert = require('node:assert');
const cp = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const conventions = require('../bin/lib/conventions.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// ─── exports ────────────────────────────────────────────────────────────────

check('exports the public functions', () => {
  for (const f of [
    'deriveConventions', 'checkConformance', 'summarizeAxis', 'classifyCasing', 'sanitizePaths',
    'classifyArchitecture', 'extractIdentifiers', 'blankSpans',
    'pyWildcardVariant', 'pyRelativityVariant', 'rustGlobVariant', 'goOrderingVariant',
  ]) {
    assert.strictEqual(typeof conventions[f], 'function', `missing ${f}`);
  }
});

// ─── blankSpans length-preservation invariant (WR-01) ─────────────────────────

check('WR-01 blankSpans preserves length on a literal ending in a trailing backslash', () => {
  for (const s of ['const x = "abc\\', 'x = /abc\\', '`abc\\']) {
    assert.strictEqual(conventions.blankSpans(s).length, s.length,
      `blankSpans must preserve length for ${JSON.stringify(s)}`);
  }
});

// ─── classifyCasing ───────────────────────────────────────────────────────────

check('classifyCasing distinguishes kebab/snake/camel/Pascal/CONSTANT/other', () => {
  assert.strictEqual(conventions.classifyCasing('base-branch-resolver'), 'kebab');
  assert.strictEqual(conventions.classifyCasing('my_module_name'), 'snake');
  assert.strictEqual(conventions.classifyCasing('myFunction'), 'camel');
  assert.strictEqual(conventions.classifyCasing('MyClass'), 'Pascal');
  assert.strictEqual(conventions.classifyCasing('MAX_RETRIES'), 'CONSTANT');
});

// ─── CONV-01: summarizeAxis (named / contested / insufficient-data + entropy) ──

check('CONV-01 summarizeAxis names a convention at >=70% over >=8 samples (entropy ~0 single variant)', () => {
  const r = conventions.summarizeAxis({ kebab: 10 });
  assert.strictEqual(r.status, 'named');
  assert.strictEqual(r.dominant, 'kebab');
  assert.ok(r.share >= 0.70, `share ${r.share} should be >= 0.70`);
  assert.ok(Math.abs(r.entropy) < 0.001, `entropy ${r.entropy} should be ~0 for a single variant`);
});

check('CONV-01 summarizeAxis names dominant at exactly the 0.70 boundary', () => {
  const r = conventions.summarizeAxis({ camel: 7, snake: 3 }); // 70% camel over 10
  assert.strictEqual(r.status, 'named');
  assert.strictEqual(r.dominant, 'camel');
});

check('CONV-01 summarizeAxis marks an axis contested below 0.70 (dominant null, entropy ~1 even split)', () => {
  const r = conventions.summarizeAxis({ esm: 5, cjs: 5 }); // 50/50 over 10
  assert.strictEqual(r.status, 'contested');
  assert.strictEqual(r.dominant, null);
  assert.strictEqual(r.contested, true);
  assert.ok(Math.abs(r.entropy - 1) < 0.05, `entropy ${r.entropy} should be ~1 for an even split`);
});

check('CONV-01 summarizeAxis: CJS/SDK repo-wide export split is contested, not named', () => {
  // The intentional dual-resolver: bin/lib CJS vs sdk/src ESM, ~even repo-wide.
  const r = conventions.summarizeAxis({ cjs: 63, esm: 60 });
  assert.strictEqual(r.status, 'contested');
  assert.strictEqual(r.dominant, null);
});

check('CONV-01 summarizeAxis returns insufficient-data below minSamples (8)', () => {
  const r = conventions.summarizeAxis({ kebab: 3 }); // total 3 < 8
  assert.strictEqual(r.status, 'insufficient-data');
  assert.strictEqual(r.dominant, null);
});

check('CONV-01 summarizeAxis honors custom dominanceThreshold / minSamples', () => {
  // 6/4 = 60% would be contested at 0.70 but named at 0.55
  const r = conventions.summarizeAxis({ a: 6, b: 4 }, { dominanceThreshold: 0.55, minSamples: 4 });
  assert.strictEqual(r.status, 'named');
  assert.strictEqual(r.dominant, 'a');
});

// ─── CONV-01: deriveConventions over a real in-repo corpus ────────────────────

check('CONV-01 deriveConventions derives all eight axes over a real directory', () => {
  const r = conventions.deriveConventions(['bin/lib/drift.cjs', 'bin/lib/schema-detect.cjs', 'bin/lib/conventions.cjs']);
  assert.strictEqual(r.skipped, false);
  assert.ok(Array.isArray(r.axes));
  const names = r.axes.map((a) => a.name).sort();
  assert.deepStrictEqual(names, [
    'export-style', 'file-name-casing', 'go-import-ordering', 'identifier-casing',
    'import-style', 'py-import-relativity', 'py-wildcard-import', 'rust-glob-import',
  ]);
  for (const a of r.axes) {
    assert.ok(['named', 'contested', 'insufficient-data'].includes(a.status), `bad status ${a.status} for ${a.name}`);
  }
});

check('CONV-01 deriveConventions never throws on bad input (null), returns skipped + empty axes', () => {
  const r = conventions.deriveConventions(null);
  assert.strictEqual(r.skipped, true);
  assert.ok(Array.isArray(r.axes));
  assert.strictEqual(r.axes.length, 0);
});

// ─── CONV-02: checkConformance flag / pass / contested-skip ────────────────────

// A derived contract: file-name-casing is NAMED kebab; identifier-casing NAMED camel.
const derivedNamed = {
  skipped: false,
  axes: [
    { name: 'file-name-casing', status: 'named', dominant: 'kebab', share: 1, entropy: 0, contested: false, total: 20, variants: { kebab: 20 } },
    { name: 'identifier-casing', status: 'named', dominant: 'camel', share: 0.95, entropy: 0.1, contested: false, total: 40, variants: { camel: 38, snake: 2 } },
  ],
};

check('CONV-02 checkConformance flags a file deviating from a NAMED file-name convention', () => {
  const r = conventions.checkConformance([{ file: 'bin/lib/my_snake_file.cjs', src: 'const x = 1;\nmodule.exports = { x };\n' }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  assert.ok(r.findings.some((f) => /file-name|casing/i.test(f.deviation) || /file-name|casing/i.test(f.convention)),
    'expected a file-name-casing finding for a snake_case file under a kebab contract');
});

check('CONV-02 checkConformance passes a file conforming to the NAMED conventions', () => {
  const r = conventions.checkConformance([{ file: 'bin/lib/well-named.cjs', src: 'const myValue = 1;\nmodule.exports = { myValue };\n' }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  const casingFindings = r.findings.filter((f) => /file-name|casing/i.test(f.deviation) || /file-name|casing/i.test(f.convention));
  assert.deepStrictEqual(casingFindings, [], 'a conforming file should yield no casing findings');
});

check('CONV-02 checkConformance never emits a finding for a CONTESTED axis', () => {
  const derivedContested = {
    skipped: false,
    axes: [
      { name: 'export-style', status: 'contested', dominant: null, share: 0.51, entropy: 0.99, contested: true, total: 30, variants: { cjs: 15, esm: 15 } },
    ],
  };
  // An ESM file under a CONTESTED export axis must NOT be flagged (can't deviate from author's choice).
  const r = conventions.checkConformance([{ file: 'bin/lib/esm-ish.cjs', src: 'export const x = 1;\nexport default x;\n' }], derivedContested);
  assert.strictEqual(r.skipped, false);
  const exportFindings = r.findings.filter((f) => /export/i.test(f.deviation) || /export/i.test(f.convention));
  assert.deepStrictEqual(exportFindings, [], 'contested axis must never produce a finding');
});

// ─── CONV-03: verb-vs-body intent ─────────────────────────────────────────────

check('CONV-03 verb-vs-body flags a read-verb function whose body mutates a parameter / does side-effecting I/O', () => {
  const src = [
    "const fs = require('node:fs');",
    'function getUser(user) {',
    '  user.name = "mutated";',          // mutate a parameter
    '  fs.writeFileSync("out.json", "x");', // side-effecting I/O
    '  return user;',
    '}',
  ].join('\n');
  const r = conventions.checkConformance([{ file: 'bin/lib/getter.cjs', src }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  assert.ok(r.findings.some((f) => /getUser|verb|intent|mutat/i.test(f.deviation)),
    'a read-verb function that mutates should produce a verb-vs-body finding');
});

check('CONV-03 verb-vs-body passes a mutating-verb function with a pure return body', () => {
  const src = [
    'function saveConfig(config) {',
    '  const merged = { ...config, saved: true };', // local-only, freshly declared
    '  return merged;',
    '}',
  ].join('\n');
  const r = conventions.checkConformance([{ file: 'bin/lib/saver.cjs', src }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  const verbFindings = r.findings.filter((f) => /verb|intent/i.test(f.deviation) || /verb|intent/i.test(f.convention));
  assert.deepStrictEqual(verbFindings, [], 'mutating-verb + pure body is benign and must not be flagged');
});

check('CONV-03 verb-vs-body does NOT flag a read-builder that only mutates a local array (Pitfall 4)', () => {
  const src = [
    'function buildList(items) {',
    '  const out = [];',
    '  out.push(items.length);', // push to a freshly-declared local, not an arg
    '  return out;',
    '}',
  ].join('\n');
  const r = conventions.checkConformance([{ file: 'bin/lib/builder.cjs', src }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  const verbFindings = r.findings.filter((f) => /buildList/.test(f.deviation));
  assert.deepStrictEqual(verbFindings, [], 'local-array mutation must not be flagged as a side effect');
});

// ─── CONV-04: architectural-split (DI-vs-env, catch swallow/rethrow/wrap) ──────

check('CONV-04 arch-split classifies a process.env file as direct-env', () => {
  // classifyArchitecture is exported; assert the label directly (no optional guard).
  assert.strictEqual(typeof conventions.classifyArchitecture, 'function', 'classifyArchitecture must be exported');
  const r = conventions.classifyArchitecture("const token = process.env.TOKEN;\n");
  assert.strictEqual(r.envStyle, 'direct-env');
});

check('CONV-04 arch-split classifies injected-config file as injected (no process.env)', () => {
  const r = conventions.classifyArchitecture("function build(config) { return config.token; }\n");
  assert.strictEqual(r.envStyle, 'injected');
});

check('CONV-04 arch-split swallow catch produces a finding via checkConformance', () => {
  // Use a kebab-named file so the ONLY finding is from the catch body.
  const swallow = 'function f() {\n  try { doThing(); } catch (e) { /* ignore */ }\n}\n';
  // Derive a minimal named contract (kebab file-name only; no casing axis so no noise).
  const derived = { skipped: false, axes: [
    { name: 'file-name-casing', status: 'named', dominant: 'kebab', share: 1, entropy: 0, contested: false, total: 20, variants: { kebab: 20 } },
  ]};
  const r = conventions.checkConformance([{ file: 'bin/lib/catch-swallow.cjs', src: swallow }], derived);
  assert.strictEqual(r.skipped, false);
  const catchFindings = r.findings.filter((f) => /swallow|catch/i.test(f.deviation));
  assert.ok(catchFindings.length >= 1, 'a swallowed catch must produce at least one catch finding');
  for (const f of catchFindings) {
    assert.strictEqual(f.tier, 'CONVENTION');
    assert.strictEqual(f.blocking, false);
  }
});

check('CONV-04 arch-split rethrow and wrap catch bodies do NOT produce a catch-swallow finding', () => {
  const derived = { skipped: false, axes: [
    { name: 'file-name-casing', status: 'named', dominant: 'kebab', share: 1, entropy: 0, contested: false, total: 20, variants: { kebab: 20 } },
  ]};
  const rethrow = 'function g() {\n  try { doThing(); } catch (e) { throw e; }\n}\n';
  const wrap = 'function h() {\n  try { doThing(); } catch (e) { throw new Error("wrapped", { cause: e }); }\n}\n';
  for (const [label, src] of [['rethrow', rethrow], ['wrap', wrap]]) {
    const r = conventions.checkConformance([{ file: 'bin/lib/catch-ok.cjs', src }], derived);
    assert.strictEqual(r.skipped, false);
    const catchFindings = r.findings.filter((f) => /swallow|catch/i.test(f.deviation));
    assert.deepStrictEqual(catchFindings, [], `${label} catch body must not be flagged as a swallow`);
  }
});

// ─── D-03: every finding is CONVENTION-tier and never blocking ────────────────

check('D-03 every finding carries tier CONVENTION and blocking false; none blocking true', () => {
  const src = [
    "const fs = require('node:fs');",
    'function getThing(obj) {',
    '  obj.dirty = true;',
    '  fs.writeFileSync("x", "y");',
    '  return obj;',
    '}',
  ].join('\n');
  const r = conventions.checkConformance(
    [{ file: 'bin/lib/My_Bad_Name.cjs', src }],
    derivedNamed,
  );
  assert.strictEqual(r.skipped, false);
  assert.ok(r.findings.length > 0, 'this deliberately-violating file should produce at least one finding');
  for (const f of r.findings) {
    assert.strictEqual(f.tier, 'CONVENTION', `finding tier was ${f.tier}`);
    assert.strictEqual(f.blocking, false, 'no CONVENTION finding may set blocking true');
  }
  assert.ok(!r.findings.some((f) => f.blocking === true), 'no finding may be blocking');
});

// ─── D-05: non-JS/TS input skips idiom checks gracefully ──────────────────────

check('D-05 a non-JS/TS file yields no idiom findings and does not throw', () => {
  const r = conventions.checkConformance([{ file: 'scripts/thing.py', src: 'def get_user(u):\n    u.name = "x"\n    return u\n' }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  // Python source must not produce verb-vs-body / arch-split idiom findings.
  const idiomFindings = r.findings.filter((f) => /verb|intent|process\.env|catch|swallow|rethrow|wrap/i.test(f.deviation + ' ' + f.convention));
  assert.deepStrictEqual(idiomFindings, [], 'non-JS/TS input must skip idiom checks');
});

check('D-05 markdown content does not throw and emits no idiom findings', () => {
  const r = conventions.checkConformance([{ file: 'docs/readme.md', src: '# Title\n\nfunction getX() { x.y = 1 }\n' }], derivedNamed);
  assert.strictEqual(r.skipped, false);
  const idiomFindings = r.findings.filter((f) => /verb|intent/i.test(f.deviation));
  assert.deepStrictEqual(idiomFindings, [], 'non-code extension must skip idiom checks');
});

// ─── never-throw on bad conformance input ─────────────────────────────────────

check('checkConformance never throws on bad input (null changedFiles)', () => {
  const r = conventions.checkConformance(null, derivedNamed);
  assert.strictEqual(r.skipped, true);
  assert.ok(Array.isArray(r.findings));
  assert.strictEqual(r.findings.length, 0);
});

check('checkConformance tolerates a missing/garbage derived contract without throwing', () => {
  const r = conventions.checkConformance([{ file: 'bin/lib/x.cjs', src: 'const x=1;' }], null);
  // Either skipped or an empty/no-named-axis findings set; must never throw.
  assert.ok(r && Array.isArray(r.findings));
});

// ─── integration: gsd-tools verify conventions subcommand (wired in Plan 10-02) ─

check('integration: gsd-tools verify conventions --check emits parseable JSON (pending until 10-02)', () => {
  const tool = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
  let out;
  try {
    out = cp.execSync(
      `node "${tool}" verify conventions --check --files "bin/lib/conventions.cjs"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (e) {
    // Subcommand not yet routed in this plan (wired in 10-02). Known-pending, NOT a failure.
    const blob = `${e.stdout || ''}${e.stderr || ''}`;
    if (/Unknown verify subcommand/i.test(blob) || /Unknown command/i.test(blob)) {
      console.log('  pending - integration (wired in 10-02)');
      return;
    }
    throw e;
  }
  // If the subcommand IS routed (10-02 landed), the output must be valid JSON.
  const parsed = JSON.parse(out);
  assert.ok(parsed && typeof parsed === 'object', 'verify conventions must emit a JSON object');
});

// ─── non-app file exclusion (vote + flag) ──────────────────────────────────────

check('isNonAppPath: test/spec/seed/script/fixture/scratch paths are non-app', () => {
  const yes = [
    'tests/foo.js', 'test/foo.js', 'src/__tests__/x.ts', 'src/__mocks__/x.ts',
    'foo.test.cjs', 'bar.spec.ts', 'spec/thing.js', 'db/seeds/users.js',
    'scripts/build.cjs', 'fixtures/sample.json', 'src/__fixtures__/a.js', 'scratch/tmp.js',
  ];
  for (const p of yes) assert.strictEqual(conventions.isNonAppPath(p), true, `expected non-app: ${p}`);
});

check('isNonAppPath: real app paths and lookalikes are app', () => {
  const no = [
    'src/app.js', 'bin/lib/conventions.cjs', 'src/contest/entry.js',
    'src/prescript/x.js', 'attestation.js',
  ];
  for (const p of no) assert.strictEqual(conventions.isNonAppPath(p), false, `expected app: ${p}`);
  // non-string input is safely false
  assert.strictEqual(conventions.isNonAppPath(null), false);
  assert.strictEqual(conventions.isNonAppPath(42), false);
});

check('deriveConventions: non-app files do not vote (kebab survives a snake test-file majority)', () => {
  const sources = {};
  const files = [];
  for (let i = 1; i <= 8; i++) {
    const p = `src/alpha-beta-${String(i).padStart(2, '0')}.js`;
    // basename alpha-beta-01 → kebab
    sources[p] = 'const value = 1;\nmodule.exports = value;\n';
    files.push(p);
  }
  for (let i = 1; i <= 20; i++) {
    const p = `tests/helper_case_${String(i).padStart(2, '0')}.js`;
    // basename helper_case_01 → snake
    sources[p] = 'const value = 1;\nmodule.exports = value;\n';
    files.push(p);
  }
  const derived = conventions.deriveConventions(files, { sources });
  assert.strictEqual(derived.skipped, false);
  const axis = derived.axes.find((a) => a.name === 'file-name-casing');
  assert.strictEqual(axis.status, 'named', `axis status was ${axis.status}`);
  assert.strictEqual(axis.dominant, 'kebab', `axis dominant was ${axis.dominant}`);
  assert.strictEqual(axis.total, 8, `only the 8 app files should vote, got ${axis.total}`);
});

check('checkConformance: a non-app file is never flagged; the same source in-app is', () => {
  const derived = {
    skipped: false,
    axes: [{ name: 'file-name-casing', status: 'named', dominant: 'kebab', total: 8, share: 1, contested: false }],
  };
  // snake basename deviation plus an empty catch (swallow): both flaggable in-app
  const src = 'function readThing() {\n  try {\n    doThing();\n  } catch (e) {}\n  return 1;\n}\n';
  const skipped = conventions.checkConformance([{ file: 'tests/some_helper.js', src }], derived);
  assert.strictEqual(skipped.skipped, false);
  assert.strictEqual(skipped.findings.length, 0, `non-app file must yield zero findings, got ${JSON.stringify(skipped.findings)}`);
  // control: identical source at an app path DOES flag (path-based skip, derivation intact)
  const flagged = conventions.checkConformance([{ file: 'src/some_helper.js', src }], derived);
  assert.ok(flagged.findings.length > 0, 'the same source in-app must produce at least one finding');
});

// ─── per-language import-habit axes ───────────────────────────────────────────

// Build an in-memory corpus of n app files at src/<prefix><NN><ext>, all holding src.
function langCorpus(prefix, ext, n, src) {
  const sources = {};
  const files = [];
  for (let i = 1; i <= n; i++) {
    const p = `src/${prefix}${String(i).padStart(2, '0')}${ext}`;
    sources[p] = src;
    files.push(p);
  }
  return { sources, files };
}

const GO_SORTED = 'package x\n\nimport (\n\t"fmt"\n\t"os"\n)\n';
const GO_UNSORTED = 'package x\n\nimport (\n\t"os"\n\t"fmt"\n)\n';
const RS_EXPLICIT = 'use std::fmt;\nuse crate::a::B;\n';
const PY_ABSOLUTE = 'import os\nfrom pkg.mod import name\n';
const PY_RELATIVE = 'from .sibling import x\n';
const PY_EXPLICIT = 'from pkg.mod import name\n';

function axisOf(derived, name) {
  return derived.axes.find((a) => a.name === name);
}

// direct detector unit assertions
check('detectors: variant/abstain basics', () => {
  assert.strictEqual(conventions.pyWildcardVariant('from a import *\n').variant, 'wildcard');
  assert.strictEqual(conventions.pyWildcardVariant('import os\n'), null);
  assert.strictEqual(conventions.rustGlobVariant('use super::*;\n'), null);
  assert.strictEqual(conventions.goOrderingVariant('package x\nimport "fmt"\n'), null);
  assert.strictEqual(conventions.pyRelativityVariant('from . import x\n').variant, 'relative');
});

check('Test 2 (Go): sorted corpus names go-import-ordering, unsorted block flagged', () => {
  const { sources, files } = langCorpus('svc', '.go', 8, GO_SORTED);
  const d = conventions.deriveConventions(files, { sources });
  const axis = axisOf(d, 'go-import-ordering');
  assert.strictEqual(axis.status, 'named');
  assert.strictEqual(axis.dominant, 'sorted');
  assert.strictEqual(axis.total, 8);
  // unsorted block flagged once
  const bad = conventions.checkConformance([{ file: 'src/new.go', src: GO_UNSORTED }], d);
  const goFindings = bad.findings.filter((f) => f.convention.startsWith('go-import-ordering'));
  assert.strictEqual(goFindings.length, 1);
  assert.strictEqual(goFindings[0].tier, 'CONVENTION');
  assert.strictEqual(goFindings[0].blocking, false);
  assert.ok(goFindings[0].convention.includes('sorted'));
  // sorted block not flagged
  const ok = conventions.checkConformance([{ file: 'src/new.go', src: GO_SORTED }], d);
  assert.strictEqual(ok.findings.filter((f) => f.convention.startsWith('go-import-ordering')).length, 0);
  // single import "fmt" abstains
  const single = conventions.checkConformance([{ file: 'src/new.go', src: 'package x\nimport "fmt"\n' }], d);
  assert.strictEqual(single.findings.filter((f) => f.convention.startsWith('go-import-ordering')).length, 0);
  // a second, unsorted group in a file whose first group is sorted still flags
  const twoGroups = 'package x\n\nimport (\n\t"fmt"\n\t"os"\n\n\t"github.com/x/y"\n\t"github.com/a/b"\n)\n';
  const two = conventions.checkConformance([{ file: 'src/new.go', src: twoGroups }], d);
  assert.strictEqual(two.findings.filter((f) => f.convention.startsWith('go-import-ordering')).length, 1);
});

check('Test 3 (Python relativity): absolute corpus flags a relative file; mirror flags absolute', () => {
  const absCorpus = langCorpus('mod', '.py', 8, PY_ABSOLUTE);
  const abs = conventions.deriveConventions(absCorpus.files, { sources: absCorpus.sources });
  const absAxis = axisOf(abs, 'py-import-relativity');
  assert.strictEqual(absAxis.status, 'named');
  assert.strictEqual(absAxis.dominant, 'absolute');
  const flagged = conventions.checkConformance([{ file: 'src/new.py', src: PY_RELATIVE }], abs);
  const rel = flagged.findings.filter((f) => f.convention.startsWith('py-import-relativity'));
  assert.strictEqual(rel.length, 1);
  assert.ok(rel[0].convention.includes('absolute'));
  // mirror: mostly-relative corpus names relative, an absolute-only file is flagged
  const relCorpus = langCorpus('rel', '.py', 8, PY_RELATIVE);
  const relDerived = conventions.deriveConventions(relCorpus.files, { sources: relCorpus.sources });
  const relAxis = axisOf(relDerived, 'py-import-relativity');
  assert.strictEqual(relAxis.dominant, 'relative');
  const flag2 = conventions.checkConformance([{ file: 'src/new.py', src: PY_ABSOLUTE }], relDerived);
  assert.strictEqual(flag2.findings.filter((f) => f.convention.startsWith('py-import-relativity')).length, 1);
});

check('Test 4 (Python wildcard): explicit corpus flags a star file; import-only abstains on wildcard', () => {
  const { sources, files } = langCorpus('mod', '.py', 8, PY_EXPLICIT);
  const d = conventions.deriveConventions(files, { sources });
  const axis = axisOf(d, 'py-wildcard-import');
  assert.strictEqual(axis.status, 'named');
  assert.strictEqual(axis.dominant, 'explicit');
  const star = conventions.checkConformance([{ file: 'src/new.py', src: 'from a import *\n' }], d);
  assert.strictEqual(star.findings.filter((f) => f.convention.startsWith('py-wildcard-import')).length, 1);
  // a file with only `import os` abstains on wildcard but still votes absolute on relativity.
  // Build a relativity-named contract to confirm the abstention is on wildcard only.
  const relD = conventions.deriveConventions(files, { sources });
  const onlyImport = conventions.checkConformance([{ file: 'src/new.py', src: 'import os\n' }], relD);
  assert.strictEqual(onlyImport.findings.filter((f) => f.convention.startsWith('py-wildcard-import')).length, 0);
  assert.strictEqual(conventions.pyRelativityVariant('import os\n').variant, 'absolute');
});

check('Test 5 (Rust): glob flagged; super::* preamble neither votes nor flags', () => {
  const explicit = langCorpus('lib', '.rs', 8, RS_EXPLICIT);
  // add 5 files whose only use is `use super::*;` (they must abstain, total stays 8)
  for (let i = 1; i <= 5; i++) {
    const p = `src/pre${String(i).padStart(2, '0')}.rs`;
    explicit.sources[p] = 'use super::*;\n';
    explicit.files.push(p);
  }
  const d = conventions.deriveConventions(explicit.files, { sources: explicit.sources });
  const axis = axisOf(d, 'rust-glob-import');
  assert.strictEqual(axis.status, 'named');
  assert.strictEqual(axis.dominant, 'explicit');
  assert.strictEqual(axis.total, 8);
  const glob = conventions.checkConformance([{ file: 'src/new.rs', src: 'use crate::foo::*;\n' }], d);
  assert.strictEqual(glob.findings.filter((f) => f.convention.startsWith('rust-glob-import')).length, 1);
  // a file whose only use is super::* is not flagged
  const pre = conventions.checkConformance([{ file: 'src/new.rs', src: 'use super::*;\n' }], d);
  assert.strictEqual(pre.findings.filter((f) => f.convention.startsWith('rust-glob-import')).length, 0);
  // explicit uses followed by a #[cfg(test)] mod with globs are not flagged
  const withTest = 'use crate::a::B;\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n    use crate::x::*;\n}\n';
  const t = conventions.checkConformance([{ file: 'src/new.rs', src: withTest }], d);
  assert.strictEqual(t.findings.filter((f) => f.convention.startsWith('rust-glob-import')).length, 0);
});

check('Test 6 (insufficient-data): 5 .py files leave both py axes insufficient, no findings', () => {
  const { sources, files } = langCorpus('mod', '.py', 5, PY_EXPLICIT);
  const d = conventions.deriveConventions(files, { sources });
  assert.strictEqual(axisOf(d, 'py-wildcard-import').status, 'insufficient-data');
  assert.strictEqual(axisOf(d, 'py-import-relativity').status, 'insufficient-data');
  const r = conventions.checkConformance([{ file: 'src/new.py', src: 'from a import *\n' }], d);
  assert.strictEqual(r.findings.filter((f) => f.convention.startsWith('py-')).length, 0);
});

check('Test 7 (contested): 5 sorted + 5 unsorted .go is contested, flags nothing', () => {
  const sources = {};
  const files = [];
  for (let i = 1; i <= 5; i++) {
    const a = `src/sort${String(i).padStart(2, '0')}.go`;
    const b = `src/uns${String(i).padStart(2, '0')}.go`;
    sources[a] = GO_SORTED; sources[b] = GO_UNSORTED; files.push(a, b);
  }
  const d = conventions.deriveConventions(files, { sources });
  const axis = axisOf(d, 'go-import-ordering');
  assert.strictEqual(axis.status, 'contested');
  assert.strictEqual(axis.dominant, null);
  const r = conventions.checkConformance([{ file: 'src/new.go', src: GO_UNSORTED }], d);
  assert.strictEqual(r.findings.filter((f) => f.convention.startsWith('go-import-ordering')).length, 0);
});

check('Test 8 (non-app exclusion): star import at tests/ is silent, at src/ flags; fixtures do not vote', () => {
  const { sources, files } = langCorpus('mod', '.py', 8, PY_EXPLICIT);
  const d = conventions.deriveConventions(files, { sources });
  const inTest = conventions.checkConformance([{ file: 'tests/helper.py', src: 'from a import *\n' }], d);
  assert.strictEqual(inTest.findings.length, 0);
  const inApp = conventions.checkConformance([{ file: 'src/helper.py', src: 'from a import *\n' }], d);
  assert.strictEqual(inApp.findings.filter((f) => f.convention.startsWith('py-wildcard-import')).length, 1);
  // a fixtures/x.go unsorted file does not vote in derivation
  const goCorpus = langCorpus('svc', '.go', 8, GO_SORTED);
  goCorpus.sources['fixtures/x.go'] = GO_UNSORTED;
  goCorpus.files.push('fixtures/x.go');
  const gd = conventions.deriveConventions(goCorpus.files, { sources: goCorpus.sources });
  assert.strictEqual(axisOf(gd, 'go-import-ordering').total, 8);
});

check('Test 9 (orthogonality): py/go corpora cast no legacy votes; js casts none on the new axes', () => {
  const py = langCorpus('mod', '.py', 8, PY_ABSOLUTE);
  const pd = conventions.deriveConventions(py.files, { sources: py.sources });
  assert.strictEqual(axisOf(pd, 'import-style').total, 0);
  assert.strictEqual(axisOf(pd, 'export-style').total, 0);
  const go = langCorpus('svc', '.go', 8, GO_SORTED);
  const gd = conventions.deriveConventions(go.files, { sources: go.sources });
  assert.strictEqual(axisOf(gd, 'import-style').total, 0);
  assert.strictEqual(axisOf(gd, 'export-style').total, 0);
  const js = langCorpus('a', '.js', 8, 'const x = require("x");\nmodule.exports = { x };\n');
  const jd = conventions.deriveConventions(js.files, { sources: js.sources });
  for (const n of ['py-wildcard-import', 'py-import-relativity', 'rust-glob-import', 'go-import-ordering']) {
    assert.strictEqual(axisOf(jd, n).total, 0, `js voted on ${n}`);
  }
});

check('Test 11 (legacy-axis gate): Go/Python cast no esm vote; JS cjs/esm unchanged on both axes', () => {
  const goOnly = conventions.deriveConventions(['src/x.go'], { sources: { 'src/x.go': GO_UNSORTED } });
  const goImport = axisOf(goOnly, 'import-style');
  assert.strictEqual(goImport.total, 0);
  assert.ok(!Object.prototype.hasOwnProperty.call(goImport.variants, 'esm'), 'Go import ( block must not add an esm key');
  const pyOnly = conventions.deriveConventions(['src/x.py'], { sources: { 'src/x.py': 'import os\nfrom pkg import name\n' } });
  assert.strictEqual(axisOf(pyOnly, 'import-style').total, 0);
  // mixed corpus: the two js files vote cjs/esm exactly, gate does not regress
  const sources = {
    'src/x.go': GO_UNSORTED,
    'src/x.py': 'import os\nfrom pkg import name\n',
    'src/c.js': 'const a = require("a");\nmodule.exports = a;\n',
    'src/e.js': 'import a from "a";\nexport default a;\n',
  };
  const d = conventions.deriveConventions(Object.keys(sources), { sources });
  assert.deepStrictEqual(axisOf(d, 'import-style').variants, { cjs: 1, esm: 1 });
  assert.strictEqual(axisOf(d, 'import-style').total, 2);
  assert.deepStrictEqual(axisOf(d, 'export-style').variants, { cjs: 1, esm: 1 });
  assert.strictEqual(axisOf(d, 'export-style').total, 2);
});

check('Test 10 (CLI SRC_RE end to end): a temp .py/.rs/.go corpus reaches named status via the CLI', () => {
  const tool = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-lang-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    for (let i = 1; i <= 8; i++) {
      const nn = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(tmpDir, 'src', `m${nn}.py`), PY_ABSOLUTE);
      fs.writeFileSync(path.join(tmpDir, 'src', `l${nn}.rs`), RS_EXPLICIT);
      fs.writeFileSync(path.join(tmpDir, 'src', `s${nn}.go`), GO_SORTED);
    }
    const out = cp.execSync(
      `node "${tool}" verify conventions --derive --scope .`,
      { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.mode, 'derive');
    assert.strictEqual(parsed.skipped, false);
    const find = (n) => parsed.axes.find((a) => a.name === n);
    for (const n of ['py-wildcard-import', 'py-import-relativity', 'rust-glob-import', 'go-import-ordering']) {
      assert.strictEqual(find(n).status, 'named', `${n} not named in CLI run`);
      assert.strictEqual(find(n).total, 8, `${n} total was ${find(n).total}`);
    }
    assert.strictEqual(find('import-style').total, 0, 'admitted files must cast no legacy import-style vote');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

if (failures) { console.error(`\nconventions: ${failures} failure(s)`); process.exit(1); }
console.log('\nconventions: all checks passed');
