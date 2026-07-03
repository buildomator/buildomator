export function describeFallbackDisabledPolicy() {
    return 'CJS fallback is disabled (GSD_QUERY_FALLBACK=registered).';
}
export function canUseCjsFallback(policy) {
    return policy.cjsFallbackEnabled;
}
//# sourceMappingURL=query-fallback-policy.js.map