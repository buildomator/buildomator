/**
 * Agent skills query handler — read configured skills from `.planning/config.json`
 * and emit the `<agent_skills>` XML block workflows interpolate into Task() prompts.
 *
 * Ports `buildAgentSkillsBlock` semantics from
 * `get-shit-done/bin/lib/init.cjs` so the SDK path honors
 * `config.agent_skills[agentType]` the same way the legacy
 * `gsd-tools.cjs agent-skills <type>` path does. Project-relative skills stay
 * project-root validated; `global:<name>` now resolves through runtime-aware
 * global skills dir policy rather than a Claude-only hardcoded path. A
 * namespaced `global:<plugin>:<skill>` entry emits a Skill-tool load-by-name
 * directive (no path resolution) so a Claude Code plugin skill can be injected.
 *
 * @example
 * ```typescript
 * import { agentSkills } from './skills.js';
 *
 * // With config.agent_skills = { "gsd-planner": [".claude/skills/demo-skill"] }
 * await agentSkills(['gsd-planner'], '/project');
 * // { data: '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/demo-skill/SKILL.md\n</agent_skills>' }
 *
 * // No agent type → empty string (matches gsd-tools cmdAgentSkills).
 * await agentSkills([], '/project');
 * // { data: '' }
 * ```
 */
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, parse, resolve, sep } from 'node:path';
import { detectRuntime, renderGlobalSkillDisplayPath, resolveGlobalSkillDir, resolveGlobalSkillsBase } from './helpers.js';
import { loadConfig } from '../config.js';
import { lookupByAgentName } from '../model-catalog.js';
const GLOBAL_SKILL_NAME_RE = /^[a-zA-Z0-9_-]+$/;
// Namespaced `<plugin>:<skill>` form: each colon-separated segment is letters, digits, "_" or "-".
const PLUGIN_SKILL_NAME_RE = /^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)+$/;
/**
 * Resolve `target` and ensure it stays inside `baseDir` after symlink resolution.
 * Mirrors the symlink-escape guard in `bin/lib/security.cjs#validatePath`.
 */
function resolveWithinBase(target, baseDir) {
    try {
        const resolvedBase = existsSync(baseDir) ? realpathSync(baseDir) : resolve(baseDir);
        const absTarget = resolve(baseDir, target);
        const resolvedTarget = existsSync(absTarget) ? realpathSync(absTarget) : absTarget;
        const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : resolvedBase + sep;
        if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(baseWithSep)) {
            return null;
        }
        return resolvedTarget;
    }
    catch {
        return null;
    }
}
/**
 * Read agent_skills_security.trusted_global_roots from a config object and
 * return the hardened list of directories a symlinked global skill may resolve
 * into. Each entry is tilde-expanded, must be absolute, is resolved to its real
 * path, and is dropped when it does not exist, when it is a filesystem/drive/UNC
 * root, or when it is the user home directory. Duplicates collapse to the first
 * occurrence. Any non-array config, missing key, or non-string entry yields an
 * empty list, so the default behaviour is unchanged.
 */
