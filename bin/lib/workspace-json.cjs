'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH     = ['.agents', 'workspace.json'];
const LEGACY_AGENTS_PATH = ['.agents', 'agents.workspace.json'];
const LEGACY_PATH        = ['agents.workspace.json'];

const FRAGILITY_THRESHOLD = 0.7;
const FRAMEWORK_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_MAX_FILES = 5;
const MAX_FILES_CONFIG_KEY = 'gsd.workspace_json_max_files';

const SUPPORTED_VERSIONS = ['0.1'];

// DoS guards — cap input sizes before materialising arrays in memory.
const MAX_INDEX_ENTRIES = 10000;
const MAX_MANIFEST_ENTRIES = 100;
const MAX_FRAGILE_FILES = 500;
const MAX_CO_CHANGE_PATTERNS = 200;

// Returns null if absent, malformed, or unreadable — never throws.
function readWorkspaceJson(cwd) {
  for (const segments of [CANONICAL_PATH, LEGACY_AGENTS_PATH, LEGACY_PATH]) {
    const filePath = path.join(cwd, ...segments);
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      process.stderr.write(`GSD: workspace.json at ${filePath} could not be read (${e.code || e.message}). Skipping.\n`);
      return null;
    }

    try {
      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        process.stderr.write('GSD: workspace.json is not a JSON object. Skipping.\n');
        return null;
      }

      if (parsed.version) {
        const fileMajor = String(parsed.version).split('.')[0];
        const supportedMajors = SUPPORTED_VERSIONS.map(v => v.split('.')[0]);
        if (!supportedMajors.includes(fileMajor)) {
          process.stderr.write(
            `GSD: workspace.json requires version ${String(parsed.version)} ` +
            `but this plugin supports ${SUPPORTED_VERSIONS.join(', ')}. ` +
            `Update gsd-plugin or regenerate your workspace.json.\n`
          );
          return null;
        }
      }

      return parsed;
    } catch (err) {
      process.stderr.write(`GSD: workspace.json at ${filePath} is not valid JSON. Skipping. (${err.message})\n`);
      return null;
    }
  }

  return null;
}

// Scoped to generated + manual.fragileFiles + manual.coChangePatterns per issue #5.
function buildContextString(workspaceJson, options) {
  if (!workspaceJson) return '';

  const { sanitizeForPrompt } = require('./security.cjs');

  const rawMax = options && options.maxFiles;
  const maxFiles = (typeof rawMax === 'number' && rawMax >= 0) ? rawMax : DEFAULT_MAX_FILES;
  const sections = [];

  const generated = workspaceJson.generated;
  if (generated && typeof generated === 'object') {
    const parts = [];

    if (Array.isArray(generated.frameworkManifest)) {
      const frameworks = generated.frameworkManifest
        .slice(0, MAX_MANIFEST_ENTRIES)
        .filter(f => f && typeof f.name === 'string' && (f.confidence == null || f.confidence >= FRAMEWORK_CONFIDENCE_THRESHOLD))
        .map(f => {
          const name = sanitizeForPrompt(f.name);
          const version = typeof f.version === 'string' ? sanitizeForPrompt(f.version) : 'unknown';
          return `${name}@${version}`;
        })
        .join(', ');
      if (frameworks) {
        parts.push(`Detected stack: ${frameworks}.`);
      }
    }

    if (generated.fileIndex && typeof generated.fileIndex === 'object' && !Array.isArray(generated.fileIndex)) {
      const allEntries = Object.entries(generated.fileIndex);
      if (allEntries.length > MAX_INDEX_ENTRIES) {
        process.stderr.write(`GSD: workspace.json fileIndex has ${allEntries.length} entries; processing first ${MAX_INDEX_ENTRIES}.\n`);
      }
      const fragileFromIndex = allEntries
        .slice(0, MAX_INDEX_ENTRIES)
        .filter(([, data]) => data && typeof data.fragility === 'number' && data.fragility >= FRAGILITY_THRESHOLD)
        .sort((a, b) => b[1].fragility - a[1].fragility)
        .slice(0, maxFiles);

      if (fragileFromIndex.length > 0) {
        const list = fragileFromIndex
          .map(([file, data]) => {
            const score = data.fragility.toFixed(2);
            const aiCount = data.aiModificationCount || 0;
            const humanCount = data.humanModificationCount || 0;
            return `${sanitizeForPrompt(file)} (fragility ${score}, ${aiCount} AI / ${humanCount} human modifications)`;
          })
          .join('; ');
        parts.push(`Empirically fragile files: ${list}.`);
      }
    }

    if (parts.length > 0) {
      sections.push(parts.join(' '));
    }
  }

  const manual = workspaceJson.manual;
  if (manual && typeof manual === 'object' && Array.isArray(manual.fragileFiles) && manual.fragileFiles.length > 0) {
    const list = manual.fragileFiles
      .slice(0, MAX_FRAGILE_FILES)
      .map(f => {
        if (f && typeof f === 'object' && typeof f.path === 'string' && typeof f.reason === 'string') {
          return `${sanitizeForPrompt(f.path)} (${sanitizeForPrompt(f.reason)})`;
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');
    if (list) {
      sections.push(`Human-flagged fragile files: ${list}.`);
    }
  }

  if (manual && typeof manual === 'object' && Array.isArray(manual.coChangePatterns) && manual.coChangePatterns.length > 0) {
    const list = manual.coChangePatterns
      .slice(0, MAX_CO_CHANGE_PATTERNS)
      .map(p => {
        if (!p || !Array.isArray(p.files)) return null;
        const stringFiles = p.files.filter(x => typeof x === 'string').map(x => sanitizeForPrompt(x));
        if (stringFiles.length === 0) return null;
        const filesPart = stringFiles.join(' ↔ ');
        const note = typeof p.note === 'string' && p.note ? sanitizeForPrompt(p.note) : null;
        return note ? `${filesPart} (${note})` : filesPart;
      })
      .filter(Boolean)
      .join('; ');
    if (list) {
      sections.push(`Files that historically change together: ${list}.`);
    }
  }

  if (sections.length === 0) return '';

  return [
    'Codebase intelligence (workspace.json):',
    sections.join(' '),
    'Treat fragile files with extra care; historical regression rate is elevated.'
  ].join(' ');
}

module.exports = {
  readWorkspaceJson,
  buildContextString,
  CANONICAL_PATH,
  LEGACY_AGENTS_PATH,
  LEGACY_PATH,
  FRAGILITY_THRESHOLD,
  DEFAULT_MAX_FILES,
  MAX_FILES_CONFIG_KEY,
};
