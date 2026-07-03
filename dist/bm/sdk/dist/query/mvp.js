/**
 * MVP-mode query handlers — three centralized seams for the MVP umbrella feature (#2826).
 *
 * Replaces three architectural duplications surfaced by the v1.50.0-canary.2 review:
 *
 * 1. **`phase.mvp-mode`** — resolves the precedence chain
 *    `--mvp` CLI flag → ROADMAP `**Mode:** mvp` → `workflow.mvp_mode` config → false.
 *    Replaces near-identical bash blocks in `plan-phase.md`, `execute-phase.md`,
 *    `verify-work.md`, `progress.md`. Single canonical resolution; workflows just
 *    call the verb and read the boolean.
 *
 * 2. **`task.is-behavior-adding`** — applies the three-check predicate
 *    (tdd=true frontmatter AND `<behavior>` block AND non-test source files in `<files>`)
 *    that was previously prose-only in `references/execute-mvp-tdd.md`. The gsd-executor
 *    agent now invokes the verb instead of inlining the checks.
 *
 * 3. **`user-story.validate`** — applies the canonical user-story regex
 *    `/^As a .+, I want to .+, so that .+\.$/` previously hardcoded in `verify-work.md`
 *    prose. Consumed by the verifier (phase-goal guard) and by `/gsd:mvp-phase`
 *    (interactive-prompt validation).
 *
 * Domain terms: see CONTEXT.md → MVP Mode, User Story, Behavior-Adding Task.
 * Concept index: get-shit-done/references/mvp-concepts.md.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { loadConfig } from '../config.js';
import { roadmapGetPhase } from './roadmap.js';
/**
 * Resolve MVP mode for a phase. Precedence (first hit wins):
 *   1. `--cli-flag` arg on this verb (caller asserts the user passed `--mvp`)
 *   2. ROADMAP.md `**Mode:** mvp` for the phase
 *   3. `workflow.mvp_mode` config (project-wide default)
 *   4. false
 *
 * @example
 *   gsd-sdk query phase.mvp-mode 1                    # roadmap + config check
 *   gsd-sdk query phase.mvp-mode 1 --cli-flag         # caller saw --mvp on CLI
 */
export const phaseMvpMode = async (args, projectDir, workstream) => {
    const phaseNum = args[0];
    if (!phaseNum) {
        throw new GSDError('Usage: phase.mvp-mode <phase-number> [--cli-flag]', ErrorClassification.Validation);
    }
    const cliFlagPresent = args.includes('--cli-flag');
    // Precedence #2: ROADMAP.md
    const phaseResult = await roadmapGetPhase([phaseNum], projectDir, workstream);
    const phaseData = phaseResult.data;
    const roadmapMode = phaseData.found && typeof phaseData.mode === 'string'
        ? phaseData.mode.trim().toLowerCase()
        : null;
    // Precedence #3: config
    const config = await loadConfig(projectDir, workstream);
    const wf = (config.workflow ?? {});
    const configMvpMode = Boolean(wf.mvp_mode ?? false);
    let active = false;
    let source = 'none';
    if (cliFlagPresent) {
        active = true;
        source = 'cli_flag';
    }
    else if (roadmapMode === 'mvp') {
        active = true;
        source = 'roadmap';
    }
    else if (configMvpMode) {
        active = true;
        source = 'config';
    }
    return {
        data: {
            active,
            source,
            roadmap_mode: roadmapMode,
            config_mvp_mode: configMvpMode,
            cli_flag_present: cliFlagPresent,
        },
    };
};
/**
 * Predicate: does this PLAN.md task add user-visible behavior under MVP+TDD?
 *
 * Three checks, all required:
 *   (1) `tdd="true"` frontmatter
 *   (2) `<behavior>` block names a user-visible outcome (block exists and is non-empty)
 *   (3) `<files>` includes at least one non-test source file
 *       (excludes `*.md`, `*.json`, `*.test.*`, `*.spec.*`)
 *
 * Pure doc-only / config-only / test-only tasks return `is_behavior_adding=false`
 * and are exempt from the MVP+TDD Gate.
 *
 * Canonical specification: get-shit-done/references/execute-mvp-tdd.md.
 *
 * @example
 *   gsd-sdk query task.is-behavior-adding ./plans/01-PLAN-auth.md
 *   gsd-sdk query task.is-behavior-adding --task-content "<task>...</task>"
 */
