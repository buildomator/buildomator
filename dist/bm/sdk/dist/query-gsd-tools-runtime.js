import { createRegistry } from './query/index.js';
import { GSDTransport } from './gsd-transport.js';
import { QueryExecutionPolicy } from './query-execution-policy.js';
import { QuerySubprocessAdapter } from './query-subprocess-adapter.js';
import { QueryNativeDirectAdapter } from './query-native-direct-adapter.js';
import { QueryNativeHotpathAdapter } from './query-native-hotpath-adapter.js';
import { formatQueryRawOutput } from './query-raw-output-projection.js';
import { createQueryNativeErrorFactory, createQueryToolsErrorFactory } from './query-tools-error-factory.js';
import { QueryRuntimeBridge } from './query-runtime-bridge.js';
export function createGSDToolsRuntime(opts) {
    const registry = createRegistry(opts.eventStream, opts.sessionId);
    const queryToolsErrorFactory = createQueryToolsErrorFactory();
    const subprocessAdapter = new QuerySubprocessAdapter({
        projectDir: opts.projectDir,
        gsdToolsPath: opts.gsdToolsPath,
        timeoutMs: opts.timeoutMs,
        workstream: opts.workstream,
        ...queryToolsErrorFactory,
    });
    const nativeErrorFactory = createQueryNativeErrorFactory(opts.timeoutMs);
    const nativeDirectAdapter = new QueryNativeDirectAdapter({
        timeoutMs: opts.timeoutMs,
        // #3591: forward opts.workstream to the registry so native dispatch
        // routes planning-path queries to .planning/workstreams/<name>/
        // instead of the root .planning tree. createGSDToolsRuntime accepts
        // workstream and the QuerySubprocessAdapter already forwards it
        // (line 38); the native dispatch closure was the only seam that
        // dropped it, silently routing GSDTools-native queries to root.
        dispatch: (registryCommand, registryArgs) => registry.dispatch(registryCommand, registryArgs, opts.projectDir, opts.workstream),
        ...nativeErrorFactory,
    });
    const transport = new GSDTransport(registry, {
        dispatchNative: (request) => nativeDirectAdapter.dispatchResult(request.legacyCommand, request.legacyArgs, request.registryCommand, request.registryArgs),
        execSubprocessJson: (legacyCommand, legacyArgs) => subprocessAdapter.execJson(legacyCommand, legacyArgs),
        execSubprocessRaw: (legacyCommand, legacyArgs) => subprocessAdapter.execRaw(legacyCommand, legacyArgs),
        formatNativeRaw: (registryCommand, data) => formatQueryRawOutput(registryCommand, data),
    });
    const executionPolicy = new QueryExecutionPolicy(transport);
    const nativeHotpathAdapter = new QueryNativeHotpathAdapter(opts.shouldUseNativeQuery, nativeDirectAdapter, opts.execJsonFallback, opts.execRawFallback);
    const bridge = new QueryRuntimeBridge(registry, executionPolicy, nativeHotpathAdapter, opts.shouldUseNativeQuery, {
        strictSdk: opts.strictSdk,
        allowFallbackToSubprocess: opts.allowFallbackToSubprocess,
        onDispatchEvent: opts.onDispatchEvent,
    });
    return { bridge };
}
//# sourceMappingURL=query-gsd-tools-runtime.js.map