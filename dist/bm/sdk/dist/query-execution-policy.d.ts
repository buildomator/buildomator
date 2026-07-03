import type { GSDTransport, TransportDecision } from './gsd-transport.js';
import type { TransportMode } from './gsd-transport-policy.js';
export interface QueryExecutionRequest {
    legacyCommand: string;
    legacyArgs: string[];
    registryCommand: string;
    registryArgs: string[];
    mode: TransportMode;
    projectDir: string;
    workstream?: string;
    preferNativeQuery: boolean;
    allowFallbackToSubprocess?: boolean;
    onTransportDecision?: (decision: TransportDecision) => void;
}
/**
 * Execution policy for query command dispatch.
 * Owns routing decision inputs for native/subprocess dispatch.
 */
export declare class QueryExecutionPolicy {
    private readonly transport;
    constructor(transport: GSDTransport);
    execute(request: QueryExecutionRequest): Promise<unknown>;
}
//# sourceMappingURL=query-execution-policy.d.ts.map