/**
 * Tests for the SDK craft-skill write side.
 *
 * Proves the handler assesses a catalog entry through the trust gate, requires a
 * recorded approval, checks the local checkout against the pin, then writes one
 * agent_skills.<agent> entry plus a pin record whose key set and ordering match
 * the CJS twin. Scoping is proven by running the real agentSkills reader.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { insertCraftSkill, releaseCraftSkills, matchCraftSkills } from './craft-skill.js';
import { agentSkills } from './skills.js';
import { createRegistry } from './index.js';

const SHARED_CATALOG = fileURLToPath(new URL('../../shared/craft-skill-catalog.json', import.meta.url));

// The CJS record key set, in order. The SDK pin record must match it exactly.
const RECORD_KEYS = [
  'record_id',
  'id',
  'agent',
  'mode',
  'entry',
  'source',
  'skill_path',
  'pinned_commit',
  'pin_verified',
  'local_head',
  'skill_md_sha256',
  'license',
  'obligations',
  'trust_tier',
  'scripts_banned',
  'verdict',
  'approved_at',
  'inserted_at',
  'released_at',
];

type Catalog = { skills: Record<string, Record<string, unknown>> };

async function writeCatalogFixture(dir: string, mutate?: (cat: Catalog) => void): Promise<string> {
  const cat = JSON.parse(readFileSync(SHARED_CATALOG, 'utf8')) as Catalog;
  if (mutate) mutate(cat);
  const p = join(dir, 'catalog.json');
  await writeFile(p, JSON.stringify(cat, null, 2));
  return p;
}

async function writeSkill(rootDir: string, name: string, frontmatterName?: string) {
  const skillDir = join(rootDir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${frontmatterName ?? name}\ndescription: test skill\n---\n\n# ${name}\n`,
  );
  return skillDir;
}

async function writeConfig(projectDir: string, config: unknown) {
  await mkdir(join(projectDir, '.planning'), { recursive: true });
  await writeFile(join(projectDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
}

function readConfig(projectDir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(projectDir, '.planning', 'config.json'), 'utf8'));
}

function readPins(projectDir: string): { version: number; records: Record<string, unknown>[] } | null {
  const p = join(projectDir, '.planning', 'craft-skills', 'pins.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function gitInit(dir: string): string {
  const opts = { cwd: dir, stdio: 'ignore' as const };
  execSync('git init -q', opts);
  execSync('git -c user.email=t@t -c user.name=t add -A', opts);
  execSync('git -c user.email=t@t -c user.name=t commit -q -m seed', opts);
  return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
}

describe('craft-skill insert / release (SDK)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-craft-'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('needs approval and writes nothing when not approved', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    const r = await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      catalog,
    });

    expect(r.inserted).toBe(false);
    expect((r as { needs_approval: boolean }).needs_approval).toBe(true);
    expect(readConfig(tmpDir).agent_skills).toEqual({});
    expect(readPins(tmpDir)).toBeNull();
  });

  it('approved ephemeral insert writes the config entry and a 19-key pin record in the CJS order', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    const r = await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      catalog,
    });

    expect(r.inserted).toBe(true);
    expect((readConfig(tmpDir).agent_skills as Record<string, unknown>)['bm-executor']).toEqual([
      '.claude/skills/seo-audit',
    ]);

    const pins = readPins(tmpDir);
    expect(pins).not.toBeNull();
    expect(pins!.records).toHaveLength(1);
    expect(Object.keys(pins!.records[0])).toEqual(RECORD_KEYS);
    expect(pins!.records[0].mode).toBe('ephemeral');
    expect(pins!.records[0].released_at).toBeNull();
  });

  it('scopes the inserted skill to the target agent type only (through the real reader)', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      catalog,
    });

    const expected =
      '<agent_skills>\n' +
      'Read these user-configured skills:\n' +
      '- @.claude/skills/seo-audit/SKILL.md\n' +
      '</agent_skills>';

    expect((await agentSkills(['bm-executor'], tmpDir)).data).toBe(expected);
    expect((await agentSkills(['gsd-executor'], tmpDir)).data).toBe(expected);
    expect((await agentSkills(['bm-planner'], tmpDir)).data).toBe('');
    expect((await agentSkills([], tmpDir)).data).toBe('');
  });

  it('release removes the ephemeral entry; agentSkills returns empty', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      catalog,
    });

    const res = await releaseCraftSkills(tmpDir, { agent: 'bm-executor' });
    expect(res.released).toHaveLength(1);
    expect(res.remaining).toBe(0);
    expect((await agentSkills(['bm-executor'], tmpDir)).data).toBe('');

    const pins = readPins(tmpDir);
    expect(pins!.records[0].released_at).not.toBeNull();
  });

  it('sticky survives a plain release and is removed with id + includeSticky', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      sticky: true,
      catalog,
    });

    const plain = await releaseCraftSkills(tmpDir, { agent: 'bm-executor' });
    expect(plain.released).toHaveLength(0);
    expect((await agentSkills(['bm-executor'], tmpDir)).data).not.toBe('');

    const forced = await releaseCraftSkills(tmpDir, { agent: 'bm-executor', id: 'seo-audit', includeSticky: true });
    expect(forced.released).toHaveLength(1);
    expect((await agentSkills(['bm-executor'], tmpDir)).data).toBe('');
  });

  it('remembers approval across release and re-insert', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      catalog,
    });
    await releaseCraftSkills(tmpDir, { agent: 'bm-executor' });

    const reinsert = await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      catalog,
    });
    expect(reinsert.inserted).toBe(true);
    expect((await agentSkills(['bm-executor'], tmpDir)).data).not.toBe('');
  });

  it('refuses a block verdict even when approved', async () => {
    const catalog = await writeCatalogFixture(tmpDir, (cat) => {
      cat.skills['seo-audit'].license = 'UNLICENSED';
    });
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: '.claude/skills/seo-audit',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/craft-skill insert refused:/);
    expect(readPins(tmpDir)).toBeNull();
  });

  it('refuses a location that escapes the project root', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: '../outside',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/refused/);
  });

  it('refuses a plugin-form global location', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: 'global:superpowers:brainstorming',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/plugin-form/);
  });

  it('refuses a skill whose frontmatter name does not match the catalog', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit', 'wrong-name');
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: '.claude/skills/seo-audit',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/skill-name-mismatch/);
  });

  it('refuses a git checkout whose HEAD differs from the pin', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    const skillDir = await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    gitInit(skillDir); // HEAD differs from the fixture's fixed pinned_commit
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: '.claude/skills/seo-audit',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/pin-mismatch/);
  });

  it('verifies the pin when the checkout HEAD matches', async () => {
    const skillDir = await writeSkill(join(tmpDir, '.claude', 'skills'), 'seo-audit');
    const head = gitInit(skillDir);
    const catalog = await writeCatalogFixture(tmpDir, (cat) => {
      cat.skills['seo-audit'].pinned_commit = head;
    });
    await writeConfig(tmpDir, { agent_skills: {} });

    const r = await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: '.claude/skills/seo-audit',
      approved: true,
      catalog,
    });
    expect((r as { pin_verified: boolean }).pin_verified).toBe(true);
  });

  it('refuses a symlinked-out global skill by default', async () => {
    const cfgDir = join(tmpDir, 'cfg');
    vi.stubEnv('CLAUDE_CONFIG_DIR', cfgDir);
    await writeSkill(join(tmpDir, 'outside'), 'ext-skill', 'seo-audit');
    await mkdir(join(cfgDir, 'skills'), { recursive: true });
    await symlink(join(tmpDir, 'outside', 'ext-skill'), join(cfgDir, 'skills', 'ext-skill'), 'dir');

    const catalog = await writeCatalogFixture(tmpDir);
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, {
        id: 'seo-audit',
        agent: 'bm-executor',
        location: 'global:ext-skill',
        approved: true,
        catalog,
      }),
    ).rejects.toThrow(/trusted_global_roots/);
  });

  it('accepts a symlinked-out global skill listed in trusted_global_roots', async () => {
    const cfgDir = join(tmpDir, 'cfg');
    vi.stubEnv('CLAUDE_CONFIG_DIR', cfgDir);
    await writeSkill(join(tmpDir, 'outside'), 'ext-skill', 'seo-audit');
    await mkdir(join(cfgDir, 'skills'), { recursive: true });
    await symlink(join(tmpDir, 'outside', 'ext-skill'), join(cfgDir, 'skills', 'ext-skill'), 'dir');

    const catalog = await writeCatalogFixture(tmpDir);
    await writeConfig(tmpDir, {
      agent_skills: {},
      agent_skills_security: { trusted_global_roots: [resolve(tmpDir, 'outside')] },
    });

    const r = await insertCraftSkill(tmpDir, {
      id: 'seo-audit',
      agent: 'bm-executor',
      location: 'global:ext-skill',
      approved: true,
      catalog,
    });
    expect(r.inserted).toBe(true);
    expect((r as { entry: string }).entry).toBe('global:ext-skill');
  });

  it('throws on an unknown catalog id', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    await writeConfig(tmpDir, { agent_skills: {} });

    await expect(
      insertCraftSkill(tmpDir, { id: 'does-not-exist', agent: 'bm-executor', location: '.', approved: true, catalog }),
    ).rejects.toThrow(/unknown catalog id/);
  });
});

describe('craft-skill match (SDK)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-craft-match-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('matches an SEO scope to the seo-audit candidate with the gate inputs inline', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    const r = matchCraftSkills({ scope: 'Audit my site SEO and fix the sitemap', catalog });
    expect(r.scope).toBe('Audit my site SEO and fix the sitemap');
    expect(r.candidates.map((c) => c.id)).toEqual(['seo-audit']);
    const c = r.candidates[0];
    expect(c.matched_triggers).toEqual(['seo', 'sitemap']);
    expect(c.verdict).toBe('allow');
    expect(c.publisher_label).toMatch(/^published by/);
    expect(c.obligations.length).toBeGreaterThan(0);
    expect(c.prompt.some((line) => line.startsWith('Publisher:'))).toBe(true);
  });

  it('matches a data scope to the duckdb-query candidate', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    const r = matchCraftSkills({ scope: 'ad-hoc SQL over Parquet files with DuckDB', catalog });
    expect(r.candidates.map((c) => c.id)).toEqual(['duckdb-query']);
    expect(r.candidates[0].matched_triggers).toEqual(['ad-hoc sql', 'duckdb', 'parquet']);
  });

  it('returns no candidates and echoes the scope for an unrelated scope', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    const r = matchCraftSkills({ scope: 'schedule the quarterly team offsite', catalog });
    expect(r.candidates).toEqual([]);
    expect(r.scope).toBe('schedule the quarterly team offsite');
  });

  it('treats a scope with shell metacharacters as data and still matches', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    const scope = '$(echo pwned); seo';
    const r = matchCraftSkills({ scope, catalog });
    expect(r.scope).toBe(scope);
    expect(r.candidates.map((c) => c.id)).toEqual(['seo-audit']);
  });

  it('throws a GSDError for a blank scope', async () => {
    const catalog = await writeCatalogFixture(tmpDir);
    expect(() => matchCraftSkills({ scope: '   ', catalog })).toThrow(/craft-skill match/);
  });

  it('reports verdict flag for a copyleft candidate', async () => {
    const catalog = await writeCatalogFixture(tmpDir, (cat) => {
      cat.skills['duckdb-query'].license = 'GPL-3.0-only';
    });
    const r = matchCraftSkills({ scope: 'ad-hoc SQL over Parquet files with DuckDB', catalog });
    expect(r.candidates.map((c) => c.id)).toEqual(['duckdb-query']);
    expect(r.candidates[0].verdict).toBe('flag');
  });
});

describe('craft-skill registry', () => {
  it('registers craft-skill.insert and craft-skill release in createRegistry', () => {
    const commands = createRegistry().commands();
    expect(commands).toContain('craft-skill.insert');
    expect(commands).toContain('craft-skill release');
  });

  it('registers craft-skill.match and craft-skill match in createRegistry', () => {
    const commands = createRegistry().commands();
    expect(commands).toContain('craft-skill.match');
    expect(commands).toContain('craft-skill match');
  });
});
