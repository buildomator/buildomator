#!/usr/bin/env node
/**
 * HANDOFF Schema Validator (SCHEMA-02)
 *
 * Generates a fresh HANDOFF.json via bin/lib/checkpoint.cjs in a tmp dir,
 * validates it against schema/handoff-v1.json using ajv, reports + exits
 * 0/1/2 per the standard maintenance-script exit convention.
 *
 * Usage (from repo root):
 *   node bin/maintenance/check-handoff-schema.cjs
 *
 * Exit codes:
 *   0 — PASS (HANDOFF.json validates against schema)
 *   1 — REGRESS (schema violation)
 *   2 — ENV ERROR (ajv missing, not at repo root, write failed, etc.)
 *
 * The validator deliberately does NOT touch the real `.planning/HANDOFF.json`
 * — it creates a fresh tmp dir, writes the HANDOFF there, validates, and
 * removes it on both success and failure paths. This keeps real session
 * state untouched.
 *
 * Context: Phase 8 of v1.2 Upstream Resilience. Pattern-matches
 * bin/maintenance/check-file-layout.cjs for structure (exit codes, env
 * guard, 'use strict').
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Env guard: must run from repo root
if (!fs.existsSync('.git') || !fs.existsSync('bin/lib/checkpoint.cjs') || !fs.existsSync('schema/handoff-v1.json')) {
  console.error('error: run from repo root (expected .git/, bin/lib/checkpoint.cjs, schema/handoff-v1.json)');
  process.exit(2);
}

let Ajv, addFormats;
try {
  Ajv = require('ajv');
  addFormats = require('ajv-formats');
} catch (err) {
  console.error('error: ajv and/or ajv-formats not installed. Run: npm install --include=dev');
  process.exit(2);
}

const { writeCheckpoint, deleteCheckpoint } = require(path.resolve('bin/lib/checkpoint.cjs'));

function main() {
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-schema-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    // Minimal STATE.md — checkpoint.cjs reads this for phase context
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: test\n---\n\nPhase: 8 - HANDOFF Schema Baseline and Detector\nPlan: 01\nStatus: Testing schema validator\n',
      'utf-8'
    );

    const data = writeCheckpoint(tmpDir, { source: 'manual-pause' });
    if (!data || data.partial) {
      console.error('warn: writeCheckpoint returned partial data — schema check will still run but coverage is incomplete');
    }

    const handoffPath = path.join(tmpDir, '.planning', 'HANDOFF.json');
    if (!fs.existsSync(handoffPath)) {
      console.error('error: writeCheckpoint did not produce HANDOFF.json at', handoffPath);
      process.exit(2);
    }
    const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf-8'));

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const schema = JSON.parse(fs.readFileSync('schema/handoff-v1.json', 'utf-8'));
    const validate = ajv.compile(schema);

    console.log('HANDOFF Schema Validator');
    console.log('========================');
    console.log('');
    console.log('Generated HANDOFF.json at:', handoffPath);
    console.log('Fields present:', Object.keys(handoff).length);

    const requiredFields = schema.required || [];
    const missingRequired = requiredFields.filter((f) => !(f in handoff));
    const optionalFields = Object.keys(schema.properties || {}).filter((f) => !requiredFields.includes(f));
    const optionalPresent = optionalFields.filter((f) => f in handoff);
    console.log(`Required fields: ${requiredFields.length - missingRequired.length}/${requiredFields.length} present`);
    console.log(`Optional fields: ${optionalPresent.length}/${optionalFields.length} present (source, partial)`);

    if (validate(handoff)) {
      console.log('');
      console.log('Status: PASS — HANDOFF.json validates against schema/handoff-v1.json');
      process.exit(0);
    } else {
      console.log('');
      console.log('Status: FAIL — HANDOFF.json fails schema validation');
      console.log('Errors:');
      for (const err of validate.errors || []) {
        console.log(`  ${err.instancePath || '(root)'}: ${err.message}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error('error:', err && err.message ? err.message : err);
    process.exit(2);
  } finally {
    // Clean up tmp dir — best effort
    if (tmpDir) {
      try {
        deleteCheckpoint(tmpDir);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
}

main();
