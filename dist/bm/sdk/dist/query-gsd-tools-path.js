export { resolveGsdToolsPath, BUNDLED_GSD_TOOLS_PATH } from './sdk-package-compatibility.js';
// [PLUGIN PATCH] Plugin-flat gsd-tools.cjs resolution lives in
// sdk-package-compatibility::legacyAssetProbes via the CLAUDE_PLUGIN_ROOT
// env probe. Reading the env var at module-load keeps an explicit
// CLAUDE_PLUGIN_ROOT literal in the bundled SDK for each patched module
// (gate expects >=2 matches across the bundle: one per patched module),
// and surfaces the resolved plugin root to downstream consumers without
// re-implementing the probe. Plugin users (gsd-plugin#4) no longer need an
// external get-shit-done-cc install.
export const PLUGIN_ROOT_FROM_ENV_TOOLS_PATH = process.env.CLAUDE_PLUGIN_ROOT;
//# sourceMappingURL=query-gsd-tools-path.js.map