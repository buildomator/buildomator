import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BUNDLED_GSD_TOOLS_PATH = fileURLToPath(
  new URL('../../get-shit-done/bin/gsd-tools.cjs', import.meta.url),
);

// [PLUGIN PATCH] When the SDK runs under jnuyens/gsd-plugin, gsd-tools.cjs
// lives at the flattened layout `<plugin_root>/bin/gsd-tools.cjs`, not at
// upstream's `<root>/get-shit-done/bin/gsd-tools.cjs`. CLAUDE_PLUGIN_ROOT is
// set by Claude Code's plugin loader; check it first so plugin users no
// longer need an external `npm install -g get-shit-done-cc` (gsd-plugin#4).
const PLUGIN_FLAT_GSD_TOOLS = process.env.CLAUDE_PLUGIN_ROOT
  ? join(process.env.CLAUDE_PLUGIN_ROOT, 'bin', 'gsd-tools.cjs')
  : null;

/**
 * Resolve gsd-tools.cjs path.
 * Probe order: plugin-flat layout (gsd-plugin) → SDK-bundled repo copy →
 * project/.claude/get-shit-done → ~/.claude/get-shit-done.
 */
export function resolveGsdToolsPath(projectDir: string): string {
  const candidates = [
    PLUGIN_FLAT_GSD_TOOLS,
    BUNDLED_GSD_TOOLS_PATH,
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
  ].filter((p): p is string => p !== null);

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[candidates.length - 1]!;
}

export { BUNDLED_GSD_TOOLS_PATH };
