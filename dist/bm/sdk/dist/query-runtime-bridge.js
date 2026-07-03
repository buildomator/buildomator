import { resolveQueryCommand } from './query/query-command-resolution-strategy.js';
import { GSDToolsError } from './gsd-tools-error.js';
/**
 * SDK Runtime Bridge Module.
 * Owns dispatch routing through the execution policy seam and hotpath/native fallback behavior.
 */
export class QueryRuntimeBridge {
    registry;
    executionPolicy;
    nativeHotpathAdapter;
    shouldUseNativeQuery;
    options;
    constructor(registry, executionPolicy, nativeHotpathAdapter, shouldUseNativeQuery, options) {
        this.registry = registry;
        this.executionPolicy = executionPolicy;
        this.nativeHotpathAdapter = nativeHotpathAdapter;
        this.shouldUseNativeQuery = shouldUseNativeQuery;
        this.options = options;
    }
    getRegistry() {
        return this.registry;
    }
    resolve(command, args) {
        return resolveQueryCommand(command, args, this.registry);
    }
    emit(event) {
        try {
            this.options?.onDispatchEvent?.(event);
        }
        catch {
            // Observability must never break dispatch behavior.
        }
    }
    async execute(input) {
        const startedAt = Date.now();
        if (this.options?.strictSdk && !this.registry.has(input.registryCommand)) {
            const error = GSDToolsError.failure(`Strict SDK mode: command '${input.registryCommand}' has no native adapter`, input.legacyCommand, input.legacyArgs, null);
            this.emit({
                type: 'query_dispatch',
                command: input.registryCommand,
                legacyCommand: input.legacyCommand,
                mode: input.mode,
                dispatchMode: 'native',
                reason: 'native_unregistered',
                durationMs: Date.now() - startedAt,
                outcome: 'error',
                errorKind: 'failure',
            });
            throw error;
        }
        let transportDecision;
        try {
            const result = await this.executionPolicy.execute({
                legacyCommand: input.legacyCommand,
                legacyArgs: input.legacyArgs,
                registryCommand: input.registryCommand,
                registryArgs: input.registryArgs,
                mode: input.mode,
                projectDir: input.projectDir,
                workstream: input.workstream,
                preferNativeQuery: this.shouldUseNativeQuery(),
                allowFallbackToSubprocess: this.options?.allowFallbackToSubprocess,
                onTransportDecision: (decision) => {
                    transportDecision = decision;
                },
            });
            this.emit({
                type: 'query_dispatch',
                command: input.registryCommand,
                legacyCommand: input.legacyCommand,
                mode: input.mode,
                dispatchMode: transportDecision?.dispatchMode ?? 'native',
                reason: transportDecision?.reason,
                durationMs: Date.now() - startedAt,
                outcome: 'success',
            });
            return result;
        }
        catch (error) {
            const kind = error instanceof GSDToolsError ? error.classification.kind : 'failure';
            this.emit({
                type: 'query_dispatch',
                command: input.registryCommand,
                legacyCommand: input.legacyCommand,
                mode: input.mode,
                dispatchMode: transportDecision?.dispatchMode ?? 'native',
                reason: transportDecision?.reason,
                durationMs: Date.now() - startedAt,
                outcome: 'error',
                errorKind: kind,
            });
            throw error;
        }
    }
    async dispatchHotpath(legacyCommand, legacyArgs, registryCommand, registryArgs, mode) {
        const startedAt = Date.now();
        const useNative = this.shouldUseNativeQuery();
        if (!useNative && this.options?.allowFallbackToSubprocess === false) {
            const error = GSDToolsError.failure(`Subprocess fallback disabled: command '${registryCommand}' cannot run without native dispatch`, legacyCommand, legacyArgs, null);
            this.emit({
                type: 'query_hotpath_dispatch',
                command: registryCommand,
                legacyCommand,
                mode,
                dispatchMode: 'subprocess',
                reason: 'policy_blocked',
                durationMs: Date.now() - startedAt,
                outcome: 'error',
                errorKind: 'failure',
            });
            throw error;
        }
        try {
            const result = await this.nativeHotpathAdapter.dispatch(legacyCommand, legacyArgs, registryCommand, registryArgs, mode);
            this.emit({
                type: 'query_hotpath_dispatch',
                command: registryCommand,
                legacyCommand,
                mode,
                dispatchMode: useNative ? 'native_hotpath' : 'subprocess',
                reason: useNative ? undefined : 'native_disabled',
                durationMs: Date.now() - startedAt,
                outcome: 'success',
            });
            return result;
        }
        catch (error) {
            const kind = error instanceof GSDToolsError ? error.classification.kind : 'failure';
            this.emit({
                type: 'query_hotpath_dispatch',
                command: registryCommand,
                legacyCommand,
                mode,
                dispatchMode: useNative ? 'native_hotpath' : 'subprocess',
                reason: useNative ? undefined : 'native_disabled',
                durationMs: Date.now() - startedAt,
                outcome: 'error',
                errorKind: kind,
            });
            throw error;
        }
    }
}
//# sourceMappingURL=query-runtime-bridge.js.map