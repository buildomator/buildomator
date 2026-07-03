export type PlanningEventActor = {
    type: 'human' | 'agent' | 'runtime' | 'verifier' | 'system';
    id: string;
    role?: string;
    sessionId?: string;
    taskId?: string;
};
export type PlanningEvent = {
    id: string;
    schemaVersion: 1;
    projectionVersion: number;
    projectId: string;
    source: {
        id: string;
        kind: 'sdk' | 'daemon' | 'cloud' | 'import';
        seq: number;
        cursor?: string;
    };
    runId: string;
    workstreamId?: string;
    planId?: string;
    itemId?: string;
    actor: PlanningEventActor;
    authority: 'local' | 'cloud' | 'human_approved' | 'system';
    type: string;
    idempotencyKey: string;
    causationId?: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    evidenceIds: string[];
    parentEventIds: string[];
    trace: Record<string, unknown>;
    requestHash: string;
};
export type PlanningJournalAppendInput = {
    projectId: string;
    type: string;
    actor: PlanningEventActor;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    planId?: string;
    itemId?: string;
    workstreamId?: string;
    evidenceIds?: string[];
    parentEventIds?: string[];
    causationId?: string;
    trace?: Record<string, unknown>;
};
export declare class PlanningJournal {
    private readonly options;
    private readonly path;
    constructor(options: {
        projectDir: string;
        sourceId: string;
        runId: string;
        sourceKind?: 'sdk' | 'daemon' | 'cloud' | 'import';
        projectionVersion?: number;
    });
    append(input: PlanningJournalAppendInput): Promise<PlanningEvent>;
    readAll(): Promise<PlanningEvent[]>;
    compact(events: PlanningEvent[]): Promise<void>;
    private findByIdempotency;
}
//# sourceMappingURL=planning-journal.d.ts.map