'use strict';

// Discrimination test for bin/maintenance/check-skill-conformance.cjs.
// Drives the gate against tmpdir sandboxes with controlled skills/<name>/SKILL.md
// fixtures and a drift-baseline.json, then asserts exit status and stdout for
// every gate behavior: the skill-count ceiling with its warn band, the
// description-length ratchet, the hard-fail frontmatter subset (name,
// description, allowed-tools), the advisory-only optional fields, the three
// in-repo allowed-tools shapes, the repo-root guard, --write-baseline sibling
// preservation, --dry, and the standalone --validate mode.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DETECTOR = path.resolve(__dirname, '..', 'bin', 'maintenance', 'check-skill-conformance.cjs');

function withSandbox(setup, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-skillconf-test-'));
  // The gate's repo-root guard needs .git/ and skills/ to confirm it is not
  // running from a partial checkout. Create all three markers.
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  setup(dir);
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function withBareDir(fn) {
  // A tmpdir with neither .git/ nor skills/, to prove the repo-root guard
  // trips (exit 2) and that --validate bypasses the guard.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-skillconf-bare-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runDetector(cwd, flags) {
  // 10000 ms: the warn-band and ceiling cases write up to 91 fixture files.
  return spawnSync('node', [DETECTOR, ...(flags || [])], {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
  });
}

// Build a skills/<dirName>/SKILL.md from explicit frontmatter lines plus a body.
function writeSkill(root, dirName, fmLines) {
  const skillDir = path.join(root, 'skills', dirName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\n' + fmLines.join('\n') + '\n---\n\nBody line.\n',
    'utf-8'
  );
}

// name + a description of a chosen length, plus any extra frontmatter lines.
function fm(name, descLen, extra) {
  const lines = [`name: ${name}`, `description: ${'d'.repeat(descLen == null ? 30 : descLen)}`];
  if (extra) for (const e of extra) lines.push(e);
  return lines;
}

// Write tests/drift-baseline.json with a file_layout marker section and an
// optional skill_conformance section.
function writeBaselineFile(root, skillConf) {
  const obj = {
    file_layout: {
      total_dangling: 100,
      has_plugin_counterpart: 100,
      genuinely_missing: 0,
      generated_at: '2026-01-01',
      note: 'marker section that must survive a skill_conformance write',
    },
  };
  if (skillConf) obj.skill_conformance = skillConf;
  fs.writeFileSync(
    path.join(root, 'tests', 'drift-baseline.json'),
    JSON.stringify(obj, null, 2) + '\n',
    'utf-8'
  );
}

const DEFAULT_BL = {
  skill_count: 3,
  max_description_length: 40,
  ceiling: 90,
  warn_at: 88,
  generated_at: '2026-01-01',
  note: 'marker',
};

const checks = [];
function check(name, fn2) {
  try {
    fn2();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

check('clean fixtures plus matching baseline: exit 0, Status PASS', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 40, [
      'argument-hint: "[thing]"',
      'type: execute',
      'agent: bm-executor',
      'model: opus',
    ]));
    writeSkill(dir, 'skill-b', fm('skill-b', 30));
    writeSkill(dir, 'skill-c', fm('skill-c', 20));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('Status: PASS'), `expected Status: PASS, got:\n${r.stdout}`);
  });
});

check('bundled dir without SKILL.md is not counted: skills 3', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-b', fm('skill-b', 20));
    writeSkill(dir, 'skill-c', fm('skill-c', 20));
    // bundled assets directory with a file but no SKILL.md.
    fs.mkdirSync(path.join(dir, 'skills', 'bundled'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', 'bundled', 'asset.ts'), 'x', 'utf-8');
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('skills: 3'), `expected skills: 3, got:\n${r.stdout}`);
  });
});

check('18-conf-count-ceiling: 88 fixtures warn, exit 0', () => {
  withSandbox((dir) => {
    for (let i = 0; i < 88; i++) {
      const n = `skill-${String(i).padStart(3, '0')}`;
      writeSkill(dir, n, fm(n, 20));
    }
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('WARN:'), `expected WARN:, got:\n${r.stdout}`);
  });
});

