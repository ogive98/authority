import type { Prisma } from '@prisma/client';
import type { JobExecutionContext } from '../thunder-core/jobs/job.types';

export type SpecificFoldersRunResult = {
  backupId: string;
  status: string;
  filesCount?: number;
  sizeBytes?: number;
  checksumSha256?: string;
  skipped?: boolean;
};

type SpecificFoldersRunner = (
  companyId: string,
  backupId: string,
  opts?: { correlationId?: string },
) => Promise<SpecificFoldersRunResult>;

let runner: SpecificFoldersRunner | null = null;

export function bindBackupSpecificFoldersRunner(fn: SpecificFoldersRunner): void {
  runner = fn;
}

export async function executeBackupSpecificFoldersJob(
  context: JobExecutionContext,
): Promise<Prisma.InputJsonValue> {
  if (!runner) {
    throw new Error('Backup specific-folders runner not bound');
  }
  const companyId = context.companyId;
  if (!companyId) {
    throw new Error('companyId required for backup.specificFolders.create.v1');
  }
  const backupId =
    typeof context.payload?.backupId === 'string'
      ? context.payload.backupId
      : null;
  if (!backupId) {
    throw new Error('backupId required in payload');
  }
  const result = await runner(companyId, backupId, {
    correlationId: context.context.correlationId,
  });
  return {
    ...result,
    thunderJobId: context.jobId,
  };
}
