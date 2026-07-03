import type { CommandFamily } from './command-manifest.types.js';
import type { RegistryAssemblyAliasGroup, RegistryAssemblyStaticGroup } from './registry-assembly-invariants.js';
export interface RegistryAssemblyStep {
    kind: 'static' | 'alias';
    key: string;
}
export declare const STATIC_CATALOG_GROUPS: readonly RegistryAssemblyStaticGroup[];
export declare const ALIAS_GROUPS: readonly RegistryAssemblyAliasGroup[];
export declare const STATIC_GROUP_BY_NAME: Readonly<Record<string, RegistryAssemblyStaticGroup>>;
export declare const ALIAS_GROUP_BY_FAMILY: Readonly<Record<CommandFamily, RegistryAssemblyAliasGroup>>;
export declare const REGISTRY_ASSEMBLY_PLAN: readonly RegistryAssemblyStep[];
//# sourceMappingURL=registry-assembly-descriptor.d.ts.map