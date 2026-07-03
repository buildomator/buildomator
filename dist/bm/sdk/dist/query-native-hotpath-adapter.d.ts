import type { QueryNativeDirectAdapter } from './query-native-direct-adapter.js';
/**
 * Adapter Module for runner hot-path native commands.
 */
export declare class QueryNativeHotpathAdapter {
    private readonly shouldUseNativeQuery;
    private readonly nativeDirect;
    private readonly execJsonFallback;
    private readonly execRawFallback;
    constructor(shouldUseNativeQuery: () => boolean, nativeDirect: QueryNativeDirectAdapter, execJsonFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<unknown>, execRawFallback: (legacyCommand: string, legacyArgs: string[]) => Promise<string>);
    dispatch(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[], mode: 'json' | 'raw'): Promise<unknown>;
    private dispatchFallback;
    private dispatchNative;
}
//# sourceMappingURL=query-native-hotpath-adapter.d.ts.map