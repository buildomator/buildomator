import { resolveTransportPolicy } from './gsd-transport-policy.js';
/**
 * Execution policy for query command dispatch.
 * Owns routing decision inputs for native/subprocess dispatch.
 */
export class QueryExecutionPolicy {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    async execute(request) {
        const policy = resolveTransportPolicy(request.registryCommand);
        return this.transport.run({
            legacyCommand: request.legacyCommand,
            legacyArgs: request.legacyArgs,
            registryCommand: request.registryCommand,
            registryArgs: request.registryArgs,
            mode: request.mode,
            projectDir: request.projectDir,
            workstream: request.workstream,
        }, {
            preferNative: request.preferNativeQuery && policy.preferNative,
            allowFallbackToSubprocess: request.allowFallbackToSubprocess ?? policy.allowFallbackToSubprocess,
        }, request.onTransportDecision);
    }
}
//# sourceMappingURL=query-execution-policy.js.map