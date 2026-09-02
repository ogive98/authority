import {
  computeBackoffDelayMs,
  DEFAULT_MAX_ATTEMPTS,
  getJobAttemptsForType,
} from './retry-policy';
import {
  isRetryableJobError,
  ThunderFatalJobError,
  ThunderRetryableJobError,
} from './job-errors';

describe('retry-policy', () => {
  it('caps backoff below the configured maximum', () => {
    const delay = computeBackoffDelayMs(10);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThan(16_000);
  });

  it('uses fewer attempts for the retryable test job', () => {
    expect(getJobAttemptsForType('thunder.fail.retryable.v1')).toBe(3);
    expect(getJobAttemptsForType('thunder.hello.v1')).toBe(
      DEFAULT_MAX_ATTEMPTS,
    );
  });
});

describe('job-errors', () => {
  it('classifies fatal errors as non-retryable', () => {
    expect(
      isRetryableJobError(new ThunderFatalJobError('validation failed')),
    ).toBe(false);
  });

  it('classifies retryable errors', () => {
    expect(
      isRetryableJobError(new ThunderRetryableJobError('network down')),
    ).toBe(true);
  });

  it('classifies timeout errors as retryable', () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    expect(isRetryableJobError(timeout)).toBe(true);
  });
});
