interface RuntimeTierEntry {
    model: string;
    reasoning_effort?: string;
}
type RuntimeTierTable = Record<string, Record<string, RuntimeTierEntry | null>>;
interface AgentCatalogEntry {
    golden: 'opus' | 'sonnet' | 'haiku';
    balanced: 'opus' | 'sonnet' | 'haiku';
    budget: 'opus' | 'sonnet' | 'haiku';
    phaseType: string;
    routingTier: 'light' | 'standard' | 'heavy';
}
interface ModelCatalog {
    profiles: string[];
    phaseTypes: string[];
    adaptiveTierMap: Record<'light' | 'standard' | 'heavy', 'opus' | 'sonnet' | 'haiku'>;
    runtimeTierDefaults: RuntimeTierTable;
    agents: Record<string, AgentCatalogEntry>;
}
export declare const catalog: ModelCatalog;
export declare const VALID_PROFILES: string[];
export declare const SUPPORTED_RUNTIMES: string[];
export type Runtime = (typeof SUPPORTED_RUNTIMES)[number];
export declare const MODEL_PROFILES: Record<string, Record<string, string>>;
export declare const AGENT_TO_PHASE_TYPE: Record<string, string>;
export declare const AGENT_DEFAULT_TIERS: Record<string, string>;
export declare function getAgentToModelMapForProfile(normalizedProfile: string): Record<string, string>;
export declare function resolveRuntimeTierDefault(runtime: string, alias: 'opus' | 'sonnet' | 'haiku'): RuntimeTierEntry | null;
export declare function runtimesWithReasoningEffort(): Set<string>;
export {};
//# sourceMappingURL=model-catalog.d.ts.map