#!/usr/bin/env node
'use strict';

// gsd-auth-detector.js, PostToolUse hook on Bash
//
// Watches Bash invocations for auth-shaped command patterns (login flows,
// credential setup, SSH key generation, env-var-based credentials, etc.)
// and logs detections to `.planning/.pending-auth-captures.jsonl` for later
// review via `/gsd:remember-access --review`.
//
// Does NOT prompt the user inline. Hooks cannot use AskUserQuestion. The
// inbox pattern lets the user review captures at their convenience and
// promote them to permanent recipes in `.planning/AUTH-RECIPES.md` and
// optionally to a user-global memory location.
//
// Privacy: the hook redacts patterns that look like secrets (long base64-ish
// tokens, anything after `--token=`, `--password=`, `--api-key=`, etc.)
// before writing to the inbox. The user gets a sanitized record of WHAT
// they did, not WHAT THE SECRET WAS.

const fs = require('fs');
const path = require('path');

// Read tool-call JSON from stdin.
function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

// Detect auth-shaped Bash commands. Each entry: { pattern: RegExp, system: string, kind: string }.
// `system` is the canonical system name used as the cross-project memory key.
// `kind` is a one-word descriptor (login / configure / keygen / token / etc.).
const AUTH_PATTERNS = [
  { pattern: /\bgh\s+auth\s+(login|refresh)/, system: 'github', kind: 'auth-login' },
  { pattern: /\bssh\s+-T\s+git@github\.com/, system: 'github', kind: 'ssh-prime' },
  { pattern: /\baws\s+configure\b/, system: 'aws', kind: 'configure' },
  { pattern: /\baws\s+sso\s+login/, system: 'aws', kind: 'sso-login' },
  { pattern: /\baws-vault\s+(add|exec)/, system: 'aws', kind: 'aws-vault' },
  { pattern: /\bgcloud\s+auth\s+(login|application-default\s+login)/, system: 'gcloud', kind: 'auth-login' },
  { pattern: /\bgcloud\s+config\s+set/, system: 'gcloud', kind: 'configure' },
  { pattern: /\bvault\s+login/, system: 'vault', kind: 'login' },
  { pattern: /\bnpm\s+(login|adduser)/, system: 'npm', kind: 'login' },
  { pattern: /\bdocker\s+login/, system: 'docker', kind: 'login' },
  { pattern: /\bkubectl\s+config\s+(set-credentials|use-context|set-context)/, system: 'kubernetes', kind: 'configure' },
  { pattern: /\bssh-keygen\s+-t/, system: 'ssh', kind: 'keygen' },
  { pattern: /\bssh-add\b/, system: 'ssh', kind: 'add-key' },
  { pattern: /\bgit\s+config\s+--global\s+user\.(email|name|signingkey)/, system: 'git', kind: 'identity' },
  { pattern: /\bop\s+signin/, system: '1password', kind: 'signin' },
  { pattern: /\bbw\s+(login|unlock)/, system: 'bitwarden', kind: 'login' },
  { pattern: /\bgpg\s+--gen-key|gpg\s+--full-generate-key/, system: 'gpg', kind: 'keygen' },
  { pattern: /\bclaude\s+(login|auth)/, system: 'anthropic', kind: 'login' },
  // Env-var assignments that look like credentials. Match the variable name,
  // not the value, since the value gets redacted below.
  { pattern: /\bexport\s+(\w*(?:TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIALS)\w*)\s*=/, system: 'env-credential', kind: 'export' },
  // Loose pattern for any `login` subcommand in a known CLI namespace
  { pattern: /\b(heroku|fly|netlify|vercel|supabase|firebase|railway)\s+login/, system: 'platform', kind: 'login' },
];

// Redact secret-looking substrings from a command line so the inbox doesn't
// store credentials. Conservative: redact anything after credential-flag
// patterns and long base64-shaped tokens.
function redact(cmd) {
  if (!cmd) return cmd;
  let out = cmd;
  // Redact `--token=...`, `--password=...`, etc. (everything to next space/quote)
  out = out.replace(/(--?(?:token|password|api[-_]?key|secret|credential|key|auth)[\s=]+)(\S+)/gi, '$1[REDACTED]');
  // Redact env-var values: VAR=value where VAR looks credential-shaped
  out = out.replace(/(\b\w*(?:TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIALS)\w*=)([^\s'"]+)/g, '$1[REDACTED]');
  // Redact long base64-ish tokens (32+ chars of base64 alphabet)
  out = out.replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, '[REDACTED-LONG-TOKEN]');
  // Redact AWS-style keys
  out = out.replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED-AWS-KEY]');
  // Redact GitHub PAT (ghp_, gho_, etc.)
  out = out.replace(/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]+/g, '[REDACTED-GH-TOKEN]');
  return out;
}

function projectRoot() {
  // Walk up from CWD looking for .planning/ to find the project root.
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function appendInboxEntry(root, entry) {
  const inboxPath = path.join(root, '.planning', '.pending-auth-captures.jsonl');
  try {
    fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
  } catch {}
  try {
    fs.appendFileSync(inboxPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {
    // Hooks must not fail noisily on disk errors. Best-effort only.
    process.stderr.write('gsd-auth-detector: could not write to inbox: ' + e.message + '\n');
  }
}

function main() {
  const raw = readStdin();
  if (!raw.trim()) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  // Claude Code's hook payload schema for PostToolUse on Bash:
  // { tool_name: "Bash", tool_input: { command: "...", description: "...", ... }, tool_response: {...}, ... }
  if (payload.tool_name !== 'Bash') return;
  const cmd = payload && payload.tool_input && payload.tool_input.command;
  if (!cmd || typeof cmd !== 'string') return;

  const matches = [];
  for (const { pattern, system, kind } of AUTH_PATTERNS) {
    if (pattern.test(cmd)) {
      matches.push({ system, kind });
    }
  }
  if (matches.length === 0) return;

  const root = projectRoot();
  if (!root) {
    // Not in a GSD project; nothing to write. Silent skip.
    return;
  }

  // Dedupe captures per session by command-hash (rough). The inbox is small;
  // we can re-process duplicates during /gsd:remember-access --review.
  const entry = {
    timestamp: new Date().toISOString(),
    command_redacted: redact(cmd),
    description: (payload.tool_input && payload.tool_input.description) || null,
    matches,
    exit_code: payload.tool_response && payload.tool_response.exit_code,
    cwd: process.cwd(),
  };
  appendInboxEntry(root, entry);
}

try {
  main();
} catch (e) {
  // Hooks must never break the orchestrator. Swallow errors.
  process.stderr.write('gsd-auth-detector error (non-fatal): ' + e.message + '\n');
}
