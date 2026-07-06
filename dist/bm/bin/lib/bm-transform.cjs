'use strict';

/**
 * Pure string transforms that make the generated bm plugin package
 * self-consistent. No disk or process dependencies, so they are unit-tested
 * directly and reused by both the build and its drift gate.
 */

// Rewrite the `/bm:` token wherever it appears: command self-references
// (/bm:plan-phase, /bm:capture, /bm:local-patches, /bm:edit-phase,
// /bm:extract-learnings) and plugin-owned artifact path segments. This is safe
// because every token that must survive lacks the `/bm:` substring: gsd://
// resource URIs (no leading slash), gsd-* filenames and the gsd-local-patches
// dir (no colon), the cache/gsd-plugin/gsd literal (trailing gsd has no colon),
// and gsd_* tool names.
const COMMAND_REF_RE = /\/bm:/g;

// The hook cache-fallback carries the plugin-name segment in two literal shapes.
// Only the trailing plugin segment is stamped; the marketplace segment
// gsd-plugin stays because both packages release from the same repo cache dir.
const FALLBACK_SLASH_FROM = 'cache/gsd-plugin/gsd';
const FALLBACK_SLASH_TO = 'cache/gsd-plugin/bm';
const FALLBACK_QUOTED_FROM = "'gsd-plugin', 'gsd'";
const FALLBACK_QUOTED_TO = "'gsd-plugin', 'bm'";

/**
 * Rewrite the `/bm:` token to `/bm:` wherever it appears.
 * Idempotent: already-rewritten text has no `/bm:` tokens left to match.
 * @param {string} text
 * @returns {string}
 */
function rewriteCommandRefs(text) {
  return String(text).replace(COMMAND_REF_RE, '/bm:');
}

/**
 * Stamp the hook cache-fallback plugin segment from gsd to bm in both literal
 * shapes: the slash form (hooks.json inline resolvers, the run-bash-hook.cjs
 * header comment, and check-plugin-update.sh) and the quoted path.join argument
 * form (run-bash-hook.cjs resolveCandidates). Exact-literal split/join only,
 * never a regex over a bare gsd token, so surrounding identity tokens survive.
 * Idempotent for both shapes.
 * @param {string} text
 * @returns {string}
 */
function stampHookFallback(text) {
  return String(text)
    .split(FALLBACK_SLASH_FROM).join(FALLBACK_SLASH_TO)
    .split(FALLBACK_QUOTED_FROM).join(FALLBACK_QUOTED_TO);
}

module.exports = { rewriteCommandRefs, stampHookFallback };
