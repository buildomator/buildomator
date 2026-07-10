#!/usr/bin/env node
'use strict';

// Command-inventory parity gate for the generated bm package.
//
// Proves three things about the committed dist/bm tree relative to the tracked
// source:
//   1. Every skills/<name>/SKILL.md in source has an identically-pathed file in
//      dist/bm (the command surface is complete).
//   2. Every tracked, non-excluded source file has a counterpart at the same
//      relative path in dist/bm (full-inventory superset).
//   3. A fail-closed census: a per-class raw-text detector, proven to FLAG each
//      known gsd-leak class (positive control) and to spare an allow-listed-only
//      input, then run against every dist/bm text file (skipping STAMP_EXCLUDE)
//      so any un-rewritten gsd token fails here instead of shipping.
//   4. `node bin/build-bm.cjs --check` exits 0, i.e. the committed dist/bm is the
//      byte-exact deterministic transform of source.
//
// Zero-dep harness mirroring tests/build-bm-drift.test.cjs: node:assert, a bare
// check(name, fn) runner, a failure counter, and a process.exit(1) footer.
// Enumeration always goes through git ls-files + the build's own shouldExclude
// predicate, never a raw fs walk, so it stays deterministic and matches exactly
// what the build ships.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { shouldExclude, STAMP_EXCLUDE, isTextFile } = require('../bin/build-bm.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'bm');
const SCRIPT = path.join(ROOT, 'bin', 'build-bm.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

// Tracked source files (git index), filtered through the build's shouldExclude,
// so the inventory checks compare exactly the set the build copies.
function includedSourceFiles() {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT });
  assert.strictEqual(listed.status, 0, 'git ls-files failed');
  return listed.stdout.toString('utf8').split('\0').filter(Boolean).filter((f) => !shouldExclude(f));
}

// ─── skill-inventory parity ────────────────────────────────────────────────

check('every source skill has an identically-pathed SKILL.md in dist/bm', () => {
  const skills = includedSourceFiles().filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
  assert.ok(skills.length > 0, 'expected at least one skills/<name>/SKILL.md in source');
  const missing = skills.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  assert.deepStrictEqual(missing, [], `skills absent from dist/bm: ${missing.slice(0, 5).join(', ')}`);
});

// ─── full-inventory parity ─────────────────────────────────────────────────

check('every tracked non-excluded source file exists at the same path in dist/bm', () => {
  const included = includedSourceFiles();
  const missing = included.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
  assert.deepStrictEqual(missing, [], `files absent from dist/bm: ${missing.slice(0, 5).join(', ')}`);
});

// ─── fail-closed census ──────────────────────────────────────────────────────

// Given raw file text, return the list of violation-class names it matches. Each
// class is matched by a DIRECT, anchored pattern against the RAW (unstripped)
// text: allow-listed tokens are NEVER pre-removed, and classes are NEVER
// reordered so one hides behind another. Allow-list sparing is expressed WITHIN
// each pattern (the character after the colon), mirroring how the build's
// gsd:(?!/) rewrite already spares gsd:// URIs.
//
// Governance (anti-cheat): do not widen the allow-list to silence a real
// violation, and do not pre-strip or reorder tokens to hide a class from its
// pattern. If the real scan flags a token that is genuinely legitimate but not
// yet spared by a pattern, STOP and surface it rather than mutating the detector
// to pass. The detector staying fail-closed is the whole point of the census.
function detectViolations(text) {
  const hits = [];
  // Un-stamped hook cache-fallback. A direct literal, so the allow-listed
  // 'gsd-plugin' substring it contains cannot hide it (pre-stripping 'gsd-plugin'
  // would leave 'cache//gsd' and destroy the violation).
  if (text.includes('cache/gsd-plugin/gsd')) hits.push('cache-fallback');
  // Un-rewritten agent reference. The colon-then-'g' shape never collides with
  // gsd:// (colon-slash) or a gsd-<file> filename (no colon before the dash).
  if (/gsd:gsd-[a-z0-9-]+/.test(text)) hits.push('agent-ref');
  // Un-rewritten slash command OR frontmatter name. Requiring a lowercase letter
  // immediately after the colon spares gsd:// (colon-slash), the regex-escaped
  // gsd:\/ in mcp/server.cjs (colon-backslash), and name:'gsd' (no colon after
  // gsd). The pattern is case-sensitive (no /i) so it leaves the uppercase
  // GSD:<section> branding markers untouched, mirroring the case-sensitive
  // gsd:(?!/) rewrite that also spares them.
  if (/gsd:[a-z]/.test(text)) hits.push('namespace-prefix');
  // Un-rewritten SDK headless-sanitizer literal. The bracketed regex source is
  // unambiguous and cannot collide with the allow-listed /gsd-<file> path.
  if (text.includes('/gsd[:-]')) hits.push('sanitizer-literal');
  return hits;
}

