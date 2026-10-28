/**
 * litellm-* profile resolution.
 *
 * A litellm profile splits tiers across two runtimes: some tiers resolve to a
 * user-named local model id served through a litellm gateway, the rest stay on
 * the Anthropic id. Twinned with `_resolveLitellmModel` in bin/lib/core.cjs:
 * both must emit the same id for the same config and tier.
 */
import { resolveRuntimeTierDefault } from './model-catalog.js';
export const LITELLM_PROFILES = new Set([
    'litellm-full',
    'litellm-adaptive',
    'litellm-balanced',
]);
export function isLitellmProfile(profile) {
    return LITELLM_PROFILES.has(profile);
}
/** Tier assignment the profile reuses: balanced for litellm-balanced, adaptive otherwise. */
export function litellmBaseProfile(profile) {
    return profile === 'litellm-balanced' ? 'balanced' : 'adaptive';
}
const warned = new Set();
/** Test hook: forget which unset-tier warnings were already emitted. */
export function resetLitellmWarningsForTests() {
    warned.clear();
}
function userModel(config, tier) {
    const overrides = config.model_profile_overrides;
    const lit = overrides?.litellm;
    const raw = lit?.[tier];
    const id = typeof raw === 'string' ? raw : raw?.model;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}
/**
 * Resolve the model id for `tier` under a litellm-* profile.
 *
 * litellm-full routes every tier local and throws when a tier has no local id.
 * The hybrid profiles keep the opus tier on Anthropic and send sonnet/haiku
 * local, falling back to the Anthropic passthrough id (with a one-time
 * warning) when a local id is unset.
 */
export function resolveLitellmModel(config, profile, tier) {
    const localTier = (tier === 'fable' ? 'opus' : tier);
    const isFull = profile === 'litellm-full';
    const localTiers = isFull ? ['opus', 'sonnet', 'haiku'] : ['sonnet', 'haiku'];
    if (!localTiers.includes(localTier)) {
        return resolveRuntimeTierDefault('claude', tier)?.model ?? tier;
    }
    const userId = userModel(config, localTier);
    if (userId)
        return userId;
    if (isFull) {
        throw new Error(`litellm-full needs a local model id for the ${localTier} tier. ` +
            `Set litellm.models.${localTier} (or model_profile_overrides.litellm.${localTier}).`);
    }
    const fallback = resolveRuntimeTierDefault('litellm', localTier)?.model ??
        resolveRuntimeTierDefault('claude', localTier)?.model ??
        localTier;
    const key = `litellm-unset::${localTier}`;
    if (!warned.has(key)) {
        warned.add(key);
        try {
            process.stderr.write(`bm: warning: ${profile} has no litellm.models.${localTier}; ` +
                `falling back to ${fallback} (Anthropic passthrough).\n`);
        }
        catch { /* ok */ }
    }
    return fallback;
}
//# sourceMappingURL=litellm-resolve.js.map