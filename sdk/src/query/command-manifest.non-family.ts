import type { OutputMode } from './command-manifest.types.js';

export interface NonFamilyCommandManifestEntry {
  canonical: string;
  aliases: string[];
  mutation: boolean;
  outputMode: OutputMode;
}

export const NON_FAMILY_COMMAND_MANIFEST: readonly NonFamilyCommandManifestEntry[] = [
  { canonical: 'frontmatter.set', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'frontmatter.merge', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'frontmatter.validate', aliases: ['frontmatter validate'], mutation: true, outputMode: 'json' },

  { canonical: 'commit', aliases: [], mutation: true, outputMode: 'raw' },
  { canonical: 'config-set', aliases: [], mutation: true, outputMode: 'raw' },
  { canonical: 'config-set-model-profile', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'config-new-project', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'config-ensure-section', aliases: [], mutation: true, outputMode: 'json' },

  { canonical: 'check-commit', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'commit-to-subrepo', aliases: [], mutation: true, outputMode: 'json' },

  { canonical: 'template.fill', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'template.select', aliases: ['template select'], mutation: true, outputMode: 'json' },

  { canonical: 'requirements.mark-complete', aliases: ['requirements mark-complete'], mutation: true, outputMode: 'json' },
  { canonical: 'todo.complete', aliases: ['todo complete'], mutation: true, outputMode: 'json' },
  { canonical: 'milestone.complete', aliases: ['milestone complete'], mutation: true, outputMode: 'json' },

  {
    canonical: 'workstream.create',
    aliases: ['workstream create'],
    mutation: true,
    outputMode: 'json',
  },
  { canonical: 'workstream.set', aliases: ['workstream set'], mutation: true, outputMode: 'json' },
  {
    canonical: 'workstream.complete',
    aliases: ['workstream complete'],
    mutation: true,
    outputMode: 'json',
  },
  {
    canonical: 'workstream.progress',
    aliases: ['workstream progress'],
    mutation: true,
    outputMode: 'json',
  },

  { canonical: 'docs-init', aliases: [], mutation: true, outputMode: 'json' },

  { canonical: 'learnings.copy', aliases: ['learnings copy'], mutation: true, outputMode: 'json' },
  { canonical: 'learnings.prune', aliases: ['learnings prune'], mutation: true, outputMode: 'json' },
  { canonical: 'learnings.delete', aliases: ['learnings delete'], mutation: true, outputMode: 'json' },

  { canonical: 'intel.snapshot', aliases: ['intel snapshot'], mutation: true, outputMode: 'json' },
  { canonical: 'intel.patch-meta', aliases: ['intel patch-meta'], mutation: true, outputMode: 'json' },

  { canonical: 'write-profile', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'generate-claude-profile', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'generate-dev-preferences', aliases: [], mutation: true, outputMode: 'json' },
  { canonical: 'generate-claude-md', aliases: [], mutation: true, outputMode: 'json' },

  { canonical: 'verify-summary', aliases: ['verify.summary', 'verify summary'], mutation: false, outputMode: 'raw' },
] as const;
