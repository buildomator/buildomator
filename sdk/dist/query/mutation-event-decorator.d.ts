import type { QueryRegistry } from './registry.js';
import type { GSDEventStream } from '../event-stream.js';
export declare function decorateMutationsWithEvents(registry: QueryRegistry, mutationCommands: Set<string>, eventStream: GSDEventStream, correlationSessionId: string): void;
export declare function countDecoratedMutationHandlers(registry: QueryRegistry, mutationCommands: Set<string>): number;
//# sourceMappingURL=mutation-event-decorator.d.ts.map