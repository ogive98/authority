import type { Prisma } from '@prisma/client';
import type { ThunderContext } from '../context/thunder-context';
import type { ThunderQueueFamily } from '../thunder.constants';

export interface ThunderQueueJobData {
  jobId: string;
}

export interface JobExecutionContext {
  jobId: string;
  jobType: string;
  companyId?: string;
  payload: Prisma.JsonObject;
  context: ThunderContext;
  attempt: number;
}

export type JobHandler = (
  context: JobExecutionContext,
) => Promise<Prisma.InputJsonValue>;

export interface RegisteredJobHandler {
  queue: ThunderQueueFamily;
  handler: JobHandler;
  dependencyKey?: string;
}

export interface JobEnqueueResult {
  jobId?: string;
  status: string;
  replayed: boolean;
  planC?: boolean;
  dependencyKey?: string;
  planCResult?: Prisma.InputJsonValue;
}
