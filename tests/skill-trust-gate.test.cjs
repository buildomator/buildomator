'use strict';

// Rejection and flag matrix for the two-axis trust gate (bin/lib/skill-trust-gate.cjs).
// Each behavior is its own check so a failure names exactly what broke. The gate
// must never throw on bad input and never read a skill body; this harness only
// feeds it catalog metadata and clones of the seed entries.

const gate = require('../bin/lib/skill-trust-gate.cjs');
const { CRAFT_SKILLS_BY_ID, catalog } = require('../bin/lib/craft-skill-catalog.cjs');

const checks = [];

function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const clone = (id) => JSON.parse(JSON.stringify(CRAFT_SKILLS_BY_ID[id]));
const codesOf = (entry) => gate.checkSafety(entry).findings.map((f) => f.code);
const OTHER_SHA = '0'.repeat(40);

// --- classifyLicense -------------------------------------------------------

check('classifyLicense MIT -> allow permissive with MIT obligations', () => {
  const r = gate.classifyLicense('MIT');
  assert(r.verdict === 'allow', `verdict ${r.verdict}`);
  assert(r.category === 'permissive', `category ${r.category}`);
  assert(r.obligations === catalog.licensePolicy.obligations.MIT, 'obligations mismatch');
});

check('classifyLicense GPL-3.0-only -> flag copyleft', () => {
  const r = gate.classifyLicense('GPL-3.0-only');
  assert(r.verdict === 'flag' && r.category === 'copyleft', JSON.stringify(r));
});

check('classifyLicense BUSL-1.1 -> flag source-available', () => {
  const r = gate.classifyLicense('BUSL-1.1');
  assert(r.verdict === 'flag' && r.category === 'source-available', JSON.stringify(r));
});

check('classifyLicense empty string -> block no-license', () => {
  const r = gate.classifyLicense('');
  assert(r.verdict === 'block' && r.category === 'no-license', JSON.stringify(r));
});

check('classifyLicense undefined -> block no-license', () => {
  const r = gate.classifyLicense(undefined);
  assert(r.verdict === 'block' && r.category === 'no-license', JSON.stringify(r));
});

check('classifyLicense NOASSERTION -> block no-license', () => {
  const r = gate.classifyLicense('NOASSERTION');
  assert(r.verdict === 'block' && r.category === 'no-license', JSON.stringify(r));
});

check('classifyLicense NONE -> block no-license', () => {
  const r = gate.classifyLicense('NONE');
  assert(r.verdict === 'block' && r.category === 'no-license', JSON.stringify(r));
});

check('classifyLicense CC-BY-NC-4.0 -> block non-commercial', () => {
  const r = gate.classifyLicense('CC-BY-NC-4.0');
  assert(r.verdict === 'block' && r.category === 'non-commercial', JSON.stringify(r));
});

check('classifyLicense LicenseRef-Proprietary -> block proprietary', () => {
  const r = gate.classifyLicense('LicenseRef-Proprietary');
  assert(r.verdict === 'block' && r.category === 'proprietary', JSON.stringify(r));
});

check('classifyLicense made-up id -> block unknown', () => {
  const r = gate.classifyLicense('Totally-Made-Up-1.0');
  assert(r.verdict === 'block' && r.category === 'unknown', JSON.stringify(r));
});

check('classifyLicense MIT OR Apache-2.0 -> allow', () => {
  assert(gate.classifyLicense('MIT OR Apache-2.0').verdict === 'allow');
});

check('classifyLicense MIT AND GPL-3.0-only -> flag', () => {
  assert(gate.classifyLicense('MIT AND GPL-3.0-only').verdict === 'flag');
});

check('classifyLicense MIT AND Nope-1.0 -> block', () => {
  assert(gate.classifyLicense('MIT AND Nope-1.0').verdict === 'block');
});

// --- checkSafety -----------------------------------------------------------

check('checkSafety seo seed -> safe with no findings', () => {
  const r = gate.checkSafety(clone('seo-audit'));
  assert(r.safe === true && r.findings.length === 0, JSON.stringify(r.findings));
});

check('checkSafety publisher off allowlist -> publisher-not-allowlisted', () => {
  const e = clone('seo-audit');
  e.publisher = 'someone-else';
  assert(codesOf(e).includes('publisher-not-allowlisted'));
});

check('checkSafety HEAD pin -> pin-not-commit', () => {
  const e = clone('seo-audit');
  e.pinned_commit = 'HEAD';
  assert(codesOf(e).includes('pin-not-commit'));
});

check('checkSafety main pin -> pin-not-commit', () => {
  const e = clone('seo-audit');
  e.pinned_commit = 'main';
  assert(codesOf(e).includes('pin-not-commit'));
});

