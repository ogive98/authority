export class ThunderFatalJobError extends Error {
  readonly code = 'THUNDER.FATAL_JOB';

  constructor(message: string) {
    super(message);
    this.name = 'ThunderFatalJobError';
  }
}

export class ThunderRetryableJobError extends Error {
  readonly code = 'THUNDER.RETRYABLE_JOB';

  constructor(message: string) {
    super(message);
    this.name = 'ThunderRetryableJobError';
  }
}

export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof ThunderRetryableJobError) {
    return true;
  }
  if (error instanceof ThunderFatalJobError) {
    return false;
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return true;
  }
  return false;
}
