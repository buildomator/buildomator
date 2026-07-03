import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
export class PlanningJournal {
    options;
    path;
    constructor(options) {
        this.options = options;
        this.path = join(options.projectDir, '.gsd', 'journal.jsonl');
    }
    async append(input) {
        const existing = await this.findByIdempotency(input.idempotencyKey);
        const requestHash = hashRequest(input);
        if (existing) {
            if (existing.requestHash !== requestHash) {
                throw new Error(`conflicting idempotency key: ${input.idempotencyKey}`);
            }
            return existing;
        }
        const events = await this.readAll();
        const event = {
            id: randomUUID(),
            schemaVersion: 1,
            projectionVersion: this.options.projectionVersion ?? 1,
            projectId: input.projectId,
            source: {
                id: this.options.sourceId,
                kind: this.options.sourceKind ?? 'sdk',
                seq: events.filter((candidate) => candidate.source.id === this.options.sourceId).length + 1,
            },
            runId: this.options.runId,
            workstreamId: input.workstreamId,
            planId: input.planId,
            itemId: input.itemId,
            actor: input.actor,
            authority: 'local',
            type: input.type,
            idempotencyKey: input.idempotencyKey,
            causationId: input.causationId,
            occurredAt: new Date().toISOString(),
            payload: input.payload,
            evidenceIds: input.evidenceIds ?? [],
            parentEventIds: input.parentEventIds ?? [],
            trace: input.trace ?? {},
            requestHash,
        };
        await mkdir(join(this.options.projectDir, '.gsd'), { recursive: true });
        await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
        return event;
    }
    async readAll() {
        let raw = '';
        try {
            raw = await readFile(this.path, 'utf8');
        }
        catch {
            return [];
        }
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    }
    async compact(events) {
        await mkdir(join(this.options.projectDir, '.gsd'), { recursive: true });
        const tmp = `${this.path}.tmp`;
        await writeFile(tmp, events.map((event) => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''), 'utf8');
        await rename(tmp, this.path);
    }
    async findByIdempotency(idempotencyKey) {
        const events = await this.readAll();
        return events.find((event) => event.idempotencyKey === idempotencyKey) ?? null;
    }
}
function hashRequest(input) {
    return createHash('sha256')
        .update(JSON.stringify({
        projectId: input.projectId,
        type: input.type,
        payload: input.payload,
        planId: input.planId,
        itemId: input.itemId,
        actor: input.actor,
    }))
        .digest('hex');
}
//# sourceMappingURL=planning-journal.js.map