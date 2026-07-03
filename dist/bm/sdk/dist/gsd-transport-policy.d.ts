export type TransportMode = 'json' | 'raw';
export interface TransportPolicy {
    preferNative: boolean;
    allowFallbackToSubprocess: boolean;
    outputMode: TransportMode;
}
export declare function resolveTransportPolicy(command: string): TransportPolicy;
export declare function setTransportPolicy(command: string, override: Partial<TransportPolicy>): void;
export declare function clearTransportPolicy(command?: string): void;
//# sourceMappingURL=gsd-transport-policy.d.ts.map