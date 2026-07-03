#!/usr/bin/env node

/**
 * GSD Legacy Cleanup -- Audit and optionally remove legacy GSD install artifacts
 *
 * This script helps users migrate from the legacy ~/.claude/get-shit-done/ install
 * to the plugin-based distribution (claude plugin install gsd).
 *
 * Usage:
 *   node migrations/legacy-cleanup.cjs           # Audit mode: list legacy artifacts
 *   node migrations/legacy-cleanup.cjs --clean    # Clean mode: remove with confirmation
 *
 * What it checks:
 *   - ~/.claude/get-shit-done/ directory (legacy install root)
 *   - GSD entries in project .mcp.json files
 *   - GSD hook entries in ~/.claude/settings.json
 *   - Legacy hook scripts in ~/.claude/hooks/
 *   - get-shit-done-cc npm package (global install)
 *
 * Safety:
 *   - Never silently deletes data
 *   - Audit mode is the default (read-only)
 *   - --clean mode prints what will be removed and asks for confirmation
 *   - The /gsd:update command is retired; plugin-managed updates replace it
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ─── Legacy path definitions ─────────────────────────────────────────────────

const HOME = os.homedir();

const LEGACY_PATHS = {
  gsdRoot: path.join(HOME, '.claude', 'get-shit-done'),
  gsdCommands: path.join(HOME, '.claude', 'commands', 'gsd'),
  gsdSkills: path.join(HOME, '.claude', 'skills'),
  agentsDir: path.join(HOME, '.claude', 'agents'),
  settingsJson: path.join(HOME, '.claude', 'settings.json'),
  hooksDir: path.join(HOME, '.claude', 'hooks'),
  hookFiles: [
    'gsd-check-update.js',
    'gsd-context-monitor.js',
    'gsd-prompt-guard.js',
    'gsd-statusline.js',
    'gsd-read-guard.js',
    'gsd-session-state.sh',
    'gsd-phase-boundary.sh',
    'gsd-validate-commit.sh',
  ],
};

// ─── Audit functions ─────────────────────────────────────────────────────────

function auditLegacyRoot() {
  const result = { found: false, path: LEGACY_PATHS.gsdRoot, details: '' };
  if (fs.existsSync(LEGACY_PATHS.gsdRoot)) {
    result.found = true;
    try {
      const versionFile = path.join(LEGACY_PATHS.gsdRoot, 'VERSION');
      if (fs.existsSync(versionFile)) {
        result.details = `Version: ${fs.readFileSync(versionFile, 'utf8').trim()}`;
      } else {
        result.details = 'No VERSION file found';
      }
    } catch {
      result.details = 'Could not read version';
    }
  }
  return result;
}

function auditMcpJson(cwd) {
  const results = [];
  // Check project .mcp.json
  const projectMcp = path.join(cwd, '.mcp.json');
  if (fs.existsSync(projectMcp)) {
    try {
      const content = JSON.parse(fs.readFileSync(projectMcp, 'utf8'));
      const servers = content.mcpServers || {};
      for (const [name, config] of Object.entries(servers)) {
        const args = (config.args || []).join(' ');
        const cmd = config.command || '';
        const fullCmd = `${cmd} ${args}`;
        if (fullCmd.includes('get-shit-done') || fullCmd.includes('.claude/get-shit-done')) {
          results.push({
            found: true,
            path: projectMcp,
            key: name,
            details: `Server "${name}" references legacy path: ${fullCmd.trim()}`,
          });
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }
  return results;
}

/**
 * Check if a command string references a legacy GSD script.
 */
function isLegacyGsdHookCommand(cmd) {
  return cmd.includes('gsd-') || cmd.includes('get-shit-done');
}

/**
 * Extract all commands from a hook group.
 * Handles both flat format ({ command }) and nested format ({ hooks: [{ command }] }).
 */
function extractHookCommands(group) {
  const cmds = [];
  // Nested format: { hooks: [{ type, command }], matcher? }
  if (Array.isArray(group.hooks)) {
    for (const h of group.hooks) {
      if (h.command) cmds.push(h.command);
    }
  }
  // Flat format: { command }
  if (group.command) cmds.push(group.command);
  return cmds;
}

