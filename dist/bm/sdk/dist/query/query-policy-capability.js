import { QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS, TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS, COMMAND_MUTATION_SET, COMMAND_RAW_OUTPUT_SET, } from './command-definition.js';
export const QUERY_MUTATION_COMMAND_LIST = QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS;
export const TRANSPORT_RAW_COMMANDS = TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS;
export const QUERY_POLICY_SNAPSHOT = {
    mutation_commands: QUERY_MUTATION_COMMAND_LIST,
    raw_output_commands: TRANSPORT_RAW_COMMANDS,
};
export function supportsMutationCommand(command) {
    return COMMAND_MUTATION_SET.has(command);
}
export function supportsRawOutputCommand(command) {
    return COMMAND_RAW_OUTPUT_SET.has(command);
}
export function isQueryMutationCommand(command) {
    return COMMAND_MUTATION_SET.has(command);
}
//# sourceMappingURL=query-policy-capability.js.map