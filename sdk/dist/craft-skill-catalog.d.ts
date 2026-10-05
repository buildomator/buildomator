export interface LicensePolicy {
    allow: string[];
    flagCopyleft: string[];
    flagSourceAvailable: string[];
    block: string[];
    obligations: Record<string, string>;
}
export interface CraftSkillPublisher {
    name: string;
    kind: 'vendor-official' | 'individual' | 'community';
    url: string;
    label: string;
}
export interface ScriptsReview {
    verdict: 'reviewed' | 'banned';
    commit: string;
    reviewed_at: string;
    note: string;
}
export interface ToolingRef {
    name: string;
    license: string;
    note: string;
}
export interface CraftSkillEntry {
    id: string;
    domain: string;
    triggers: string[];
    publisher: string;
    source: string;
    skill_path: string;
    skill_name: string;
    pinned_commit: string;
    license: string;
    license_url: string;
    obligations: string;
    trust_tier: 'A' | 'B' | 'C';
    bundles_scripts: boolean;
    scripts_review: ScriptsReview | null;
    tooling: ToolingRef[];
    target_agents: string[];
    summary: string;
    verified_at: string;
}
export interface CraftSkillCatalog {
    version: 1;
    licensePolicy: LicensePolicy;
    publishers: Record<string, CraftSkillPublisher>;
    skills: Record<string, CraftSkillEntry>;
}
export interface CatalogValidation {
    valid: boolean;
    errors: string[];
}
export declare const ENTRY_KEYS: readonly string[];
export declare const TRUST_TIERS: readonly string[];
export declare const PINNED_COMMIT_RE: RegExp;
export declare const MAX_STRING_LENGTH = 400;
export declare const FORBIDDEN_KEYS: readonly string[];
export declare function validateCraftSkillCatalog(raw: unknown): CatalogValidation;
export declare function resolveCatalogPath(overridePath?: string): string;
export declare function loadCraftSkillCatalog(overridePath?: string): CraftSkillCatalog;
export declare function deriveCatalogViews(cat: CraftSkillCatalog): {
    CRAFT_SKILLS_BY_ID: Record<string, CraftSkillEntry>;
    CRAFT_SKILL_TRIGGER_INDEX: Record<string, string[]>;
    PUBLISHER_ALLOWLIST: Set<string>;
};
export declare const catalog: CraftSkillCatalog;
export declare const CRAFT_SKILLS_BY_ID: Record<string, CraftSkillEntry>;
export declare const CRAFT_SKILL_TRIGGER_INDEX: Record<string, string[]>;
export declare const PUBLISHER_ALLOWLIST: Set<string>;
//# sourceMappingURL=craft-skill-catalog.d.ts.map