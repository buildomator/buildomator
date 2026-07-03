/**
 * Throw a clear error when the active runtime is not Claude.
 *
 * Precedence mirrors `detectRuntime`: `GSD_RUNTIME` env var > `config.runtime`
 * > `'claude'`. Unknown / missing runtime values default to Claude (the
 * historical behavior) so existing Claude users are unaffected.
 *
 * @param config Project config (with optional `runtime` field).
 * @throws Error with a runtime-specific actionable message when non-Claude.
 */
export declare function assertRuntimeSupportsAutoMode(config?: Record<string, unknown> | {
    runtime?: unknown;
}): void;
//# sourceMappingURL=runtime-gate.d.ts.map