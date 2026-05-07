declare const BUNDLED_GSD_TOOLS_PATH: string;
/**
 * Resolve gsd-tools.cjs path.
 * Probe order: plugin-flat layout (gsd-plugin) → SDK-bundled repo copy →
 * project/.claude/get-shit-done → ~/.claude/get-shit-done.
 */
export declare function resolveGsdToolsPath(projectDir: string): string;
export { BUNDLED_GSD_TOOLS_PATH };
//# sourceMappingURL=query-gsd-tools-path.d.ts.map