export interface FallowUnusedExport {
    file?: string;
    symbol?: string;
    line?: number | null;
}
export interface FallowDuplicateBlock {
    left?: {
        file?: string;
        start?: number | null;
        end?: number | null;
    };
    right?: {
        file?: string;
        start?: number | null;
        end?: number | null;
    };
    similarity?: number;
}
export interface FallowCircularDependency {
    cycle?: string[];
}
export interface FallowReport {
    unusedExports?: FallowUnusedExport[];
    duplicates?: FallowDuplicateBlock[];
    circularDependencies?: FallowCircularDependency[];
}
export interface NormalizedFallowFinding {
    type: 'unused_export' | 'duplicate_block' | 'circular_dependency';
    message: string;
    file: string;
    line: number | null;
    related_file?: string;
}
export interface NormalizedFallowReport {
    summary: {
        unused_exports: number;
        duplicates: number;
        circular_dependencies: number;
        total: number;
    };
    findings: NormalizedFallowFinding[];
}
export declare function normalizeFallowReport(report: FallowReport | null | undefined): NormalizedFallowReport;
//# sourceMappingURL=fallow-audit.d.ts.map