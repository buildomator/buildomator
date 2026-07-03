export declare const QUERY_MUTATION_COMMAND_LIST: readonly string[];
export declare const TRANSPORT_RAW_COMMANDS: readonly string[];
export declare const QUERY_POLICY_SNAPSHOT: {
    readonly mutation_commands: readonly string[];
    readonly raw_output_commands: readonly string[];
};
export declare function supportsMutationCommand(command: string): boolean;
export declare function supportsRawOutputCommand(command: string): boolean;
export declare function isQueryMutationCommand(command: string): boolean;
//# sourceMappingURL=query-policy-capability.d.ts.map