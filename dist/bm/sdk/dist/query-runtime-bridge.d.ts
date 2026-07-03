import type { QueryRegistry } from './query/registry.js';
import type { TransportMode } from './gsd-transport-policy.js';
import type { QueryCommandResolution } from './query/query-command-resolution-strategy.js';
import { QueryExecutionPolicy } from './query-execution-policy.js';
import { QueryNativeHotpathAdapter } from './query-native-hotpath-adapter.js';
import type { TransportDecision } from './gsd-transport.js';
export interface RuntimeBridgeExecuteInput {
    legacyCommand: string;
    legacyArgs: string[];
    registryCommand: string;
    registryArgs: string[];
    mode: TransportMode;
    projectDir: string;
    workstream?: string;
}
export interface RuntimeBridgeDispatchEvent {
    type: 'query_dispatch';
    command: string;
    legacyCommand: string;
    mode: TransportMode;
    dispatchMode: 'native' | 'subprocess' | 'native_hotpath';
    reason?: TransportDecision['reason'];
    durationMs: number;
    outcome: 'success' | 'error';
    errorKind?: 'timeout' | 'failure';
}
export interface RuntimeBridgeHotpathEvent {
    type: 'query_hotpath_dispatch';
    command: string;
    legacyCommand: string;
    mode: TransportMode;
    dispatchMode: 'native_hotpath' | 'subprocess';
    reason?: 'native_disabled' | 'policy_blocked';
    durationMs: number;
    outcome: 'success' | 'error';
    errorKind?: 'timeout' | 'failure';
}
export type RuntimeBridgeEvent = RuntimeBridgeDispatchEvent | RuntimeBridgeHotpathEvent;
export interface RuntimeBridgeOptions {
    strictSdk?: boolean;
    allowFallbackToSubprocess?: boolean;
    onDispatchEvent?: (event: RuntimeBridgeEvent) => void;
}
/**
 * SDK Runtime Bridge Module.
 * Owns dispatch routing through the execution policy seam and hotpath/native fallback behavior.
 */
export declare class QueryRuntimeBridge {
    private readonly registry;
    private readonly executionPolicy;
    private readonly nativeHotpathAdapter;
    private readonly shouldUseNativeQuery;
    private readonly options?;
    constructor(registry: QueryRegistry, executionPolicy: QueryExecutionPolicy, nativeHotpathAdapter: QueryNativeHotpathAdapter, shouldUseNativeQuery: () => boolean, options?: RuntimeBridgeOptions | undefined);
    getRegistry(): QueryRegistry;
    resolve(command: string, args: string[]): QueryCommandResolution | null;
    private emit;
    execute(input: RuntimeBridgeExecuteInput): Promise<unknown>;
    dispatchHotpath(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[], mode: TransportMode): Promise<unknown>;
}
//# sourceMappingURL=query-runtime-bridge.d.ts.map