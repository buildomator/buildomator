import { createRequire } from 'node:module';
export type LegacySdkAsset = 'gsd-tools' | 'core-cjs';
export interface LegacySdkAssetResolution {
    asset: LegacySdkAsset;
    path: string | null;
    fallbackPath: string;
    probes: string[];
}
interface LegacySdkCompatibilityDeps {
    existsSync?: (path: string) => boolean;
    homeDir?: string;
    createRequire?: typeof createRequire;
}
export declare const BUNDLED_GSD_TOOLS_PATH: string;
export declare const BUNDLED_CORE_CJS_PATH: string;
export declare const BUNDLED_GSD_TEMPLATES_DIR: string;
export declare const BUNDLED_GSD_AGENTS_DIR: string;
export declare function resolveLegacyInstallDir(homeDir?: string): string;
export declare function resolveLegacyTemplatesDir(homeDir?: string): string;
export declare function resolveLegacyWorkflowsDir(homeDir?: string): string;
export declare function resolveLegacyUserProfilePath(homeDir?: string): string;
export declare function resolveLegacySkillsDir(homeDir?: string): string;
export declare function resolveBundledTemplatesDir(): string;
export declare function resolveBundledAgentsDir(): string;
export declare function probeLegacySdkAsset(asset: LegacySdkAsset, projectDir: string, deps?: LegacySdkCompatibilityDeps): LegacySdkAssetResolution;
/**
 * Resolve the legacy `gsd-tools.cjs` executable path through the SDK Package Seam Module.
 *
 * Preserves historical behavior: if no probe exists, return the final fallback path so
 * downstream subprocess errors still show a concrete location.
 */
export declare function resolveGsdToolsPath(projectDir: string, deps?: LegacySdkCompatibilityDeps): string;
/**
 * Load `loadConfig(cwd)` from the legacy CJS install through one compatibility seam.
 */
export declare function loadLegacyCoreConfig(projectDir: string, deps?: LegacySdkCompatibilityDeps): Record<string, unknown>;
export {};
//# sourceMappingURL=sdk-package-compatibility.d.ts.map