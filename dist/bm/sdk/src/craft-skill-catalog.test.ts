import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as sdk from './craft-skill-catalog.js';

const require = createRequire(import.meta.url);
const cjs = require('../../bin/lib/craft-skill-catalog.cjs');

const SEO_SHA = 'dda3841f0b294e01e93b1541486beefbfab0915e';
const DUCKDB_SHA = '7feda8e01e22bc0886c86123f3884947e36d8c69';

const clone = () => JSON.parse(JSON.stringify(sdk.catalog));

// The committed catalog plus the six negative clones the CJS test exercises.
// Each twin must return a deep-equal { valid, errors } for every one.
function fixtures(): Array<{ name: string; value: unknown }> {
  const body = clone();
  body.skills['seo-audit'].body = 'some skill text';

  const headPin = clone();
  headPin.skills['seo-audit'].pinned_commit = 'HEAD';

  const shortSha = clone();
  shortSha.skills['seo-audit'].pinned_commit = 'dda3841';

  const unknownPublisher = clone();
  unknownPublisher.skills['seo-audit'].publisher = 'mystery-vendor';

  const oversizeSummary = clone();
  oversizeSummary.skills['seo-audit'].summary = 'x'.repeat(401);

  const badTier = clone();
  badTier.skills['seo-audit'].trust_tier = 'D';

  return [
    { name: 'committed', value: clone() },
    { name: 'smuggled body key', value: body },
    { name: 'HEAD pin', value: headPin },
    { name: 'short sha', value: shortSha },
    { name: 'unknown publisher', value: unknownPublisher },
    { name: '401-char summary', value: oversizeSummary },
    { name: 'trust_tier D', value: badTier },
  ];
}

describe('craft-skill catalog SDK reader', () => {
  it('validates the committed catalog', () => {
    const v = sdk.validateCraftSkillCatalog(sdk.catalog);
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('exposes the seed entries with the expected metadata', () => {
    const seo = sdk.CRAFT_SKILLS_BY_ID['seo-audit'];
    const duck = sdk.CRAFT_SKILLS_BY_ID['duckdb-query'];
    expect(seo.license).toBe('MIT');
    expect(duck.license).toBe('MIT');
    expect(seo.pinned_commit).toBe(SEO_SHA);
    expect(duck.pinned_commit).toBe(DUCKDB_SHA);
    expect(seo.publisher).toBe('coreyhaines31');
    expect(duck.publisher).toBe('duckdb');
    expect(seo.trust_tier).toBe('A');
    expect(duck.trust_tier).toBe('B');
    expect(seo.bundles_scripts).toBe(false);
    expect(duck.bundles_scripts).toBe(false);
    expect(duck.tooling[0].license).toBe('MIT');
  });

  it('matches the CJS twin on every fixture', () => {
    for (const f of fixtures()) {
      expect(sdk.validateCraftSkillCatalog(f.value), f.name).toEqual(cjs.validateCraftSkillCatalog(f.value));
    }
  });

  it('agrees with the CJS twin on derived views', () => {
    const sdkViews = sdk.deriveCatalogViews(sdk.catalog);
    const cjsViews = cjs.deriveCatalogViews(cjs.catalog);
    expect(Object.keys(sdkViews.CRAFT_SKILLS_BY_ID).sort()).toEqual(Object.keys(cjsViews.CRAFT_SKILLS_BY_ID).sort());
    expect(sdkViews.CRAFT_SKILL_TRIGGER_INDEX).toEqual(cjsViews.CRAFT_SKILL_TRIGGER_INDEX);
    expect([...sdkViews.PUBLISHER_ALLOWLIST].sort()).toEqual([...cjsViews.PUBLISHER_ALLOWLIST].sort());
  });

  it('fails closed when loading an invalid catalog file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'craft-skill-cat-sdk-'));
    const badPath = join(dir, 'craft-skill-catalog.json');
    const bad = clone();
    bad.skills['seo-audit'].pinned_commit = 'HEAD';
    writeFileSync(badPath, JSON.stringify(bad));
    try {
      expect(() => sdk.loadCraftSkillCatalog(badPath)).toThrow(/craft-skill-catalog\.json invalid:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
