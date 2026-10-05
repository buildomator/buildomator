'use strict';

// Proves the craft-skill catalog is valid, holds exactly the seed entries,
// carries metadata and pins only (no vendored skill bodies), and that the
// closed-schema validator rejects the body-smuggling and floating-ref cases.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cat = require(path.join(ROOT, 'bin', 'lib', 'craft-skill-catalog.cjs'));
const rawText = fs.readFileSync(path.join(ROOT, 'sdk', 'shared', 'craft-skill-catalog.json'), 'utf-8');
const raw = JSON.parse(rawText);

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

const clone = () => JSON.parse(JSON.stringify(cat.catalog));
const SEO_SHA = 'dda3841f0b294e01e93b1541486beefbfab0915e';
const DUCKDB_SHA = '7feda8e01e22bc0886c86123f3884947e36d8c69';

// ─── 1. Committed catalog validates ──────────────────────────────────────────
const committed = cat.validateCraftSkillCatalog(cat.catalog);
ok('committed catalog validates', committed.valid === true && committed.errors.length === 0);

// ─── 2. Seed entries present and correct ─────────────────────────────────────
const seo = cat.CRAFT_SKILLS_BY_ID['seo-audit'];
const duck = cat.CRAFT_SKILLS_BY_ID['duckdb-query'];
ok('seed seo-audit exists', !!seo);
ok('seed duckdb-query exists', !!duck);
ok('seo-audit license MIT', seo && seo.license === 'MIT');
ok('duckdb-query license MIT', duck && duck.license === 'MIT');
ok('seo-audit pinned commit matches', seo && seo.pinned_commit === SEO_SHA);
ok('duckdb-query pinned commit matches', duck && duck.pinned_commit === DUCKDB_SHA);
ok('seo-audit publisher coreyhaines31', seo && seo.publisher === 'coreyhaines31');
ok('duckdb-query publisher duckdb', duck && duck.publisher === 'duckdb');
ok('seo-audit trust_tier A', seo && seo.trust_tier === 'A');
ok('duckdb-query trust_tier B', duck && duck.trust_tier === 'B');
ok('seo-audit bundles_scripts false', seo && seo.bundles_scripts === false);
ok('duckdb-query bundles_scripts false', duck && duck.bundles_scripts === false);
ok('duckdb-query declares tooling with a license',
  duck && Array.isArray(duck.tooling) && duck.tooling.length > 0 && typeof duck.tooling[0].license === 'string');

// ─── 3. Derived views ────────────────────────────────────────────────────────
ok('trigger index duckdb -> duckdb-query', cat.CRAFT_SKILL_TRIGGER_INDEX['duckdb'].includes('duckdb-query'));
ok('trigger index seo -> seo-audit', cat.CRAFT_SKILL_TRIGGER_INDEX['seo'].includes('seo-audit'));
ok('publisher allowlist holds both', cat.PUBLISHER_ALLOWLIST.has('coreyhaines31') && cat.PUBLISHER_ALLOWLIST.has('duckdb'));

// ─── 4. No-vendoring: metadata + pins only ───────────────────────────────────
let allKeysKnown = true;
let noOversizeString = true;
for (const entry of Object.values(cat.catalog.skills)) {
  for (const k of Object.keys(entry)) {
    if (!cat.ENTRY_KEYS.includes(k)) allKeysKnown = false;
  }
  for (const v of Object.values(entry)) {
    if (typeof v === 'string' && v.length > cat.MAX_STRING_LENGTH) noOversizeString = false;
  }
}
ok('every entry key is in ENTRY_KEYS', allKeysKnown);
ok('no entry string value exceeds the 400-char cap', noOversizeString);

