import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../thunder-core/jobs/job.types';
import type { RetentionRunResult } from './backup-retention.service';

type RetentionRunner = (
  companyId: string,
  opts?: { force?: boolean; actorUserId?: string; correlationId?: string },
) => Promise<RetentionRunResult>;

let runner: RetentionRunner | null = null;

/** Bound by BackupRetentionService.onModuleInit — Thunder HOW handler stays DI-free. */
export function bindBackupRetentionRunner(fn: RetentionRunner): void {
  runner = fn;
}

export async function executeBackupRetentionJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  if (!runner) {
    throw new Error('Backup retention runner not bound');
  }
  const companyId = context.companyId;
  if (!companyId) {
    throw new Error('companyId required for backup.retention.run.v1');
  }
  const result = await runner(companyId, {
    force: context.payload.force === true,
    actorUserId:
      typeof context.payload.actorUserId === 'string'
        ? context.payload.actorUserId
        : 'system',
    correlationId: context.context.correlationId,
  });
  return {
    ...result,
    thunderJobId: context.jobId,
  };
}
