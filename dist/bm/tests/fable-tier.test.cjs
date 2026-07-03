'use strict';

// Regression test for the Claude Fable 5 model tier (v3.4.4).
//
// Fable 5 (claude-fable-5) is a new top tier ABOVE opus. It is added as a
// first-class model tier in the catalog and wired as the quality-profile
// default for the heaviest (routingTier: heavy) agents. Anthropic-compatible
// runtimes get the real model; non-Claude runtimes alias fable to their most
// capable model so a fable-tier agent still resolves there.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mc = require(path.join(ROOT, 'bin', 'lib', 'model-catalog.cjs'));
const schema = require(path.join(ROOT, 'bin', 'lib', 'config-schema.cjs'));

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

// ─── 1. Catalog: fable model per runtime ─────────────────────────────────────
const rp = mc.RUNTIME_PROFILE_MAP;
ok('claude.fable -> claude-fable-5', rp.claude.fable && rp.claude.fable.model === 'claude-fable-5');
ok('copilot.fable -> claude-fable-5', rp.copilot.fable && rp.copilot.fable.model === 'claude-fable-5');
ok('opencode.fable -> anthropic/claude-fable-5', rp.opencode.fable && rp.opencode.fable.model === 'anthropic/claude-fable-5');
ok('hermes.fable -> anthropic/claude-fable-5', rp.hermes.fable && rp.hermes.fable.model === 'anthropic/claude-fable-5');
// non-Claude runtimes alias fable to their top (opus-equivalent) model
ok('codex.fable aliases to gpt-5.4 (opus-equivalent)', rp.codex.fable && rp.codex.fable.model === 'gpt-5.4');
ok('gemini.fable aliases to gemini-3-pro', rp.gemini.fable && rp.gemini.fable.model === 'gemini-3-pro');
ok('qwen.fable aliases to qwen3-max-2026-01-23', rp.qwen.fable && rp.qwen.fable.model === 'qwen3-max-2026-01-23');

// null runtimes carry a fable: null entry (filtered out of RUNTIME_PROFILE_MAP)
const rawCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'sdk', 'shared', 'model-catalog.json'), 'utf-8'));
ok('kilo declares fable: null', rawCatalog.runtimeTierDefaults.kilo.fable === null);

// ─── 2. No regression on opus/sonnet/haiku ───────────────────────────────────
ok('claude.opus still claude-opus-4-8', rp.claude.opus.model === 'claude-opus-4-8');
ok('claude.sonnet is claude-sonnet-5', rp.claude.sonnet.model === 'claude-sonnet-5');
ok('claude.haiku still claude-haiku-4-5', rp.claude.haiku.model === 'claude-haiku-4-5');

// ─── 3. Quality profile: heavy agents -> fable; others unchanged ─────────────
const quality = mc.getAgentToModelMapForProfile('quality');
const HEAVY = ['gsd-planner', 'gsd-roadmapper', 'gsd-debugger', 'gsd-assumptions-analyzer',
  'gsd-debug-session-manager', 'gsd-eval-planner', 'gsd-framework-selector',
  'gsd-security-auditor', 'gsd-user-profiler'];
for (const a of HEAVY) ok(`quality(${a}) -> fable`, quality[a] === 'fable');
ok('quality(gsd-executor) stays opus (standard tier, not promoted)', quality['gsd-executor'] === 'opus');
ok('quality(gsd-verifier) stays sonnet', quality['gsd-verifier'] === 'sonnet');

// balanced / budget profiles untouched by the fable promotion
const balanced = mc.getAgentToModelMapForProfile('balanced');
ok('balanced(gsd-planner) still opus', balanced['gsd-planner'] === 'opus');
const budget = mc.getAgentToModelMapForProfile('budget');
ok('budget(gsd-planner) still sonnet', budget['gsd-planner'] === 'sonnet');

// ─── 4. Config-schema accepts fable in runtime overrides ─────────────────────
ok('model_profile_overrides.claude.fable is a valid config key',
  schema.isValidConfigKey('model_profile_overrides.claude.fable'));
ok('model_profile_overrides.claude.opus still valid (no regression)',
  schema.isValidConfigKey('model_profile_overrides.claude.opus'));

// ─── Report ──────────────────────────────────────────────────────────────────
for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
