'use strict';

const { VERIFY_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routeVerifyCommand({ verify, args, cwd, raw, error }) {
  const subcommand = args[1];

  if (subcommand === 'plan-structure') {
    verify.cmdVerifyPlanStructure(cwd, args[2], raw);
  } else if (subcommand === 'phase-completeness') {
    verify.cmdVerifyPhaseCompleteness(cwd, args[2], raw);
  } else if (subcommand === 'references') {
    verify.cmdVerifyReferences(cwd, args[2], raw);
  } else if (subcommand === 'commits') {
    verify.cmdVerifyCommits(cwd, args.slice(2), raw);
  } else if (subcommand === 'artifacts') {
    verify.cmdVerifyArtifacts(cwd, args[2], raw);
  } else if (subcommand === 'key-links') {
    verify.cmdVerifyKeyLinks(cwd, args[2], raw);
  } else if (subcommand === 'schema-drift') {
    const rest = args.slice(2);
    const skipFlag = rest.includes('--skip');
    const phaseArg = rest.find((arg) => !arg.startsWith('-'));
    verify.cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw);
  } else if (subcommand === 'codebase-drift') {
    verify.cmdVerifyCodebaseDrift(cwd, raw);
  } else if (subcommand === 'conventions') {
    // Parse --derive / --check / --scope <value> / --files <value> into opts.
    const rest = args.slice(2);
    const parsedOpts = { derive: false, check: false, scope: undefined, files: undefined };
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === '--derive') parsedOpts.derive = true;
      else if (a === '--check') parsedOpts.check = true;
      else if (a === '--scope') parsedOpts.scope = rest[++i];
      else if (a === '--files') parsedOpts.files = rest[++i];
    }
    verify.cmdVerifyConventions(cwd, parsedOpts, raw);
  } else if (subcommand === 'drift') {
    // Parse --scope <value> / --top <n> / --fail-on-score <n> / --json into opts.
    // Mirror the conventions arg-parse loop.
    const rest = args.slice(2);
    const o = { scope: undefined, top: undefined, failOnScore: undefined };
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--scope') o.scope = rest[++i];
      else if (rest[i] === '--top') o.top = +rest[++i];
      else if (rest[i] === '--fail-on-score') o.failOnScore = +rest[++i];
      // --json is already handled by the outer raw flag; skip silently
    }
    verify.cmdVerifyDrift(cwd, o, raw);
  } else {
    error(`Unknown verify subcommand. Available: ${VERIFY_SUBCOMMANDS.join(', ')}`);
  }
}

module.exports = {
  routeVerifyCommand,
};
