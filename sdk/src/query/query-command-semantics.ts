/**
 * @deprecated Legacy compatibility seam.
 * Prefer importing policy and indexed views from `query-policy-capability` or `command-definition`.
 */

export {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
} from './query-policy-capability.js';

export {
  normalizeQueryCommand,
  resolveQueryTokens,
  resolveQueryCommand,
  explainQueryCommandNoMatch,
  type QueryCommandRegistryLike,
  type QueryCommandResolution,
  type QueryMatchMode,
  type QueryResolutionSource,
  type QueryCommandNoMatch,
} from './query-command-resolution-strategy.js';