check('checkSafety tag pin -> pin-not-commit', () => {
  const e = clone('seo-audit');
  e.pinned_commit = 'v1.2.0';
  assert(codesOf(e).includes('pin-not-commit'));
});

check('checkSafety short sha pin -> pin-not-commit', () => {
  const e = clone('seo-audit');
  e.pinned_commit = 'dda3841';
  assert(codesOf(e).includes('pin-not-commit'));
});

check('checkSafety bundles scripts with no review -> scripts-unreviewed', () => {
  const e = clone('seo-audit');
  e.bundles_scripts = true;
  e.scripts_review = null;
  assert(codesOf(e).includes('scripts-unreviewed'));
});

check('checkSafety review at a different commit -> scripts-review-stale', () => {
  const e = clone('seo-audit');
  e.bundles_scripts = true;
  e.scripts_review = { verdict: 'reviewed', commit: OTHER_SHA, reviewed_at: '2026-10-05', note: 'ok' };
  assert(codesOf(e).includes('scripts-review-stale'));
});

check('checkSafety banned review at the pin -> safe with scripts_banned', () => {
  const e = clone('seo-audit');
  e.bundles_scripts = true;
  e.scripts_review = { verdict: 'banned', commit: e.pinned_commit, reviewed_at: '2026-10-05', note: 'do not run' };
  const r = gate.checkSafety(e);
  assert(r.safe === true, JSON.stringify(r.findings));
  assert(r.scripts_banned === true, 'scripts_banned should be true');
});

check('checkSafety trust tier C -> tier-c-hold', () => {
  const e = clone('seo-audit');
  e.trust_tier = 'C';
  assert(codesOf(e).includes('tier-c-hold'));
});

check('checkSafety tier B with no declared execution -> tier-b-undeclared-execution', () => {
  const e = clone('seo-audit');
  e.trust_tier = 'B';
  e.bundles_scripts = false;
  e.tooling = [];
  assert(codesOf(e).includes('tier-b-undeclared-execution'));
});

check('checkSafety tooling with empty license -> tooling-license-missing', () => {
  const e = clone('seo-audit');
  e.tooling = [{ name: 'x', license: '', note: '' }];
  assert(codesOf(e).includes('tooling-license-missing'));
});

check('checkSafety proprietary tooling license -> tooling-license-blocked', () => {
  const e = clone('duckdb-query');
  e.tooling[0].license = 'LicenseRef-Proprietary';
  assert(codesOf(e).includes('tooling-license-blocked'));
});

check('checkSafety http source -> source-not-https', () => {
  const e = clone('seo-audit');
  e.source = 'http://github.com/coreyhaines31/marketingskills';
  assert(codesOf(e).includes('source-not-https'));
});

check('checkSafety ssh source -> source-not-https', () => {
  const e = clone('seo-audit');
  e.source = 'git@github.com:coreyhaines31/marketingskills.git';
  assert(codesOf(e).includes('source-not-https'));
});

// --- assessEntry -----------------------------------------------------------

check('assessEntry seo seed -> allow', () => {
  assert(gate.assessEntry(clone('seo-audit')).verdict === 'allow');
});

check('assessEntry duckdb seed (tier B, declared MIT tooling) -> allow', () => {
  assert(gate.assessEntry(clone('duckdb-query')).verdict === 'allow');
});

check('assessEntry GPL license -> flag', () => {
  const e = clone('seo-audit');
  e.license = 'GPL-3.0-only';
  assert(gate.assessEntry(e).verdict === 'flag');
});

check('assessEntry unknown publisher -> block', () => {
  const e = clone('seo-audit');
  e.publisher = 'mystery-vendor';
  assert(gate.assessEntry(e).verdict === 'block');
});

check('flags are not blocks: GPL entry assesses flag with safe safety', () => {
  const e = clone('seo-audit');
  e.license = 'GPL-3.0-only';
  const a = gate.assessEntry(e);
  assert(a.verdict === 'flag', `verdict ${a.verdict}`);
  assert(a.safety.safe === true, 'safety should be safe');
});

check('obligations surfaced: seo prompt carries the MIT obligations line', () => {
  const a = gate.assessEntry(clone('seo-audit'));
  const line = a.prompt.find((l) => l.startsWith('Obligations: '));
  assert(line !== undefined, 'no obligations line');
  assert(line === `Obligations: ${catalog.licensePolicy.obligations.MIT}`, line);
});

check('tooling license is checked independently of the skill license', () => {
  const e = clone('duckdb-query');
  e.tooling[0].license = 'LicenseRef-Proprietary';
  const a = gate.assessEntry(e);
  assert(e.license === 'MIT', 'precondition: skill license is MIT');
  assert(a.verdict === 'block', `verdict ${a.verdict}`);
});

