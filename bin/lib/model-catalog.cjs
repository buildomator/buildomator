'use strict';

const path = require('node:path');
const fs = require('node:fs');

// [PLUGIN PATCH] Plugin flattens upstream's <root>/get-shit-done/bin/lib/ into
// <plugin_root>/bin/lib/, so upstream's ../../../sdk/shared traversal lands one
// level too high. Try the plugin path (`../../sdk/shared/`) first; fall back to
// the upstream path (`../../../sdk/shared/`) when this file is executed under
// an upstream-style npm install. Same fallback shape as getAgentsDir() in
// core.cjs.
const pluginCatalogPath = path.join(__dirname, '..', '..', 'sdk', 'shared', 'model-catalog.json');
const upstreamCatalogPath = path.join(__dirname, '..', '..', '..', 'sdk', 'shared', 'model-catalog.json');
const catalog = require(fs.existsSync(pluginCatalogPath) ? pluginCatalogPath : upstreamCatalogPath);

const VALID_PROFILES = [...catalog.profiles];
const VALID_PHASE_TYPES = new Set(catalog.phaseTypes);
const VALID_AGENT_TIERS = new Set(Object.keys(catalog.adaptiveTierMap));

const MODEL_PROFILES = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, {
    quality: meta.golden,
    balanced: meta.balanced,
    budget: meta.budget,
    adaptive: catalog.adaptiveTierMap[meta.routingTier],
  }])
);

const AGENT_TO_PHASE_TYPE = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.phaseType])
);

const AGENT_DEFAULT_TIERS = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.routingTier])
);

const MODEL_ALIAS_MAP = Object.fromEntries(
  Object.entries(catalog.runtimeTierDefaults.claude).map(([tier, entry]) => [tier, entry?.model])
);

const RUNTIME_PROFILE_MAP = Object.fromEntries(
  Object.entries(catalog.runtimeTierDefaults)
    .map(([runtime, tiers]) => [
      runtime,
      Object.fromEntries(
        Object.entries(tiers).filter(([, entry]) => entry).map(([tier, entry]) => [tier, entry])
      ),
    ])
    .filter(([, tiers]) => Object.keys(tiers).length > 0)
);

const KNOWN_RUNTIMES = new Set(Object.keys(catalog.runtimeTierDefaults));
const RUNTIMES_WITH_REASONING_EFFORT = new Set(
  Object.entries(catalog.runtimeTierDefaults)
    .filter(([, tiers]) => Object.values(tiers).some((entry) => entry && entry.reasoning_effort))
    .map(([runtime]) => runtime)
);

function nextTier(currentTier) {
  const order = ['light', 'standard', 'heavy'];
  const idx = order.indexOf(String(currentTier));
  if (idx === -1) return null;
  return order[Math.min(idx + 1, order.length - 1)];
}

function formatAgentToModelMapAsTable(agentToModelMap) {
  const agentWidth = Math.max('Agent'.length, ...Object.keys(agentToModelMap).map((a) => a.length));
  const modelWidth = Math.max('Model'.length, ...Object.values(agentToModelMap).map((m) => m.length));
  const sep = '─'.repeat(agentWidth + 2) + '┼' + '─'.repeat(modelWidth + 2);
  const header = ` ${'Agent'.padEnd(agentWidth)} │ ${'Model'.padEnd(modelWidth)}`;
  let out = `${header}\n${sep}\n`;
  for (const [agent, model] of Object.entries(agentToModelMap)) {
    out += ` ${agent.padEnd(agentWidth)} │ ${model.padEnd(modelWidth)}\n`;
  }
  return out;
}

function getAgentToModelMapForProfile(normalizedProfile) {
  const profile = VALID_PROFILES.includes(normalizedProfile) ? normalizedProfile : 'balanced';
  const out = {};
  for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
    out[agent] = profile === 'inherit' ? 'inherit' : profiles[profile];
  }
  return out;
}

module.exports = {
  catalog,
  MODEL_PROFILES,
  VALID_PROFILES,
  AGENT_TO_PHASE_TYPE,
  VALID_PHASE_TYPES,
  AGENT_DEFAULT_TIERS,
  VALID_AGENT_TIERS,
  MODEL_ALIAS_MAP,
  RUNTIME_PROFILE_MAP,
  KNOWN_RUNTIMES,
  RUNTIMES_WITH_REASONING_EFFORT,
  nextTier,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
};
