#!/usr/bin/env node
/**
 * Regression suite for hooks/gsd-envelope-sanitizer.cjs.
 *
 * The sanitizer strips unbalanced trailing tool-call envelope closers
 * (</content>, </invoke>, </function_calls>) that a streamed write can leak into
 * the tail of a just-written .planning markdown file. It must leave every other
 * file, every balanced usage, and every already-clean file byte-identical, and
 * it must never block the tool (exit 0 on every path).
 *
 * Same house pattern as tests/hooks-smoke.test.cjs: spawn the hook with a crafted
 * payload piped to stdin, fixtures under a per-run temp dir with a .planning/
 * subdir, assert on file bytes and exit codes.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', 'hooks', 'gsd-envelope-sanitizer.cjs');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function runHook(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('hook timed out (5s)'));
    }, 5000);
    child.stdout.on('data', (b) => { stdout += b.toString('utf8'); });
    child.stderr.on('data', (b) => { stderr += b.toString('utf8'); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    child.stdin.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  });
}

function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envelope-san-'));
  fs.mkdirSync(path.join(dir, '.planning', 'x'), { recursive: true });
  return dir;
}

// Write a fixture inside the temp .planning/x dir and return its absolute path.
function planningFile(dir, name, content) {
  const fp = path.join(dir, '.planning', 'x', name);
  fs.writeFileSync(fp, content);
  return fp;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// 1. Leaked </content> + </invoke> after </output>: file ends with </output>\n
test('strips </content> + </invoke> leaked after </output>', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'A-PLAN.md',
    '<objective>\nA\n</objective>\n\n<output>\nDone\n</output>\n</content>\n</invoke>\n');
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0, got ' + r.code);
  const after = fs.readFileSync(fp, 'utf8');
  assert(after.endsWith('</output>\n'), 'expected file to end with </output>\\n; got tail: ' + JSON.stringify(after.slice(-40)));
  assert(!/<\/content>|<\/invoke>/.test(after), 'leaked closers still present');
  assert(/stripped 2 leaked/.test(r.stderr), 'expected stderr notice; got: ' + JSON.stringify(r.stderr));
});

// 2. Leaked </content> alone at EOF: stripped
test('strips lone </content> at EOF', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'B-PLAN.md', '<objective>\nhi\n</objective>\n</content>\n');
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  const after = fs.readFileSync(fp, 'utf8');
  assert(after === '<objective>\nhi\n</objective>\n', 'unexpected content: ' + JSON.stringify(after));
});

// 3. Leaked </function_calls> at EOF: stripped
test('strips </function_calls> at EOF', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'C-PLAN.md', 'body line\n</function_calls>\n');
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  const after = fs.readFileSync(fp, 'utf8');
  assert(after === 'body line\n', 'unexpected content: ' + JSON.stringify(after));
});

// 4. Closers followed by trailing blank lines: closers + blanks removed, one \n kept
test('removes closers plus trailing blank lines, keeps single newline', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'D-PLAN.md', 'real content\n</content>\n\n\n');
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  const after = fs.readFileSync(fp, 'utf8');
  assert(after === 'real content\n', 'unexpected content: ' + JSON.stringify(after));
});

// 5. Balanced <content>...</content>: byte-identical
test('leaves balanced <content>...</content> untouched', async () => {
  const dir = mkTmp();
  const before = '<content>\nbalanced body\n</content>\n';
  const fp = planningFile(dir, 'E-PLAN.md', before);
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === before, 'balanced file was modified');
  assert(r.stderr.trim() === '', 'expected no stderr on no-op; got: ' + JSON.stringify(r.stderr));
});

// 6. Non-.planning path with trailing </content>: byte-identical
test('leaves non-.planning file untouched', async () => {
  const dir = mkTmp();
  const before = 'doc about tool use\n</content>\n';
  const fp = path.join(dir, 'outside.md');
  fs.writeFileSync(fp, before);
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === before, 'non-.planning file was modified');
});

// 7. Non-.md path inside .planning: byte-identical
test('leaves non-.md file inside .planning untouched', async () => {
  const dir = mkTmp();
  const before = 'data\n</content>\n';
  const fp = path.join(dir, '.planning', 'x', 'notes.txt');
  fs.writeFileSync(fp, before);
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === before, 'non-.md file was modified');
});

// 8. Already-clean file: byte-identical; running twice is a no-op (idempotent)
test('already-clean file is untouched and idempotent across two runs', async () => {
  const dir = mkTmp();
  const before = '<objective>\nclean\n</objective>\n\n<output>\nok\n</output>\n';
  const fp = planningFile(dir, 'F-PLAN.md', before);
  const r1 = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r1.code === 0, 'expected exit 0 (first run)');
  assert(fs.readFileSync(fp, 'utf8') === before, 'clean file changed on first run');
  const r2 = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r2.code === 0, 'expected exit 0 (second run)');
  assert(fs.readFileSync(fp, 'utf8') === before, 'clean file changed on second run');
});

// 8b. Second run on a stripped file changes nothing (idempotent after strip)
test('second run on a stripped file is a no-op', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'G-PLAN.md', 'content\n</output>\n</content>\n</invoke>\n');
  await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  const afterFirst = fs.readFileSync(fp, 'utf8');
  assert(afterFirst === 'content\n</output>\n', 'first strip unexpected: ' + JSON.stringify(afterFirst));
  const r2 = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r2.code === 0, 'expected exit 0 (second run)');
  assert(fs.readFileSync(fp, 'utf8') === afterFirst, 'second run changed a stripped file');
  assert(r2.stderr.trim() === '', 'second run emitted a strip notice');
});

// 9a. Edit shape triggers the strip
test('Edit tool_input shape triggers the strip', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'H-PLAN.md', 'edited body\n</content>\n');
  const r = await runHook({
    tool_name: 'Edit',
    tool_input: { file_path: fp, old_string: 'a', new_string: 'b' },
  });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === 'edited body\n', 'Edit shape did not strip');
});

// 9b. MultiEdit shape triggers the strip
test('MultiEdit tool_input shape triggers the strip', async () => {
  const dir = mkTmp();
  const fp = planningFile(dir, 'I-PLAN.md', 'multi body\n</invoke>\n');
  const r = await runHook({
    tool_name: 'MultiEdit',
    tool_input: { file_path: fp, edits: [{ old_string: 'a', new_string: 'b' }] },
  });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === 'multi body\n', 'MultiEdit shape did not strip');
});

// 10a. Malformed JSON on stdin: exit 0, no crash
test('malformed JSON on stdin exits 0', async () => {
  const r = await runHook('{not valid json');
  assert(r.code === 0, 'expected exit 0 on bad JSON, got ' + r.code);
});

// 10b. Missing file_path: exit 0
test('missing file_path exits 0', async () => {
  const r = await runHook({ tool_name: 'Write', tool_input: {} });
  assert(r.code === 0, 'expected exit 0 on missing file_path, got ' + r.code);
});

// 10c. Nonexistent file: exit 0, nothing created
test('nonexistent file exits 0 without creating anything', async () => {
  const dir = mkTmp();
  const fp = path.join(dir, '.planning', 'x', 'does-not-exist.md');
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0 on missing file, got ' + r.code);
  assert(!fs.existsSync(fp), 'hook created a file that did not exist');
});

// 11. A leaked closer sitting above real content is NOT stripped (only the tail)
test('closer above real trailing content is not stripped', async () => {
  const dir = mkTmp();
  const before = 'top\n</content>\nreal tail line\n';
  const fp = planningFile(dir, 'J-PLAN.md', before);
  const r = await runHook({ tool_name: 'Write', tool_input: { file_path: fp } });
  assert(r.code === 0, 'expected exit 0');
  assert(fs.readFileSync(fp, 'utf8') === before, 'mid-document closer was wrongly stripped');
});

(async () => {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('PASS: ' + t.name);
      pass++;
    } catch (err) {
      console.error('FAIL: ' + t.name);
      console.error('       ' + err.message);
      fail++;
    }
  }
  console.log('---');
  console.log(pass + ' passed, ' + fail + ' failed (out of ' + tests.length + ')');
  process.exit(fail === 0 ? 0 : 1);
})();
