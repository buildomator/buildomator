export interface GSDToolsErrorClassification {
    kind: 'timeout' | 'failure';
    timeoutMs?: number;
}
export declare class GSDToolsError extends Error {
    readonly command: string;
    readonly args: string[];
    readonly exitCode: number | null;
    readonly stderr: string;
    constructor(message: string, command: string, args: string[], exitCode: number | null, stderr: string, options?: {
        cause?: unknown;
        classification?: GSDToolsErrorClassification;
    });
    static timeout(message: string, command: string, args: string[], stderr?: string, timeoutMs?: number, options?: {
        cause?: unknown;
        exitCode?: number | null;
    }): GSDToolsError;
    static failure(message: string, command: string, args: string[], exitCode: number | null, stderr?: string, options?: {
        cause?: unknown;
    }): GSDToolsError;
    readonly classification: GSDToolsErrorClassification;
}
//# sourceMappingURL=gsd-tools-error.d.ts.map