check('18-conf-count-ceiling: 90 fixtures warn, exit 0', () => {
  withSandbox((dir) => {
    for (let i = 0; i < 90; i++) {
      const n = `skill-${String(i).padStart(3, '0')}`;
      writeSkill(dir, n, fm(n, 20));
    }
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('WARN:'), `expected WARN:, got:\n${r.stdout}`);
  });
});

check('18-conf-count-ceiling: 91 fixtures hard-fail, exit 1', () => {
  withSandbox((dir) => {
    for (let i = 0; i < 91; i++) {
      const n = `skill-${String(i).padStart(3, '0')}`;
      writeSkill(dir, n, fm(n, 20));
    }
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('skill_count 91 > ceiling 90'), `expected ceiling line, got:\n${r.stdout}`);
  });
});

check('18-conf-desc-ratchet: description 41 over baseline 40 hard-fails, names file', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-long', fm('skill-long', 41));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('description length 41 > baseline 40'), `expected ratchet line, got:\n${r.stdout}`);
    assert(r.stdout.includes('skills/skill-long/SKILL.md'), `expected offending path, got:\n${r.stdout}`);
  });
});

check('18-conf-desc-ratchet: all descriptions below baseline, REDUCED exit 0', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-b', fm('skill-b', 25));
    writeSkill(dir, 'skill-c', fm('skill-c', 30));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('REDUCED'), `expected REDUCED, got:\n${r.stdout}`);
  });
});

check('18-conf-desc-ratchet: --write-baseline preserves file_layout and adds skill_conformance', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-b', fm('skill-b', 35));
    writeSkill(dir, 'skill-c', fm('skill-c', 30));
    // Pre-seed ONLY file_layout, no skill_conformance section.
    writeBaselineFile(dir, null);
  }, (dir) => {
    const before = JSON.parse(fs.readFileSync(path.join(dir, 'tests', 'drift-baseline.json'), 'utf-8'));
    const r = runDetector(dir, ['--write-baseline']);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert(
      r.stdout.includes('Wrote tests/drift-baseline.json (skill_conformance section).'),
      `expected write confirmation, got:\n${r.stdout}`
    );
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'tests', 'drift-baseline.json'), 'utf-8'));
    assert(
      JSON.stringify(after.file_layout) === JSON.stringify(before.file_layout),
      'expected file_layout section byte-identical'
    );
    const sc = after.skill_conformance;
    assert(sc, 'expected skill_conformance section added');
    assert(sc.skill_count === 3, `expected skill_count 3, got ${sc.skill_count}`);
    assert(sc.max_description_length === 35, `expected max_description_length 35, got ${sc.max_description_length}`);
    assert(sc.ceiling === 90, `expected ceiling 90, got ${sc.ceiling}`);
    assert(sc.warn_at === 88, `expected warn_at 88, got ${sc.warn_at}`);
    assert(typeof sc.generated_at === 'string' && sc.generated_at.length > 0, 'expected generated_at');
    assert(typeof sc.note === 'string' && sc.note.length > 0, 'expected note');
  });
});

check('--write-baseline refuses to write while a hard finding exists', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-empty', ['name: skill-empty', 'description: ""']);
    // No baseline file present.
  }, (dir) => {
    const r = runDetector(dir, ['--write-baseline']);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(
      !fs.existsSync(path.join(dir, 'tests', 'drift-baseline.json')),
      'expected the baseline file NOT to be written'
    );
  });
});

check('18-conf-frontmatter: missing name hard-fails, exit 1', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-noname', ['description: a valid description here']);
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('name missing or empty'), `expected name finding, got:\n${r.stdout}`);
  });
});

check('18-conf-frontmatter: empty description hard-fails, exit 1', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-empty', ['name: skill-empty', 'description: ""']);
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('description missing or empty'), `expected description finding, got:\n${r.stdout}`);
  });
});

check('18-conf-allowed-tools: three in-repo shapes all pass, exit 0', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-list', fm('skill-list', 20, [
      'allowed-tools:',
      '  - Read',
      '  - Bash(git:*)',
      '  - mcp__context7__*',
    ]));
    writeSkill(dir, 'skill-empty-arr', fm('skill-empty-arr', 20, ['allowed-tools: []']));
    writeSkill(dir, 'skill-comma', fm('skill-comma', 20, [
      'allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion',
    ]));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });
});

