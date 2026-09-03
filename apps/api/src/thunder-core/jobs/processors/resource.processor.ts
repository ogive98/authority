import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../job.types';

export function executeCriticalPingJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  return Promise.resolve({
    ok: true,
    lane: 'critical',
    correlationId: context.context.correlationId,
  });
}

export function executeImportBulkJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  return Promise.resolve({
    ok: true,
    lane: 'import',
    correlationId: context.context.correlationId,
  });
}

export function executeModuleGatedJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  return Promise.resolve({
    ok: true,
    module: 'inventory',
    correlationId: context.context.correlationId,
  });
}
