import type { QueryDispatchError } from './query-dispatch-contract.js';
import type { QueryFailureSignal } from '../query-failure-classification.js';
export declare function unknownCommandError(input: {
    message: string;
    normalized: string;
    attempted: string[];
    hints: string[];
}): QueryDispatchError;
export declare function nativeFailureError(input: {
    message: string;
    command: string;
    args: string[];
}): QueryDispatchError;
export declare function nativeTimeoutError(input: {
    message: string;
    command: string;
    args: string[];
    timeoutMs?: number;
}): QueryDispatchError;
export declare function fallbackFailureError(input: {
    message: string;
    command: string;
    args: string[];
    backend?: 'cjs';
}): QueryDispatchError;
export declare function validationError(input: {
    message: string;
    code?: number;
    details?: Record<string, unknown>;
}): QueryDispatchError;
export declare function internalError(input: {
    message: string;
    code?: number;
    details?: Record<string, unknown>;
}): QueryDispatchError;
export declare function nativeDispatchErrorFromSignal(signal: QueryFailureSignal, command: string, args: string[]): QueryDispatchError;
export declare function fallbackDispatchErrorFromSignal(signal: QueryFailureSignal, command: string, args: string[]): QueryDispatchError;
//# sourceMappingURL=query-error-taxonomy.d.ts.map