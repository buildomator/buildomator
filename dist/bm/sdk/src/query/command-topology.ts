import type { QueryRegistry } from './registry.js';
import type { QueryHandler } from './utils.js';
import {
  resolveQueryCommand,
  explainQueryCommandNoMatch,
  type QueryCommandRegistryLike,
} from './query-command-resolution-strategy.js';
import { supportsMutationCommand, supportsRawOutputCommand } from './query-policy-capability.js';
import { UNKNOWN_COMMAND_HINTS } from './query-unknown-command-hints.js';
import { describeFallbackDisabledPolicy } from './query-fallback-policy.js';

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

export function diagnoseUnknownCommand(
  command: string,
  args: string[],
  registry: QueryCommandRegistryLike,
  fallbackRestricted: boolean,
): UnknownCommandDiagnosis {
  const noMatch = explainQueryCommandNoMatch(command, args, registry);
  const normalized = [noMatch.normalized.command, ...noMatch.normalized.args].join(' ');
  const attempted = noMatch.attempted.dotted.slice(0, 2);
  const hints = [...UNKNOWN_COMMAND_HINTS];
  const attemptedSuffix = attempted.length > 0 ? ` Attempted dotted: ${attempted.join(' | ')}.` : '';
  const fallbackClause = fallbackRestricted ? `${describeFallbackDisabledPolicy()} ` : '';
  const message = `Error: Unknown command: "${normalized}". ${hints[0]} ${hints[1]} ${fallbackClause}${hints[2]}${attemptedSuffix}`;

  return {
    normalized,
    attempted,
    hints,
    message,
  };
}

export function createCommandTopology(registry: QueryRegistry): CommandTopology {
  return {
    resolve(tokens: string[], fallbackRestricted = false): CommandTopologyResult {
      const command = tokens[0];
      const args = tokens.slice(1);
      if (!command) {
        return {
          kind: 'no_match',
          attempted: [],
          hints: [],
          message: 'Error: "gsd-sdk query" requires a command',
        };
      }

      const matched = resolveQueryCommand(command, args, registry);
      if (!matched) {
        const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
        return {
          kind: 'no_match',
          normalized: diagnosis.normalized,
          attempted: diagnosis.attempted,
          hints: diagnosis.hints,
          message: diagnosis.message,
        };
      }

      const adapter = registry.getHandler(matched.cmd);
      if (!adapter) {
        const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
        return {
          kind: 'no_match',
          normalized: diagnosis.normalized,
          attempted: diagnosis.attempted,
          hints: diagnosis.hints,
          message: diagnosis.message,
        };
      }

      return {
        kind: 'match',
        canonical: matched.cmd,
        args: matched.args,
        output_mode: supportsRawOutputCommand(matched.cmd) ? 'raw' : 'json',
        mutation: supportsMutationCommand(matched.cmd),
        adapter,
      };
    },
  };
}
