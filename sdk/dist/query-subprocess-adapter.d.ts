import type { QueryToolsErrorFactory } from './query-tools-error-factory.js';
export interface QuerySubprocessAdapterDeps extends QueryToolsErrorFactory {
    projectDir: string;
    gsdToolsPath: string;
    timeoutMs: number;
    workstream?: string;
}
export declare class QuerySubprocessAdapter {
    private readonly deps;
    constructor(deps: QuerySubprocessAdapterDeps);
    execJson(command: string, args: string[]): Promise<unknown>;
    execRaw(command: string, args: string[]): Promise<string>;
    private commandArgs;
    private processExecutionError;
    private processSpawnError;
    private parseOutput;
}
//# sourceMappingURL=query-subprocess-adapter.d.ts.map