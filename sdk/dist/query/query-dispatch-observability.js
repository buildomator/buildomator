export function fallbackBridgeNotices(command) {
    return [
        `[bm-sdk] '${command}' not in native registry; falling back to gsd-tools.cjs.`,
        '[bm-sdk] Transparent bridge, prefer adding a native handler when parity matters.',
    ];
}
//# sourceMappingURL=query-dispatch-observability.js.map