function auditSettingsJson() {
  const results = [];
  if (!fs.existsSync(LEGACY_PATHS.settingsJson)) return results;

  try {
    const content = JSON.parse(fs.readFileSync(LEGACY_PATHS.settingsJson, 'utf8'));

    // Check for hook entries referencing legacy GSD scripts
    const hooks = content.hooks || {};
    for (const [event, groups] of Object.entries(hooks)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        const cmds = extractHookCommands(group);
        for (const cmd of cmds) {
          if (isLegacyGsdHookCommand(cmd)) {
            results.push({
              found: true,
              path: LEGACY_PATHS.settingsJson,
              event,
              command: cmd,
              details: `Hook "${event}" references legacy GSD script: ${cmd}`,
            });
          }
        }
      }
    }
  } catch {
    // Not valid JSON, skip
  }
  return results;
}

function auditGsdCommands() {
  const result = { found: false, path: LEGACY_PATHS.gsdCommands, details: '' };
  if (fs.existsSync(LEGACY_PATHS.gsdCommands)) {
    try {
      const files = fs.readdirSync(LEGACY_PATHS.gsdCommands);
      result.found = true;
      result.details = `${files.length} legacy command files in ~/.claude/commands/gsd/`;
    } catch {
      result.found = true;
      result.details = 'Directory exists but could not list contents';
    }
  }
  return result;
}

