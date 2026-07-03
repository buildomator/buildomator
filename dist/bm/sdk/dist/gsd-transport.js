import { toFailureSignal } from './query-failure-classification.js';
import { GSDToolsError } from './gsd-tools-error.js';
export class GSDTransport {
    registry;
    adapters;
    constructor(registry, adapters) {
        this.registry = registry;
        this.adapters = adapters;
    }
    async run(request, policy, onDecision) {
        const useNative = this.shouldUseNative(request, policy);
        if (useNative) {
            try {
                const native = await this.adapters.dispatchNative(request);
                onDecision?.({ dispatchMode: 'native' });
                return this.projectNativeOutput(request, native.data);
            }
            catch (error) {
                if (this.shouldRethrowNativeError(error, policy))
                    throw error;
                onDecision?.({ dispatchMode: 'subprocess', reason: 'native_failure_fallback' });
            }
        }
        else {
            const reason = this.subprocessReason(request, policy);
            if (!policy.allowFallbackToSubprocess && reason === 'native_unregistered') {
                throw GSDToolsError.failure(`Subprocess fallback disabled: command '${request.registryCommand}' cannot run without native dispatch`, request.legacyCommand, request.legacyArgs, null);
            }
            onDecision?.({ dispatchMode: 'subprocess', reason });
        }
        return this.dispatchSubprocess(request);
    }
    shouldUseNative(request, policy) {
        const forceSubprocess = Boolean(request.workstream);
        return !forceSubprocess && policy.preferNative && this.registry.has(request.registryCommand);
    }
    subprocessReason(request, policy) {
        if (request.workstream)
            return 'workstream_forced';
        if (!policy.preferNative)
            return 'native_not_preferred';
        if (!this.registry.has(request.registryCommand))
            return 'native_unregistered';
        throw new Error(`Unexpected subprocess reason state for command '${request.registryCommand}' with preferNative=${String(policy.preferNative)} and workstream=${String(request.workstream)}`);
    }
    shouldRethrowNativeError(error, policy) {
        if (!policy.allowFallbackToSubprocess)
            return true;
        // Do not subprocess-fallback after a timed-out native dispatch:
        // the timeout does not cancel the native handler, so falling through
        // would run the same command twice (double-execution race).
        return toFailureSignal(error).kind === 'timeout';
    }
    dispatchSubprocess(request) {
        if (request.mode === 'raw') {
            return this.adapters.execSubprocessRaw(request.legacyCommand, request.legacyArgs);
        }
        return this.adapters.execSubprocessJson(request.legacyCommand, request.legacyArgs);
    }
    projectNativeOutput(request, data) {
        if (request.mode === 'raw') {
            if (this.adapters.formatNativeRaw) {
                return this.adapters.formatNativeRaw(request.registryCommand, data).trim();
            }
            return this.toRaw(data);
        }
        return data;
    }
    toRaw(data) {
        if (typeof data === 'string')
            return data.trim();
        const json = JSON.stringify(data, null, 2);
        if (json == null)
            return '';
        return json.trim();
    }
}
//# sourceMappingURL=gsd-transport.js.map