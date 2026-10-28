/**
 * litellm-* profile resolution: SDK resolveModel handler (agent context) and
 * the session-runner resolver (no agent context), plus a parity check against
 * the CJS resolver in bin/lib/core.cjs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolveModel } from './config-query.js';
import { resolveModel as sessionResolveModel } from '../session-runner.js';
import { resetLitellmWarningsForTests } from '../litellm-resolve.js';
import type { GSDConfig } from '../config.js';

const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';
const LOCAL = { opus: 'local-big', sonnet: 'local-mid', haiku: 'local-small' };

let tmpDir: string;
let stderr: string[];

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-litellm-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  resetLitellmWarningsForTests();
  stderr = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(cfg: Record<string, unknown>): Promise<void> {
  await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify(cfg));
}

/** Config for a profile with the local map set via the override seam directly. */
function seamConfig(profile: string, local: Record<string, string> = LOCAL): Record<string, unknown> {
  return { model_profile: profile, model_profile_overrides: { litellm: local } };
}

async function modelFor(agent: string): Promise<string> {
  const r = await resolveModel([agent], tmpDir);
  return (r.data as { model: string }).model;
}

const AGENTS = { opus: 'bm-planner', sonnet: 'bm-executor', haiku: 'bm-codebase-mapper' } as const;

describe('resolveModel handler: litellm profiles', () => {
  it('litellm-full: every tier is local', async () => {
    await writeConfig(seamConfig('litellm-full'));
    expect(await modelFor(AGENTS.opus)).toBe('local-big');
    expect(await modelFor(AGENTS.sonnet)).toBe('local-mid');
    expect(await modelFor(AGENTS.haiku)).toBe('local-small');
  });

  for (const tier of ['opus', 'sonnet', 'haiku'] as const) {
    it(`litellm-full: unset ${tier} tier hard-errors`, async () => {
      const local = { ...LOCAL } as Record<string, string>;
      delete local[tier];
      await writeConfig(seamConfig('litellm-full', local));
      await expect(resolveModel([AGENTS[tier]], tmpDir)).rejects.toThrow(
        new RegExp(`needs a local model id for the ${tier} tier`),
      );
    });
  }

  it('litellm-adaptive: opus stays Anthropic, sonnet and haiku are local', async () => {
    await writeConfig(seamConfig('litellm-adaptive'));
    expect(await modelFor(AGENTS.opus)).toBe(OPUS);
    expect(await modelFor(AGENTS.sonnet)).toBe('local-mid');
    expect(await modelFor(AGENTS.haiku)).toBe('local-small');
  });

  it('litellm-balanced: planner and eval-planner stay Anthropic, executor is local', async () => {
    await writeConfig(seamConfig('litellm-balanced'));
    expect(await modelFor('bm-planner')).toBe(OPUS);
    expect(await modelFor('bm-eval-planner')).toBe(OPUS);
    expect(await modelFor('bm-executor')).toBe('local-mid');
    expect(await modelFor('bm-codebase-mapper')).toBe('local-small');
  });

  for (const profile of ['litellm-adaptive', 'litellm-balanced']) {
    it(`${profile}: unset sonnet and haiku warn once and pass through to Anthropic`, async () => {
      await writeConfig({ model_profile: profile });
      expect(await modelFor('bm-executor')).toBe(SONNET);
      expect(await modelFor('bm-codebase-mapper')).toBe(HAIKU);
      expect(stderr.filter((c) => c.includes('litellm.models.')).length).toBe(2);
      await modelFor('bm-executor');
      expect(stderr.filter((c) => c.includes('litellm.models.sonnet')).length).toBe(1);
    });
  }

  it('a swapped local id flows through unchanged', async () => {
    await writeConfig(seamConfig('litellm-adaptive', { sonnet: 'deepseek-coder', haiku: 'deepseek-small' }));
    expect(await modelFor('bm-executor')).toBe('deepseek-coder');
    expect(await modelFor('bm-codebase-mapper')).toBe('deepseek-small');
  });

  it('per-agent model_overrides still beats the litellm split', async () => {
    await writeConfig({ ...seamConfig('litellm-full'), model_overrides: { 'bm-executor': 'pinned-model' } });
    expect(await modelFor('bm-executor')).toBe('pinned-model');
  });
});

