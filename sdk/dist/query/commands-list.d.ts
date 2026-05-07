import type { QueryHandler } from './utils.js';
/**
 * `commands` — return the full list of registered query command strings.
 *
 * Closes #3121: the `commands` verb was referenced in workflow files
 * (references/workstream-flag.md) but had no native SDK handler, causing
 * a fallback to gsd-tools.cjs which threw "Unknown command: commands".
 *
 * Returns: JSON array of all canonical + alias command strings the SDK
 * registry accepts, sorted alphabetically. Suitable for discoverability
 * and for agent auto-complete when constructing `gsd-sdk query` calls.
 */
export declare const commandsList: QueryHandler<string[]>;
//# sourceMappingURL=commands-list.d.ts.map