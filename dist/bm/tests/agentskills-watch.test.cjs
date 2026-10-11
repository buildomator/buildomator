'use strict';

// Wedge-guard harness for bin/check-agentskills-release.sh.
// Runs the watch under shimmed npm, curl, gh and ssh in a tmpdir sandbox so it
// never touches the network, then asserts: cron never wedges (exit 0 when npm
// is absent, the network is down, or the GitHub probe 404s), the
// seed/compare/notify/state-update sequence behaves, and the script carries no
// dashes. Zero external deps; mirrors the check/assert style of
// tests/user-docs-jargon.test.cjs.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'bin', 'check-agentskills-release.sh');

const OLD_SHA = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555';
const NEW_SHA = '9999ffff8888eeee7777dddd6666cccc5555bbbb';

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Write four executable bash shims into <shims>/ for npm, curl, gh and ssh.
// Each reads FAKE_* env vars set per run so one shim set covers every case.
// The ssh shim records its full argv plus stdin into <mailLog> so a test can
// confirm whether (and with what subject) a mail was sent.
function makeShims(shims, mailLog) {
  const write = (name, body) => {
    const p = path.join(shims, name);
    fs.writeFileSync(p, body, { mode: 0o755 });
    fs.chmodSync(p, 0o755);
  };
  write('npm', [
    '#!/bin/bash',
    'if [ "${FAKE_NPM_FAIL:-0}" = "1" ]; then exit 1; fi',
    'if [ "$2" = "skills-ref" ]; then echo "${FAKE_NPM_VERSION:-}"; exit 0; fi',
    'if [ "$2" = "skills" ]; then echo "1.7.2"; exit 0; fi',
    'exit 0',
    '',
  ].join('\n'));
  write('curl', [
    '#!/bin/bash',
    'exit ${FAKE_CURL_STATUS:-0}',
    '',
  ].join('\n'));
  write('gh', [
    '#!/bin/bash',
    'if [ -z "${FAKE_GH_SHA:-}" ]; then exit 1; fi',
    'echo "${FAKE_GH_SHA}"',
    '',
  ].join('\n'));
  write('ssh', [
    '#!/bin/bash',
    '{ echo "ARGV: $*"; cat; } >> "$MAIL_LOG"',
    'exit ${FAKE_SSH_STATUS:-0}',
    '',
  ].join('\n'));
}

// Run the script in a fresh sandbox and return its result plus the resulting
// state files and mail log. Caller must invoke result.cleanup() when done.
function runScript({ env = {}, npmOverride, seed } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentskills-watch-'));
  const home = path.join(tmp, 'home');
  const shims = path.join(tmp, 'shims');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(shims, { recursive: true });
  const mailLog = path.join(tmp, 'mail.log');
  const versionFile = path.join(home, '.agentskills-last-known-version');
  const shaFile = path.join(home, '.agentskills-last-known-sha');
  makeShims(shims, mailLog);
  if (seed) {
    if (seed.version !== undefined) fs.writeFileSync(versionFile, seed.version + '\n');
    if (seed.sha !== undefined) fs.writeFileSync(shaFile, seed.sha + '\n');
  }
  const r = spawnSync('bash', [SCRIPT], {
    cwd: tmp,
    encoding: 'utf-8',
    timeout: 10000,
    env: {
      PATH: process.env.PATH,
      HOME: home,
      NPM: npmOverride || path.join(shims, 'npm'),
      CURL: path.join(shims, 'curl'),
      GH: path.join(shims, 'gh'),
      SSH: path.join(shims, 'ssh'),
      MAIL_HOST: 'localhost',
      RECIPIENT: 'nobody',
      MAIL_LOG: mailLog,
      ...env,
    },
  });
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    mail: fs.existsSync(mailLog) ? fs.readFileSync(mailLog, 'utf-8') : '',
    version: fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf-8').trim() : null,
    sha: fs.existsSync(shaFile) ? fs.readFileSync(shaFile, 'utf-8').trim() : null,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

function mailCount(mail) {
  const m = mail.match(/ARGV:/g);
  return m ? m.length : 0;
}

check('npm absent: exit 0, no state file, no mail', () => {
  const r = runScript({ npmOverride: '/nonexistent/npm', env: { FAKE_CURL_STATUS: '0' } });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(r.version === null, `expected no version file, got ${r.version}`);
    assert(mailCount(r.mail) === 0, `expected no mail, got:\n${r.mail}`);
  } finally { r.cleanup(); }
});

