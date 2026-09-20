'use strict';

// Spec for agent_skills_security.trusted_global_roots in the CJS twin:
//   - loadTrustedGlobalRoots hardening rules (bin/lib/security.cjs)
//   - buildAgentSkillsBlock (via gsd-tools.cjs agent-skills) accepts a global
//     skill symlinked outside the runtime skills dir only when its real
//     location sits under a configured trusted root, emitting a NOTE; otherwise
//     the existing symlink-escape WARNING stands and nothing is injected.
// A project-relative root, the filesystem root, the home directory, and a
// non-existent path are each rejected. An in-base skill still loads with no
// NOTE, and the plugin-form branch is untouched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
const { loadTrustedGlobalRoots } = require('../bin/lib/security.cjs');

const checks = [];

function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-trusted-roots-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function writeSkill(dir, name) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${name}\n---\n# ${name}\n`);
}

function writeConfig(root, config) {
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), JSON.stringify(config));
}

function runAgentSkills(root, agent = 'gsd-executor') {
  const res = spawnSync(process.execPath, [GSD_TOOLS, 'agent-skills', agent], {
    cwd: root,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'cfg') },
    encoding: 'utf8',
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

// Create an ext-skill directory outside the runtime skills dir and symlink it in.
function linkExternalSkill(root) {
  writeSkill(path.join(root, 'outside'), 'ext-skill');
  fs.mkdirSync(path.join(root, 'cfg', 'skills'), { recursive: true });
  fs.symlinkSync(
    path.join(root, 'outside', 'ext-skill'),
    path.join(root, 'cfg', 'skills', 'ext-skill'),
    'dir',
  );
}

const DIRECTIVE = (name) =>
  `- Invoke the Skill tool with skill "${name}" at agent start (plugin skill, loaded by name, not by path)`;

// --- Part 1: loader hardening ---

check('non-object and empty configs yield an empty list', () => {
  assert(loadTrustedGlobalRoots({}).length === 0, 'empty object');
  assert(loadTrustedGlobalRoots(null).length === 0, 'null');
  assert(loadTrustedGlobalRoots(42).length === 0, 'number');
  assert(loadTrustedGlobalRoots({ agent_skills_security: { trusted_global_roots: 'x' } }).length === 0, 'string value');
  assert(loadTrustedGlobalRoots({ agent_skills_security: 5 }).length === 0, 'non-object section');
});

check('relative, root, home, tilde, and non-existent entries are dropped; a real dir survives once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgr-real-'));
  try {
    const r = loadTrustedGlobalRoots({
      agent_skills_security: {
        trusted_global_roots: [
          'rel/x', '/', os.homedir(), '~', path.join(dir, 'nope'), 42, dir, dir,
        ],
      },
    });
    assert(r.length === 1, `expected one entry, got ${JSON.stringify(r)}`);
    assert(r[0] === fs.realpathSync(dir), `expected realpath of dir, got ${r[0]}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('a dir listed directly and via a symlink to it de-dupes to one entry', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tgr-dedupe-'));
  const target = path.join(base, 'target');
  const link = path.join(base, 'link');
  fs.mkdirSync(target, { recursive: true });
  fs.symlinkSync(target, link, 'dir');
  try {
    const r = loadTrustedGlobalRoots({
      agent_skills_security: { trusted_global_roots: [target, link] },
    });
    assert(r.length === 1, `expected one entry, got ${JSON.stringify(r)}`);
    assert(r[0] === fs.realpathSync(target), `expected realpath of target, got ${r[0]}`);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// --- Part 2: subprocess acceptance / rejection matrix ---

check('default: a symlinked-out global skill is rejected with the symlink-escape WARNING', () => {
  withProject((root) => {
    linkExternalSkill(root);
    writeConfig(root, { agent_skills: { 'gsd-executor': ['global:ext-skill'] } });
    const { stdout, stderr } = runAgentSkills(root);
    assert(stdout === '', `expected empty stdout, got ${JSON.stringify(stdout)}`);
    assert(stderr.includes('failed path check'), `expected symlink-escape WARNING, got ${stderr}`);
    assert(!stderr.includes('NOTE:'), `did not expect a NOTE, got ${stderr}`);
  });
});

check('trusted: the same skill is accepted with a NOTE when its root is trusted', () => {
  withProject((root) => {
    linkExternalSkill(root);
    writeConfig(root, {
      agent_skills: { 'gsd-executor': ['global:ext-skill'] },
      agent_skills_security: { trusted_global_roots: [path.join(root, 'outside')] },
    });
    const { stdout, stderr } = runAgentSkills(root);
    const expected =
      '<agent_skills>\n' +
      'Read these user-configured skills:\n' +
      `- @${path.join(root, 'cfg', 'skills', 'ext-skill', 'SKILL.md')}\n` +
      '</agent_skills>';
    assert(stdout === expected, `unexpected block:\n${JSON.stringify(stdout)}\nexpected:\n${JSON.stringify(expected)}`);
    assert(stderr.includes('accepted via trusted_global_roots'), `expected NOTE, got ${stderr}`);
  });
});

for (const [label, rootsOf] of [
  ['project-relative', () => ['outside']],
  ['filesystem root', () => ['/']],
  ['home directory', () => [os.homedir()]],
  ['non-existent path', (root) => [path.join(root, 'does-not-exist')]],
]) {
  check(`hardening: ${label} root does not accept the symlinked-out skill`, () => {
    withProject((root) => {
      linkExternalSkill(root);
      writeConfig(root, {
        agent_skills: { 'gsd-executor': ['global:ext-skill'] },
        agent_skills_security: { trusted_global_roots: rootsOf(root) },
      });
      const { stdout, stderr } = runAgentSkills(root);
      assert(stdout === '', `expected empty stdout, got ${JSON.stringify(stdout)}`);
      assert(stderr.includes('failed path check'), `expected WARNING, got ${stderr}`);
      assert(!stderr.includes('NOTE:'), `did not expect a NOTE, got ${stderr}`);
    });
  });
}

check('in-base global skill still loads with no NOTE even when trusted roots are configured', () => {
  withProject((root) => {
    writeSkill(path.join(root, 'cfg', 'skills'), 'my-notes');
    writeConfig(root, {
      agent_skills: { 'gsd-executor': ['global:my-notes'] },
      agent_skills_security: { trusted_global_roots: [path.join(root, 'outside')] },
    });
    const { stdout, stderr } = runAgentSkills(root);
    const expected =
      '<agent_skills>\n' +
      'Read these user-configured skills:\n' +
      `- @${path.join(root, 'cfg', 'skills', 'my-notes', 'SKILL.md')}\n` +
      '</agent_skills>';
    assert(stdout === expected, `unexpected block:\n${JSON.stringify(stdout)}`);
    assert(!stderr.includes('NOTE:'), `did not expect a NOTE, got ${stderr}`);
  });
});

check('plugin-form global:<plugin>:<skill> is untouched with trusted roots configured', () => {
  withProject((root) => {
    writeConfig(root, {
      agent_skills: { 'gsd-executor': ['global:superpowers:brainstorming'] },
      agent_skills_security: { trusted_global_roots: [path.join(root, 'outside')] },
    });
    const { stdout } = runAgentSkills(root);
    assert(
      stdout ===
        '<agent_skills>\n' +
          'Read these user-configured skills:\n' +
          DIRECTIVE('superpowers:brainstorming') + '\n' +
          '</agent_skills>',
      `unexpected stdout: ${JSON.stringify(stdout)}`,
    );
  });
});

const failed = checks.filter(([ok]) => !ok);
const passed = checks.length - failed.length;

console.log('');
console.log(`trusted global roots: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
