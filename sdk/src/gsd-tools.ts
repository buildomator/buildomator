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


import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex, RoadmapAnalysis } from './types.js';
import type { GSDEventStream } from './event-stream.js';
import { toToolsErrorFromUnknown } from './query-tools-error-factory.js';
import { GSDToolsError } from './gsd-tools-error.js';
import type { QueryCommandResolution } from './query/query-command-resolution-strategy.js';
import { resolveGsdToolsPath } from './query-gsd-tools-path.js';
import { createGSDToolsRuntime } from './query-gsd-tools-runtime.js';
import { QueryCommandExecutor } from './query-command-executor.js';
import { QueryHotpathMethods } from './query-hotpath-methods.js';
import { QueryRuntimeBridge, type RuntimeBridgeOptions } from './query-runtime-bridge.js';

export { GSDToolsError } from './gsd-tools-error.js';

// ─── GSDTools class ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;


export class GSDTools {
  private readonly projectDir: string;
  private readonly gsdToolsPath: string;
  private readonly timeoutMs: number;
  private readonly workstream?: string;
  private readonly bridge: QueryRuntimeBridge;
  private readonly preferNativeQuery: boolean;
  private readonly commandExecutor: QueryCommandExecutor;
  private readonly hotpathMethods: QueryHotpathMethods;

  constructor(opts: {
    projectDir: string;
    gsdToolsPath?: string;
    timeoutMs?: number;
    workstream?: string;
    /** When set, mutation handlers emit the same events as `gsd-sdk query`. */
    eventStream?: GSDEventStream;
    /** Correlation id for mutation events when `eventStream` is set. */
    sessionId?: string;
    /**
     * When true (default), route known commands through the SDK query registry.
     * Set false in tests that substitute a mock `gsdToolsPath` script.
     */
    preferNativeQuery?: boolean;
    /** When true, fail if a command has no native registry adapter. */
    strictSdk?: boolean;
    /** Explicit subprocess bridge policy. Default false for SDK-native mode. */
    allowFallbackToSubprocess?: boolean;
    /** Structured runtime bridge dispatch observability callback. */
    onDispatchEvent?: RuntimeBridgeOptions['onDispatchEvent'];
  }) {
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
      dispatchNativeHotpath: (legacyCommand, legacyArgs, registryCommand, registryArgs, mode) =>
        this.dispatchNativeHotpath(legacyCommand, legacyArgs, registryCommand, registryArgs, mode),
    });
  }

  private shouldUseNativeQuery(): boolean {
    return this.preferNativeQuery && !this.workstream;
  }

  private nativeMatch(command: string, args: string[]): QueryCommandResolution | null {
    return this.bridge.resolve(command, args);
  }

  private async dispatchNativeHotpath(
    legacyCommand: string,
    legacyArgs: string[],
    registryCommand: string,
    registryArgs: string[],
    mode: 'json' | 'raw',
  ): Promise<unknown> {
    return this.executeWithToolsError(legacyCommand, legacyArgs, () =>
      this.bridge.dispatchHotpath(
        legacyCommand,
        legacyArgs,
        registryCommand,
        registryArgs,
        mode,
      ));
  }

  private async executeWithToolsError<T>(command: string, args: string[], work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (err) {
      if (err instanceof GSDToolsError) throw err;
      throw toToolsErrorFromUnknown(command, args, err);
    }
  }

  // ─── Core exec ───────────────────────────────────────────────────────────

  /**
   * Execute a gsd-tools command and return parsed JSON output.
   * Handles the `@file:` prefix pattern for large results.
   */
  async exec(command: string, args: string[] = []): Promise<unknown> {
    return this.executeWithToolsError(command, args, () => this.commandExecutor.exec(command, args, 'json'));
  }

  // ─── Raw exec (no JSON parsing) ───────────────────────────────────────

  /**
   * Execute a gsd-tools command and return raw stdout without JSON parsing.
   * Use for commands like `config-set` that return plain text, not JSON.
   */
  async execRaw(command: string, args: string[] = []): Promise<string> {
    return this.executeWithToolsError(command, args, async () => {
      const out = await this.commandExecutor.exec(command, args, 'raw');
      return typeof out === 'string' ? out : String(out ?? '');
    });
  }


  // ─── Typed convenience methods ─────────────────────────────────────────

  async stateLoad(): Promise<unknown> {
    return this.exec('state', ['load']);
  }

  async roadmapAnalyze(): Promise<RoadmapAnalysis> {
    return this.exec('roadmap', ['analyze']) as Promise<RoadmapAnalysis>;
  }

  async phaseComplete(phase: string): Promise<string> {
    return this.hotpathMethods.phaseComplete(phase);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    return this.hotpathMethods.commit(message, files);
  }

  async verifySummary(path: string): Promise<string> {
    return this.execRaw('verify-summary', [path]);
  }

  async initExecutePhase(phase: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phase]);
  }

  /**
   * Query phase state from gsd-tools.cjs `init phase-op`.
   * Returns a typed PhaseOpInfo describing what exists on disk for this phase.
   */
  async initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo> {
    return this.hotpathMethods.initPhaseOp(phaseNumber);
  }

  /**
   * Get a config value via the `config-get` surface (CJS and registry use the same key path).
   */
  async configGet(key: string): Promise<string | null> {
    return this.hotpathMethods.configGet(key);
  }

  /**
   * Begin phase state tracking in gsd-tools.cjs.
   */
  async stateBeginPhase(phaseNumber: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phaseNumber]);
  }

  /**
   * Get the plan index for a phase, grouping plans into dependency waves.
   * Returns typed PhasePlanIndex with wave assignments and completion status.
   */
  async phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex> {
    return this.hotpathMethods.phasePlanIndex(phaseNumber);
  }

  /**
   * Query new-project init state from gsd-tools.cjs `init new-project`.
   * Returns project metadata, model configs, brownfield detection, etc.
   */
  async initNewProject(): Promise<InitNewProjectInfo> {
    return this.hotpathMethods.initNewProject();
  }

  /**
   * Set a config value via gsd-tools.cjs `config-set`.
   * Handles type coercion (booleans, numbers, JSON) on the gsd-tools side.
   * Note: config-set returns `key=value` text, not JSON, so we use execRaw.
   */
  async configSet(key: string, value: string): Promise<string> {
    return this.hotpathMethods.configSet(key, value);
  }
}

export { resolveGsdToolsPath } from './query-gsd-tools-path.js';
