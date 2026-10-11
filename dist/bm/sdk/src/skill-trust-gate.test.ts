import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import * as sdkGate from './skill-trust-gate.js';
import * as catMod from './craft-skill-catalog.js';

const require = createRequire(import.meta.url);
const cjsGate = require('../../bin/lib/skill-trust-gate.cjs');

const clone = (id: string) => JSON.parse(JSON.stringify(catMod.CRAFT_SKILLS_BY_ID[id]));
const OTHER_SHA = '0'.repeat(40);

// A fixture list that exercises every rejection and flag path. Each fixture is a
// catalog clone with one field mutated; both twins must return the same
// assessment for it.
function fixtures(): Array<{ name: string; value: unknown }> {
  const unknownPublisher = clone('seo-audit');
  unknownPublisher.publisher = 'mystery-vendor';

  const headPin = clone('seo-audit');
  headPin.pinned_commit = 'HEAD';

  const shortSha = clone('seo-audit');
  shortSha.pinned_commit = 'dda3841';

  const scriptsUnreviewed = clone('seo-audit');
  scriptsUnreviewed.bundles_scripts = true;
  scriptsUnreviewed.scripts_review = null;

  const scriptsStale = clone('seo-audit');
  scriptsStale.bundles_scripts = true;
  scriptsStale.scripts_review = { verdict: 'reviewed', commit: OTHER_SHA, reviewed_at: '2026-10-05', note: 'ok' };

  const scriptsBanned = clone('seo-audit');
  scriptsBanned.bundles_scripts = true;
  scriptsBanned.scripts_review = { verdict: 'banned', commit: scriptsBanned.pinned_commit, reviewed_at: '2026-10-05', note: 'do not run' };

  const tierC = clone('seo-audit');
  tierC.trust_tier = 'C';

  const tierBUndeclared = clone('seo-audit');
  tierBUndeclared.trust_tier = 'B';
  tierBUndeclared.bundles_scripts = false;
  tierBUndeclared.tooling = [];

  const gpl = clone('seo-audit');
  gpl.license = 'GPL-3.0-only';

  const busl = clone('seo-audit');
  busl.license = 'BUSL-1.1';

  const noLicense = clone('seo-audit');
  noLicense.license = 'NOASSERTION';

  const ncLicense = clone('seo-audit');
  ncLicense.license = 'CC-BY-NC-4.0';

  const proprietaryTooling = clone('duckdb-query');
  proprietaryTooling.tooling[0].license = 'LicenseRef-Proprietary';

  const httpSource = clone('seo-audit');
  httpSource.source = 'http://github.com/coreyhaines31/marketingskills';

  return [
    { name: 'seo seed', value: clone('seo-audit') },
    { name: 'duckdb seed', value: clone('duckdb-query') },
    { name: 'unknown publisher', value: unknownPublisher },
    { name: 'HEAD pin', value: headPin },
    { name: 'short sha', value: shortSha },
    { name: 'scripts unreviewed', value: scriptsUnreviewed },
    { name: 'scripts stale', value: scriptsStale },
    { name: 'scripts banned', value: scriptsBanned },
    { name: 'tier C', value: tierC },
    { name: 'tier B undeclared', value: tierBUndeclared },
    { name: 'GPL license', value: gpl },
    { name: 'BUSL license', value: busl },
    { name: 'no license', value: noLicense },
    { name: 'NC license', value: ncLicense },
    { name: 'proprietary tooling', value: proprietaryTooling },
    { name: 'http source', value: httpSource },
  ];
}

const SPDX_CASES = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'GPL-3.0-only',
  'AGPL-3.0-or-later',
  'MPL-2.0',
  'BUSL-1.1',
  'SSPL-1.0',
  'CC-BY-NC-4.0',
  'LicenseRef-Proprietary',
  'NOASSERTION',
  '',
  'MIT OR GPL-3.0-only',
  'MIT AND Nope-1.0',
  'Nope-1.0',
];

describe('skill trust gate twin parity', () => {
  it.each(fixtures())('assessEntry matches the CJS twin for $name', ({ value }) => {
    expect(sdkGate.assessEntry(value)).toEqual(cjsGate.assessEntry(value));
  });

  it.each(SPDX_CASES)('classifyLicense matches the CJS twin for "%s"', (spdx) => {
    expect(sdkGate.classifyLicense(spdx)).toEqual(cjsGate.classifyLicense(spdx));
  });

  it('renders the seo prompt identically across twins', () => {
    const seo = clone('seo-audit');
    expect(sdkGate.renderAssessment(sdkGate.assessEntry(seo))).toBe(
      cjsGate.renderAssessment(cjsGate.assessEntry(seo))
    );
  });

  it('never throws on bad input and blocks a non-object entry', () => {
    expect(() => sdkGate.classifyLicense(null)).not.toThrow();
    expect(() => sdkGate.checkSafety(null)).not.toThrow();
    expect(sdkGate.assessEntry('seo-audit').verdict).toBe('block');
  });
});

describe('external validation merge (applyExternalValidation)', () => {
  const firstSeedId = Object.keys(catMod.CRAFT_SKILLS_BY_ID)[0];
  const base = () => sdkGate.assessEntry(catMod.CRAFT_SKILLS_BY_ID[firstSeedId]);

  it('externalValidateArgv builds the pinned argv and SKILLS_REF_PIN is exact', () => {
    expect(sdkGate.SKILLS_REF_PIN).toBe('skills-ref@0.1.5');
    expect(sdkGate.externalValidateArgv('/x/skill')).toEqual(['--yes', 'skills-ref@0.1.5', 'validate', '/x/skill']);
    expect(Object.keys(sdkGate.SAFETY_FINDINGS).length).toBe(12);
  });

  it('a clean run keeps the verdict and inserts the external validate line', () => {
    const b = base();
    const out = sdkGate.applyExternalValidation(b, { status: 0, stdout: '', stderr: '' });
    expect(out.verdict).toBe(b.verdict);
    expect(out.prompt[out.prompt.length - 1].startsWith('Verdict:')).toBe(true);
    expect(out.prompt[out.prompt.length - 2]).toBe('External validate: skills-ref@0.1.5 clean');
    expect(b.prompt).not.toContain('External validate: skills-ref@0.1.5 clean');
    expect(sdkGate.applyExternalValidation(b, { status: 0, stdout: '', stderr: '' })).toEqual(
      cjsGate.applyExternalValidation(b, { status: 0, stdout: '', stderr: '' }),
    );
  });

  it('a non-zero exit blocks with external-validate-failed', () => {
    const out = sdkGate.applyExternalValidation(base(), {
      status: 1,
      stdout: '',
      stderr: 'Unexpected fields in frontmatter: argument-hint',
    });
    expect(out.verdict).toBe('block');
    expect(out.safety.safe).toBe(false);
    const f = out.safety.findings.find((x) => x.code === 'external-validate-failed');
    expect(f).toBeDefined();
    expect(f!.message).toContain('Unexpected fields in frontmatter: argument-hint');
    expect(out.prompt[out.prompt.length - 1]).toBe('Verdict: block');
  });

  it('a null status (spawn error) blocks with external-validate-unavailable', () => {
    const out = sdkGate.applyExternalValidation(base(), {
      status: null,
      stdout: '',
      stderr: '',
      error: 'spawn npx ENOENT',
    });
    expect(out.verdict).toBe('block');
    const f = out.safety.findings.find((x) => x.code === 'external-validate-unavailable');
    expect(f).toBeDefined();
    expect(f!.message).toContain('spawn npx ENOENT');
  });
});