// FORBIDDEN_KEYS never appear as JSON keys in the raw catalog text
let noForbiddenKeyInText = true;
for (const fk of cat.FORBIDDEN_KEYS) {
  if (new RegExp('"' + fk + '"\\s*:').test(rawText)) noForbiddenKeyInText = false;
}
ok('no forbidden key (body/instructions/...) appears as a JSON key', noForbiddenKeyInText);
ok('raw text carries no "body" key', !/"body"\s*:/.test(rawText));
ok('raw text carries no "instructions" key', !/"instructions"\s*:/.test(rawText));

// No copied skill tree anywhere in the repo
ok('no copied skills/seo-audit dir', !fs.existsSync(path.join(ROOT, 'skills', 'seo-audit')));
ok('no copied skills/query dir', !fs.existsSync(path.join(ROOT, 'skills', 'query')));
ok('no copied sdk/shared/seo-audit dir', !fs.existsSync(path.join(ROOT, 'sdk', 'shared', 'seo-audit')));
ok('no copied sdk/shared/query dir', !fs.existsSync(path.join(ROOT, 'sdk', 'shared', 'query')));
const craftFiles = fs.readdirSync(path.join(ROOT, 'sdk', 'shared')).filter((f) => f.startsWith('craft-skill'));
ok('sdk/shared holds exactly one craft-skill* file', craftFiles.length === 1);

// ─── 5. License policy ───────────────────────────────────────────────────────
ok('allow list is exactly MIT/Apache-2.0/BSD-2/BSD-3/ISC',
  JSON.stringify(raw.licensePolicy.allow) === JSON.stringify(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']));
let everyFlagHasObligation = true;
for (const id of [].concat(raw.licensePolicy.allow, raw.licensePolicy.flagCopyleft, raw.licensePolicy.flagSourceAvailable)) {
  if (typeof raw.licensePolicy.obligations[id] !== 'string' || raw.licensePolicy.obligations[id].length === 0) {
    everyFlagHasObligation = false;
  }
}
ok('every allow/flag SPDX id has an obligations line', everyFlagHasObligation);

// ─── 6. Negative fixtures ────────────────────────────────────────────────────
function expectInvalid(label, mutate, needle) {
  const c = clone();
  mutate(c);
  const v = cat.validateCraftSkillCatalog(c);
  ok(label, v.valid === false && v.errors.join('\n').includes(needle));
}

expectInvalid('rejects a smuggled body key', (c) => { c.skills['seo-audit'].body = 'some skill text'; }, 'body');
expectInvalid('rejects pinned_commit "HEAD"', (c) => { c.skills['seo-audit'].pinned_commit = 'HEAD'; }, 'pinned_commit');
expectInvalid('rejects a 7-char short sha', (c) => { c.skills['seo-audit'].pinned_commit = 'dda3841'; }, 'pinned_commit');
expectInvalid('rejects an unknown publisher', (c) => { c.skills['seo-audit'].publisher = 'mystery-vendor'; }, 'is not in the publishers map');
expectInvalid('rejects a 401-char string field', (c) => { c.skills['seo-audit'].summary = 'x'.repeat(401); }, '400-char cap');
expectInvalid('rejects trust_tier "D"', (c) => { c.skills['seo-audit'].trust_tier = 'D'; }, 'trust_tier');

// ─── 7. Env override fails closed on an invalid file ─────────────────────────
let tmpDir = null;
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-skill-cat-'));
  const badPath = path.join(tmpDir, 'craft-skill-catalog.json');
  const bad = clone();
  bad.skills['seo-audit'].pinned_commit = 'HEAD';
  fs.writeFileSync(badPath, JSON.stringify(bad));
  process.env.GSD_CRAFT_SKILL_CATALOG = badPath;
  let threw = false;
  let message = '';
  try {
    cat.loadCraftSkillCatalog();
  } catch (e) {
    threw = true;
    message = String(e.message || '');
  }
  ok('env override: invalid catalog throws', threw);
  ok('env override: error message prefix', message.startsWith('craft-skill-catalog.json invalid:'));
} finally {
  delete process.env.GSD_CRAFT_SKILL_CATALOG;
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── Report ──────────────────────────────────────────────────────────────────
for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