function loadTrustedGlobalRoots(config) {
    if (typeof config !== 'object' || config === null)
        return [];
    const section = config.agent_skills_security;
    if (typeof section !== 'object' || section === null)
        return [];
    const entries = section.trusted_global_roots;
    if (!Array.isArray(entries))
        return [];
    const home = homedir();
    let homeReal;
    try {
        homeReal = realpathSync(home);
    }
    catch {
        homeReal = resolve(home);
    }
    const roots = [];
    for (const entry of entries) {
        if (typeof entry !== 'string')
            continue;
        let expanded = entry;
        if (entry === '~')
            expanded = home;
        else if (entry.startsWith('~/'))
            expanded = join(home, entry.slice(2));
        if (!isAbsolute(expanded))
            continue;
        let real;
        try {
            real = realpathSync(expanded);
        }
        catch {
            continue;
        }
        const rootOf = parse(real).root;
        if (real === rootOf || real === rootOf.replace(/[\\/]+$/, ''))
            continue;
        if (real === homeReal)
            continue;
        if (!roots.includes(real))
            roots.push(real);
    }
    return roots;
}
export const agentSkills = async (args, projectDir) => {
    const agentType = (args[0] || '').trim();
    // Match gsd-tools `cmdAgentSkills`: no agent type → empty string (JSON `""`), not a structured object.
    if (!agentType) {
        return { data: '' };
    }
    let config;
    try {
        config = await loadConfig(projectDir);
    }
    catch {
        return { data: '' };
    }
    const raw = lookupByAgentName(config.agent_skills, agentType);
    if (!raw)
        return { data: '' };
    let skillPaths;
    if (typeof raw === 'string') {
        skillPaths = [raw];
    }
    else if (Array.isArray(raw)) {
        skillPaths = raw;
    }
    else {
        return { data: '' };
    }
    if (skillPaths.length === 0)
        return { data: '' };
    const runtime = detectRuntime(config);
    const globalSkillsBase = resolveGlobalSkillsBase(runtime);
    const trustedGlobalRoots = loadTrustedGlobalRoots(config);
    const validEntries = [];
    for (const entry of skillPaths) {
        if (typeof entry !== 'string')
            continue;
        // `global:<name>` — skill installed under the runtime-global skills dir (#1992, #3126).
        if (entry.startsWith('global:')) {
            const skillName = entry.slice(7);
            if (!skillName) {
                process.stderr.write('[agent-skills] WARNING: "global:" prefix with empty skill name — skipping\n');
                continue;
            }
            // A colon in the name marks the `<plugin>:<skill>` plugin-skill form: no filesystem
            // resolution, emit a Skill-tool load-by-name directive for the Claude runtime.
            if (skillName.includes(':')) {
                if (!PLUGIN_SKILL_NAME_RE.test(skillName)) {
                    process.stderr.write(`[agent-skills] WARNING: Invalid plugin skill name "${skillName}": expected <plugin>:<skill> with segments of letters, digits, "_" or "-", skipping\n`);
                    continue;
                }
                if (runtime !== 'claude') {
                    process.stderr.write(`[agent-skills] WARNING: Plugin skill "${skillName}" needs the Claude runtime (Skill tool); runtime "${runtime}" skips it\n`);
                    continue;
                }
                validEntries.push({ kind: 'plugin', ref: skillName });
                continue;
            }
            if (!GLOBAL_SKILL_NAME_RE.test(skillName)) {
                process.stderr.write(`[agent-skills] WARNING: Invalid global skill name "${skillName}" — skipping\n`);
                continue;
            }
            if (globalSkillsBase === null) {
                process.stderr.write(`[agent-skills] WARNING: Runtime "${runtime}" does not use a skills directory — "global:${skillName}" is not supported on this runtime\n`);
                continue;
            }
            const skillDir = resolveGlobalSkillDir(runtime, skillName);
            const displayPath = renderGlobalSkillDisplayPath(runtime, skillName);
            if (!skillDir) {
                process.stderr.write(`[agent-skills] WARNING: Could not resolve global skill directory for "${skillName}" on runtime "${runtime}" — skipping\n`);
                continue;
            }
            const skillMd = join(skillDir, 'SKILL.md');
            if (!existsSync(skillMd)) {
                process.stderr.write(`[agent-skills] WARNING: Global skill not found at "${displayPath}/SKILL.md" — skipping\n`);
                continue;
            }
            const withinBase = resolveWithinBase(skillMd, globalSkillsBase) !== null;
            const trustedRoot = withinBase
                ? null
                : trustedGlobalRoots.find(root => resolveWithinBase(skillMd, root) !== null);
            if (trustedRoot) {
                process.stderr.write(`[agent-skills] NOTE: Global skill "${skillName}" accepted via trusted_global_roots (resolves under ${trustedRoot})\n`);
            }
            if (!withinBase && !trustedRoot) {
                process.stderr.write(`[agent-skills] WARNING: Global skill "${skillName}" failed path check (symlink escape?) — skipping\n`);
                continue;
            }
            validEntries.push({ kind: 'path', ref: skillMd });
            continue;
        }
        // Project-relative path — must resolve within projectDir.
        if (resolveWithinBase(entry, projectDir) === null) {
            process.stderr.write(`[agent-skills] WARNING: Skipping unsafe path "${entry}"\n`);
            continue;
        }
        const skillMd = join(projectDir, entry, 'SKILL.md');
        if (!existsSync(skillMd)) {
            process.stderr.write(`[agent-skills] WARNING: Skill not found at "${entry}/SKILL.md" — skipping\n`);
            continue;
        }
        validEntries.push({ kind: 'path', ref: `${entry}/SKILL.md` });
    }
    if (validEntries.length === 0)
        return { data: '' };
    const lines = validEntries
        .map((e) => e.kind === 'plugin'
        ? `- Invoke the Skill tool with skill "${e.ref}" at agent start (plugin skill, loaded by name, not by path)`
        : `- @${e.ref}`)
        .join('\n');
    const block = `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>`;
    // Signal the CLI dispatcher to write raw text — workflows embed the result
    // with `$(gsd-sdk query agent-skills …)` and need the XML block verbatim, not
    // a JSON-quoted string (see cli.ts QueryResult.format handling).
    return { data: block, format: 'text' };
};
//# sourceMappingURL=skills.js.map