import { resolveQueryCommand, explainQueryCommandNoMatch, } from './query-command-resolution-strategy.js';
import { supportsMutationCommand, supportsRawOutputCommand } from './query-policy-capability.js';
import { UNKNOWN_COMMAND_HINTS } from './query-unknown-command-hints.js';
import { describeFallbackDisabledPolicy } from './query-fallback-policy.js';
export function diagnoseUnknownCommand(command, args, registry, fallbackRestricted) {
    const noMatch = explainQueryCommandNoMatch(command, args, registry);
    const normalized = [noMatch.normalized.command, ...noMatch.normalized.args].join(' ');
    const attempted = noMatch.attempted.dotted.slice(0, 2);
    const hints = [...UNKNOWN_COMMAND_HINTS];
    const attemptedSuffix = attempted.length > 0 ? ` Attempted dotted: ${attempted.join(' | ')}.` : '';
    const fallbackClause = fallbackRestricted ? `${describeFallbackDisabledPolicy()} ` : '';
    const message = `Error: Unknown command: "${normalized}". ${hints[0]} ${hints[1]} ${fallbackClause}${hints[2]}${attemptedSuffix}`;
    return {
        normalized,
        attempted,
        hints,
        message,
    };
}
export function createCommandTopology(registry) {
    return {
        resolve(tokens, fallbackRestricted = false) {
            const command = tokens[0];
            const args = tokens.slice(1);
            if (!command) {
                return {
                    kind: 'no_match',
                    attempted: [],
                    hints: [],
                    message: 'Error: "gsd-sdk query" requires a command',
                };
            }
            const matched = resolveQueryCommand(command, args, registry);
            if (!matched) {
                const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
                return {
                    kind: 'no_match',
                    normalized: diagnosis.normalized,
                    attempted: diagnosis.attempted,
                    hints: diagnosis.hints,
                    message: diagnosis.message,
                };
            }
            const adapter = registry.getHandler(matched.cmd);
            if (!adapter) {
                const diagnosis = diagnoseUnknownCommand(command, args, registry, fallbackRestricted);
                return {
                    kind: 'no_match',
                    normalized: diagnosis.normalized,
                    attempted: diagnosis.attempted,
                    hints: diagnosis.hints,
                    message: diagnosis.message,
                };
            }
            return {
                kind: 'match',
                canonical: matched.cmd,
                args: matched.args,
                output_mode: supportsRawOutputCommand(matched.cmd) ? 'raw' : 'json',
                mutation: supportsMutationCommand(matched.cmd),
                adapter,
            };
        },
    };
}
//# sourceMappingURL=command-topology.js.map