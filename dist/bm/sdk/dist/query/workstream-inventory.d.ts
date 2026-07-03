/**
 * Workstream Inventory Module.
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Query handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 */
export interface WorkstreamPhaseInventory {
    directory: string;
    status: 'complete' | 'in_progress' | 'pending';
    plan_count: number;
    summary_count: number;
}
export interface WorkstreamInventory {
    name: string;
    path: string;
    active: boolean;
    files: {
        roadmap: boolean;
        state: boolean;
        requirements: boolean;
    };
    status: string;
    current_phase: string | null;
    last_activity: string | null;
    phases: WorkstreamPhaseInventory[];
    phase_count: number;
    completed_phases: number;
    roadmap_phase_count: number;
    total_plans: number;
    completed_plans: number;
    progress_percent: number;
}
export interface WorkstreamInventoryList {
    mode: 'flat' | 'workstream';
    active: string | null;
    workstreams: WorkstreamInventory[];
    count: number;
    message?: string;
}
export declare const planningRoot: (projectDir: string) => string;
export declare const workstreamsRoot: (projectDir: string) => string;
export declare function countRoadmapPhases(roadmapPath: string, fallbackCount: number): number;
export declare function countPhaseFiles(phaseDir: string): {
    planCount: number;
    summaryCount: number;
};
export declare function inspectWorkstream(projectDir: string, name: string, options?: {
    active?: string | null;
}): WorkstreamInventory | null;
export declare function listWorkstreamInventories(projectDir: string): WorkstreamInventoryList;
//# sourceMappingURL=workstream-inventory.d.ts.map