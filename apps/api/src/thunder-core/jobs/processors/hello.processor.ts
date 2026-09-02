import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../job.types';

export function executeHelloJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  const message =
    typeof context.payload.message === 'string'
      ? context.payload.message
      : 'hello';

  return Promise.resolve({
    message,
    executedAt: new Date().toISOString(),
    executionCount: 1,
    correlationId: context.context.correlationId,
  });
}
