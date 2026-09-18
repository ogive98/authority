import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../thunder-core/jobs/job.types';

export type AutoBackupRunResult = {
  companyId: string;
  backupId: string;
  scope: string;
  restorable: boolean;
  label: string | null;
};

type AutoCreateRunner = (
  companyId: string,
  opts?: { correlationId?: string },
) => Promise<AutoBackupRunResult>;

let runner: AutoCreateRunner | null = null;

/** Bound by BackupAutoService.onModuleInit — Thunder HOW handler stays DI-free. */
export function bindBackupAutoCreateRunner(fn: AutoCreateRunner): void {
  runner = fn;
}

export async function executeBackupAutoCreateJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  if (!runner) {
    throw new Error('Backup auto-create runner not bound');
  }
  const companyId = context.companyId;
  if (!companyId) {
    throw new Error('companyId required for backup.auto.create.v1');
  }
  const result = await runner(companyId, {
    correlationId: context.context.correlationId,
  });
  return {
    ...result,
    thunderJobId: context.jobId,
  };
}
