import { buildMutationEvent } from './mutation-event-mapper.js';
export function decorateMutationsWithEvents(registry, mutationCommands, eventStream, correlationSessionId) {
    for (const cmd of mutationCommands) {
        const original = registry.getHandler(cmd);
        if (!original)
            continue;
        registry.register(cmd, async (args, projectDir, workstream) => {
            const result = await original(args, projectDir, workstream);
            try {
                const event = buildMutationEvent(correlationSessionId, cmd, args, result);
                eventStream.emitEvent(event);
            }
            catch {
                // Event emission is fire-and-forget; never block mutation success
            }
            return result;
        });
    }
}
export function countDecoratedMutationHandlers(registry, mutationCommands) {
    let count = 0;
    for (const cmd of mutationCommands) {
        if (registry.getHandler(cmd))
            count++;
    }
    return count;
}
//# sourceMappingURL=mutation-event-decorator.js.map