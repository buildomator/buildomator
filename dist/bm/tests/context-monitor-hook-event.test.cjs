'use strict';

// Regression test for the #770 + #925 pairing (v3.4.2 cherry-picks).
//
// #770 registered hooks/gsd-context-monitor.js under the new SubagentStop
// lifecycle event (in addition to PostToolUse). #925 then fixed the script,
// which hardcoded `hookEventName: "PostToolUse"`: Claude Code rejects hook
// output whose hookSpecificOutput.hookEventName does not echo the triggering
// event ("expected SubagentStop but got PostToolUse"), so the SubagentStop
// wiring is silently broken without #925. These two ship together or not at all.
//
// allow-test-rule: source-text-is-the-product
// hooks/*.js and hooks.json ARE the installed runtime contract; asserting their
// text IS asserting deployed behavior.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

// ─── #925: context-monitor echoes the actual hook event ──────────────────────
const mon = fs.readFileSync(path.join(ROOT, 'hooks', 'gsd-context-monitor.js'), 'utf-8');
ok('context-monitor reads data.hook_event_name from the payload',
  /data\.hook_event_name/.test(mon));
ok('context-monitor still falls back to the runtime heuristic',
  /GEMINI_API_KEY[\s\S]{0,40}AfterTool[\s\S]{0,40}PostToolUse/.test(mon));
ok('hookEventName is no longer an unconditional hardcode',
  !/hookEventName:\s*process\.env\.GEMINI_API_KEY\s*\?\s*"AfterTool"\s*:\s*"PostToolUse"\s*,/.test(mon));

// ─── #770: SubagentStop is wired to the context-monitor (in shim form) ───────
const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf-8'));
ok('hooks.json registers SubagentStop', Array.isArray(hooks.hooks.SubagentStop));
ok('SubagentStop runs gsd-context-monitor.js',
  JSON.stringify(hooks.hooks.SubagentStop || '').includes('gsd-context-monitor.js'));
ok('SubagentStop uses the plugin stale-path resolver shim (not a bare path)',
  JSON.stringify(hooks.hooks.SubagentStop || '').includes('.claude/plugins/cache/gsd-plugin/gsd'));

for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
