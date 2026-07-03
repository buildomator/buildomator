import { fallbackErrorDetails, nativeErrorDetails, unknownCommandDetails } from './query-error-details-schema.js';
export function unknownCommandError(input) {
    return {
        kind: 'unknown_command',
        code: 10,
        message: input.message,
        details: unknownCommandDetails({
            normalized: input.normalized,
            attempted: input.attempted,
            hints: input.hints,
        }),
    };
}
export function nativeFailureError(input) {
    return {
        kind: 'native_failure',
        code: 1,
        message: `Error: ${input.message}`,
        details: nativeErrorDetails({
            command: input.command,
            args: input.args,
        }),
    };
}
export function nativeTimeoutError(input) {
    return {
        kind: 'native_timeout',
        code: 1,
        message: `Error: ${input.message}`,
        details: nativeErrorDetails({
            command: input.command,
            args: input.args,
            ...(input.timeoutMs !== undefined ? { timeout_ms: input.timeoutMs } : {}),
        }),
    };
}
export function fallbackFailureError(input) {
    return {
        kind: 'fallback_failure',
        code: 1,
        message: `Error: gsd-tools.cjs fallback failed: ${input.message}`,
        details: fallbackErrorDetails({
            command: input.command,
            args: input.args,
            backend: input.backend ?? 'cjs',
        }),
    };
}
export function validationError(input) {
    return {
        kind: 'validation_error',
        code: input.code ?? 10,
        message: input.message,
        details: input.details,
    };
}
export function internalError(input) {
    return {
        kind: 'internal_error',
        code: input.code ?? 1,
        message: input.message,
        details: input.details,
    };
}
export function nativeDispatchErrorFromSignal(signal, command, args) {
    if (signal.kind === 'timeout') {
        return nativeTimeoutError({ message: signal.message, command, args, timeoutMs: signal.timeoutMs });
    }
    return nativeFailureError({ message: signal.message, command, args });
}
export function fallbackDispatchErrorFromSignal(signal, command, args) {
    return fallbackFailureError({ message: signal.message, command, args, backend: 'cjs' });
}
//# sourceMappingURL=query-error-taxonomy.js.map