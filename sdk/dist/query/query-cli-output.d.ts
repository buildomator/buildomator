import type { QueryDispatchResult } from './query-dispatch-contract.js';
export interface QueryCliAdapterOutput {
    exitCode: number;
    stdoutChunks: string[];
    stderrLines: string[];
}
export declare function buildQueryCliOutputFromDispatch(out: QueryDispatchResult): QueryCliAdapterOutput;
export declare function buildQueryCliOutputFromError(err: unknown): QueryCliAdapterOutput;
//# sourceMappingURL=query-cli-output.d.ts.map