import { GSDError, exitCodeFor } from './errors.js';
import { GSDToolsError } from './gsd-tools-error.js';
import { errorMessage, toFailureSignal } from './query-failure-classification.js';
function timeoutToolsError(message, command, args, stderr = '', timeoutMs) {
    return GSDToolsError.timeout(message, command, args, stderr, timeoutMs);
}
function failureToolsError(message, command, args, exitCode, stderr = '', cause) {
    return GSDToolsError.failure(message, command, args, exitCode, stderr, cause === undefined ? undefined : { cause });
}
export function toToolsErrorFromUnknown(command, args, err) {
    if (err instanceof GSDError) {
        return failureToolsError(err.message, command, args, exitCodeFor(err.classification), '', err);
    }
    const msg = errorMessage(err);
    const signal = toFailureSignal(err);
    if (signal.kind === 'timeout') {
        return timeoutToolsError(msg, command, args, '', signal.timeoutMs);
    }
    return failureToolsError(msg, command, args, 1, '', err instanceof Error ? err : undefined);
}
export function createQueryToolsErrorFactory() {
    return {
        createTimeoutError: (message, command, args, stderr, timeoutMs) => timeoutToolsError(message, command, args, stderr, timeoutMs),
        createFailureError: (message, command, args, exitCode, stderr) => failureToolsError(message, command, args, exitCode, stderr),
    };
}
export function createQueryNativeErrorFactory(defaultTimeoutMs) {
    return {
        createNativeTimeoutError: (message, command, args) => timeoutToolsError(message, command, args, '', defaultTimeoutMs),
        createNativeFailureError: (message, command, args, cause) => failureToolsError(message, command, args, 1, '', cause),
    };
}
//# sourceMappingURL=query-tools-error-factory.js.map