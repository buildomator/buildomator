export function registerAliasCatalog(registry, aliases, handlers) {
    for (const entry of aliases) {
        const handler = handlers[entry.canonical];
        if (!handler)
            continue;
        registry.register(entry.canonical, handler);
        for (const alias of entry.aliases) {
            registry.register(alias, handler);
        }
    }
}
export function registerStaticCatalog(registry, entries) {
    for (const [command, handler] of entries) {
        registry.register(command, handler);
    }
}
//# sourceMappingURL=command-catalog.js.map