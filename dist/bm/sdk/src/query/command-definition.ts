import { COMMAND_MANIFEST } from './command-manifest.js';
import { NON_FAMILY_COMMAND_MANIFEST } from './command-manifest.non-family.js';
import type { CommandFamily, OutputMode } from './command-manifest.types.js';

export interface CommandDefinition {
  family?: CommandFamily;
  canonical: string;
  aliases: string[];
  mutation: boolean;
  output_mode: OutputMode;
  handler_key?: string;
}

const FAMILY_COMMAND_DEFINITIONS: readonly CommandDefinition[] = COMMAND_MANIFEST.map((entry) => ({
  family: entry.family,
  canonical: entry.canonical,
  aliases: [...entry.aliases],
  mutation: entry.mutation,
  output_mode: entry.outputMode,
  handler_key: entry.handlerKey ?? entry.canonical,
})) as readonly CommandDefinition[];

const NON_FAMILY_COMMAND_DEFINITIONS: readonly CommandDefinition[] = NON_FAMILY_COMMAND_MANIFEST.map((entry) => ({
  canonical: entry.canonical,
  aliases: [...entry.aliases],
  mutation: entry.mutation,
  output_mode: entry.outputMode,
})) as readonly CommandDefinition[];

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  ...FAMILY_COMMAND_DEFINITIONS,
  ...NON_FAMILY_COMMAND_DEFINITIONS,
] as const;

function byFamily(family: CommandFamily): readonly CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((entry) => entry.family === family);
}

export const COMMAND_DEFINITIONS_BY_FAMILY: Readonly<Record<CommandFamily, readonly CommandDefinition[]>> = {
  state: byFamily('state'),
  verify: byFamily('verify'),
  init: byFamily('init'),
  phase: byFamily('phase'),
  phases: byFamily('phases'),
  validate: byFamily('validate'),
  roadmap: byFamily('roadmap'),
} as const;

export const COMMAND_DEFINITION_BY_CANONICAL: Readonly<Record<string, CommandDefinition>> = Object.fromEntries(
  COMMAND_DEFINITIONS.map((entry) => [entry.canonical, entry]),
);

export const COMMAND_MUTATION_SET: ReadonlySet<string> = new Set(
  COMMAND_DEFINITIONS.filter((entry) => entry.mutation).flatMap((entry) => [entry.canonical, ...entry.aliases]),
);

export const COMMAND_RAW_OUTPUT_SET: ReadonlySet<string> = new Set(
  COMMAND_DEFINITIONS.filter((entry) => entry.output_mode === 'raw').flatMap((entry) => [entry.canonical, ...entry.aliases]),
);

export const FAMILY_MUTATION_COMMANDS: readonly string[] = FAMILY_COMMAND_DEFINITIONS
  .filter((entry) => entry.mutation)
  .flatMap((entry) => [entry.canonical, ...entry.aliases]);

export const FAMILY_RAW_OUTPUT_COMMANDS: readonly string[] = FAMILY_COMMAND_DEFINITIONS
  .filter((entry) => entry.output_mode === 'raw')
  .flatMap((entry) => [entry.canonical, ...entry.aliases]);

export const QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS: readonly string[] = Array.from(COMMAND_MUTATION_SET);
export const TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS: readonly string[] = Array.from(COMMAND_RAW_OUTPUT_SET);
