/**
 * litellm-* profile resolution.
 *
 * A litellm profile splits tiers across two runtimes: some tiers resolve to a
 * user-named local model id served through a litellm gateway, the rest stay on
 * the Anthropic id. Twinned with `_resolveLitellmModel` in bin/lib/core.cjs:
 * both must emit the same id for the same config and tier.
 */
export declare const LITELLM_PROFILES: ReadonlySet<string>;
export declare function isLitellmProfile(profile: string): boolean;
/** Tier assignment the profile reuses: balanced for litellm-balanced, adaptive otherwise. */
export declare function litellmBaseProfile(profile: string): 'balanced' | 'adaptive';
/** Test hook: forget which unset-tier warnings were already emitted. */
export declare function resetLitellmWarningsForTests(): void;
/**
 * Resolve the model id for `tier` under a litellm-* profile.
 *
 * litellm-full routes every tier local and throws when a tier has no local id.
 * The hybrid profiles keep the opus tier on Anthropic and send sonnet/haiku
 * local, falling back to the Anthropic passthrough id (with a one-time
 * warning) when a local id is unset.
 */
export declare function resolveLitellmModel(config: Record<string, unknown>, profile: string, tier: string): string;
//# sourceMappingURL=litellm-resolve.d.ts.map