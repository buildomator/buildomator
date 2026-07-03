/**
 * Module owning command normalization + execution payload shape.
 */
export class QueryCommandExecutor {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async exec(command, args, mode) {
        const matched = this.deps.nativeMatch(command, args);
        const registryCommand = matched?.cmd ?? command;
        const registryArgs = matched?.args ?? args;
        return this.deps.execute({
            legacyCommand: command,
            legacyArgs: args,
            registryCommand,
            registryArgs,
            mode,
        });
    }
}
//# sourceMappingURL=query-command-executor.js.map