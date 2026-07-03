export function fallbackBridgeNotices(command) {
    return [
        `[gsd-sdk] '${command}' not in native registry; falling back to gsd-tools.cjs.`,
        '[gsd-sdk] Transparent bridge — prefer adding a native handler when parity matters.',
    ];
}
//# sourceMappingURL=query-dispatch-observability.js.map