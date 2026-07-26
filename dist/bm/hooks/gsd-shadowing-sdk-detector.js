#!/usr/bin/env node
'use strict';

// gsd-shadowing-sdk-detector.js, SessionStart hook
//
// Detects a shadowing `bm-sdk` or `gsd-sdk` binary in $PATH that would take
// precedence over the plugin's bundled wrapper. When found, emits a
// SessionStart additionalContext warning recommending the user uninstall the
// global `@gsd-build/sdk` / `get-shit-done-cc` package, since the plugin
// bundles its own SDK and does not need the standalone package.
//
// Background: prior to bundling, the plugin required a separate global SDK
// install. Now the plugin bundles `sdk/dist/cli.js`. A lingering global
// symlink at `/opt/homebrew/bin/bm-sdk` (or `gsd-sdk`, or a similar PATH-first
// location) will shadow the plugin's wrapper, and the global SDK does not
// honor `CLAUDE_PLUGIN_ROOT` so it reports `agents_installed: false` for every
// workflow that calls bare `bm-sdk`.
// (See #PLUGIN-WRAPPER-ENV-EXPORT, which only fires when the plugin's wrapper
// is actually invoked.)

const fs = require('fs');
const path = require('path');

// Both CLI names resolve to the same bundled SDK. bm-sdk is primary; gsd-sdk
// remains a working alias.
const SDK_NAMES = ['bm-sdk', 'gsd-sdk'];

function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;
  return path.resolve(__dirname, '..');
}

function findInPath(binary) {
  const PATH = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of PATH.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {}
    }
  }
  return null;
}

function realpath(p) {
  try { return fs.realpathSync(p); } catch { return p; }
}

// Returns a shadowing record { name, found, foundReal } if `name` resolves in
// PATH to something OTHER than a plugin-owned wrapper, else null.
function checkShadow(name, root) {
  const found = findInPath(name);
  if (!found) return null;

  const foundReal = realpath(found);
  const expectedReals = [
    realpath(path.join(root, 'bin', 'bm-sdk')),
    realpath(path.join(root, 'bin', 'bm-sdk.cmd')),
    realpath(path.join(root, 'bin', 'gsd-sdk')),
    realpath(path.join(root, 'bin', 'gsd-sdk.cmd')),
  ];

  if (expectedReals.includes(foundReal)) return null;
  if (foundReal.includes(path.join('.claude', 'plugins', 'cache', 'gsd-plugin'))) return null;

  return { name, found, foundReal };
}

function main() {
  const root = pluginRoot();

  const shadows = [];
  for (const name of SDK_NAMES) {
    const hit = checkShadow(name, root);
    if (hit) shadows.push(hit);
  }

  if (shadows.length === 0) {
    process.exit(0);
  }

  const foundLines = [];
  for (const s of shadows) {
    foundLines.push('  found `' + s.name + '`: ' + s.found);
    foundLines.push('  resolves:      ' + s.foundReal);
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        '',
        'GSD: A shadowing SDK binary was detected in your PATH:',
        ...foundLines,
        '  (plugin bundled wrappers: ' + path.join(root, 'bin') + ')',
        '',
        'The shadowing binary will be used INSTEAD of the plugin\'s bundled SDK',
        'whenever workflows call bare `bm-sdk` (or `gsd-sdk`). The global SDK',
        'does not honor `CLAUDE_PLUGIN_ROOT`, so init queries report',
        '`agents_installed: false` and skills like `/bm:new-project` skip the',
        'parallel research path.',
        '',
        'To fix, remove the shadowing global:',
        '  npm uninstall -g @gsd-build/sdk',
        '  npm uninstall -g get-shit-done-cc',
        '',
        'The plugin bundles its own SDK at',
        '`${CLAUDE_PLUGIN_ROOT}/sdk/dist/cli.js` and does not need the',
        'standalone npm package. After uninstalling, `which bm-sdk` and',
        '`which gsd-sdk` should resolve to a path under',
        '`.claude/plugins/cache/gsd-plugin/`.',
        ''
      ].join('\n')
    }
  };

  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.exit(0);
}