check('network down (curl exits 22): exit 0, no state file, no mail', () => {
  const r = runScript({ env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '22' } });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(r.version === null, `expected no version file, got ${r.version}`);
    assert(mailCount(r.mail) === 0, `expected no mail, got:\n${r.mail}`);
  } finally { r.cleanup(); }
});

check('first run seeds state silently: exit 0, version 0.1.5, no mail', () => {
  const r = runScript({ env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '0', FAKE_GH_SHA: OLD_SHA } });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(r.version === '0.1.5', `expected version 0.1.5, got ${r.version}`);
    assert(r.sha === OLD_SHA, `expected sha ${OLD_SHA}, got ${r.sha}`);
    assert(mailCount(r.mail) === 0, `expected no mail on first run, got:\n${r.mail}`);
  } finally { r.cleanup(); }
});

check('unchanged version and sha: exit 0, no mail', () => {
  const r = runScript({
    seed: { version: '0.1.5', sha: OLD_SHA },
    env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '0', FAKE_GH_SHA: OLD_SHA },
  });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(mailCount(r.mail) === 0, `expected no mail, got:\n${r.mail}`);
    assert(r.version === '0.1.5', `expected version unchanged 0.1.5, got ${r.version}`);
  } finally { r.cleanup(); }
});

check('new version with GitHub 404: exit 0, one mail naming both versions, state advances', () => {
  const r = runScript({
    seed: { version: '0.1.4', sha: '' },
    env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '0', FAKE_GH_SHA: '' },
  });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(mailCount(r.mail) === 1, `expected exactly one mail, got ${mailCount(r.mail)}:\n${r.mail}`);
    assert(r.mail.includes('0.1.5') && r.mail.includes('0.1.4'), `expected subject naming both versions, got:\n${r.mail}`);
    assert(r.version === '0.1.5', `expected state advanced to 0.1.5, got ${r.version}`);
  } finally { r.cleanup(); }
});

check('sha moved with same version: exit 0, one "spec repo moved" mail, sha file updated', () => {
  const r = runScript({
    seed: { version: '0.1.5', sha: OLD_SHA },
    env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '0', FAKE_GH_SHA: NEW_SHA },
  });
  try {
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}`);
    assert(mailCount(r.mail) === 1, `expected exactly one mail, got ${mailCount(r.mail)}:\n${r.mail}`);
    assert(r.mail.includes('spec repo moved'), `expected "spec repo moved" subject, got:\n${r.mail}`);
    assert(r.sha === NEW_SHA, `expected sha updated to ${NEW_SHA}, got ${r.sha}`);
  } finally { r.cleanup(); }
});

check('send failure keeps state (ssh exits 1): version file still 0.1.4', () => {
  const r = runScript({
    seed: { version: '0.1.4', sha: OLD_SHA },
    env: { FAKE_NPM_VERSION: '0.1.5', FAKE_CURL_STATUS: '0', FAKE_GH_SHA: OLD_SHA, FAKE_SSH_STATUS: '1' },
  });
  try {
    assert(r.version === '0.1.4', `expected state kept at 0.1.4 after failed send, got ${r.version}`);
  } finally { r.cleanup(); }
});

check('script hygiene: no en/em dash, no box-drawing, not the c-word', () => {
  const s = fs.readFileSync(SCRIPT, 'utf-8');
  const forbidden = new RegExp(String.fromCharCode(91, 8211, 8212, 9472, 93));
  assert(!forbidden.test(s), 'script contains an en dash, em dash or box-drawing rule');
  assert(!/can[o]nical/i.test(s), 'script contains the forbidden word');
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`agentskills-watch harness: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
