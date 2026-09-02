import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../job.types';

export function executeBreakerGuardedJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  return Promise.resolve({
    ok: true,
    dependency: 'external_api_stub',
    correlationId: context.context.correlationId,
    executedAt: new Date().toISOString(),
  });
}
