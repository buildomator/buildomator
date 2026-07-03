export interface QueryCommandRegistryLike {
    has(command: string): boolean;
}
export type QueryMatchMode = 'dotted' | 'spaced';
export type QueryResolutionSource = 'normalized' | 'expanded';
export interface QueryCommandResolution {
    cmd: string;
    args: string[];
    matchedBy: QueryMatchMode;
    expanded: boolean;
    source: QueryResolutionSource;
}
export interface QueryCommandNoMatch {
    normalized: {
        command: string;
        args: string[];
        tokens: string[];
    };
    attempted: {
        dotted: string[];
        spaced: string[];
        expandedTokens: string[] | null;
    };
}
export declare function normalizeQueryCommand(command: string, args: string[]): [string, string[]];
export declare function resolveQueryTokens(tokens: string[], registry: QueryCommandRegistryLike): QueryCommandResolution | null;
export declare function resolveQueryCommand(command: string, args: string[], registry: QueryCommandRegistryLike): QueryCommandResolution | null;
export declare function explainQueryCommandNoMatch(command: string, args: string[], registry: QueryCommandRegistryLike): QueryCommandNoMatch;
//# sourceMappingURL=query-command-resolution-strategy.d.ts.map