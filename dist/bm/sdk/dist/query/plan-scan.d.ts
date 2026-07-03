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
export declare function scanPhasePlans(phaseDir: string): PhasePlanScan;
//# sourceMappingURL=plan-scan.d.ts.map