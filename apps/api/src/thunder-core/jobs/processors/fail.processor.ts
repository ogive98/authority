import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../job.types';
import {
  ThunderFatalJobError,
  ThunderRetryableJobError,
} from '../retry/job-errors';

export function executeFailRetryableJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  if (context.attempt >= 3) {
    return Promise.resolve({
      recovered: true,
      attempt: context.attempt,
      executedAt: new Date().toISOString(),
    });
  }

  return Promise.reject(
    new ThunderRetryableJobError(
      `Simulated retryable failure on attempt ${context.attempt}`,
    ),
  );
}

export function executeFailFatalJob(): Promise<Prisma.InputJsonValue> {
  return Promise.reject(
    new ThunderFatalJobError('Simulated validation failure (non-retryable)'),
  );
}
