export interface FallbackBridgeRunInput {
    projectDir: string;
    gsdToolsPath: string;
    normCmd: string;
    normArgs: string[];
    ws?: string;
}
export interface FallbackBridgeOutput {
    mode: 'json' | 'text';
    output: unknown;
    stderr: string;
}
export declare function runFallbackBridge(input: FallbackBridgeRunInput): Promise<FallbackBridgeOutput>;
//# sourceMappingURL=query-fallback-bridge-adapter.d.ts.map