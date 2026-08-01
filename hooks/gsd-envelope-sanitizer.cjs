#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// Envelope Sanitizer - PostToolUse hook (Write|Edit|MultiEdit)
//
// Repairs a rare streamed-write decoder leak: on large, XML-tag-dense single
// writes the decoder can intermittently emit its own tool-call envelope closers
// (</content>, </invoke>, </function_calls>) into the file body AS content. The
// leak is always at the very end of the file and always unbalanced (there is no
// matching opener for the leaked closer), so it is safe to trim.
//
// This hook runs after the file lands and strips ONLY those unbalanced trailing
// closer lines from planning markdown, leaving every other file and every
// balanced usage byte-identical. It is fail-soft: it exits 0 on every path and
// can never block or fail the tool it follows. It is idempotent: a file with no
// leaked tail is left untouched, so running twice is a no-op.

'use strict';

const fs = require('fs');
const path = require('path');

// The exact closer lines the decoder can leak. A candidate line qualifies only
// when its trimmed text equals one of these verbatim.
const CLOSER_TAGS = ['</content>', '</invoke>', '</function_calls>'];

// Opener probes used by the balanced guard: if any leaked closer has a matching
// opener earlier in the file, the usage is legitimate and nothing is stripped.
const OPENER_PROBES = {
  '</content>': /<content[\s>]/,
  '</invoke>': /<invoke[\s>]/,
  '</function_calls>': /<function_calls[\s>]/,
};

let input = '';
// Exit silently if stdin never closes, so a stalled pipe cannot hang the tool
// loop until Claude Code kills the process and reports a hook error.
const stdinTimeout = setTimeout(() => process.exit(0), 5000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);

    // Write, Edit, and MultiEdit all carry the target path here.
    const filePath = data.tool_input?.file_path || '';
    if (!filePath) process.exit(0);

    // Scope guard: act only on markdown files inside a .planning directory.
    // Files elsewhere (docs about tool use, test fixtures) can legitimately
    // contain these tags, so they are never touched.
    const resolved = path.resolve(filePath);
    if (!/(^|[/\\])\.planning[/\\]/.test(resolved)) process.exit(0);
    if (!/\.md$/i.test(resolved)) process.exit(0);

    let original;
    try {
      original = fs.readFileSync(resolved, 'utf8');
    } catch (e) {
      process.exit(0);
    }

    const lines = original.split('\n');

    // Walk backward from the end: skip trailing blank lines, then collect
    // consecutive trailing lines that are exactly a closer tag. Stop at the
    // first line that is neither blank nor a closer (a real </output> or any
    // content line ends the walk). Track the index of the last kept line.
    let i = lines.length - 1;
    const collected = [];
    let sawTrailingContent = false;
    while (i >= 0) {
      const trimmed = lines[i].trim();
      if (trimmed === '') {
        // A blank line is skippable only while we are still in the trailing
        // run (before any real content line). Blank lines interleaved among
        // closers are tolerated and dropped with them.
        if (sawTrailingContent) break;
        i--;
        continue;
      }
      if (CLOSER_TAGS.includes(trimmed)) {
        collected.push(trimmed);
        i--;
        continue;
      }
      sawTrailingContent = true;
      break;
    }

    // No leaked closers: idempotent no-op path.
    if (collected.length === 0) process.exit(0);

    // Balanced guard: everything before the collected tail. If any distinct
    // collected tag has a matching opener there, the usage is legitimate and
    // we fail closed by stripping nothing.
    const remaining = lines.slice(0, i + 1).join('\n');
    const distinct = [...new Set(collected)];
    for (const tag of distinct) {
      const probe = OPENER_PROBES[tag];
      if (probe && probe.test(remaining)) process.exit(0);
    }

    // Strip: keep the lines up to and including the last real line, drop any
    // trailing blank lines, and end with exactly one newline.
    let kept = lines.slice(0, i + 1);
    while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
    const rebuilt = kept.length > 0 ? kept.join('\n') + '\n' : '';

    if (rebuilt === original) process.exit(0);

    fs.writeFileSync(resolved, rebuilt);
    process.stderr.write(
      `envelope-sanitizer: stripped ${collected.length} leaked envelope closer line(s) from ${resolved}\n`,
    );
    process.exit(0);
  } catch (e) {
    // Never block tool execution.
    process.exit(0);
  }
});
