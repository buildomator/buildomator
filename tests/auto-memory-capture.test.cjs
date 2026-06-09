'use strict';

// Regression test for the ad-hoc durable-decision auto-capture feature
// (v2.46.x). Covers:
//   - memory.cjs cmdWriteDecisionMemory: writes a frontmatter'd memory file to
//     the resolved auto-memory dir + flat-indexes it in MEMORY.md, idempotently.
//   - The two latent write-phase-memory bugs fixed alongside (export name +
//     args[1] positional) — asserted against the gsd-tools dispatch source.
//   - The three ad-hoc workflows (quick/debug/fast) wire the shared protocol
//     and gate on workflow.auto_memory_capture.
//
// allow-test-rule: source-text-is-the-product
// Workflow .md files ARE the installed prompts; asserting their text IS
// asserting the deployed behavior contract.

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const MEMORY = path.join(ROOT, 'bin', 'lib', 'memory.cjs');

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

// ─── 1. Exports ──────────────────────────────────────────────────────────────
const memory = require(MEMORY);
ok('exports cmdWriteDecisionMemory', typeof memory.cmdWriteDecisionMemory === 'function');
ok('exports appendDecisionIndex', typeof memory.appendDecisionIndex === 'function');
ok('exports cmdWritePhaseMemory (correct name)', typeof memory.cmdWritePhaseMemory === 'function');

// ─── 2. Functional: write + index + idempotency (in a temp memory dir) ───────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-decmem-'));
const memDir = path.join(tmp, 'memory') + path.sep;
process.env.CLAUDE_COWORK_MEMORY_PATH_OVERRIDE = memDir;
const bodyFile = path.join(tmp, 'body.md');
fs.writeFileSync(bodyFile, '**Why:** because.\n\n**How to apply:** thus.\n');

// Suppress the command's stdout JSON so test output stays clean.
const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;
try {
  memory.cmdWriteDecisionMemory(ROOT, {
    slug: 'decmem-unit-fixture',
    title: 'Decmem Fixture',
    description: 'one-line hook',
    type: 'feedback',
    bodyFile,
  }, false);
  // second call, same slug, different title/hook → must update in place
  memory.cmdWriteDecisionMemory(ROOT, {
    slug: 'decmem-unit-fixture',
    title: 'Decmem Fixture v2',
    description: 'updated hook',
    type: 'feedback',
    bodyFile,
  }, false);
} finally {
  process.stdout.write = realWrite;
}

const memFile = path.join(memDir, 'decmem-unit-fixture.md');
const memContent = fs.existsSync(memFile) ? fs.readFileSync(memFile, 'utf-8') : '';
ok('memory file written', fs.existsSync(memFile));
ok('frontmatter has name', /^name: decmem-unit-fixture$/m.test(memContent));
ok('frontmatter has type', /^ {2}type: feedback$/m.test(memContent));
ok('body preserved', memContent.includes('**Why:** because.'));

const idx = fs.existsSync(path.join(memDir, 'MEMORY.md'))
  ? fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf-8')
  : '';
const idxLines = idx.split('\n').filter((l) => l.includes('decmem-unit-fixture.md'));
ok('exactly one index line (idempotent, no dup)', idxLines.length === 1);
ok('index line is flat style with updated title+hook',
  idxLines[0] === '- [Decmem Fixture v2](decmem-unit-fixture.md): updated hook');

fs.rmSync(tmp, { recursive: true, force: true });
delete process.env.CLAUDE_COWORK_MEMORY_PATH_OVERRIDE;

// ─── 3. gsd-tools dispatch: phase-memory fix + decision case ─────────────────
const tools = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-tools.cjs'), 'utf-8');
const phaseCase = tools.slice(tools.indexOf("case 'write-phase-memory'"), tools.indexOf("case 'write-decision-memory'"));
ok('write-phase-memory calls cmdWritePhaseMemory', phaseCase.includes('memory.cmdWritePhaseMemory('));
ok('write-phase-memory no longer references undefined writePhaseMemory', !/memory\.writePhaseMemory\(/.test(phaseCase));
ok('write-phase-memory reads phase from args[1]', phaseCase.includes('const phaseArg = args[1]'));
ok('write-decision-memory case present', tools.includes("case 'write-decision-memory'"));
ok('write-decision-memory dispatches to cmdWriteDecisionMemory', tools.includes('memory.cmdWriteDecisionMemory('));

// ─── 4. Shared protocol reference ────────────────────────────────────────────
const ref = fs.existsSync(path.join(ROOT, 'references', 'auto-memory-capture.md'))
  ? fs.readFileSync(path.join(ROOT, 'references', 'auto-memory-capture.md'), 'utf-8')
  : '';
ok('reference exists', ref.length > 0);
ok('reference names the command', ref.includes('write-decision-memory'));
ok('reference names the config gate', ref.includes('workflow.auto_memory_capture'));

// ─── 5. Workflows wire the protocol + the config gate ────────────────────────
for (const wf of ['quick.md', 'debug.md', 'fast.md']) {
  const txt = fs.readFileSync(path.join(ROOT, 'workflows', wf), 'utf-8');
  ok(`${wf} references the capture protocol`, txt.includes('references/auto-memory-capture.md'));
  ok(`${wf} gates on workflow.auto_memory_capture`, txt.includes('workflow.auto_memory_capture'));
}

// ─── Report ──────────────────────────────────────────────────────────────────
for (const [pass, label] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
}
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
