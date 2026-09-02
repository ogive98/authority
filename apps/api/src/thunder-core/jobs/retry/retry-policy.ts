export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_BACKOFF_BASE_MS = 1_000;
export const DEFAULT_BACKOFF_MAX_MS = 16_000;
export const DEFAULT_JOB_TIMEOUT_MS = 30_000;

export function computeBackoffDelayMs(attempt: number): number {
  if (process.env.NODE_ENV === 'test') {
    return 10;
  }

  const capped = Math.min(
    DEFAULT_BACKOFF_BASE_MS * 2 ** Math.max(attempt - 1, 0),
    DEFAULT_BACKOFF_MAX_MS,
  );
  return Math.floor(Math.random() * capped);
}

export function getJobAttemptsForType(jobType: string): number {
  if (jobType === 'thunder.fail.retryable.v1') {
    return 3;
  }
  return DEFAULT_MAX_ATTEMPTS;
}

export function getJobTimeoutMsForType(jobType: string): number {
  if (jobType === 'thunder.fail.timeout.v1') {
    return 50;
  }
  return DEFAULT_JOB_TIMEOUT_MS;
}
