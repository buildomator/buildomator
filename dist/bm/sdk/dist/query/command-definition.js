import { COMMAND_MANIFEST } from './command-manifest.js';
import { NON_FAMILY_COMMAND_MANIFEST } from './command-manifest.non-family.js';
const FAMILY_COMMAND_DEFINITIONS = COMMAND_MANIFEST.map((entry) => ({
    family: entry.family,
    canonical: entry.canonical,
    aliases: [...entry.aliases],
    mutation: entry.mutation,
    output_mode: entry.outputMode,
    handler_key: entry.handlerKey ?? entry.canonical,
}));
const NON_FAMILY_COMMAND_DEFINITIONS = NON_FAMILY_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: [...entry.aliases],
    mutation: entry.mutation,
    output_mode: entry.outputMode,
}));
export const COMMAND_DEFINITIONS = [
    ...FAMILY_COMMAND_DEFINITIONS,
    ...NON_FAMILY_COMMAND_DEFINITIONS,
];
function byFamily(family) {
    return COMMAND_DEFINITIONS.filter((entry) => entry.family === family);
}
export const COMMAND_DEFINITIONS_BY_FAMILY = {
    state: byFamily('state'),
    verify: byFamily('verify'),
    init: byFamily('init'),
    phase: byFamily('phase'),
    phases: byFamily('phases'),
    validate: byFamily('validate'),
    roadmap: byFamily('roadmap'),
};
export const COMMAND_DEFINITION_BY_CANONICAL = Object.fromEntries(COMMAND_DEFINITIONS.map((entry) => [entry.canonical, entry]));
export const COMMAND_MUTATION_SET = new Set(COMMAND_DEFINITIONS.filter((entry) => entry.mutation).flatMap((entry) => [entry.canonical, ...entry.aliases]));
export const COMMAND_RAW_OUTPUT_SET = new Set(COMMAND_DEFINITIONS.filter((entry) => entry.output_mode === 'raw').flatMap((entry) => [entry.canonical, ...entry.aliases]));
export const FAMILY_MUTATION_COMMANDS = FAMILY_COMMAND_DEFINITIONS
    .filter((entry) => entry.mutation)
    .flatMap((entry) => [entry.canonical, ...entry.aliases]);
export const FAMILY_RAW_OUTPUT_COMMANDS = FAMILY_COMMAND_DEFINITIONS
    .filter((entry) => entry.output_mode === 'raw')
    .flatMap((entry) => [entry.canonical, ...entry.aliases]);
export const QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS = Array.from(COMMAND_MUTATION_SET);
export const TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS = Array.from(COMMAND_RAW_OUTPUT_SET);
//# sourceMappingURL=command-definition.js.map