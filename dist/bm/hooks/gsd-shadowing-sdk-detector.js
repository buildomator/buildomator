#!/usr/bin/env node
'use strict';

// gsd-shadowing-sdk-detector.js, SessionStart hook
//
// Detects a shadowing `gsd-sdk` binary in $PATH that would take precedence
// over the plugin's bundled wrapper. When found, emits a SessionStart
// additionalContext warning recommending the user uninstall the global
// `@gsd-build/sdk` / `get-shit-done-cc` package, since the plugin v2.42.0+
// bundles its own SDK and does not need the standalone package.
//
// Background: prior to v2.42.0 the plugin required a separate
// `npm install -g get-shit-done-cc` install. Now the plugin bundles
// `sdk/dist/cli.js`. A lingering global symlink at `/opt/homebrew/bin/gsd-sdk`
// (or similar PATH-first location) will shadow the plugin's wrapper, and
// the global SDK does not honor `CLAUDE_PLUGIN_ROOT` so it reports
// `agents_installed: false` for every workflow that calls bare `gsd-sdk`.
// (See plugin v2.42.5 #PLUGIN-WRAPPER-ENV-EXPORT, which only fires when the
// plugin's wrapper is actually invoked.)

const fs = require('fs');
const path = require('path');

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

function main() {
  const root = pluginRoot();
  const expectedUnix = path.join(root, 'bin', 'gsd-sdk');
  const expectedWin = path.join(root, 'bin', 'gsd-sdk.cmd');

  const found = findInPath('gsd-sdk');
  if (!found) {
    process.exit(0);
  }

  const foundReal = realpath(found);
  const expectedReal = realpath(expectedUnix);
  const expectedWinReal = realpath(expectedWin);

  if (foundReal === expectedReal || foundReal === expectedWinReal) {
    process.exit(0);
  }

  if (foundReal.includes(path.join('.claude', 'plugins', 'cache', 'gsd-plugin'))) {
    process.exit(0);
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        '',
        'GSD: A shadowing `gsd-sdk` binary was detected in your PATH:',
        '  found:    ' + found,
        '  resolves: ' + foundReal,
        '  (plugin bundled wrapper:  ' + expectedUnix + ')',
        '',
        'The shadowing binary will be used INSTEAD of the plugin\'s bundled SDK',
        'whenever workflows call bare `gsd-sdk`. The global SDK does not honor',
        '`CLAUDE_PLUGIN_ROOT`, so init queries report `agents_installed: false`',
        'and skills like `/bm:new-project` skip the parallel research path.',
        '',
        'To fix, remove the shadowing global:',
        '  npm uninstall -g @gsd-build/sdk',
        '  npm uninstall -g get-shit-done-cc',
        '',
        'The plugin v2.42.0+ bundles its own SDK at',
        '`${CLAUDE_PLUGIN_ROOT}/sdk/dist/cli.js` and does not need the',
        'standalone npm package. After uninstalling, `which gsd-sdk` should',
        'resolve to a path under `.claude/plugins/cache/gsd-plugin/`.',
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