check('18-conf-allowed-tools: list item with internal whitespace is malformed, exit 1', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-bad', fm('skill-bad', 20, [
      'allowed-tools:',
      '  - not a tool',
    ]));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('allowed-tools malformed'), `expected malformed finding, got:\n${r.stdout}`);
  });
});

check('18-conf-allowed-tools: bare allowed-tools key (placeholder) is malformed, exit 1', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-bare', ['name: skill-bare', 'allowed-tools:', 'description: a valid description']);
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('allowed-tools malformed'), `expected malformed finding, got:\n${r.stdout}`);
  });
});

check('18-conf-frontmatter: license, compatibility, metadata are advisory only, exit 0', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-opt', fm('skill-opt', 20, [
      'license:',
      'compatibility: ' + 'c'.repeat(501),
      'metadata: not-a-map',
    ]));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('advisory:'), `expected advisory output, got:\n${r.stdout}`);
  });
});

check('name differs from directory is advisory only, exit 0', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'extract_learnings', fm('extract-learnings', 20));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('advisory:'), `expected advisory output, got:\n${r.stdout}`);
  });
});

check('fence-less SKILL.md yields a finding, no crash', () => {
  withSandbox((dir) => {
    const skillDir = path.join(dir, 'skills', 'skill-nofence');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'no frontmatter fence at all\n', 'utf-8');
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('name missing or empty'), `expected name finding, got:\n${r.stdout}`);
    assert(!/\bat Object\.|\n\s+at /.test(r.stderr), `expected no stack trace in stderr, got:\n${r.stderr}`);
  });
});

check('no baseline and clean fixtures: exit 0 with No baseline message', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-a', fm('skill-a', 20));
    writeSkill(dir, 'skill-b', fm('skill-b', 20));
    // No drift-baseline.json.
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('No baseline found (run with --write-baseline).'), `expected no-baseline message, got:\n${r.stdout}`);
  });
});

check('no baseline but missing name still hard-fails, exit 1', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-noname', ['description: a valid description']);
    // No drift-baseline.json; structural failure must not depend on a baseline.
  }, (dir) => {
    const r = runDetector(dir);
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
  });
});

check('--dry does not compare to baseline, exit 0', () => {
  withSandbox((dir) => {
    writeSkill(dir, 'skill-long', fm('skill-long', 41));
    writeBaselineFile(dir, DEFAULT_BL);
  }, (dir) => {
    const r = runDetector(dir, ['--dry']);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('Dry-run mode, not comparing to baseline.'), `expected dry-run message, got:\n${r.stdout}`);
  });
});

check('18-conf-cwd-guard: wrong cwd exits 2', () => {
  withBareDir((dir) => {
    const r = runDetector(dir);
    assert(r.status === 2, `expected exit 2, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert(r.stderr.includes('run from repo root'), `expected repo-root error, got:\n${r.stderr}`);
  });
});

check('--validate on a clean standalone dir from a bare cwd: exit 0', () => {
  withBareDir((home) => {
    const skillDir = path.join(home, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: a valid description here\n---\nBody.\n',
      'utf-8'
    );
    withBareDir((cwd) => {
      const r = spawnSync('node', [DETECTOR, '--validate', skillDir], { cwd, encoding: 'utf-8', timeout: 10000 });
      assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    });
  });
});

check('--validate on a dir whose SKILL.md lacks a description: exit 1', () => {
  withBareDir((home) => {
    const skillDir = path.join(home, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\n---\nBody.\n',
      'utf-8'
    );
    withBareDir((cwd) => {
      const r = spawnSync('node', [DETECTOR, '--validate', skillDir], { cwd, encoding: 'utf-8', timeout: 10000 });
      assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
      assert(r.stdout.includes('description missing or empty'), `expected description finding, got:\n${r.stdout}`);
    });
  });
});

check('--validate on a nonexistent dir: exit 1 mentioning SKILL.md', () => {
  withBareDir((cwd) => {
    const r = spawnSync('node', [DETECTOR, '--validate', path.join(cwd, 'nope')], { cwd, encoding: 'utf-8', timeout: 10000 });
    assert(r.status === 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}`);
    assert(r.stdout.includes('SKILL.md'), `expected SKILL.md mention, got:\n${r.stdout}`);
  });
});

const failed = checks.filter(([ok]) => !ok);
console.log('');
console.log(`skill-conformance gate: ${checks.length - failed.length}/${checks.length} checks passed`);
for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
