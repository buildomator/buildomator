export declare const INCOMPLETE_SUMMARY_STATUSES: Set<string>;
export declare function summaryFileIsComplete(summaryPath: string): boolean;
export declare function resolveSummaryPath(phaseDir: string, summaryFile: string): string;
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
/**
 * Count summaries that pair with a real plan AND count as complete.
 *
 * Extends countMatchedSummaries with a status read: a matched summary whose
 * frontmatter status is in INCOMPLETE_SUMMARY_STATUSES (or that is unreadable)
 * is excluded, so a plan paused at a checkpoint is never counted done.
 */
export declare function countMatchedCompleteSummaries(planFiles: string[], summaryFiles: string[], phaseDir: string): number;
export declare function scanPhasePlans(phaseDir: string): PhasePlanScan;
//# sourceMappingURL=plan-scan.d.ts.map