import type { QueryNativeErrorFactory } from './query-tools-error-factory.js';
import type { QueryResult } from './query/utils.js';
export interface QueryNativeDirectAdapterDeps extends QueryNativeErrorFactory {
    timeoutMs: number;
    dispatch: (registryCommand: string, registryArgs: string[]) => Promise<QueryResult>;
}
/**
 * Adapter Module for direct native registry dispatch with timeout policy.
 */
export declare class QueryNativeDirectAdapter {
    private readonly deps;
    constructor(deps: QueryNativeDirectAdapterDeps);
    dispatchResult(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<QueryResult>;
    dispatchJson(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<unknown>;
    dispatchRaw(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<string>;
    private dispatchData;
    private toNativeDispatchError;
    private withTimeout;
}
//# sourceMappingURL=query-native-direct-adapter.d.ts.map