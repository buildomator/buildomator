export interface QueryRuntimeContextInput {
    projectDir: string;
    ws?: string;
}
export interface QueryRuntimeContext {
    projectDir: string;
    ws?: string;
}
/**
 * Resolve the runtime context for a query invocation.
 *
 * Workstream resolution priority:
 *   1. `--ws <name>` flag (input.ws)
 *   2. `GSD_WORKSTREAM` environment variable
 *   3. `.planning/active-workstream` file
 *   4. Root `.planning/` (no workstream)
 */
export declare function resolveQueryRuntimeContext(input: QueryRuntimeContextInput): QueryRuntimeContext;
//# sourceMappingURL=query-runtime-context.d.ts.map