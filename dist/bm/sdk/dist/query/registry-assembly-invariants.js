export function collectRegistryAssemblyInvariantReport(inputs, registry) {
    const counts = new Map();
    for (const group of inputs.staticGroups) {
        for (const [command] of group.entries) {
            counts.set(command, (counts.get(command) ?? 0) + 1);
        }
    }
    for (const group of inputs.aliasGroups) {
        for (const entry of group.aliases) {
            counts.set(entry.canonical, (counts.get(entry.canonical) ?? 0) + 1);
            for (const alias of entry.aliases) {
                counts.set(alias, (counts.get(alias) ?? 0) + 1);
            }
        }
    }
    const duplicateCommandKeys = toSortedList(Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([command]) => command));
    const aliasCanonicalsMissingHandlers = [];
    for (const group of inputs.aliasGroups) {
        for (const entry of group.aliases) {
            if (!group.handlers[entry.canonical]) {
                aliasCanonicalsMissingHandlers.push(`${group.family}:${entry.canonical}`);
            }
        }
    }
    const missingMutationCommands = registry
        ? toSortedList(Array.from(inputs.mutationCommands).filter((command) => !registry.has(command)))
        : [];
    const missingRawOutputPolicyCommands = registry
        ? toSortedList(inputs.rawOutputPolicyCommands.filter((command) => !registry.has(command)))
        : [];
    return {
        duplicateCommandKeys,
        aliasCanonicalsMissingHandlers: toSortedList(aliasCanonicalsMissingHandlers),
        missingMutationCommands,
        missingRawOutputPolicyCommands,
    };
}
function toSortedList(values) {
    return Array.from(values).sort((a, b) => a.localeCompare(b));
}
export function assertNoDuplicateRegisteredCommands(inputs) {
    const report = collectRegistryAssemblyInvariantReport(inputs);
    if (report.duplicateCommandKeys.length > 0) {
        throw new Error(`registry assembly invariant failed: duplicate command keys: ${report.duplicateCommandKeys.join(', ')}`);
    }
}
export function assertAliasCanonicalsHaveHandlers(inputs) {
    const report = collectRegistryAssemblyInvariantReport(inputs);
    if (report.aliasCanonicalsMissingHandlers.length > 0) {
        throw new Error(`registry assembly invariant failed: alias canonical missing handler: ${report.aliasCanonicalsMissingHandlers.join(', ')}`);
    }
}
export function assertMutationCommandsRegistered(registry, mutationCommands) {
    const report = collectRegistryAssemblyInvariantReport({
        staticGroups: [],
        aliasGroups: [],
        mutationCommands,
        rawOutputPolicyCommands: [],
    }, registry);
    if (report.missingMutationCommands.length > 0) {
        throw new Error(`registry assembly invariant failed: mutation command missing from registry: ${report.missingMutationCommands.join(', ')}`);
    }
}
export function assertRawOutputPolicyCommandsRegistered(registry, rawOutputPolicyCommands) {
    const report = collectRegistryAssemblyInvariantReport({
        staticGroups: [],
        aliasGroups: [],
        mutationCommands: new Set(),
        rawOutputPolicyCommands,
    }, registry);
    if (report.missingRawOutputPolicyCommands.length > 0) {
        throw new Error(`registry assembly invariant failed: raw-output policy command missing from registry: ${report.missingRawOutputPolicyCommands.join(', ')}`);
    }
}
//# sourceMappingURL=registry-assembly-invariants.js.map