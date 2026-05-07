import type { QueryDispatchResult } from './query-dispatch-contract.js';
export interface RunCjsFallbackDispatchInput {
    projectDir: string;
    gsdToolsPath: string;
    normCmd: string;
    normArgs: string[];
    ws?: string;
    pickField?: string;
}
export declare function runCjsFallbackDispatch(input: RunCjsFallbackDispatchInput): Promise<QueryDispatchResult>;
//# sourceMappingURL=query-fallback-executor.d.ts.map