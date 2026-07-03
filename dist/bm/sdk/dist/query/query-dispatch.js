import { extractField } from './registry.js';
import { normalizeQueryCommand } from './query-command-resolution-strategy.js';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';
import { unknownCommandError, validationError, fallbackDispatchErrorFromSignal, nativeDispatchErrorFromSignal } from './query-error-taxonomy.js';
import { canUseCjsFallback } from './query-fallback-policy.js';
import { toFailureSignal } from '../query-failure-classification.js';
export function dispatchFailure(error, stderr = []) {
    return {
        ok: false,
        error,
        stderr,
        exit_code: error.code,
    };
}
export function dispatchSuccess(stdout, stderr = []) {
    return {
        ok: true,
        stdout,
        stderr,
        exit_code: 0,
    };
}
export function toDispatchFailure(error, stderr = []) {
    return dispatchFailure(error, stderr);
}
export function mapNativeDispatchError(error, command, args) {
    return nativeDispatchErrorFromSignal(toFailureSignal(error), command, args);
}
export function mapFallbackDispatchError(error, command, args) {
    return fallbackDispatchErrorFromSignal(toFailureSignal(error), command, args);
}
export function formatPick(data, pickField) {
    if (!pickField)
        return data;
    return extractField(data, pickField);
}
export function formatSuccess(data, format, pickField) {
    if (format === 'text' && typeof data === 'string') {
        if (pickField) {
            throw new Error('--pick is not supported for text output');
        }
        return data.endsWith('\n') ? data : `${data}\n`;
    }
    const output = formatPick(data, pickField);
    return `${JSON.stringify(output === undefined ? null : output, null, 2)}\n`;
}
export function validateQueryDispatchInput(queryArgv) {
    const queryArgs = [...queryArgv];
    const pickIdx = queryArgs.indexOf('--pick');
    if (pickIdx !== -1) {
        if (pickIdx + 1 >= queryArgs.length) {
            return {
                queryArgs,
                error: dispatchFailure(validationError({
                    message: 'Error: --pick requires a field name',
                    details: { field: '--pick', reason: 'missing_value' },
                })),
            };
        }
        const pickField = queryArgs[pickIdx + 1];
        queryArgs.splice(pickIdx, 2);
        if (queryArgs.length === 0 || !queryArgs[0]) {
            return {
                queryArgs,
                error: dispatchFailure(validationError({
                    message: 'Error: "gsd-sdk query" requires a command',
                    details: { reason: 'missing_command' },
                })),
            };
        }
        return { queryArgs, pickField };
    }
    if (queryArgs.length === 0 || !queryArgs[0]) {
        return {
            queryArgs,
            error: dispatchFailure(validationError({
                message: 'Error: "gsd-sdk query" requires a command',
                details: { reason: 'missing_command' },
            })),
        };
    }
    return { queryArgs };
}
export function planQueryDispatch(queryArgv, topology, cjsFallbackEnabled) {
    const queryCommand = queryArgv[0];
    if (!queryCommand) {
        return { mode: 'error', normalized: { command: '', args: [], tokens: [] }, matched: null };
    }
    const [normCmd, normArgs] = normalizeQueryCommand(queryCommand, queryArgv.slice(1));
    const normalizedTokens = [normCmd, ...normArgs];
    const resolved = topology.resolve(queryArgv, !cjsFallbackEnabled);
    if (resolved.kind === 'match') {
        return { mode: 'native', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: resolved };
    }
    if (cjsFallbackEnabled) {
        return { mode: 'cjs', normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens }, matched: null };
    }
    return {
        mode: 'error',
        normalized: { command: normCmd, args: normArgs, tokens: normalizedTokens },
        matched: null,
        noMatchMessage: resolved.message,
        noMatchNormalized: resolved.normalized,
        noMatchAttempted: resolved.attempted,
        noMatchHints: resolved.hints,
    };
}
function fail(error, stderr = []) {
    return toDispatchFailure(error, stderr);
}
export async function runQueryDispatch(deps, queryArgv) {
    const validated = validateQueryDispatchInput(queryArgv);
    if (validated.error)
        return validated.error;
    const { queryArgs, pickField } = validated;
    const plan = planQueryDispatch(queryArgs, deps.topology, deps.cjsFallbackEnabled);
    const normCmd = plan.normalized.command;
    const normArgs = plan.normalized.args;
    if (!normCmd || !String(normCmd).trim()) {
        return fail(validationError({ message: 'Error: "gsd-sdk query" requires a command', details: { reason: 'empty_normalized_command' } }));
    }
    if (plan.mode === 'error') {
        return fail(unknownCommandError({
            message: plan.noMatchMessage ?? `Error: Unknown command: "${queryArgs[0] ?? normCmd}"`,
            normalized: plan.noMatchNormalized ?? [normCmd, ...normArgs].join(' ').trim(),
            attempted: plan.noMatchAttempted ?? [],
            hints: plan.noMatchHints ?? [],
        }));
    }
    if (plan.mode === 'cjs') {
        if (canUseCjsFallback({ cjsFallbackEnabled: deps.cjsFallbackEnabled })) {
            try {
                const gsdPath = deps.resolveGsdToolsPath(deps.projectDir);
                return await runCjsFallbackDispatch({
                    projectDir: deps.projectDir,
                    gsdToolsPath: gsdPath,
                    normCmd,
                    normArgs,
                    ws: deps.ws,
                    pickField,
                });
            }
            catch (e) {
                return toDispatchFailure(mapFallbackDispatchError(e, normCmd, normArgs));
            }
        }
        return toDispatchFailure(mapFallbackDispatchError(new Error('CJS fallback denied by policy'), normCmd, normArgs));
    }
    const matched = plan.matched;
    if (!matched) {
        return toDispatchFailure(mapFallbackDispatchError(new Error('No native match in dispatch plan'), normCmd, normArgs));
    }
    // #3259: guard — if the invocation contains --help / -h AND the matched
    // handler is a mutating command (mutation: true in the command manifest),
    // short-circuit to a non-mutating stub. Mutating handlers are not help-aware
    // by default (fail-closed). This prevents e.g. `milestone.complete --help`
    // from writing milestone artifacts to disk.
    const helpFlagPresent = matched.args.some((a) => a === '--help' || a === '-h');
    if (helpFlagPresent && matched.mutation) {
        return dispatchSuccess(formatSuccess({ help: `Usage: gsd-sdk query ${matched.canonical} [args...]` }, undefined));
    }
    const dispatchNative = deps.nativeAdapter
        ? (cmd, args) => deps.nativeAdapter.dispatch(cmd, args)
        : deps.dispatchNative;
    try {
        const result = dispatchNative
            ? await dispatchNative(matched.canonical, matched.args)
            : await matched.adapter(matched.args, deps.projectDir, deps.ws);
        return dispatchSuccess(formatSuccess(result.data, result.format, pickField));
    }
    catch (e) {
        return toDispatchFailure(mapNativeDispatchError(e, matched.canonical, matched.args));
    }
}
//# sourceMappingURL=query-dispatch.js.map