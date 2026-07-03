import { PlanningJournal, type PlanningEventActor } from './planning-journal.js';
type RuntimeOptions = {
    projectDir: string;
    projectId: string;
    runId: string;
    sourceId: string;
    actor: PlanningEventActor;
};
type RuntimeMeta = {
    idempotencyKey: string;
    planId?: string;
    itemId?: string;
};
type NextInput = RuntimeMeta & {
    selector?: {
        itemId?: string;
        titleIncludes?: string;
    };
    createPlan?: {
        title: string;
        items: Array<{
            title: string;
            description?: string;
            dependsOn?: string[];
        }>;
    };
};
type CheckpointInput = RuntimeMeta & {
    summary?: string;
    subTasks?: Array<{
        id?: string;
        text: string;
    }>;
    agentCriteria?: Array<{
        id?: string;
        text: string;
    }>;
    criteriaMet?: string[];
    blocked?: {
        reason: string;
        nextAction?: string;
    };
};
type DoneInput = RuntimeMeta & {
    summary: string;
    blockers?: string[];
    criteriaMet?: string[];
    evidenceRefs?: string[];
    evidencePolicy?: 'auto' | 'explicit' | 'waive';
    evidenceWaiverReason?: string;
    advance?: boolean;
};
export declare class PlanningRuntime {
    private readonly options;
    readonly journal: PlanningJournal;
    constructor(options: RuntimeOptions);
    status(input: RuntimeMeta): Promise<import("./planning-journal.js").PlanningEvent>;
    next(input: NextInput): Promise<import("./planning-journal.js").PlanningEvent>;
    checkpoint(input: CheckpointInput): Promise<import("./planning-journal.js").PlanningEvent>;
    sync(input: RuntimeMeta & {
        cursor?: string;
    }): Promise<import("./planning-journal.js").PlanningEvent>;
    done(input: DoneInput): Promise<import("./planning-journal.js").PlanningEvent>;
    private record;
}
export {};
//# sourceMappingURL=planning-runtime.d.ts.map