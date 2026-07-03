import type { QueryRegistry } from './registry.js';
import type { QueryDispatchError, QueryDispatchResult } from './query-dispatch-contract.js';
import type { QueryResult } from './utils.js';
import type { QueryNativeDispatchAdapter } from './query-native-dispatch-adapter.js';
import type { CommandTopology, CommandTopologyMatch } from './command-topology.js';
export interface QueryDispatchDeps {
    registry: QueryRegistry;
    projectDir: string;
    ws?: string;
    cjsFallbackEnabled: boolean;
    resolveGsdToolsPath: (projectDir: string) => string;
    /** @deprecated use topology */
    dispatchNative?: (cmd: string, args: string[]) => Promise<QueryResult>;
    /** @deprecated use topology */
    nativeAdapter?: QueryNativeDispatchAdapter;
    topology: CommandTopology;
}
export type DispatchMode = 'native' | 'cjs' | 'error';
export interface DispatchPlan {
    mode: DispatchMode;
    normalized: {
        command: string;
        args: string[];
        tokens: string[];
    };
    matched: CommandTopologyMatch | null;
    noMatchMessage?: string;
    noMatchNormalized?: string;
    noMatchAttempted?: string[];
    noMatchHints?: string[];
}
export type DispatchSuccessFormat = 'json' | 'text' | undefined;
export interface DispatchInputValidationResult {
    queryArgs: string[];
    pickField?: string;
    error?: QueryDispatchResult;
}
export declare function dispatchFailure(error: QueryDispatchError, stderr?: string[]): QueryDispatchResult;
export declare function dispatchSuccess(stdout: string, stderr?: string[]): QueryDispatchResult;
export declare function toDispatchFailure(error: QueryDispatchError, stderr?: string[]): QueryDispatchResult;
export declare function mapNativeDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError;
export declare function mapFallbackDispatchError(error: unknown, command: string, args: string[]): QueryDispatchError;
export declare function formatPick(data: unknown, pickField?: string): unknown;
export declare function formatSuccess(data: unknown, format: DispatchSuccessFormat, pickField?: string): string;
export declare function validateQueryDispatchInput(queryArgv: string[]): DispatchInputValidationResult;
export declare function planQueryDispatch(queryArgv: string[], topology: CommandTopology, cjsFallbackEnabled: boolean): DispatchPlan;
export declare function runQueryDispatch(deps: QueryDispatchDeps, queryArgv: string[]): Promise<QueryDispatchResult>;
//# sourceMappingURL=query-dispatch.d.ts.map