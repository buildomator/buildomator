import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
export interface AliasCatalogEntry {
    canonical: string;
    aliases: string[];
}
export declare function registerAliasCatalog(registry: QueryRegistry, aliases: readonly AliasCatalogEntry[], handlers: Readonly<Record<string, QueryHandler>>): void;
export declare function registerStaticCatalog(registry: QueryRegistry, entries: ReadonlyArray<readonly [command: string, handler: QueryHandler]>): void;
//# sourceMappingURL=command-catalog.d.ts.map