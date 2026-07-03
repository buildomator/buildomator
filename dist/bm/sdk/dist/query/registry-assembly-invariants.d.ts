import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
import type { AliasCatalogEntry } from './command-catalog.js';
export interface RegistryAssemblyAliasGroup {
    family: string;
    aliases: readonly AliasCatalogEntry[];
    handlers: Readonly<Record<string, QueryHandler>>;
}
export interface RegistryAssemblyStaticGroup {
    name: string;
    entries: ReadonlyArray<readonly [command: string, handler: QueryHandler]>;
}
export interface RegistryAssemblyInputs {
    staticGroups: readonly RegistryAssemblyStaticGroup[];
    aliasGroups: readonly RegistryAssemblyAliasGroup[];
    mutationCommands: ReadonlySet<string>;
    rawOutputPolicyCommands: readonly string[];
}
export interface RegistryAssemblyInvariantReport {
    duplicateCommandKeys: string[];
    aliasCanonicalsMissingHandlers: string[];
    missingMutationCommands: string[];
    missingRawOutputPolicyCommands: string[];
}
export declare function collectRegistryAssemblyInvariantReport(inputs: RegistryAssemblyInputs, registry?: QueryRegistry): RegistryAssemblyInvariantReport;
export declare function assertNoDuplicateRegisteredCommands(inputs: RegistryAssemblyInputs): void;
export declare function assertAliasCanonicalsHaveHandlers(inputs: RegistryAssemblyInputs): void;
export declare function assertMutationCommandsRegistered(registry: QueryRegistry, mutationCommands: ReadonlySet<string>): void;
export declare function assertRawOutputPolicyCommandsRegistered(registry: QueryRegistry, rawOutputPolicyCommands: readonly string[]): void;
//# sourceMappingURL=registry-assembly-invariants.d.ts.map