import { formatSuccess } from './query-dispatch-formatting.js';
import { mapFallbackDispatchError, toDispatchFailure } from './query-dispatch-error-mapper.js';
import { runFallbackBridge } from './query-fallback-bridge-adapter.js';
import { fallbackBridgeNotices } from './query-dispatch-observability.js';
function formatFallbackOutput(data, mode, pickField) {
    if (mode === 'text') {
        const text = String(data ?? '');
        if (!text.trim())
            return undefined;
    }
    return formatSuccess(data, mode, pickField);
}
export async function runCjsFallbackDispatch(input) {
    const { projectDir, gsdToolsPath, normCmd, normArgs, ws, pickField } = input;
    const stderr = fallbackBridgeNotices(normCmd);
    try {
        const fallback = await runFallbackBridge({ projectDir, gsdToolsPath, normCmd, normArgs, ws });
        if (fallback.stderr.trim())
            stderr.push(fallback.stderr.trimEnd());
        return {
            ok: true,
            stderr,
            stdout: formatFallbackOutput(fallback.output, fallback.mode, pickField) ?? '',
            exit_code: 0,
        };
    }
    catch (err) {
        return toDispatchFailure(mapFallbackDispatchError(err, normCmd, normArgs), stderr);
    }
}
//# sourceMappingURL=query-fallback-executor.js.map