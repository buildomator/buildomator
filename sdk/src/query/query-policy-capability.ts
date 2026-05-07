import {
  QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS,
  TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS,
  COMMAND_MUTATION_SET,
  COMMAND_RAW_OUTPUT_SET,
} from './command-definition.js';

export const QUERY_MUTATION_COMMAND_LIST: readonly string[] = QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS;
export const TRANSPORT_RAW_COMMANDS: readonly string[] = TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS;

export const QUERY_POLICY_SNAPSHOT = {
  mutation_commands: QUERY_MUTATION_COMMAND_LIST,
  raw_output_commands: TRANSPORT_RAW_COMMANDS,
} as const;

export function supportsMutationCommand(command: string): boolean {
  return COMMAND_MUTATION_SET.has(command);
}

export function supportsRawOutputCommand(command: string): boolean {
  return COMMAND_RAW_OUTPUT_SET.has(command);
}

export function isQueryMutationCommand(command: string): boolean {
  return COMMAND_MUTATION_SET.has(command);
}
