import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
import { type QueryCommandRegistryLike } from './query-command-resolution-strategy.js';
export type CommandTopologyOutputMode = 'json' | 'text' | 'raw';
export interface CommandTopologyMatch {
    kind: 'match';
    canonical: string;
    args: string[];
    output_mode: CommandTopologyOutputMode;
    mutation: boolean;
    adapter: QueryHandler;
}
export interface CommandTopologyNoMatch {
    kind: 'no_match';
    attempted: string[];
    normalized?: string;
    hints: string[];
    message: string;
}
export type CommandTopologyResult = CommandTopologyMatch | CommandTopologyNoMatch;
export interface CommandTopology {
    resolve(tokens: string[], fallbackRestricted?: boolean): CommandTopologyResult;
}
export interface UnknownCommandDiagnosis {
    normalized: string;
    attempted: string[];
    hints: string[];
    message: string;
}
export declare function diagnoseUnknownCommand(command: string, args: string[], registry: QueryCommandRegistryLike, fallbackRestricted: boolean): UnknownCommandDiagnosis;
export declare function createCommandTopology(registry: QueryRegistry): CommandTopology;
//# sourceMappingURL=command-topology.d.ts.map