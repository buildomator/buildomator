/**
 * Query command registry — routes commands to native SDK handlers.
 *
 * The registry is a flat `Map<string, QueryHandler>` that maps command names
 * to handler functions. Unknown keys passed to `dispatch()` throw `GSDError`.
 * The `gsd-sdk query` CLI resolves argv with `resolveQueryArgv()` before dispatch;
 * there is no automatic delegation to `gsd-tools.cjs`.
 *
 * Also exports `extractField` — a TypeScript port of the `--pick` field
 * extraction logic from gsd-tools.cjs (lines 365-382).
 *
 * @example
 * ```typescript
 * import { QueryRegistry, extractField } from './registry.js';
 *
 * const registry = new QueryRegistry();
 * registry.register('generate-slug', generateSlug);
 * const result = await registry.dispatch('generate-slug', ['My Phase'], '/project');
 * const slug = extractField(result.data, 'slug'); // 'my-phase'
 * ```
 */
import { GSDError, ErrorClassification } from '../errors.js';
import { resolveQueryTokens } from './query-command-resolution-strategy.js';
// ─── extractField ──────────────────────────────────────────────────────────
/**
 * Extract a nested field from an object using dot-notation and bracket syntax.
 *
 * Direct port of `extractField()` from gsd-tools.cjs (lines 365-382).
 * Supports `a.b.c` dot paths, `items[0]` array indexing, and `items[-1]`
 * negative indexing.
 *
 * @param obj - The object to extract from
 * @param fieldPath - Dot-separated path with optional bracket notation
 * @returns The extracted value, or undefined if the path doesn't resolve
 */
export function extractField(obj, fieldPath) {
    const parts = fieldPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        const bracketMatch = part.match(/^(.+?)\[(-?\d+)]$/);
        if (bracketMatch) {
            const key = bracketMatch[1];
            const index = parseInt(bracketMatch[2], 10);
            current = current[key];
            if (!Array.isArray(current))
                return undefined;
            current = index < 0 ? current[current.length + index] : current[index];
        }
        else {
            current = current[part];
        }
    }
    return current;
}
// ─── QueryRegistry ─────────────────────────────────────────────────────────
/**
 * Flat command registry that routes query commands to native handlers.
 *
 * `dispatch()` throws `GSDError` for unknown command keys. The `gsd-sdk query`
 * CLI uses `resolveQueryArgv()` first; when no handler matches, it may shell out
 * to `gsd-tools.cjs` (see `cli.ts` and `QUERY-HANDLERS.md` fallback policy).
 */
export class QueryRegistry {
    handlers = new Map();
    /**
     * Register a native handler for a command name.
     *
     * @param command - The command name (e.g., 'generate-slug', 'state.load')
     * @param handler - The handler function to invoke
     */
    register(command, handler) {
        this.handlers.set(command, handler);
    }
    /**
     * Check if a command has a registered native handler.
     *
     * @param command - The command name to check
     * @returns True if the command has a native handler
     */
    has(command) {
        return this.handlers.has(command);
    }
    /**
     * List all registered command names (for tooling, pipelines, and tests).
     */
    commands() {
        return Array.from(this.handlers.keys());
    }
    /**
     * Get the handler for a command without dispatching.
     *
     * @param command - The command name to look up
     * @returns The handler function, or undefined if not registered
     */
    getHandler(command) {
        return this.handlers.get(command);
    }
    /**
     * Dispatch a command to its registered native handler.
     *
     * @param command - The command name to dispatch
     * @param args - Arguments to pass to the handler
     * @param projectDir - The project directory for context
     * @param workstream - Optional workstream name to scope .planning paths
     * @returns The query result from the handler
     * @throws GSDError if no handler is registered for the command
     */
    async dispatch(command, args, projectDir, workstream) {
        const handler = this.handlers.get(command);
        if (!handler) {
            throw new GSDError(`Unknown command: "${command}". No native handler registered.`, ErrorClassification.Validation);
        }
        return handler(args, projectDir, workstream);
    }
}
/**
 * Map argv after `gsd-sdk query` to a registered handler key and remaining args.
 * Longest-prefix match on dotted (`a.b.c`) and spaced (`a b c`) keys; if no match,
 * expands a single dotted token (`state.validate` → `state`, `validate`) and retries.
 */
export function resolveQueryArgv(tokens, registry) {
    const resolved = resolveQueryTokens(tokens, registry);
    if (!resolved)
        return null;
    return { cmd: resolved.cmd, args: resolved.args };
}
//# sourceMappingURL=registry.js.map