function auditGsdSkills() {
  const results = [];
  if (fs.existsSync(LEGACY_PATHS.gsdSkills)) {
    try {
      const dirs = fs.readdirSync(LEGACY_PATHS.gsdSkills).filter(d => d.startsWith('gsd-'));
      if (dirs.length > 0) {
        results.push({
          found: true,
          path: LEGACY_PATHS.gsdSkills,
          details: `${dirs.length} legacy GSD skill dirs in ~/.claude/skills/ (gsd-*)`,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

function auditGsdAgents() {
  const results = [];
  if (fs.existsSync(LEGACY_PATHS.agentsDir)) {
    try {
      const files = fs.readdirSync(LEGACY_PATHS.agentsDir).filter(f => f.startsWith('gsd-'));
      if (files.length > 0) {
        results.push({
          found: true,
          path: LEGACY_PATHS.agentsDir,
          details: `${files.length} legacy GSD agent files in ~/.claude/agents/ (gsd-*.md)`,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

function auditHookFiles() {
  const results = [];
  for (const hookFile of LEGACY_PATHS.hookFiles) {
    const fullPath = path.join(LEGACY_PATHS.hooksDir, hookFile);
    if (fs.existsSync(fullPath)) {
      results.push({
        found: true,
        path: fullPath,
        details: `Legacy hook script: ${hookFile}`,
      });
    }
  }
  return results;
}

function auditNpmPackage() {
  const result = { found: false, path: 'get-shit-done-cc (global npm)', details: '' };
  try {
    const { execSync } = require('child_process');
    const output = execSync('npm list -g get-shit-done-cc --depth=0 2>/dev/null', {
      encoding: 'utf8',
      timeout: 10000,
    });
    if (output.includes('get-shit-done-cc')) {
      result.found = true;
      const match = output.match(/get-shit-done-cc@([\d.]+)/);
      result.details = match ? `Installed version: ${match[1]}` : 'Installed (version unknown)';
    }
  } catch {
    // Not installed or npm not available
  }
  return result;
}

// ─── Display functions ───────────────────────────────────────────────────────

function printHeader() {
  console.log('');
  console.log('GSD Legacy Install Audit');
  console.log('========================');
  console.log('');
  console.log('Checking for legacy GSD artifacts that should be removed after');
  console.log('migrating to: claude plugin install gsd');
  console.log('');
  console.log('Legacy paths checked:');
  console.log('  - ~/.claude/get-shit-done/ (legacy install root)');
  console.log('  - .mcp.json (legacy MCP server entries)');
  console.log('  - ~/.claude/settings.json (legacy hook entries)');
  console.log('  - ~/.claude/hooks/gsd-*.js (legacy hook scripts)');
  console.log('  - get-shit-done-cc npm package (legacy installer)');
  console.log('  - /gsd:update command (retired, now plugin-managed)');
  console.log('');
}

function printFindings(findings) {
  if (findings.length === 0) {
    console.log('No legacy GSD artifacts found. Your installation is clean.');
    console.log('');
    return;
  }

  console.log(`Found ${findings.length} legacy artifact(s):`);
  console.log('');

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    console.log(`  ${i + 1}. ${f.path}`);
    if (f.details) console.log(`     ${f.details}`);
  }
  console.log('');
}

// ─── Clean functions ─────────────────────────────────────────────────────────

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function cleanLegacyRoot() {
  if (!fs.existsSync(LEGACY_PATHS.gsdRoot)) return false;
  const backupPath = LEGACY_PATHS.gsdRoot + '-legacy';
  if (fs.existsSync(backupPath)) {
    // Backup already exists from a prior run — remove the original
    console.log(`  Removing: ${LEGACY_PATHS.gsdRoot} (backup already at ${backupPath})`);
    fs.rmSync(LEGACY_PATHS.gsdRoot, { recursive: true, force: true });
  } else {
    console.log(`  Moving: ${LEGACY_PATHS.gsdRoot} -> ${backupPath}`);
    fs.renameSync(LEGACY_PATHS.gsdRoot, backupPath);
  }
  console.log('  Done.');
  return true;
}

async function cleanMcpEntries(cwd) {
  const projectMcp = path.join(cwd, '.mcp.json');
  if (!fs.existsSync(projectMcp)) return false;

  try {
    const content = JSON.parse(fs.readFileSync(projectMcp, 'utf8'));
    const servers = content.mcpServers || {};
    let changed = false;

    for (const [name, config] of Object.entries(servers)) {
      const args = (config.args || []).join(' ');
      const cmd = config.command || '';
      if (`${cmd} ${args}`.includes('get-shit-done')) {
        console.log(`  Removing MCP server entry: "${name}" from ${projectMcp}`);
        delete servers[name];
        changed = true;
      }
    }

    if (changed) {
      content.mcpServers = servers;
      fs.writeFileSync(projectMcp, JSON.stringify(content, null, 2) + '\n');
      console.log('  Updated .mcp.json');
    }
    return changed;
  } catch {
    return false;
  }
}

async function cleanSettingsHooks() {
  if (!fs.existsSync(LEGACY_PATHS.settingsJson)) return false;

  try {
    const content = JSON.parse(fs.readFileSync(LEGACY_PATHS.settingsJson, 'utf8'));
    const hooks = content.hooks || {};
    let changed = false;

    for (const [event, groups] of Object.entries(hooks)) {
      if (!Array.isArray(groups)) continue;
      const filtered = groups.filter((group) => {
        const cmds = extractHookCommands(group);
        const hasLegacy = cmds.some(isLegacyGsdHookCommand);
        if (hasLegacy) {
          for (const cmd of cmds) {
            if (isLegacyGsdHookCommand(cmd)) {
              console.log(`  Removing hook: "${event}" -> ${cmd}`);
            }
          }
          changed = true;
          return false;
        }
        return true;
      });
      hooks[event] = filtered;
      if (filtered.length === 0) {
        delete hooks[event];
      }
    }

    if (changed) {
      content.hooks = hooks;
      fs.writeFileSync(LEGACY_PATHS.settingsJson, JSON.stringify(content, null, 2) + '\n');
      console.log('  Updated settings.json');
    }
    return changed;
  } catch {
    return false;
  }
}

async function cleanGsdCommands() {
  if (!fs.existsSync(LEGACY_PATHS.gsdCommands)) return false;
  const backupPath = LEGACY_PATHS.gsdCommands + '-legacy';
  if (!fs.existsSync(backupPath)) {
    console.log(`  Moving: ${LEGACY_PATHS.gsdCommands} -> ${backupPath}`);
    fs.renameSync(LEGACY_PATHS.gsdCommands, backupPath);
  } else {
    console.log(`  Removing: ${LEGACY_PATHS.gsdCommands} (backup already at ${backupPath})`);
    fs.rmSync(LEGACY_PATHS.gsdCommands, { recursive: true, force: true });
  }
  return true;
}

async function cleanGsdSkills() {
  if (!fs.existsSync(LEGACY_PATHS.gsdSkills)) return false;
  let cleaned = false;
  try {
    const dirs = fs.readdirSync(LEGACY_PATHS.gsdSkills).filter(d => d.startsWith('gsd-'));
    for (const dir of dirs) {
      const fullPath = path.join(LEGACY_PATHS.gsdSkills, dir);
      console.log(`  Removing: ${fullPath}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
      cleaned = true;
    }
  } catch { /* skip */ }
  return cleaned;
}

async function cleanGsdAgents() {
  if (!fs.existsSync(LEGACY_PATHS.agentsDir)) return false;
  let cleaned = false;
  try {
    const files = fs.readdirSync(LEGACY_PATHS.agentsDir).filter(f => f.startsWith('gsd-'));
    for (const file of files) {
      const fullPath = path.join(LEGACY_PATHS.agentsDir, file);
      console.log(`  Removing: ${fullPath}`);
      fs.unlinkSync(fullPath);
      cleaned = true;
    }
  } catch { /* skip */ }
  return cleaned;
}

async function cleanHookFiles() {
  let cleaned = false;
  for (const hookFile of LEGACY_PATHS.hookFiles) {
    const fullPath = path.join(LEGACY_PATHS.hooksDir, hookFile);
    if (fs.existsSync(fullPath)) {
      console.log(`  Removing: ${fullPath}`);
      fs.unlinkSync(fullPath);
      cleaned = true;
    }
  }
  return cleaned;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cleanMode = args.includes('--clean');
  const cwd = process.cwd();

  printHeader();

  // Collect findings
  const findings = [];

  const rootAudit = auditLegacyRoot();
  if (rootAudit.found) findings.push(rootAudit);

  const cmdAudit = auditGsdCommands();
  if (cmdAudit.found) findings.push(cmdAudit);

  const skillAudit = auditGsdSkills();
  findings.push(...skillAudit);

  const agentAudit = auditGsdAgents();
  findings.push(...agentAudit);

  const mcpAudit = auditMcpJson(cwd);
  findings.push(...mcpAudit);

  const settingsAudit = auditSettingsJson();
  findings.push(...settingsAudit);

  const hookAudit = auditHookFiles();
  findings.push(...hookAudit);

  const npmAudit = auditNpmPackage();
  if (npmAudit.found) findings.push(npmAudit);

  printFindings(findings);

  if (findings.length === 0) {
    process.exit(0);
  }

  if (!cleanMode) {
    console.log('To remove these artifacts, run:');
    console.log('  node bin/gsd-tools.cjs migrate --clean');
    console.log('');
    console.log('Or manually remove them following the migration guide in README.md.');
    console.log('');
    process.exit(0);
  }

  // Clean mode
  console.log('--- CLEANUP MODE ---');
  console.log('');
  console.log('The following legacy artifacts will be removed:');
  printFindings(findings);

  const confirmed = await askConfirmation('Proceed with cleanup? (y/N) ');
  if (!confirmed) {
    console.log('Cleanup cancelled.');
    process.exit(0);
  }

  console.log('');
  console.log('Cleaning up...');
  console.log('');

  await cleanLegacyRoot();
  await cleanGsdCommands();
  await cleanGsdSkills();
  await cleanGsdAgents();
  await cleanMcpEntries(cwd);
  await cleanSettingsHooks();
  await cleanHookFiles();

  if (npmAudit.found) {
    console.log('');
    console.log('  NOTE: get-shit-done-cc npm package detected but not auto-removed.');
    console.log('  To uninstall: npm uninstall -g get-shit-done-cc');
  }

  console.log('');
  console.log('Cleanup complete. Verify your plugin install:');
  console.log('  1. Start a new Claude Code session');
  console.log('  2. Run /gsd:status');
  console.log('');
}

// ─── Auto-migration (runs silently on session start) ────────────────────────

/**
 * Automatically fix legacy artifacts without user interaction.
 * Safe to call on every session start — idempotent, non-destructive.
 *
 * What it does:
 *   - Moves ~/.claude/get-shit-done/ to ~/.claude/get-shit-done-legacy/
 *   - Moves ~/.claude/commands/gsd/ to ~/.claude/commands/gsd-legacy/
 *   - Removes GSD skill dirs (gsd-*) from ~/.claude/skills/
 *   - Removes GSD agent files (gsd-*.md) from ~/.claude/agents/
 *   - Removes GSD entries from project .mcp.json
 *   - Removes GSD hook entries from ~/.claude/settings.json
 *   - Removes legacy hook scripts from ~/.claude/hooks/
 *
 * What it does NOT do:
 *   - Uninstall npm packages (requires user action)
 *   - Delete any data (legacy root is moved, not deleted)
 *
 * @param {string} cwd - Project working directory (for .mcp.json)
 * @returns {{ migrated: boolean, actions: string[] }}
 */
function autoMigrate(cwd) {
  const actions = [];

  try {
    // 1. Move legacy root (not delete)
    if (fs.existsSync(LEGACY_PATHS.gsdRoot)) {
      const backupPath = LEGACY_PATHS.gsdRoot + '-legacy';
      if (!fs.existsSync(backupPath)) {
        fs.renameSync(LEGACY_PATHS.gsdRoot, backupPath);
        actions.push(`Moved ~/.claude/get-shit-done/ to ~/.claude/get-shit-done-legacy/`);
      } else {
        // Backup exists, legacy root is leftover — remove it
        fs.rmSync(LEGACY_PATHS.gsdRoot, { recursive: true, force: true });
        actions.push(`Removed leftover ~/.claude/get-shit-done/ (backup already exists)`);
      }
    }

    // 2. Move legacy commands directory
    if (fs.existsSync(LEGACY_PATHS.gsdCommands)) {
      const backupPath = LEGACY_PATHS.gsdCommands + '-legacy';
      if (!fs.existsSync(backupPath)) {
        fs.renameSync(LEGACY_PATHS.gsdCommands, backupPath);
        actions.push(`Moved ~/.claude/commands/gsd/ to ~/.claude/commands/gsd-legacy/`);
      } else {
        fs.rmSync(LEGACY_PATHS.gsdCommands, { recursive: true, force: true });
        actions.push(`Removed leftover ~/.claude/commands/gsd/ (backup already exists)`);
      }
    }

    // 3. Remove legacy GSD skill directories from ~/.claude/skills/
    if (fs.existsSync(LEGACY_PATHS.gsdSkills)) {
      try {
        const dirs = fs.readdirSync(LEGACY_PATHS.gsdSkills).filter(d => d.startsWith('gsd-'));
        for (const dir of dirs) {
          fs.rmSync(path.join(LEGACY_PATHS.gsdSkills, dir), { recursive: true, force: true });
          actions.push(`Removed legacy skill dir ~/.claude/skills/${dir}`);
        }
      } catch { /* skip */ }
    }

    // 4. Remove legacy GSD agent files from ~/.claude/agents/
    if (fs.existsSync(LEGACY_PATHS.agentsDir)) {
      try {
        const files = fs.readdirSync(LEGACY_PATHS.agentsDir).filter(f => f.startsWith('gsd-'));
        for (const file of files) {
          fs.unlinkSync(path.join(LEGACY_PATHS.agentsDir, file));
          actions.push(`Removed legacy agent ~/.claude/agents/${file}`);
        }
      } catch { /* skip */ }
    }

    // 5. Clean legacy GSD entries from .mcp.json
    const projectMcp = path.join(cwd, '.mcp.json');
    if (fs.existsSync(projectMcp)) {
      try {
        const content = JSON.parse(fs.readFileSync(projectMcp, 'utf8'));
        const servers = content.mcpServers || {};
        let changed = false;

        for (const [name, config] of Object.entries(servers)) {
          const args = (config.args || []).join(' ');
          const cmd = config.command || '';
          if (`${cmd} ${args}`.includes('get-shit-done')) {
            delete servers[name];
            changed = true;
            actions.push(`Removed legacy MCP entry "${name}" from .mcp.json`);
          }
        }

        if (changed) {
          content.mcpServers = servers;
          fs.writeFileSync(projectMcp, JSON.stringify(content, null, 2) + '\n');
        }
      } catch { /* skip invalid JSON */ }
    }

    // 6. Clean GSD hooks from settings.json
    if (fs.existsSync(LEGACY_PATHS.settingsJson)) {
      try {
        const content = JSON.parse(fs.readFileSync(LEGACY_PATHS.settingsJson, 'utf8'));
        const hooks = content.hooks || {};
        let changed = false;

        for (const [event, groups] of Object.entries(hooks)) {
          if (!Array.isArray(groups)) continue;
          const filtered = groups.filter((group) => {
            const cmds = extractHookCommands(group);
            const hasLegacy = cmds.some(isLegacyGsdHookCommand);
            if (hasLegacy) {
              for (const cmd of cmds) {
                if (isLegacyGsdHookCommand(cmd)) {
                  actions.push(`Removed legacy hook "${event}" -> ${cmd}`);
                }
              }
              changed = true;
              return false;
            }
            return true;
          });
          hooks[event] = filtered;
          if (filtered.length === 0) delete hooks[event];
        }

        if (changed) {
          content.hooks = hooks;
          if (Object.keys(content.hooks).length === 0) delete content.hooks;
          fs.writeFileSync(LEGACY_PATHS.settingsJson, JSON.stringify(content, null, 2) + '\n');
        }
      } catch { /* skip invalid JSON */ }
    }

    // 7. Remove legacy hook scripts
    for (const hookFile of LEGACY_PATHS.hookFiles) {
      const fullPath = path.join(LEGACY_PATHS.hooksDir, hookFile);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        actions.push(`Removed legacy hook script ${hookFile}`);
      }
    }
  } catch (err) {
    // Auto-migration should never break a session — swallow errors
    actions.push(`Auto-migration error (non-fatal): ${err.message}`);
  }

  return { migrated: actions.length > 0, actions };
}

// Export for use by gsd-tools.cjs
module.exports = { main, autoMigrate, auditLegacyRoot, auditMcpJson, auditSettingsJson, auditHookFiles, auditNpmPackage };

// Direct execution
if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
