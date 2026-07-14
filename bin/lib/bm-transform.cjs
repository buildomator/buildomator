'use strict';

/**
 * Pure string transforms that make the generated bm plugin package
 * self-consistent. No disk or process dependencies, so they are unit-tested
 * directly and reused by both the build and its drift gate.
 */

// Rewrite every `gsd:` namespace prefix to `bm:` wherever it appears: slash
// commands (/gsd:plan-phase, /gsd:capture, ...), subagent_type/type agent
// references (gsd:gsd-<agent>), and agent/skill frontmatter names (name: gsd:<x>).
// The negative lookahead spares gsd:// MCP resource URIs (the char after the
// colon is a slash). Surviving tokens have no `gsd:` colon prefix at all: gsd-*
// filenames and the gsd-local-patches dir (no colon), the cache/gsd-plugin/gsd
// literal (trailing gsd has no colon), gsd_* tool names, and gsd[A-Z] camelCase.
// One file needs a build-layer exclusion instead of a regex tweak: mcp/server.cjs
// carries the regex-source-escaped URI form gsd:\/\/ (a backslash follows the
// colon, which this lookahead would wrongly flip), so build-bm.cjs skips the
// command rewrite for that file to keep it byte-identical (D-05).
const COMMAND_REF_RE = /gsd:(?!\/)/g;

// The SDK headless-prompt sanitizer matches interactive slash-command lines with
// the character class literal `/gsd[:-]`. It contains `gsd[`, not `gsd:`, so the
// namespace rewrite above never touches it; a targeted exact-literal pass flips
// it so bm's own sanitizer strips /bm: lines. Independent of COMMAND_REF_RE.
const SANITIZER_LITERAL_FROM = '/gsd[:-]';
const SANITIZER_LITERAL_TO = '/bm[:-]';

// The plugin-root fallback carries the plugin-name segment in several exact
// literal shapes. Each pair flips ONLY the fixed plugin-name segment gsd -> bm;
// the marketplace directory (a runtime wildcard scan) and every surrounding
// identity token (gsd-tools.cjs, run-bash-hook.cjs, the gsd-plugin marketplace
// name in the legacy literal) survive untouched. A LIST of exact-literal pairs so
// the runtime carriers and the deferred reference-doc literal each flip in
// lockstep, applied via split/join (never a regex over a bare gsd token).
//
//   1. Legacy slash form (cache/gsd-plugin/gsd): still embedded in reference docs,
//      agents, skills, workflows, and the coexist test fixtures. Kept so those
//      files continue to resolve the bm cache dir until the deferred markdown
//      sweep replaces them with a plugin-agnostic glob.
//   2. hooks.json inline resolvers: the plugin-name segment is the assignment
//      g='gsd' (17 resolvers, marketplace segment is a readdirSync wildcard).
//   3. run-bash-hook.cjs resolveCandidates: const pkgSegment = 'gsd'.
//   4. check-plugin-update.sh: PKG_SEGMENT="gsd".
const FALLBACK_PAIRS = [
  ['cache/gsd-plugin/gsd', 'cache/gsd-plugin/bm'],
  ["g='gsd'", "g='bm'"],
  ["const pkgSegment = 'gsd'", "const pkgSegment = 'bm'"],
  ['PKG_SEGMENT="gsd"', 'PKG_SEGMENT="bm"'],
];

/**
 * Rewrite the `gsd:` namespace prefix to `bm:` wherever it appears (sparing
 * gsd:// URIs) and flip the `/gsd[:-]` SDK sanitizer literal to `/bm[:-]`. The
 * two passes are independent: `gsd[` is not `gsd:`, so the lookahead pass never
 * touches the character-class literal. Idempotent: rewritten text has no `gsd:`
 * (non-slash) prefix and no `/gsd[:-]` literal left to match.
 * @param {string} text
 * @returns {string}
 */
function rewriteCommandRefs(text) {
  return String(text)
    .replace(COMMAND_REF_RE, 'bm:')
    .split(SANITIZER_LITERAL_FROM).join(SANITIZER_LITERAL_TO);
}

/**
 * Stamp the plugin-root fallback plugin-name segment from gsd to bm in every
 * literal shape the runtime carriers and the deferred reference-doc literal use
 * (see FALLBACK_PAIRS). Exact-literal split/join per pair, never a regex over a
 * bare gsd token, so surrounding identity tokens (gsd-tools.cjs, the gsd-plugin
 * marketplace name, run-bash-hook.cjs) survive. Idempotent for every shape: each
 * FROM literal is absent once flipped, and no TO literal contains another pair's
 * FROM, so order and repeat application are stable.
 * @param {string} text
 * @returns {string}
 */
function stampHookFallback(text) {
  let out = String(text);
  for (const [from, to] of FALLBACK_PAIRS) {
    out = out.split(from).join(to);
  }
  return out;
}

// The session-start hook wraps the gsd-only deprecation nudge (the notice that
// the /gsd: prefix is being renamed to /bm:) in a pair of exact-literal sentinel
// comments so the generated bm package can strip the whole block: bm must never
// tell users to switch to bm. The sentinels are defined here as plain string
// constants (never as a line-opening comment) so this very file can name them
// without matching its own strip. The match is LINE-ANCHORED (multiline `^`,
// leading whitespace allowed) so only a sentinel that opens a line is stripped;
// a sentinel that appears inside a quoted string -- as it does right here -- is
// left intact, which is what lets suppressNudge coexist with its own source.
const NUDGE_START_SENTINEL = '// BM-NUDGE-START';
const NUDGE_END_SENTINEL = '// BM-NUDGE-END';
const NUDGE_BLOCK_RE = new RegExp(
  '^[ \\t]*' + NUDGE_START_SENTINEL.replace(/\//g, '\\/') +
  '[\\s\\S]*?^[ \\t]*' + NUDGE_END_SENTINEL.replace(/\//g, '\\/') + '[^\\n]*\\n?',
  'm',
);

/**
 * Strip the sentinel-bracketed deprecation nudge block (BM-NUDGE-START through
 * BM-NUDGE-END, inclusive) from the text, leaving surrounding code intact and
 * syntactically valid. The match is line-anchored, so a sentinel embedded as a
 * quoted string literal is never removed. Idempotent: text with no sentinel
 * block is returned unchanged, and a second application equals the first (once
 * the block is gone there is nothing left to match).
 * @param {string} text
 * @returns {string}
 */
function suppressNudge(text) {
  return String(text).replace(NUDGE_BLOCK_RE, '');
}

module.exports = { rewriteCommandRefs, stampHookFallback, suppressNudge };
