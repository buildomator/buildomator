export interface QueryFailureSignal {
    kind: 'timeout' | 'failure';
    message: string;
    timeoutMs?: number;
}
export declare function errorMessage(error: unknown): string;
export declare function timeoutMessage(command: string, args: string[], timeoutMs: number): string;
export declare function toFailureSignal(error: unknown): QueryFailureSignal;
//# sourceMappingURL=query-failure-classification.d.ts.map