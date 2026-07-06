'use strict';

/**
 * Pure string transforms that make the generated bm plugin package
 * self-consistent. No disk or process dependencies, so they are unit-tested
 * directly and reused by both the build and its drift gate.
 */

// Leading-boundary anchored substitution: a `/gsd:` command self-reference is
// only rewritten when the slash is at the start of the string or preceded by a
// non-alphanumeric character. This covers every command (including capture,
// local-patches, edit-phase, extract-learnings) while sparing gsd:// resource
// URIs (no leading slash), gsd-* filenames (no colon), and cache-path literals
// like cache/gsd-plugin/gsd (the trailing gsd has no colon).
const COMMAND_REF_RE = /(?<![A-Za-z0-9])\/gsd:/g;

// The hook cache-fallback carries the plugin-name segment in two literal shapes.
// Only the trailing plugin segment is stamped; the marketplace segment
// gsd-plugin stays because both packages release from the same repo cache dir.
const FALLBACK_SLASH_FROM = 'cache/gsd-plugin/gsd';
const FALLBACK_SLASH_TO = 'cache/gsd-plugin/bm';
const FALLBACK_QUOTED_FROM = "'gsd-plugin', 'gsd'";
const FALLBACK_QUOTED_TO = "'gsd-plugin', 'bm'";

/**
 * Rewrite `/gsd:<skill>` command self-references to `/bm:<skill>`.
 * Idempotent: already-rewritten text has no `/gsd:` tokens left to match.
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
