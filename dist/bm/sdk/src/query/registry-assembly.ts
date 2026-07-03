import { QueryRegistry } from './registry.js';
import { GSDEventStream } from '../event-stream.js';
import { registerAliasCatalog, registerStaticCatalog } from './command-catalog.js';
import { QUERY_MUTATION_COMMAND_LIST, TRANSPORT_RAW_COMMANDS } from './query-policy-capability.js';
import { decorateMutationsWithEvents } from './mutation-event-decorator.js';
import {
  STATIC_CATALOG_GROUPS,
  ALIAS_GROUPS,
  STATIC_GROUP_BY_NAME,
  ALIAS_GROUP_BY_FAMILY,
  REGISTRY_ASSEMBLY_PLAN,
} from './registry-assembly-descriptor.js';
import {
  assertAliasCanonicalsHaveHandlers,
  assertMutationCommandsRegistered,
  assertNoDuplicateRegisteredCommands,
  assertRawOutputPolicyCommandsRegistered,
} from './registry-assembly-invariants.js';

/**
 * Command names that perform durable writes (disk, git, or global profile store).
 */
export const QUERY_MUTATION_COMMANDS = new Set<string>(QUERY_MUTATION_COMMAND_LIST);


export function buildRegistry(): QueryRegistry {
  assertAliasCanonicalsHaveHandlers({
    staticGroups: STATIC_CATALOG_GROUPS,
    aliasGroups: ALIAS_GROUPS,
    mutationCommands: QUERY_MUTATION_COMMANDS,
    rawOutputPolicyCommands: TRANSPORT_RAW_COMMANDS,
  });
  assertNoDuplicateRegisteredCommands({
    staticGroups: STATIC_CATALOG_GROUPS,
    aliasGroups: ALIAS_GROUPS,
    mutationCommands: QUERY_MUTATION_COMMANDS,
    rawOutputPolicyCommands: TRANSPORT_RAW_COMMANDS,
  });

  const registry = new QueryRegistry();

  for (const step of REGISTRY_ASSEMBLY_PLAN) {
    if (step.kind === 'static') {
      const group = STATIC_GROUP_BY_NAME[step.key];
      if (!group) throw new Error(`registry assembly invariant failed: unknown static group: ${step.key}`);
      registerStaticCatalog(registry, group.entries);
      continue;
    }

    const group = ALIAS_GROUP_BY_FAMILY[step.key as keyof typeof ALIAS_GROUP_BY_FAMILY];
    if (!group) throw new Error(`registry assembly invariant failed: unknown alias group: ${step.key}`);
    registerAliasCatalog(registry, group.aliases, group.handlers);
  }

  assertMutationCommandsRegistered(registry, QUERY_MUTATION_COMMANDS);
  assertRawOutputPolicyCommandsRegistered(registry, TRANSPORT_RAW_COMMANDS);

  return registry;
}

export function decorateRegistryMutations(
  registry: QueryRegistry,
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): void {
  if (!eventStream) return;
  const mutationSessionId = correlationSessionId ?? '';
  decorateMutationsWithEvents(registry, QUERY_MUTATION_COMMANDS, eventStream, mutationSessionId);
}

export function createRegistry(
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): QueryRegistry {
  const registry = buildRegistry();
  decorateRegistryMutations(registry, eventStream, correlationSessionId);
  return registry;
}
