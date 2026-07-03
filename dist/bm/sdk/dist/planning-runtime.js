import { PlanningJournal } from './planning-journal.js';
export class PlanningRuntime {
    options;
    journal;
    constructor(options) {
        this.options = options;
        this.journal = new PlanningJournal({
            projectDir: options.projectDir,
            sourceId: options.sourceId,
            runId: options.runId,
            sourceKind: 'sdk',
        });
    }
    status(input) {
        return this.record('plan.status', input, {});
    }
    next(input) {
        return this.record('plan.next', input, {
            selector: input.selector,
            createPlan: input.createPlan,
        });
    }
    checkpoint(input) {
        return this.record('plan.checkpoint', input, {
            summary: input.summary,
            subTasks: input.subTasks,
            agentCriteria: input.agentCriteria,
            criteriaMet: input.criteriaMet,
            blocked: input.blocked,
        });
    }
    sync(input) {
        return this.record('plan.sync', input, { cursor: input.cursor });
    }
    done(input) {
        return this.record('plan.done', input, {
            summary: input.summary,
            blockers: input.blockers,
            criteriaMet: input.criteriaMet,
            evidenceRefs: input.evidenceRefs,
            evidencePolicy: input.evidencePolicy ?? 'auto',
            evidenceWaiverReason: input.evidenceWaiverReason,
            advance: input.advance ?? true,
        });
    }
    record(type, input, payload) {
        return this.journal.append({
            projectId: this.options.projectId,
            type,
            actor: this.options.actor,
            planId: input.planId,
            itemId: input.itemId,
            idempotencyKey: input.idempotencyKey,
            payload,
        });
    }
}
//# sourceMappingURL=planning-runtime.js.map