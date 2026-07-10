'use strict';

/**
 * Pure string transforms that make the generated bm plugin package
 * self-consistent. No disk or process dependencies, so they are unit-tested
 * directly and reused by both the build and its drift gate.
 */

// Rewrite every `bm:` namespace prefix to `bm:` wherever it appears: slash
// commands (/bm:plan-phase, /bm:capture, ...), subagent_type/type agent
// references (bm:gsd-<agent>), and agent/skill frontmatter names (name: bm:<x>).
// The negative lookahead spares gsd:// MCP resource URIs (the char after the
// colon is a slash). Surviving tokens have no `bm:` colon prefix at all: gsd-*
// filenames and the gsd-local-patches dir (no colon), the cache/gsd-plugin/gsd
// literal (trailing gsd has no colon), gsd_* tool names, and gsd[A-Z] camelCase.
// One file needs a build-layer exclusion instead of a regex tweak: mcp/server.cjs
// carries the regex-source-escaped URI form bm:\/\/ (a backslash follows the
// colon, which this lookahead would wrongly flip), so build-bm.cjs skips the
// command rewrite for that file to keep it byte-identical (D-05).
const COMMAND_REF_RE = /bm:(?!\/)/g;

// The SDK headless-prompt sanitizer matches interactive slash-command lines with
// the character class literal `/bm[:-]`. It contains `gsd[`, not `bm:`, so the
// namespace rewrite above never touches it; a targeted exact-literal pass flips
// it so bm's own sanitizer strips /bm: lines. Independent of COMMAND_REF_RE.
const SANITIZER_LITERAL_FROM = '/bm[:-]';
const SANITIZER_LITERAL_TO = '/bm[:-]';

// The hook cache-fallback carries the plugin-name segment in two literal shapes.
// Only the trailing plugin segment is stamped; the marketplace segment
// gsd-plugin stays because both packages release from the same repo cache dir.
const FALLBACK_SLASH_FROM = 'cache/gsd-plugin/gsd';
const FALLBACK_SLASH_TO = 'cache/gsd-plugin/bm';
const FALLBACK_QUOTED_FROM = "'gsd-plugin', 'gsd'";
const FALLBACK_QUOTED_TO = "'gsd-plugin', 'bm'";

/**
 * Rewrite the `bm:` namespace prefix to `bm:` wherever it appears (sparing
 * gsd:// URIs) and flip the `/bm[:-]` SDK sanitizer literal to `/bm[:-]`. The
 * two passes are independent: `gsd[` is not `bm:`, so the lookahead pass never
 * touches the character-class literal. Idempotent: rewritten text has no `bm:`
 * (non-slash) prefix and no `/bm[:-]` literal left to match.
 * @param {string} text
 * @returns {string}
 */
function rewriteCommandRefs(text) {
  return String(text)
    .replace(COMMAND_REF_RE, 'bm:')
    .split(SANITIZER_LITERAL_FROM).join(SANITIZER_LITERAL_TO);
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
