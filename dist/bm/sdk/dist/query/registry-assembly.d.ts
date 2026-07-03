import { QueryRegistry } from './registry.js';
import { GSDEventStream } from '../event-stream.js';
/**
 * Command names that perform durable writes (disk, git, or global profile store).
 */
export declare const QUERY_MUTATION_COMMANDS: Set<string>;
export declare function buildRegistry(): QueryRegistry;
export declare function decorateRegistryMutations(registry: QueryRegistry, eventStream?: GSDEventStream, correlationSessionId?: string): void;
export declare function createRegistry(eventStream?: GSDEventStream, correlationSessionId?: string): QueryRegistry;
//# sourceMappingURL=registry-assembly.d.ts.map