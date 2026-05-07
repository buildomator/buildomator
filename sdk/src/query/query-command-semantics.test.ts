import { describe, expect, it } from 'vitest';
import {
  QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS,
  TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS,
} from './command-definition.js';
import {
  QUERY_MUTATION_COMMAND_LIST,
  TRANSPORT_RAW_COMMANDS,
  isQueryMutationCommand,
} from './query-command-semantics.js';

describe('query-command-semantics compatibility seam', () => {
  it('keeps legacy exports derived from command definitions', () => {
    expect(QUERY_MUTATION_COMMAND_LIST).toBe(QUERY_MUTATION_COMMANDS_FROM_DEFINITIONS);
    expect(TRANSPORT_RAW_COMMANDS).toBe(TRANSPORT_RAW_COMMANDS_FROM_DEFINITIONS);
  });

  it('classifies mutation status through derived set', () => {
    expect(isQueryMutationCommand('state.update')).toBe(true);
    expect(isQueryMutationCommand('state.json')).toBe(false);
  });
});
