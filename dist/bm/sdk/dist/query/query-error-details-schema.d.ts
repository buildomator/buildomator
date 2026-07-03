export interface UnknownCommandDetails {
    normalized: string;
    attempted: string[];
    hints: string[];
}
export interface NativeErrorDetails {
    command: string;
    args: string[];
    timeout_ms?: number;
}
export interface FallbackErrorDetails {
    command: string;
    args: string[];
    backend: 'cjs';
}
export declare function unknownCommandDetails(input: UnknownCommandDetails): UnknownCommandDetails;
export declare function nativeErrorDetails(input: NativeErrorDetails): NativeErrorDetails;
export declare function fallbackErrorDetails(input: FallbackErrorDetails): FallbackErrorDetails;
//# sourceMappingURL=query-error-details-schema.d.ts.map