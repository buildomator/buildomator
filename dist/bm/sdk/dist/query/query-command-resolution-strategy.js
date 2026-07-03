import { STATE_SUBCOMMANDS, VERIFY_SUBCOMMANDS, INIT_SUBCOMMANDS, PHASE_SUBCOMMANDS, PHASES_SUBCOMMANDS, VALIDATE_SUBCOMMANDS, ROADMAP_SUBCOMMANDS, } from './command-aliases.generated.js';
const MERGE_FIRST_WITH_SUBCOMMAND = new Set([
    'state', 'template', 'frontmatter', 'verify', 'phase', 'requirements', 'init',
    'workstream', 'intel', 'learnings', 'uat', 'todo', 'milestone', 'check', 'detect', 'route',
]);
export function normalizeQueryCommand(command, args) {
    if (command === 'scaffold')
        return ['phase.scaffold', args];
    if (command === 'state' && args.length === 0)
        return ['state.load', []];
    if (command === 'state' && args.length > 0) {
        if (STATE_SUBCOMMANDS.has(args[0]))
            return [`state.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'verify' && args.length > 0) {
        if (VERIFY_SUBCOMMANDS.has(args[0]))
            return [`verify.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'init' && args.length > 0) {
        if (INIT_SUBCOMMANDS.has(args[0]))
            return [`init.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'phase' && args.length > 0) {
        if (PHASE_SUBCOMMANDS.has(args[0]))
            return [`phase.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'phases' && args.length > 0) {
        if (PHASES_SUBCOMMANDS.has(args[0]))
            return [`phases.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'validate' && args.length > 0) {
        if (VALIDATE_SUBCOMMANDS.has(args[0]))
            return [`validate.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (command === 'roadmap' && args.length > 0) {
        if (ROADMAP_SUBCOMMANDS.has(args[0]))
            return [`roadmap.${args[0]}`, args.slice(1)];
        return [command, args];
    }
    if (MERGE_FIRST_WITH_SUBCOMMAND.has(command) && args.length > 0 && !args[0].startsWith('-'))
        return [`${command}.${args[0]}`, args.slice(1)];
    if ((command === 'progress' || command === 'stats') && args.length > 0 && !args[0].startsWith('-'))
        return [`${command}.${args[0]}`, args.slice(1)];
    return [command, args];
}
function expandFirstDottedToken(tokens) {
    if (tokens.length === 0)
        return tokens;
    const first = tokens[0];
    if (first.startsWith('--') || !first.includes('.'))
        return tokens;
    return [...first.split('.'), ...tokens.slice(1)];
}
function matchRegisteredPrefix(tokens, registry, track) {
    for (let i = tokens.length; i >= 1; i--) {
        const head = tokens.slice(0, i);
        const dotted = head.join('.');
        const spaced = head.join(' ');
        track?.dotted.push(dotted);
        track?.spaced.push(spaced);
        if (registry.has(dotted))
            return { cmd: dotted, args: tokens.slice(i), matchedBy: 'dotted' };
        if (registry.has(spaced))
            return { cmd: spaced, args: tokens.slice(i), matchedBy: 'spaced' };
    }
    return null;
}
export function resolveQueryTokens(tokens, registry) {
    const direct = matchRegisteredPrefix(tokens, registry);
    if (direct)
        return { ...direct, expanded: false, source: 'normalized' };
    const expanded = expandFirstDottedToken(tokens);
    if (expanded !== tokens) {
        const afterExpand = matchRegisteredPrefix(expanded, registry);
        if (afterExpand)
            return { ...afterExpand, expanded: true, source: 'expanded' };
    }
    return null;
}
export function resolveQueryCommand(command, args, registry) {
    const [normCmd, normArgs] = normalizeQueryCommand(command, args);
    return resolveQueryTokens([normCmd, ...normArgs], registry);
}
export function explainQueryCommandNoMatch(command, args, registry) {
    const [normalizedCommand, normalizedArgs] = normalizeQueryCommand(command, args);
    const normalizedTokens = [normalizedCommand, ...normalizedArgs];
    const attempted = { dotted: [], spaced: [] };
    matchRegisteredPrefix(normalizedTokens, registry, attempted);
    const expandedTokens = expandFirstDottedToken(normalizedTokens);
    if (expandedTokens !== normalizedTokens)
        matchRegisteredPrefix(expandedTokens, registry, attempted);
    return {
        normalized: { command: normalizedCommand, args: normalizedArgs, tokens: normalizedTokens },
        attempted: { dotted: attempted.dotted, spaced: attempted.spaced, expandedTokens: expandedTokens !== normalizedTokens ? expandedTokens : null },
    };
}
//# sourceMappingURL=query-command-resolution-strategy.js.map