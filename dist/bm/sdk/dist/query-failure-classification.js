import { GSDToolsError } from './gsd-tools-error.js';
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function parseTimeoutMs(message) {
    const m = message.match(/timed out after\s+(\d+)ms/i);
    if (!m)
        return undefined;
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) ? n : undefined;
}
function isTimeoutMessage(message) {
    return /timed out after/i.test(message);
}
export function timeoutMessage(command, args, timeoutMs) {
    return `gsd-tools timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`;
}
export function toFailureSignal(error) {
    if (error instanceof GSDToolsError && error.classification) {
        return {
            kind: error.classification.kind,
            message: error.message,
            timeoutMs: error.classification.timeoutMs,
        };
    }
    const message = errorMessage(error);
    if (isTimeoutMessage(message)) {
        return { kind: 'timeout', message, timeoutMs: parseTimeoutMs(message) };
    }
    return { kind: 'failure', message };
}
//# sourceMappingURL=query-failure-classification.js.map