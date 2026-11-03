#!/usr/bin/env node
'use strict';

// gsd-reconcile-sweep.js, SessionStart hook
//
// Looks for logged decisions that are not yet in the reconcile ledger and
// that share a topic with a standing rule in CLAUDE.md / PROJECT.md. When
// any exist, it merges them into .planning/reconcile-pending.json and tells
// the agent a reconciliation is pending. The ledger is read first, so a
// session with no new decisions does no work and prints nothing.
//
// This hook only retrieves and records. It makes no model call, edits no
// authority doc, and asks nothing: the agent asks the user before applying.

const fs = require('fs');
const path = require('path');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function resolveCwd() {
  try {
    const input = JSON.parse(readStdin() || '{}');
    if (input && typeof input.cwd === 'string' && input.cwd) return input.cwd;
  } catch { /* fall through */ }
  return process.cwd();
}

function main() {
  const cwd = resolveCwd();
  if (!fs.existsSync(path.join(cwd, '.planning'))) process.exit(0);

  const reconcile = require(path.join(__dirname, '..', 'bin', 'lib', 'reconcile.cjs'));
  const sweep = reconcile.reconcileSweep(cwd);
  if (!sweep || sweep.skipped) process.exit(0);

  const flagged = sweep.decisions.filter((d) => d.modelNeeded);
  if (flagged.length === 0) process.exit(0);

  // reconcilePending merges by decision hash, so earlier undrained entries survive.
  for (const d of flagged) reconcile.reconcilePending(cwd, [d.decisionHash]);

  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        '',
        'GSD: ' + flagged.length + ' logged decision(s) may contradict a standing rule in CLAUDE.md or PROJECT.md.',
        '  pending record: .planning/reconcile-pending.json',
        '',
        'Read references/decision-reconciliation.md and follow its session-start branch:',
        'show the user each decision, the contested rule and the proposed rewrite, and',
        'ask before changing anything, whatever your confidence. Apply a rewrite only',
        'after the user confirms. The /reconcile skill runs this on demand.',
        ''
      ].join('\n')
    }
  };

  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

try { main(); } catch { process.exit(0); }
