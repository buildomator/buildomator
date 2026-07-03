import type { QueryResult } from './query/utils.js';
import type { QueryRegistry } from './query/registry.js';
import type { TransportMode } from './gsd-transport-policy.js';
export interface TransportRequest {
    legacyCommand: string;
    legacyArgs: string[];
    registryCommand: string;
    registryArgs: string[];
    mode: TransportMode;
    projectDir: string;
    workstream?: string;
}
export interface TransportAdapters {
    dispatchNative: (request: TransportRequest) => Promise<QueryResult>;
    execSubprocessJson: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>;
    execSubprocessRaw: (legacyCommand: string, legacyArgs: string[]) => Promise<string>;
    formatNativeRaw?: (registryCommand: string, data: unknown) => string;
}
export interface TransportPolicyLike {
    preferNative: boolean;
    allowFallbackToSubprocess: boolean;
}
export interface TransportDecision {
    dispatchMode: 'native' | 'subprocess';
    reason?: 'workstream_forced' | 'native_not_preferred' | 'native_unregistered' | 'native_failure_fallback';
}
export declare class GSDTransport {
    private readonly registry;
    private readonly adapters;
    constructor(registry: QueryRegistry, adapters: TransportAdapters);
    run(request: TransportRequest, policy: TransportPolicyLike, onDecision?: (decision: TransportDecision) => void): Promise<unknown>;
    private shouldUseNative;
    private subprocessReason;
    private shouldRethrowNativeError;
    private dispatchSubprocess;
    private projectNativeOutput;
    private toRaw;
}
//# sourceMappingURL=gsd-transport.d.ts.map