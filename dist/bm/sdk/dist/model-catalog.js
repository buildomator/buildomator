import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const CATALOG_PATH = new URL('../shared/model-catalog.json', import.meta.url);
export const catalog = JSON.parse(readFileSync(fileURLToPath(CATALOG_PATH), 'utf-8'));
export const VALID_PROFILES = [...catalog.profiles];
export const SUPPORTED_RUNTIMES = Object.keys(catalog.runtimeTierDefaults);
export const MODEL_PROFILES = Object.fromEntries(Object.entries(catalog.agents).map(([agent, meta]) => [agent, {
        quality: meta.golden,
        balanced: meta.balanced,
        budget: meta.budget,
        adaptive: catalog.adaptiveTierMap[meta.routingTier],
    }]));
export const AGENT_TO_PHASE_TYPE = Object.fromEntries(Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.phaseType]));
export const AGENT_DEFAULT_TIERS = Object.fromEntries(Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.routingTier]));
export function getAgentToModelMapForProfile(normalizedProfile) {
    const profile = VALID_PROFILES.includes(normalizedProfile) ? normalizedProfile : 'balanced';
    const out = {};
    for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
        out[agent] = profile === 'inherit' ? 'inherit' : profiles[profile] ?? profiles.balanced;
    }
    return out;
}
export function resolveRuntimeTierDefault(runtime, alias) {
    return catalog.runtimeTierDefaults[runtime]?.[alias] ?? null;
}
export function runtimesWithReasoningEffort() {
    return new Set(Object.entries(catalog.runtimeTierDefaults)
        .filter(([, tiers]) => Object.values(tiers).some((entry) => entry && entry.reasoning_effort))
        .map(([runtime]) => runtime));
}
//# sourceMappingURL=model-catalog.js.map