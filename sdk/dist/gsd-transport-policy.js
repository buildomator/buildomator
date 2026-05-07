import { TRANSPORT_RAW_COMMANDS } from './query/query-policy-capability.js';
const DEFAULT_POLICY = {
    preferNative: true,
    allowFallbackToSubprocess: true,
    outputMode: 'json',
};
const BUILTIN_COMMAND_POLICY = Object.fromEntries(TRANSPORT_RAW_COMMANDS.map((command) => [command, { outputMode: 'raw' }]));
const COMMAND_POLICY_OVERRIDES = {};
export function resolveTransportPolicy(command) {
    const override = {
        ...(BUILTIN_COMMAND_POLICY[command] ?? {}),
        ...(COMMAND_POLICY_OVERRIDES[command] ?? {}),
    };
    return {
        preferNative: override.preferNative ?? DEFAULT_POLICY.preferNative,
        allowFallbackToSubprocess: override.allowFallbackToSubprocess ?? DEFAULT_POLICY.allowFallbackToSubprocess,
        outputMode: override.outputMode ?? DEFAULT_POLICY.outputMode,
    };
}
export function setTransportPolicy(command, override) {
    COMMAND_POLICY_OVERRIDES[command] = { ...(COMMAND_POLICY_OVERRIDES[command] ?? {}), ...override };
}
export function clearTransportPolicy(command) {
    if (command) {
        delete COMMAND_POLICY_OVERRIDES[command];
        return;
    }
    for (const key of Object.keys(COMMAND_POLICY_OVERRIDES)) {
        delete COMMAND_POLICY_OVERRIDES[key];
    }
}
//# sourceMappingURL=gsd-transport-policy.js.map