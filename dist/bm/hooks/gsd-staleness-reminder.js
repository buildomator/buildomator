#!/usr/bin/env node
'use strict';

// gsd-staleness-reminder.js, SessionStart hook
//
// Reads the plugin's CHANGELOG.md, finds the most recent release date,
// compares against today. If the cached plugin is more than STALENESS_DAYS
// old (default 14), emits a SessionStart additionalContext advisory with
// the /plugin marketplace update recipe. Silent otherwise.
//
// Why this exists: Claude Code's plugin marketplace does not auto-update
// unless the user explicitly opts in. Pre-v2.40.2 versions ship a known
// MCP framing bug; users on v2.38.x have re-reported it four times
// (issues #1, #2, #3, #7) even though the fix has been on master since
// 2026-05-07. This hook nudges users to refresh on a 14-day cadence.

const fs = require('fs');
const path = require('path');

const STALENESS_DAYS = Number(process.env.GSD_STALENESS_DAYS) || 14;

function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;
  return path.resolve(__dirname, '..');
}

function readChangelogTopRelease(changelogPath) {
  let content;
  try { content = fs.readFileSync(changelogPath, 'utf8'); }
  catch { return null; }

  const re = /^## \[(\d+\.\d+\.\d+)\][^\n]*?(\d{4})-(\d{2})-(\d{2})/m;
  const m = content.match(re);
  if (!m) return null;

  const [, version, y, mo, d] = m;
  const releaseDate = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (isNaN(releaseDate.getTime())) return null;

  return { version, releaseDate };
}

function ageInDays(releaseDate) {
  const now = new Date();
  const diffMs = now.getTime() - releaseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function main() {
  const root = pluginRoot();
  const changelogPath = path.join(root, 'CHANGELOG.md');

  const release = readChangelogTopRelease(changelogPath);
  if (!release) {
    process.exit(0);
  }

  const days = ageInDays(release.releaseDate);
  if (days <= STALENESS_DAYS) {
    process.exit(0);
  }

  const dateStr = release.releaseDate.toISOString().slice(0, 10);

  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        '',
        'GSD: Your cached plugin is ' + days + ' days old.',
        '  installed version: v' + release.version + ' (' + dateStr + ')',
        '  staleness threshold: ' + STALENESS_DAYS + ' days',
        '',
        'Plugin updates carry bug fixes (e.g. the MCP framing fix in v2.40.2),',
        'upstream GSD syncs, and new safety hooks. The marketplace does not',
        'auto-update by default. To refresh from inside Claude Code:',
        '',
        '  /plugin marketplace update',
        '  /plugin install gsd@gsd-plugin',
        '  /reload-plugins',
        '',
        'After updating, this advisory will disappear until the next ' + STALENESS_DAYS + '-day window.',
        '(Set GSD_STALENESS_DAYS env var to change the threshold.)',
        ''
      ].join('\n')
    }
  };

  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

try { main(); } catch { process.exit(0); }