export const taskIsBehaviorAdding = async (args, projectDir) => {
    let content = null;
    if (args[0] === '--task-content') {
        content = args[1] ?? null;
    }
    else if (args[0]) {
        const requestedPath = args[0];
        const projectRoot = resolve(projectDir ?? process.cwd());
        const resolvedTaskPath = resolve(projectRoot, requestedPath);
        const rel = relative(projectRoot, resolvedTaskPath);
        if (rel === '..' || rel.startsWith(`..${sep}`)) {
            throw new GSDError(`Task file is outside project scope: ${requestedPath}`, ErrorClassification.Validation);
        }
        if (!existsSync(resolvedTaskPath)) {
            throw new GSDError(`Task file not found: ${requestedPath}`, ErrorClassification.Validation);
        }
        content = await readFile(resolvedTaskPath, 'utf-8');
    }
    if (!content) {
        throw new GSDError('Usage: task.is-behavior-adding <plan-file-path> | --task-content "<xml>"', ErrorClassification.Validation);
    }
    // Check 1: tdd="true" — accept either single or double quotes, case-insensitive.
    const tddTrue = /\btdd\s*=\s*["']true["']/i.test(content);
    // Check 2: <behavior>...</behavior> block exists and is non-empty after trim.
    const behaviorMatch = content.match(/<behavior>([\s\S]*?)<\/behavior>/i);
    const hasBehaviorBlock = Boolean(behaviorMatch && behaviorMatch[1].trim().length > 0);
    // Check 3: <files>...</files> includes at least one source file
    // (anything that is NOT *.md, *.json, *.test.*, *.spec.*).
    const filesMatch = content.match(/<files>([\s\S]*?)<\/files>/i);
    let hasSourceFiles = false;
    if (filesMatch) {
        const filesBody = filesMatch[1];
        const fileLines = filesBody
            .split(/[\n,]/)
            .map(l => l.trim().replace(/^[-*]\s*/, ''))
            .filter(Boolean);
        hasSourceFiles = fileLines.some(f => !/\.md$/i.test(f) &&
            !/\.json$/i.test(f) &&
            !/\.test\.[^.]+$/i.test(f) &&
            !/\.spec\.[^.]+$/i.test(f) &&
            !/(^|[\\/])tests?[\\/]/i.test(f) &&
            !/\.(yml|yaml|toml|ini|cfg|conf|properties)$/i.test(f) &&
            !/(^|[\\/])\.env(\..+)?$/i.test(f));
    }
    const isBehaviorAdding = tddTrue && hasBehaviorBlock && hasSourceFiles;
    let reason = null;
    if (!isBehaviorAdding) {
        const missing = [];
        if (!tddTrue)
            missing.push('tdd="true" frontmatter absent');
        if (!hasBehaviorBlock)
            missing.push('<behavior> block missing or empty');
        if (!hasSourceFiles)
            missing.push('<files> has no non-test source file');
        reason = `Not behavior-adding: ${missing.join('; ')}`;
    }
    return {
        data: {
            is_behavior_adding: isBehaviorAdding,
            checks: {
                tdd_true: tddTrue,
                has_behavior_block: hasBehaviorBlock,
                has_source_files: hasSourceFiles,
            },
            reason,
        },
    };
};
/**
 * The canonical User Story regex — exported so unit tests can assert it directly
 * and other modules can import it without re-defining.
 *
 * Pattern: `As a [role], I want to [capability], so that [outcome].`
 */
export const USER_STORY_REGEX = /^As a (?<role>.+?), I want to (?<capability>.+?), so that (?<outcome>.+?)\.$/;
/**
 * Validate that a string matches the User Story format used by MVP-mode phases.
 * Used by `gsd-verifier` (phase-goal guard) and `/gsd:mvp-phase` (interactive prompting).
 *
 * @example
 *   gsd-sdk query user-story.validate "As a user, I want to log in, so that I can see my data."
 *   gsd-sdk query user-story.validate --story "<text>"
 */
export const userStoryValidate = async (args, _projectDir) => {
    let input = null;
    if (args[0] === '--story') {
        input = args[1] ?? null;
    }
    else if (args[0]) {
        input = args.join(' ');
    }
    if (input === null || input === '') {
        throw new GSDError('Usage: user-story.validate "<story text>" | --story "<text>"', ErrorClassification.Validation);
    }
    const match = input.match(USER_STORY_REGEX);
    const errors = [];
    let slots = null;
    if (match && match.groups) {
        slots = {
            role: match.groups.role.trim(),
            capability: match.groups.capability.trim(),
            outcome: match.groups.outcome.trim(),
        };
    }
    else {
        if (!/^As a /i.test(input))
            errors.push('Must begin with "As a ".');
        if (!/, I want to /i.test(input))
            errors.push('Must contain ", I want to ".');
        if (!/, so that /i.test(input))
            errors.push('Must contain ", so that ".');
        if (!/\.$/.test(input))
            errors.push('Must end with a period.');
        if (errors.length === 0)
            errors.push('Does not match canonical User Story shape.');
    }
    return {
        data: {
            valid: match !== null,
            input,
            slots,
            errors,
        },
    };
};
//# sourceMappingURL=mvp.js.map