check('renderAssessment surfaces facts and no endorsement words', () => {
  const a = gate.assessEntry(clone('seo-audit'));
  const text = gate.renderAssessment(a);
  assert(text.includes('published by Corey Haines (marketingskills)'), 'publisher label missing');
  assert(text.includes('MIT'), 'license missing');
  assert(text.includes('Obligations: '), 'obligations line missing');
  assert(text.includes('Trust tier: A'), 'trust tier missing');
  assert(text.includes('dda3841f0b294e01e93b1541486beefbfab0915e'), 'pinned sha missing');
  assert(!/recommended|endorsed|trusted by/i.test(text), 'endorsement wording present');
});

// --- external validation merge ---------------------------------------------

const firstSeed = () => gate.assessEntry(CRAFT_SKILLS_BY_ID[Object.keys(CRAFT_SKILLS_BY_ID)[0]], catalog);

check('external validation: externalValidateArgv builds the pinned argv and the table has 12 codes', () => {
  assert(gate.SKILLS_REF_PIN === 'skills-ref@0.1.5', `pin ${gate.SKILLS_REF_PIN}`);
  assert(gate.externalValidateArgv('/x/skill').join(' ') === '--yes skills-ref@0.1.5 validate /x/skill', 'argv mismatch');
  assert(Object.keys(gate.SAFETY_FINDINGS).length === 12, `finding count ${Object.keys(gate.SAFETY_FINDINGS).length}`);
});

check('external validation: clean run keeps the verdict and inserts the clean line before Verdict', () => {
  const base = firstSeed();
  const out = gate.applyExternalValidation(base, { status: 0, stdout: '', stderr: '' });
  assert(out.verdict === base.verdict, `verdict changed to ${out.verdict}`);
  assert(JSON.stringify(out.safety) === JSON.stringify(base.safety), 'safety changed');
  const last = out.prompt[out.prompt.length - 1];
  const prev = out.prompt[out.prompt.length - 2];
  assert(last.startsWith('Verdict:'), `last line ${last}`);
  assert(prev === 'External validate: skills-ref@0.1.5 clean', `prev line ${prev}`);
  assert(base.prompt[base.prompt.length - 1].startsWith('Verdict:'), 'input prompt mutated');
  assert(!base.prompt.includes('External validate: skills-ref@0.1.5 clean'), 'input prompt gained the clean line');
});

check('external validation: a non-zero exit blocks with external-validate-failed', () => {
  const base = firstSeed();
  const out = gate.applyExternalValidation(base, { status: 1, stdout: '', stderr: 'Unexpected fields in frontmatter: argument-hint' });
  assert(out.verdict === 'block', `verdict ${out.verdict}`);
  assert(out.safety.safe === false, 'safety.safe should be false');
  const f = out.safety.findings.find((x) => x.code === 'external-validate-failed');
  assert(f, 'no external-validate-failed finding');
  assert(f.message.includes('Unexpected fields in frontmatter: argument-hint'), `message ${f.message}`);
  assert(out.prompt[out.prompt.length - 1] === 'Verdict: block', `last ${out.prompt[out.prompt.length - 1]}`);
  assert(out.prompt[out.prompt.length - 2].startsWith('Finding: '), `prev ${out.prompt[out.prompt.length - 2]}`);
});

check('external validation: a null status (spawn error) blocks with external-validate-unavailable', () => {
  const base = firstSeed();
  const out = gate.applyExternalValidation(base, { status: null, stdout: '', stderr: '', error: 'spawn npx ENOENT' });
  assert(out.verdict === 'block', `verdict ${out.verdict}`);
  const f = out.safety.findings.find((x) => x.code === 'external-validate-unavailable');
  assert(f, 'no external-validate-unavailable finding');
  assert(f.message.includes('spawn npx ENOENT'), `message ${f.message}`);
});

// --- never throws ----------------------------------------------------------

check('classifyLicense(null) returns an object', () => {
  const r = gate.classifyLicense(null);
  assert(r && typeof r === 'object' && r.verdict === 'block', JSON.stringify(r));
});

check('checkSafety(null) returns an object with entry-malformed', () => {
  const r = gate.checkSafety(null);
  assert(r && typeof r === 'object' && r.safe === false, JSON.stringify(r));
  assert(r.findings.map((f) => f.code).includes('entry-malformed'));
});

check('checkSafety({}) returns an object with entry-malformed', () => {
  const r = gate.checkSafety({});
  assert(r && typeof r === 'object' && r.findings.map((f) => f.code).includes('entry-malformed'));
});

check('assessEntry of a non-object returns verdict block', () => {
  const r = gate.assessEntry('seo-audit');
  assert(r && typeof r === 'object' && r.verdict === 'block', JSON.stringify(r));
});

// --- report ----------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const [ok, name] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name}`); }
}
console.log(`\n${passed} passed, ${failed} failed, ${checks.length} total`);
if (failed > 0) process.exit(1);
