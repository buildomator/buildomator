export interface FallbackOutputClassification {
    mode: 'json' | 'text';
    output: unknown;
}
export declare function classifyFallbackOutput(raw: string, projectDir: string): Promise<FallbackOutputClassification>;
//# sourceMappingURL=query-fallback-output-classifier.d.ts.map