// Every file under dir as [rel, absPath], for the raw-bytes real scan.
function distFiles(dir) {
  const acc = [];
  (function walk(d, prefix) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(d, ent.name), rel);
      else acc.push([rel, path.join(d, ent.name)]);
    }
  })(dir, '');
  return acc;
}

check('census positive control: each violation class is flagged against raw text', () => {
  // Durable RED proof: if the detector is ever broken or pre-strips a class, one
  // of these assertions fails. Each input names the class it must be flagged as.
  assert.ok(detectViolations('const d = "cache/gsd-plugin/gsd"').includes('cache-fallback'),
    'cache-fallback class not flagged');
  assert.ok(detectViolations('subagent_type=gsd:gsd-executor').includes('agent-ref'),
    'agent-ref class not flagged');
  assert.ok(detectViolations('/gsd:plan-phase').includes('namespace-prefix'),
    'namespace-prefix (slash-command) class not flagged');
  assert.ok(detectViolations('name: gsd:plan-phase').includes('namespace-prefix'),
    'namespace-prefix (frontmatter name) class not flagged');
  assert.ok(detectViolations('const re = /gsd[:-]/').includes('sanitizer-literal'),
    'sanitizer-literal class not flagged');
});

check('census positive control: an allow-listed-only input yields zero flags', () => {
  // Every token here legitimately contains gsd and must be spared. The uppercase
  // branding marker proves the case-sensitive patterns leave GSD:<section> alone.
  const allowed = [
    'gsd-plugin gsd-tools.cjs gsd://state gsd:\\/\\/phase gsd_get_state gsdParser',
    'open-gsd opengsd .gsd gsd/some-milestone GSD Get Shit Done cache/gsd-plugin/bm',
    "name:'gsd'",
    '<!-- GSD:project-start source:minimal -->',
  ].join('\n');
  assert.deepStrictEqual(detectViolations(allowed), [],
    `allow-listed-only input was flagged: ${detectViolations(allowed).join(', ')}`);
});

check('census real scan: dist/bm has zero non-allow-listed gsd tokens (skips STAMP_EXCLUDE, scans server.cjs)', () => {
  // The real proof: run the same detector over every dist/bm text file. Files in
  // STAMP_EXCLUDE (the un-stamped fallback carriers, the test fixtures, and
  // CHANGELOG.md) are skipped because they legitimately retain the gsd-form
  // literal; mcp/server.cjs is NOT excluded, so its URI-form gsd: tokens must be
  // (and are) spared by the detector's colon-then-lowercase requirement.
  const offenders = [];
  for (const [rel, abs] of distFiles(OUT)) {
    if (STAMP_EXCLUDE.has(rel)) continue;
    const buf = fs.readFileSync(abs);
    if (!isTextFile(rel, buf)) continue;
    const hits = detectViolations(buf.toString('utf8'));
    if (hits.length) offenders.push(`${rel} [${hits.join(', ')}]`);
  }
  assert.deepStrictEqual(offenders, [],
    `census flagged gsd leaks in dist/bm:\n${offenders.slice(0, 10).join('\n')}`);
});

// ─── byte-parity gate ──────────────────────────────────────────────────────

check('build-bm --check exits 0 (dist/bm is the byte-exact transform of source)', () => {
  const r = spawnSync('node', [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `--check reported drift:\n${r.stdout}${r.stderr}`);
});

// ─── footer ────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll bm-parity tests passed');
