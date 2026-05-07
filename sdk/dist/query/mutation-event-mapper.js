import { GSDEventType, } from '../types.js';
const FAMILY_RULES = [
    { family: 'template', matches: (cmd) => cmd.startsWith('template.') || cmd.startsWith('template ') },
    { family: 'git', matches: (cmd) => cmd === 'commit' || cmd === 'check-commit' || cmd === 'commit-to-subrepo' },
    { family: 'frontmatter', matches: (cmd) => cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ') },
    { family: 'config', matches: (cmd) => cmd.startsWith('config-') },
    { family: 'validate', matches: (cmd) => cmd.startsWith('validate.') || cmd.startsWith('validate ') },
    { family: 'phase', matches: (cmd) => cmd.startsWith('phase.') || cmd.startsWith('phase ') || cmd.startsWith('phases.') || cmd.startsWith('phases ') },
    { family: 'state', matches: (cmd) => cmd.startsWith('state.') || cmd.startsWith('state ') },
];
function resolveFamily(cmd) {
    return FAMILY_RULES.find((rule) => rule.matches(cmd))?.family ?? 'default';
}
export function buildMutationEvent(correlationSessionId, cmd, args, result) {
    const base = {
        timestamp: new Date().toISOString(),
        sessionId: correlationSessionId,
    };
    switch (resolveFamily(cmd)) {
        case 'template': {
            const data = result.data;
            return {
                ...base,
                type: GSDEventType.TemplateFill,
                templateType: data?.template ?? args[0] ?? '',
                path: data?.path ?? args[1] ?? '',
                created: data?.created ?? false,
            };
        }
        case 'git': {
            const data = result.data;
            return {
                ...base,
                type: GSDEventType.GitCommit,
                hash: data?.hash ?? null,
                committed: data?.committed ?? false,
                reason: data?.reason ?? '',
            };
        }
        case 'frontmatter':
            return {
                ...base,
                type: GSDEventType.FrontmatterMutation,
                command: cmd,
                file: args[0] ?? '',
                fields: args.slice(1),
                success: true,
            };
        case 'config':
        case 'validate':
            return {
                ...base,
                type: GSDEventType.ConfigMutation,
                command: cmd,
                key: args[0] ?? '',
                success: true,
            };
        case 'phase':
        case 'state':
        case 'default':
            return {
                ...base,
                type: GSDEventType.StateMutation,
                command: cmd,
                fields: args.slice(0, 2),
                success: true,
            };
    }
}
//# sourceMappingURL=mutation-event-mapper.js.map