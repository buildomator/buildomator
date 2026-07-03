/**
 * GSD Tools Bridge — programmatic access to GSD planning operations.
 *
 * By default routes commands through the SDK **query registry** (same handlers as
 * `gsd-sdk query`) so `PhaseRunner`, `InitRunner`, and `GSD` share contracts with
 * the typed CLI. Runner hot-path helpers (`initPhaseOp`, `phasePlanIndex`,
 * `phaseComplete`, `initNewProject`, `configSet`, `commit`) call
 * `registry.dispatch()` with canonical keys when native query is active, avoiding
 * repeated argv resolution. When a workstream is set, dispatches to `gsd-tools.cjs` so
 * workstream env stays aligned with CJS.
 */
import { toToolsErrorFromUnknown } from './query-tools-error-factory.js';
import { GSDToolsError } from './gsd-tools-error.js';
import { resolveGsdToolsPath } from './query-gsd-tools-path.js';
import { createGSDToolsRuntime } from './query-gsd-tools-runtime.js';
import { QueryCommandExecutor } from './query-command-executor.js';
import { QueryHotpathMethods } from './query-hotpath-methods.js';
export { GSDToolsError } from './gsd-tools-error.js';
// ─── GSDTools class ──────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 30_000;
export class GSDTools {
    projectDir;
    gsdToolsPath;
    timeoutMs;
    workstream;
    bridge;
    preferNativeQuery;
    commandExecutor;
    hotpathMethods;
    constructor(opts) {
        this.projectDir = opts.projectDir;
        this.gsdToolsPath =
            opts.gsdToolsPath ?? resolveGsdToolsPath(opts.projectDir);
        this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.workstream = opts.workstream;
        this.preferNativeQuery = opts.preferNativeQuery ?? true;
        const runtime = createGSDToolsRuntime({
            projectDir: this.projectDir,
            gsdToolsPath: this.gsdToolsPath,
            timeoutMs: this.timeoutMs,
            workstream: this.workstream,
            eventStream: opts.eventStream,
            sessionId: opts.sessionId,
            shouldUseNativeQuery: () => this.shouldUseNativeQuery(),
            execJsonFallback: (legacyCommand, legacyArgs) => this.exec(legacyCommand, legacyArgs),
            execRawFallback: (legacyCommand, legacyArgs) => this.execRaw(legacyCommand, legacyArgs),
            strictSdk: opts.strictSdk,
            allowFallbackToSubprocess: opts.allowFallbackToSubprocess,
            onDispatchEvent: opts.onDispatchEvent,
        });
        this.bridge = runtime.bridge;
        this.commandExecutor = new QueryCommandExecutor({
            nativeMatch: (command, args) => this.nativeMatch(command, args),
            execute: async (input) => this.bridge.execute({
                legacyCommand: input.legacyCommand,
                legacyArgs: input.legacyArgs,
                registryCommand: input.registryCommand,
                registryArgs: input.registryArgs,
                mode: input.mode,
                projectDir: this.projectDir,
                workstream: this.workstream,
            }),
        });
        this.hotpathMethods = new QueryHotpathMethods({
            dispatchNativeHotpath: (legacyCommand, legacyArgs, registryCommand, registryArgs, mode) => this.dispatchNativeHotpath(legacyCommand, legacyArgs, registryCommand, registryArgs, mode),
        });
    }
    shouldUseNativeQuery() {
        return this.preferNativeQuery && !this.workstream;
    }
    nativeMatch(command, args) {
        return this.bridge.resolve(command, args);
    }
    async dispatchNativeHotpath(legacyCommand, legacyArgs, registryCommand, registryArgs, mode) {
        return this.executeWithToolsError(legacyCommand, legacyArgs, () => this.bridge.dispatchHotpath(legacyCommand, legacyArgs, registryCommand, registryArgs, mode));
    }
    async executeWithToolsError(command, args, work) {
        try {
            return await work();
        }
        catch (err) {
            if (err instanceof GSDToolsError)
                throw err;
            throw toToolsErrorFromUnknown(command, args, err);
        }
    }
    // ─── Core exec ───────────────────────────────────────────────────────────
    /**
     * Execute a gsd-tools command and return parsed JSON output.
     * Handles the `@file:` prefix pattern for large results.
     */
    async exec(command, args = []) {
        return this.executeWithToolsError(command, args, () => this.commandExecutor.exec(command, args, 'json'));
    }
    // ─── Raw exec (no JSON parsing) ───────────────────────────────────────
    /**
     * Execute a gsd-tools command and return raw stdout without JSON parsing.
     * Use for commands like `config-set` that return plain text, not JSON.
     */
    async execRaw(command, args = []) {
        return this.executeWithToolsError(command, args, async () => {
            const out = await this.commandExecutor.exec(command, args, 'raw');
            return typeof out === 'string' ? out : String(out ?? '');
        });
    }
    // ─── Typed convenience methods ─────────────────────────────────────────
    async stateLoad() {
        return this.exec('state', ['load']);
    }
    async roadmapAnalyze() {
        return this.exec('roadmap', ['analyze']);
    }
    async phaseComplete(phase) {
        return this.hotpathMethods.phaseComplete(phase);
    }
    async commit(message, files) {
        return this.hotpathMethods.commit(message, files);
    }
    async verifySummary(path) {
        return this.execRaw('verify-summary', [path]);
    }
    async initExecutePhase(phase) {
        return this.execRaw('state', ['begin-phase', '--phase', phase]);
    }
    /**
     * Query phase state from gsd-tools.cjs `init phase-op`.
     * Returns a typed PhaseOpInfo describing what exists on disk for this phase.
     */
    async initPhaseOp(phaseNumber) {
        return this.hotpathMethods.initPhaseOp(phaseNumber);
    }
    /**
     * Get a config value via the `config-get` surface (CJS and registry use the same key path).
     */
    async configGet(key) {
        return this.hotpathMethods.configGet(key);
    }
    /**
     * Begin phase state tracking in gsd-tools.cjs.
     */
    async stateBeginPhase(phaseNumber) {
        return this.execRaw('state', ['begin-phase', '--phase', phaseNumber]);
    }
    /**
     * Get the plan index for a phase, grouping plans into dependency waves.
     * Returns typed PhasePlanIndex with wave assignments and completion status.
     */
    async phasePlanIndex(phaseNumber) {
        return this.hotpathMethods.phasePlanIndex(phaseNumber);
    }
    /**
     * Query new-project init state from gsd-tools.cjs `init new-project`.
     * Returns project metadata, model configs, brownfield detection, etc.
     */
    async initNewProject() {
        return this.hotpathMethods.initNewProject();
    }
    /**
     * Set a config value via gsd-tools.cjs `config-set`.
     * Handles type coercion (booleans, numbers, JSON) on the gsd-tools side.
     * Note: config-set returns `key=value` text, not JSON, so we use execRaw.
     */
    async configSet(key, value) {
        return this.hotpathMethods.configSet(key, value);
    }
}
export { resolveGsdToolsPath } from './query-gsd-tools-path.js';
//# sourceMappingURL=gsd-tools.js.map