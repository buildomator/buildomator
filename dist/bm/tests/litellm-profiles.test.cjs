'use strict';

// litellm-* profiles: per-tier runtime split in the CJS resolver.
// Run: timeout 120 /opt/homebrew/opt/node@22/bin/node --test tests/litellm-profiles.test.cjs

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const core = require('../bin/lib/core.cjs');

const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';

let tmp;
let stderrChunks;
let realWrite;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'litellm-prof-'));
  fs.mkdirSync(path.join(tmp, '.planning'), { recursive: true });
  core._resetRuntimeWarningCacheForTests();
  stderrChunks = [];
  realWrite = process.stderr.write;
  process.stderr.write = (chunk) => { stderrChunks.push(String(chunk)); return true; };
});

afterEach(() => {
  process.stderr.write = realWrite;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function setConfig(cfg) {
  fs.writeFileSync(path.join(tmp, '.planning', 'config.json'), JSON.stringify(cfg));
}
function resolve(agent) {
  return core.resolveModelInternal(tmp, agent);
}
const LOCAL = { opus: 'local-big', sonnet: 'local-mid', haiku: 'local-small' };

// Agents by tier: bm-planner is opus under both bases, bm-executor is sonnet,
// bm-codebase-mapper is haiku.

test('litellm-full: every tier resolves to a local id', () => {
  setConfig({ model_profile: 'litellm-full', litellm: { models: LOCAL } });
  assert.strictEqual(resolve('bm-planner'), 'local-big');
  assert.strictEqual(resolve('bm-executor'), 'local-mid');
  assert.strictEqual(resolve('bm-codebase-mapper'), 'local-small');
});

for (const tier of ['opus', 'sonnet', 'haiku']) {
  test(`litellm-full: unset ${tier} tier hard-errors`, () => {
    const models = { ...LOCAL };
    delete models[tier];
    setConfig({ model_profile: 'litellm-full', litellm: { models } });
    const agent = { opus: 'bm-planner', sonnet: 'bm-executor', haiku: 'bm-codebase-mapper' }[tier];
    assert.throws(() => resolve(agent), new RegExp(`needs a local model id for the ${tier} tier`));
  });
}

test('litellm-adaptive: opus stays Anthropic, sonnet and haiku go local', () => {
  setConfig({ model_profile: 'litellm-adaptive', litellm: { models: LOCAL } });
  assert.strictEqual(resolve('bm-planner'), OPUS);
  assert.strictEqual(resolve('bm-executor'), 'local-mid');
  assert.strictEqual(resolve('bm-codebase-mapper'), 'local-small');
});

test('litellm-balanced: planner and eval-planner stay Anthropic, executor goes local', () => {
  setConfig({ model_profile: 'litellm-balanced', litellm: { models: LOCAL } });
  assert.strictEqual(resolve('bm-planner'), OPUS);
  assert.strictEqual(resolve('bm-eval-planner'), OPUS);
  assert.strictEqual(resolve('bm-executor'), 'local-mid');
  assert.strictEqual(resolve('bm-codebase-mapper'), 'local-small');
});

for (const profile of ['litellm-adaptive', 'litellm-balanced']) {
  test(`${profile}: unset sonnet and haiku warn and pass through to Anthropic`, () => {
    setConfig({ model_profile: profile });
    assert.strictEqual(resolve('bm-executor'), SONNET);
    assert.strictEqual(resolve('bm-codebase-mapper'), HAIKU);
    const warnings = stderrChunks.filter((c) => c.includes('litellm.models.'));
    assert.strictEqual(warnings.length, 2);
    // one-time: resolving again does not warn again
    resolve('bm-executor');
    assert.strictEqual(stderrChunks.filter((c) => c.includes('litellm.models.sonnet')).length, 1);
  });
}

test('a swapped local id flows through unchanged', () => {
  setConfig({ model_profile: 'litellm-adaptive', litellm: { models: { sonnet: 'deepseek-coder', haiku: 'deepseek-small' } } });
  assert.strictEqual(resolve('bm-executor'), 'deepseek-coder');
  assert.strictEqual(resolve('bm-codebase-mapper'), 'deepseek-small');
});

test('explicit model_profile_overrides.litellm wins over litellm.models', () => {
  setConfig({
    model_profile: 'litellm-adaptive',
    litellm: { models: LOCAL },
    model_profile_overrides: { litellm: { sonnet: 'override-mid' } },
  });
  assert.strictEqual(resolve('bm-executor'), 'override-mid');
  assert.strictEqual(resolve('bm-codebase-mapper'), 'local-small');
});

test('per-agent model_overrides still beats the litellm split', () => {
  setConfig({ model_profile: 'litellm-full', litellm: { models: LOCAL }, model_overrides: { 'bm-executor': 'pinned-model' } });
  assert.strictEqual(resolve('bm-executor'), 'pinned-model');
});

test('legacy gsd- agent names resolve the same as bm- names', () => {
  setConfig({ model_profile: 'litellm-adaptive', litellm: { models: LOCAL } });
  assert.strictEqual(resolve('gsd-executor'), 'local-mid');
});

test('config-set-model-profile accepts the three litellm profiles', () => {
  const { VALID_PROFILES } = require('../bin/lib/model-catalog.cjs');
  for (const p of ['litellm-full', 'litellm-adaptive', 'litellm-balanced']) {
    assert.ok(VALID_PROFILES.includes(p), p);
  }
  const { execFileSync } = require('node:child_process');
  const tools = path.resolve(__dirname, '..', 'bin', 'gsd-tools.cjs');
  setConfig({ model_profile: 'balanced' });
  for (const p of ['litellm-full', 'litellm-adaptive', 'litellm-balanced']) {
    execFileSync(process.execPath, [tools, 'config-set-model-profile', p, '--cwd', tmp], { stdio: 'pipe' });
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(saved.model_profile, p);
  }
});

test('litellm config keys validate in the CJS schema', () => {
  const schema = require('../bin/lib/config-schema.cjs');
  for (const k of ['litellm.api_base', 'litellm.models.opus', 'litellm.models.sonnet', 'litellm.models.haiku', 'model_profile_overrides.litellm.sonnet']) {
    assert.ok(schema.isValidConfigKey(k), k);
  }
  assert.ok(!schema.isValidConfigKey('litellm.models.fable'));
});

test('loadConfig maps litellm.models onto the override seam', () => {
  setConfig({ litellm: { models: LOCAL }, model_profile_overrides: { litellm: { opus: 'x-big' } } });
  const cfg = core.loadConfig(tmp);
  assert.strictEqual(cfg.model_profile_overrides.litellm.opus, 'x-big');
  assert.strictEqual(cfg.model_profile_overrides.litellm.sonnet, 'local-mid');
  assert.strictEqual(cfg.model_profile_overrides.litellm.haiku, 'local-small');
});
