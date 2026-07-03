/**
 * Adapter Module for runner hot-path native commands.
 */
export class QueryNativeHotpathAdapter {
    shouldUseNativeQuery;
    nativeDirect;
    execJsonFallback;
    execRawFallback;
    constructor(shouldUseNativeQuery, nativeDirect, execJsonFallback, execRawFallback) {
        this.shouldUseNativeQuery = shouldUseNativeQuery;
        this.nativeDirect = nativeDirect;
        this.execJsonFallback = execJsonFallback;
        this.execRawFallback = execRawFallback;
    }
    async dispatch(legacyCommand, legacyArgs, registryCommand, registryArgs, mode) {
        if (!this.shouldUseNativeQuery()) {
            return this.dispatchFallback(legacyCommand, legacyArgs, mode);
        }
        return this.dispatchNative(legacyCommand, legacyArgs, registryCommand, registryArgs, mode);
    }
    dispatchFallback(legacyCommand, legacyArgs, mode) {
        return mode === 'raw'
            ? this.execRawFallback(legacyCommand, legacyArgs)
            : this.execJsonFallback(legacyCommand, legacyArgs);
    }
    dispatchNative(legacyCommand, legacyArgs, registryCommand, registryArgs, mode) {
        return mode === 'raw'
            ? this.nativeDirect.dispatchRaw(legacyCommand, legacyArgs, registryCommand, registryArgs)
            : this.nativeDirect.dispatchJson(legacyCommand, legacyArgs, registryCommand, registryArgs);
    }
}
//# sourceMappingURL=query-native-hotpath-adapter.js.map