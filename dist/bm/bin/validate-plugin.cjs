#!/usr/bin/env node
/**
 * Validate a GSD plugin manifest against the PluginManifest schema.
 *
 * Usage: node bin/validate-plugin.cjs .claude-plugin/plugin.json
 *
 * Reads the JSON file, parses it through the same Zod schema that Claude Code
 * uses at plugin-load time, and reports errors or success.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node bin/validate-plugin.cjs <path-to-plugin.json>');
  process.exit(1);
}

const absolute = path.resolve(manifestPath);
if (!fs.existsSync(absolute)) {
  console.error(`File not found: ${absolute}`);
  process.exit(1);
}

let manifest;
try {
  const raw = fs.readFileSync(absolute, 'utf-8');
  manifest = JSON.parse(raw);
} catch (err) {
  console.error(`Failed to parse JSON: ${err.message}`);
  process.exit(1);
}

// --- Required field checks (mirrors PluginManifestSchema) ---
const errors = [];

if (typeof manifest.name !== 'string' || !manifest.name) {
  errors.push('Missing or empty "name" field');
}

if (manifest.name && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(manifest.name)) {
  errors.push(`"name" must be kebab-case: got "${manifest.name}"`);
}

if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
  errors.push(`"version" should be semver: got "${manifest.version}"`);
}

// MCP servers validation
if (manifest.mcpServers) {
  if (typeof manifest.mcpServers === 'object' && !Array.isArray(manifest.mcpServers)) {
    for (const [name, cfg] of Object.entries(manifest.mcpServers)) {
      if (!cfg.command) {
        errors.push(`mcpServers.${name}: missing "command"`);
      }
    }
  }
}

// Check referenced paths exist relative to the manifest directory
const pluginRoot = path.dirname(path.dirname(absolute)); // .claude-plugin/plugin.json -> repo root
const expectedDirs = ['bin'];
const warnings = [];
const optionalDirs = ['mcp', 'skills', 'agents', 'hooks', 'templates', 'references'];
for (const dir of expectedDirs) {
  const dirPath = path.join(pluginRoot, dir);
  if (!fs.existsSync(dirPath)) {
    errors.push(`Required directory "${dir}/" not found at ${dirPath}`);
  }
}
for (const dir of optionalDirs) {
  const dirPath = path.join(pluginRoot, dir);
  if (!fs.existsSync(dirPath)) {
    warnings.push(`Optional directory "${dir}/" not yet present`);
  }
}

if (errors.length > 0) {
  console.error('Plugin manifest validation FAILED:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(`Plugin manifest valid: ${manifest.name}@${manifest.version || 'unversioned'}`);
console.log(`  MCP servers: ${manifest.mcpServers ? Object.keys(manifest.mcpServers).join(', ') : 'none'}`);
console.log(`  Description: ${manifest.description || '(none)'}`);
process.exit(0);
