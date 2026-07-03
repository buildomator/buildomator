export interface GSDToolsErrorClassification {
  kind: 'timeout' | 'failure';
  timeoutMs?: number;
}

function timeoutClassification(timeoutMs?: number): GSDToolsErrorClassification {
  return timeoutMs === undefined ? { kind: 'timeout' } : { kind: 'timeout', timeoutMs };
}

function failureClassification(): GSDToolsErrorClassification {
  return { kind: 'failure' };
}

export class GSDToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
    options?: { cause?: unknown; classification?: GSDToolsErrorClassification },
  ) {
    super(message, options);
    this.name = 'GSDToolsError';
    this.classification = options?.classification ?? failureClassification();
  }

  static timeout(
    message: string,
    command: string,
    args: string[],
    stderr = '',
    timeoutMs?: number,
    options?: { cause?: unknown; exitCode?: number | null },
  ): GSDToolsError {
    return new GSDToolsError(
      message,
      command,
      args,
      options?.exitCode ?? null,
      stderr,
      { cause: options?.cause, classification: timeoutClassification(timeoutMs) },
    );
  }

  static failure(
    message: string,
    command: string,
    args: string[],
    exitCode: number | null,
    stderr = '',
    options?: { cause?: unknown },
  ): GSDToolsError {
    return new GSDToolsError(
      message,
      command,
      args,
      exitCode,
      stderr,
      { cause: options?.cause, classification: failureClassification() },
    );
  }

  public readonly classification: GSDToolsErrorClassification;
}
