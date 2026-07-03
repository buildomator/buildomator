import type { GSDEventStream } from './event-stream.js';
import { QueryRuntimeBridge, type RuntimeBridgeOptions } from './query-runtime-bridge.js';
export interface GSDToolsRuntime {
    bridge: QueryRuntimeBridge;
}
export declare function createGSDToolsRuntime(opts: {
    projectDir: string;
    gsdToolsPath: string;
    timeoutMs: number;
    workstream?: string;
    eventStream?: GSDEventStream;
    sessionId?: string;
    shouldUseNativeQuery: () => boolean;
    execJsonFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>;
    execRawFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<string>;
    strictSdk?: boolean;
    allowFallbackToSubprocess?: boolean;
    onDispatchEvent?: RuntimeBridgeOptions['onDispatchEvent'];
}): GSDToolsRuntime;
//# sourceMappingURL=query-gsd-tools-runtime.d.ts.map