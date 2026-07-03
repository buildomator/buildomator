import { formatQueryRawOutput } from './query-raw-output-projection.js';
import { GSDToolsError } from './gsd-tools-error.js';
import { errorMessage, timeoutMessage } from './query-failure-classification.js';
import type { QueryNativeErrorFactory } from './query-tools-error-factory.js';
import type { QueryResult } from './query/utils.js';

export interface QueryNativeDirectAdapterDeps extends QueryNativeErrorFactory {
  timeoutMs: number;
  dispatch: (registryCommand: string, registryArgs: string[]) => Promise<QueryResult>;
}

/**
 * Adapter Module for direct native registry dispatch with timeout policy.
 */
export class QueryNativeDirectAdapter {
  constructor(private readonly deps: QueryNativeDirectAdapterDeps) {}

  async dispatchResult(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<QueryResult> {
    try {
      return await this.withTimeout(legacyCommand, legacyArgs, this.deps.dispatch(registryCommand, registryArgs));
    } catch (error) {
      throw this.toNativeDispatchError(legacyCommand, legacyArgs, error);
    }
  }

  async dispatchJson(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<unknown> {
    return this.dispatchData(legacyCommand, legacyArgs, registryCommand, registryArgs);
  }

  async dispatchRaw(legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[]): Promise<string> {
    const data = await this.dispatchData(legacyCommand, legacyArgs, registryCommand, registryArgs);
    return formatQueryRawOutput(registryCommand, data).trim();
  }

  private async dispatchData(
    legacyCommand: string,
    legacyArgs: string[],
    registryCommand: string,
    registryArgs: string[],
  ): Promise<unknown> {
    const result = await this.dispatchResult(legacyCommand, legacyArgs, registryCommand, registryArgs);
    return result.data;
  }

  private toNativeDispatchError(legacyCommand: string, legacyArgs: string[], error: unknown): GSDToolsError {
    if (error instanceof GSDToolsError) return error;
    return this.deps.createNativeFailureError(errorMessage(error), legacyCommand, legacyArgs, error);
  }

  private async withTimeout<T>(legacyCommand: string, legacyArgs: string[], work: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          this.deps.createNativeTimeoutError(
            timeoutMessage(legacyCommand, legacyArgs, this.deps.timeoutMs),
            legacyCommand,
            legacyArgs,
          ),
        );
      }, this.deps.timeoutMs);
    });

    try {
      return await Promise.race([work, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }
}
