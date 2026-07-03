import { formatQueryRawOutput } from './query-raw-output-projection.js';
import { GSDToolsError } from './gsd-tools-error.js';
import { errorMessage, timeoutMessage } from './query-failure-classification.js';
/**
 * Adapter Module for direct native registry dispatch with timeout policy.
 */
export class QueryNativeDirectAdapter {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async dispatchResult(legacyCommand, legacyArgs, registryCommand, registryArgs) {
        try {
            return await this.withTimeout(legacyCommand, legacyArgs, this.deps.dispatch(registryCommand, registryArgs));
        }
        catch (error) {
            throw this.toNativeDispatchError(legacyCommand, legacyArgs, error);
        }
    }
    async dispatchJson(legacyCommand, legacyArgs, registryCommand, registryArgs) {
        return this.dispatchData(legacyCommand, legacyArgs, registryCommand, registryArgs);
    }
    async dispatchRaw(legacyCommand, legacyArgs, registryCommand, registryArgs) {
        const data = await this.dispatchData(legacyCommand, legacyArgs, registryCommand, registryArgs);
        return formatQueryRawOutput(registryCommand, data).trim();
    }
    async dispatchData(legacyCommand, legacyArgs, registryCommand, registryArgs) {
        const result = await this.dispatchResult(legacyCommand, legacyArgs, registryCommand, registryArgs);
        return result.data;
    }
    toNativeDispatchError(legacyCommand, legacyArgs, error) {
        if (error instanceof GSDToolsError)
            return error;
        return this.deps.createNativeFailureError(errorMessage(error), legacyCommand, legacyArgs, error);
    }
    async withTimeout(legacyCommand, legacyArgs, work) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(this.deps.createNativeTimeoutError(timeoutMessage(legacyCommand, legacyArgs, this.deps.timeoutMs), legacyCommand, legacyArgs));
            }, this.deps.timeoutMs);
        });
        try {
            return await Promise.race([work, timeoutPromise]);
        }
        finally {
            if (timeoutId !== undefined)
                clearTimeout(timeoutId);
        }
    }
}
//# sourceMappingURL=query-native-direct-adapter.js.map