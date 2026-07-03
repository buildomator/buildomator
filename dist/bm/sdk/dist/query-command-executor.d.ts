export interface QueryCommandExecutorDeps {
    nativeMatch: (command: string, args: string[]) => {
        cmd: string;
        args: string[];
    } | null;
    execute: (input: {
        legacyCommand: string;
        legacyArgs: string[];
        registryCommand: string;
        registryArgs: string[];
        mode: 'json' | 'raw';
    }) => Promise<unknown>;
}
/**
 * Module owning command normalization + execution payload shape.
 */
export declare class QueryCommandExecutor {
    private readonly deps;
    constructor(deps: QueryCommandExecutorDeps);
    exec(command: string, args: string[], mode: 'json' | 'raw'): Promise<unknown>;
}
//# sourceMappingURL=query-command-executor.d.ts.map