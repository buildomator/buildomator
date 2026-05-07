function timeoutClassification(timeoutMs) {
    return timeoutMs === undefined ? { kind: 'timeout' } : { kind: 'timeout', timeoutMs };
}
function failureClassification() {
    return { kind: 'failure' };
}
export class GSDToolsError extends Error {
    command;
    args;
    exitCode;
    stderr;
    constructor(message, command, args, exitCode, stderr, options) {
        super(message, options);
        this.command = command;
        this.args = args;
        this.exitCode = exitCode;
        this.stderr = stderr;
        this.name = 'GSDToolsError';
        this.classification = options?.classification ?? failureClassification();
    }
    static timeout(message, command, args, stderr = '', timeoutMs, options) {
        return new GSDToolsError(message, command, args, options?.exitCode ?? null, stderr, { cause: options?.cause, classification: timeoutClassification(timeoutMs) });
    }
    static failure(message, command, args, exitCode, stderr = '', options) {
        return new GSDToolsError(message, command, args, exitCode, stderr, { cause: options?.cause, classification: failureClassification() });
    }
    classification;
}
//# sourceMappingURL=gsd-tools-error.js.map