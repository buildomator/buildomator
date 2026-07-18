export interface PhasePlanScan {
    planCount: number;
    summaryCount: number;
    completed: boolean;
    hasNestedPlans: boolean;
    planFiles: string[];
    summaryFiles: string[];
}
export declare function isRootPlanFile(fileName: string): boolean;
export declare function isNestedPlanFile(fileName: string): boolean;
export declare function isRootSummaryFile(fileName: string): boolean;
export declare function isNestedSummaryFile(fileName: string): boolean;
/**
 * Count only the summaries that pair with a real plan file.
 *
 * A summary counts toward completion when its pairing id matches some plan's
 * pairing id. Stray summaries that match no plan are excluded, so they can
 * never inflate a phase to complete.
 */
export declare function countMatchedSummaries(planFiles: string[], summaryFiles: string[]): number;
export declare function scanPhasePlans(phaseDir: string): PhasePlanScan;
//# sourceMappingURL=plan-scan.d.ts.map