describe('session-runner resolveModel: litellm profiles (no agent context)', () => {
  const cfg = (profile: string, local?: Record<string, string>) =>
    ({ model_profile: profile, model_profile_overrides: local ? { litellm: local } : undefined }) as unknown as GSDConfig;

  it('never returns the raw profile string', () => {
    for (const p of ['litellm-full', 'litellm-adaptive', 'litellm-balanced']) {
      expect(sessionResolveModel(undefined, cfg(p, LOCAL))).toBe('local-mid');
    }
  });

  it('litellm-full hard-errors when the sonnet tier is unset', () => {
    expect(() => sessionResolveModel(undefined, cfg('litellm-full', { opus: 'a', haiku: 'b' }))).toThrow(
      /needs a local model id for the sonnet tier/,
    );
  });

  it('hybrid profiles warn and pass through to Anthropic sonnet when unset', () => {
    expect(sessionResolveModel(undefined, cfg('litellm-adaptive'))).toBe(SONNET);
    expect(sessionResolveModel(undefined, cfg('litellm-balanced'))).toBe(SONNET);
    expect(stderr.some((c) => c.includes('litellm.models.sonnet'))).toBe(true);
  });

  it('a swapped local id flows through unchanged', () => {
    expect(sessionResolveModel(undefined, cfg('litellm-adaptive', { sonnet: 'deepseek-coder' }))).toBe('deepseek-coder');
  });

  it('an explicit model option still wins', () => {
    expect(sessionResolveModel({ model: 'explicit' } as never, cfg('litellm-full', LOCAL))).toBe('explicit');
  });
});

describe('twin parity: CJS resolver and SDK resolvers emit identical ids', () => {
  const require_ = createRequire(import.meta.url);
  const core = require_(resolve(fileURLToPath(import.meta.url), '../../../../bin/lib/core.cjs'));

  const setups: Array<{ name: string; local: Record<string, string> }> = [
    { name: 'all local set', local: LOCAL },
    { name: 'swapped ids', local: { opus: 'ds-big', sonnet: 'ds-mid', haiku: 'ds-small' } },
    { name: 'sonnet and haiku only', local: { sonnet: 'm', haiku: 's' } },
    { name: 'nothing set', local: {} },
  ];

  for (const profile of ['litellm-full', 'litellm-adaptive', 'litellm-balanced']) {
    for (const setup of setups) {
      it(`${profile} / ${setup.name}`, async () => {
        await writeConfig({ model_profile: profile, model_profile_overrides: { litellm: setup.local } });
        for (const agent of Object.values(AGENTS)) {
          let cjs: string; let sdk: string;
          try { cjs = core.resolveModelInternal(tmpDir, agent); } catch (e) { cjs = `ERR:${(e as Error).message}`; }
          try { sdk = await modelFor(agent); } catch (e) { sdk = `ERR:${(e as Error).message}`; }
          expect(sdk, `${profile} ${agent}`).toBe(cjs);
        }
        // session-runner (sonnet tier) must agree with a sonnet-tier agent
        let cjsExec: string; let sess: string;
        try { cjsExec = core.resolveModelInternal(tmpDir, 'bm-executor'); } catch (e) { cjsExec = `ERR:${(e as Error).message}`; }
        const { loadConfig } = await import('../config.js');
        try { sess = sessionResolveModel(undefined, await loadConfig(tmpDir)) as string; } catch (e) { sess = `ERR:${(e as Error).message}`; }
        expect(sess, `${profile} session-runner`).toBe(cjsExec);
      });
    }
  }
});

describe('litellm config sugar and schema (SDK)', () => {
  it('maps litellm.models onto model_profile_overrides.litellm', async () => {
    const { loadConfig } = await import('../config.js');
    await writeConfig({ litellm: { models: LOCAL } });
    const cfg = await loadConfig(tmpDir);
    expect((cfg.model_profile_overrides as Record<string, unknown>).litellm).toEqual(LOCAL);
  });

  it('an explicit override wins over litellm.models for the same tier', async () => {
    const { loadConfig } = await import('../config.js');
    await writeConfig({ litellm: { models: LOCAL }, model_profile_overrides: { litellm: { sonnet: 'override-mid' } } });
    const cfg = await loadConfig(tmpDir);
    const lit = (cfg.model_profile_overrides as Record<string, Record<string, string>>).litellm;
    expect(lit.sonnet).toBe('override-mid');
    expect(lit.haiku).toBe('local-small');
  });

  it('resolveModel sees litellm.models via the sugar', async () => {
    await writeConfig({ model_profile: 'litellm-adaptive', litellm: { models: LOCAL } });
    expect(await modelFor('bm-executor')).toBe('local-mid');
    expect(await modelFor('bm-planner')).toBe(OPUS);
  });

  it('config keys validate and the profiles are accepted', async () => {
    const { isValidConfigKeyPath } = await import('./config-schema.js');
    const { VALID_PROFILES } = await import('../model-catalog.js');
    for (const k of ['litellm.api_base', 'litellm.models.opus', 'litellm.models.sonnet', 'litellm.models.haiku']) {
      expect(isValidConfigKeyPath(k), k).toBe(true);
    }
    expect(isValidConfigKeyPath('litellm.models.fable')).toBe(false);
    for (const p of ['litellm-full', 'litellm-adaptive', 'litellm-balanced']) {
      expect(VALID_PROFILES).toContain(p);
    }
  });
});
