'use strict';

// Spec for the global:<plugin>:<skill> plugin-skill form in the CJS agent-skills
// twin (bin/lib/init.cjs buildAgentSkillsBlock, driven through gsd-tools.cjs).
//
// A namespaced global name is a Claude Code plugin skill: it is loaded by name
// via the Skill tool, not resolved to a filesystem path. This guards:
//   - the plugin form emits the Skill-tool directive and never trips the legacy
//     "Invalid global skill name" check;
//   - a plain global:<name> still resolves to <config dir>/skills/<name>/SKILL.md;
//   - a malformed namespaced name is skipped with a warning;
//   - a mixed config renders path, plugin and personal-global entries in order,
//     byte-identical to the SDK twin's expected block (the parity contract, since
//     no golden covers agent-skills);
//   - a non-claude runtime skips the plugin entry with a runtime-naming warning.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-skills-plugin-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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

const DIRECTIVE = (name) =>
  `- Invoke the Skill tool with skill "${name}" at agent start (plugin skill, loaded by name, not by path)`;

check('plugin form emits the Skill-tool directive and no "Invalid global skill name" warning', () => {
  withProject((root) => {
    writeConfig(root, { agent_skills: { 'gsd-executor': ['global:superpowers:brainstorming'] } });
    const { stdout, stderr } = runAgentSkills(root);
    assert(
      stdout ===
        '<agent_skills>\n' +
          'Read these user-configured skills:\n' +
          DIRECTIVE('superpowers:brainstorming') + '\n' +
          '</agent_skills>',
      `unexpected stdout: ${JSON.stringify(stdout)}`,
    );
    assert(!stderr.includes('Invalid global skill name'), `unexpected legacy warning: ${stderr}`);
  });
});

check('plain global:<name> resolves to <config dir>/skills/<name>/SKILL.md', () => {
  withProject((root) => {
    writeSkill(path.join(root, 'cfg', 'skills'), 'my-notes');
    writeConfig(root, { agent_skills: { 'gsd-executor': ['global:my-notes'] } });
    const { stdout } = runAgentSkills(root);
    assert(
      stdout ===
        '<agent_skills>\n' +
          'Read these user-configured skills:\n' +
          `- @${path.join(root, 'cfg', 'skills', 'my-notes', 'SKILL.md')}\n` +
          '</agent_skills>',
      `unexpected stdout: ${JSON.stringify(stdout)}`,
    );
  });
});

check('malformed global:a::b is skipped with a warning and yields empty stdout', () => {
  withProject((root) => {
    writeConfig(root, { agent_skills: { 'gsd-executor': ['global:a::b'] } });
    const { stdout, stderr } = runAgentSkills(root);
    assert(stdout === '', `expected empty stdout, got: ${JSON.stringify(stdout)}`);
    assert(stderr.includes('Invalid plugin skill name'), `expected plugin-name warning, got: ${stderr}`);
  });
});

check('mixed config renders path, plugin and personal-global in order (SDK parity)', () => {
  withProject((root) => {
    writeSkill(path.join(root, '.claude', 'skills'), 'local-skill');
    writeSkill(path.join(root, 'cfg', 'skills'), 'my-notes');
    writeConfig(root, {
      agent_skills: {
        'gsd-executor': ['.claude/skills/local-skill', 'global:superpowers:brainstorming', 'global:my-notes'],
      },
    });
    const { stdout } = runAgentSkills(root);
    const expected =
      '<agent_skills>\n' +
      'Read these user-configured skills:\n' +
      '- @.claude/skills/local-skill/SKILL.md\n' +
      DIRECTIVE('superpowers:brainstorming') + '\n' +
      `- @${path.join(root, 'cfg', 'skills', 'my-notes', 'SKILL.md')}\n` +
      '</agent_skills>';
    assert(stdout === expected, `unexpected block:\n${JSON.stringify(stdout)}\nexpected:\n${JSON.stringify(expected)}`);
  });
});

check('non-claude runtime skips the plugin entry with a runtime-naming warning', () => {
  withProject((root) => {
    writeConfig(root, {
      runtime: 'codex',
      agent_skills: { 'gsd-executor': ['global:superpowers:brainstorming'] },
    });
    const { stdout, stderr } = runAgentSkills(root);
    assert(stdout === '', `expected empty stdout, got: ${JSON.stringify(stdout)}`);
    assert(stderr.includes('needs the Claude runtime'), `expected runtime warning, got: ${stderr}`);
  });
});

check('config keyed gsd-executor answers a bm-executor query (normalization)', () => {
  withProject((root) => {
    writeConfig(root, { agent_skills: { 'gsd-executor': ['global:superpowers:brainstorming'] } });
    const { stdout } = runAgentSkills(root, 'bm-executor');
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

check('config keyed bm-executor answers a gsd-executor query (legacy CLI arg)', () => {
  withProject((root) => {
    writeConfig(root, { agent_skills: { 'bm-executor': ['global:superpowers:brainstorming'] } });
    const { stdout } = runAgentSkills(root, 'gsd-executor');
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
console.log(`agent-skills plugin form: ${passed}/${checks.length} checks passed`);
for (const [ok, name] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed.length > 0 ? 1 : 0);
