'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_PATH = ['.agents', 'agents.workspace.json'];
const LEGACY_PATH = ['agents.workspace.json'];

const FRAGILITY_THRESHOLD = 0.7;
const FRAMEWORK_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_MAX_FILES = 5;
const MAX_FILES_CONFIG_KEY = 'gsd.workspace_json_max_files';

const SUPPORTED_VERSIONS = ['0.1', '1.0'];

// Returns null if absent, malformed, or unreadable — never throws.
function readWorkspaceJson(cwd) {
  const canonicalFilePath = path.join(cwd, ...CANONICAL_PATH);
  const legacyFilePath = path.join(cwd, ...LEGACY_PATH);

  let filePath = null;
  if (fs.existsSync(canonicalFilePath)) {
    filePath = canonicalFilePath;
  } else if (fs.existsSync(legacyFilePath)) {
    filePath = legacyFilePath;
  }

  if (!filePath) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (parsed.version && !SUPPORTED_VERSIONS.some(v => String(parsed.version).startsWith(v))) {
      process.stderr.write(
        `GSD: workspace.json version ${parsed.version} is newer than supported. ` +
        `Reading what we can. Consider upgrading gsd-plugin.\n`
      );
    }

    return parsed;
  } catch (err) {
    process.stderr.write(
      `GSD: workspace.json present but unreadable. Skipping. (${err.message})\n`
    );
    return null;
  }
}

// Scoped to generated + manual.fragileFiles + manual.coChangePatterns per issue #5.
function buildContextString(workspaceJson, options) {
  if (!workspaceJson) return '';

  const maxFiles = (options && options.maxFiles) || DEFAULT_MAX_FILES;
  const sections = [];

  const generated = workspaceJson.generated;
  if (generated) {
    const parts = [];

    if (generated.frameworkManifest && Array.isArray(generated.frameworkManifest)) {
      const frameworks = generated.frameworkManifest
        .filter(f => f.confidence === undefined || f.confidence >= FRAMEWORK_CONFIDENCE_THRESHOLD)
        .map(f => `${f.name}@${f.version || 'unknown'}`)
        .join(', ');
      if (frameworks) {
        parts.push(`Detected stack: ${frameworks}.`);
      }
    }

    if (generated.fileIndex && typeof generated.fileIndex === 'object') {
      const fragileFromIndex = Object.entries(generated.fileIndex)
        .filter(([, data]) => data && data.fragility !== undefined && data.fragility >= FRAGILITY_THRESHOLD)
        .sort((a, b) => (b[1].fragility || 0) - (a[1].fragility || 0))
        .slice(0, maxFiles);

      if (fragileFromIndex.length > 0) {
        const list = fragileFromIndex
          .map(([file, data]) => {
            const score = (data.fragility || 0).toFixed(2);
            const aiCount = data.aiModificationCount || 0;
            const humanCount = data.humanModificationCount || 0;
            return `${file} (fragility ${score}, ${aiCount} AI / ${humanCount} human modifications)`;
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
  if (manual && Array.isArray(manual.fragileFiles) && manual.fragileFiles.length > 0) {
    const list = manual.fragileFiles
      .map(f => {
        if (f && typeof f === 'object' && f.path && f.reason) {
          return `${f.path} (${f.reason})`;
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');
    if (list) {
      sections.push(`Human-flagged fragile files: ${list}.`);
    }
  }

  if (manual && Array.isArray(manual.coChangePatterns) && manual.coChangePatterns.length > 0) {
    const list = manual.coChangePatterns
      .map(p => {
        if (p && Array.isArray(p.files) && p.files.length > 0) {
          const filesPart = p.files.join(' ↔ ');
          return p.note ? `${filesPart} (${p.note})` : filesPart;
        }
        return null;
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
  LEGACY_PATH,
  FRAGILITY_THRESHOLD,
  DEFAULT_MAX_FILES,
  MAX_FILES_CONFIG_KEY,
};
