import type { CommandFamily, OutputMode } from './command-manifest.types.js';
export interface CommandDefinition {
    family?: CommandFamily;
    canonical: string;
    aliases: string[];
    mutation: boolean;
    output_mode: OutputMode;
    handler_key?: string;
}
export declare const COMMAND_DEFINITIONS: readonly CommandDefinition[];
export declare const COMMAND_DEFINITIONS_BY_FAMILY: Readonly<Record<CommandFamily, readonly CommandDefinition[]>>;
export declare const COMMAND_DEFINITION_BY_CANONICAL: Readonly<Record<string, CommandDefinition>>;
export declare const COMMAND_MUTATION_SET: ReadonlySet<string>;
export declare const COMMAND_RAW_OUTPUT_SET: ReadonlySet<string>;
export declare const FAMILY_MUTATION_COMMANDS: readonly string[];
export declare const FAMILY_RAW_OUTPUT_COMMANDS: readonly string[];
export declare const QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS: readonly string[];
export declare const TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS: readonly string[];
//# sourceMappingURL=command-definition.d.ts.map