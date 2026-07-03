import type { AliasCatalogEntry } from './command-catalog.js';
import type { CommandFamily } from './command-manifest.types.js';
import type { QueryHandler } from './utils.js';
import {
  FOUNDATION_STATIC_CATALOG,
  STATE_SUPPORT_STATIC_CATALOG,
  MUTATION_SURFACES_STATIC_CATALOG,
  VERIFY_DECISION_STATIC_CATALOG,
  DECISION_ROUTING_STATIC_CATALOG,
} from './command-static-catalog-foundation.js';
import { DOMAIN_STATIC_CATALOG } from './command-static-catalog-domain.js';
import { COMMAND_DEFINITIONS_BY_FAMILY, type CommandDefinition } from './command-definition.js';
import { FAMILY_HANDLERS } from './command-family-handlers.js';
import type { RegistryAssemblyAliasGroup, RegistryAssemblyStaticGroup } from './registry-assembly-invariants.js';

export interface RegistryAssemblyStep {
  kind: 'static' | 'alias';
  key: string;
}

function toAliasCatalogEntry(entry: CommandDefinition): AliasCatalogEntry {
  return {
    canonical: entry.canonical,
    aliases: entry.aliases,
  };
}

function buildAliasGroup(family: CommandFamily): RegistryAssemblyAliasGroup {
  const definitions = COMMAND_DEFINITIONS_BY_FAMILY[family];
  const familyHandlers = FAMILY_HANDLERS[family] as Readonly<Record<string, QueryHandler>>;
  const handlers: Record<string, QueryHandler> = {};

  for (const entry of definitions) {
    const handler = familyHandlers[entry.handler_key!];
    if (!handler) continue;
    handlers[entry.canonical] = handler;
  }

  return {
    family,
    aliases: definitions.map(toAliasCatalogEntry),
    handlers,
  };
}

export const STATIC_CATALOG_GROUPS: readonly RegistryAssemblyStaticGroup[] = [
  { name: 'FOUNDATION_STATIC_CATALOG', entries: FOUNDATION_STATIC_CATALOG },
  { name: 'STATE_SUPPORT_STATIC_CATALOG', entries: STATE_SUPPORT_STATIC_CATALOG },
  { name: 'MUTATION_SURFACES_STATIC_CATALOG', entries: MUTATION_SURFACES_STATIC_CATALOG },
  { name: 'VERIFY_DECISION_STATIC_CATALOG', entries: VERIFY_DECISION_STATIC_CATALOG },
  { name: 'DECISION_ROUTING_STATIC_CATALOG', entries: DECISION_ROUTING_STATIC_CATALOG },
  { name: 'DOMAIN_STATIC_CATALOG', entries: DOMAIN_STATIC_CATALOG },
] as const;

export const ALIAS_GROUPS: readonly RegistryAssemblyAliasGroup[] = [
  buildAliasGroup('state'),
  buildAliasGroup('roadmap'),
  buildAliasGroup('verify'),
  buildAliasGroup('validate'),
  buildAliasGroup('phase'),
  buildAliasGroup('phases'),
  buildAliasGroup('init'),
] as const;

export const STATIC_GROUP_BY_NAME = Object.fromEntries(
  STATIC_CATALOG_GROUPS.map((group) => [group.name, group]),
) as Readonly<Record<string, RegistryAssemblyStaticGroup>>;

export const ALIAS_GROUP_BY_FAMILY = Object.fromEntries(
  ALIAS_GROUPS.map((group) => [group.family, group]),
) as Readonly<Record<CommandFamily, RegistryAssemblyAliasGroup>>;

export const REGISTRY_ASSEMBLY_PLAN: readonly RegistryAssemblyStep[] = [
  { kind: 'static', key: 'FOUNDATION_STATIC_CATALOG' },
  { kind: 'alias', key: 'state' },
  { kind: 'static', key: 'STATE_SUPPORT_STATIC_CATALOG' },
  { kind: 'alias', key: 'roadmap' },
  { kind: 'static', key: 'MUTATION_SURFACES_STATIC_CATALOG' },
  { kind: 'alias', key: 'verify' },
  { kind: 'static', key: 'VERIFY_DECISION_STATIC_CATALOG' },
  { kind: 'alias', key: 'validate' },
  { kind: 'static', key: 'DECISION_ROUTING_STATIC_CATALOG' },
  { kind: 'alias', key: 'phase' },
  { kind: 'alias', key: 'phases' },
  { kind: 'alias', key: 'init' },
  { kind: 'static', key: 'DOMAIN_STATIC_CATALOG' },
] as const;
