import { Injectable } from '@nestjs/common';
import {
  THUNDER_JOB_TYPES,
  THUNDER_QUEUE_FAMILIES,
  type ThunderQueueFamily,
} from '../thunder.constants';
import type { JobHandler, RegisteredJobHandler } from './job.types';
import { executeHelloJob } from './processors/hello.processor';

@Injectable()
export class JobRegistryService {
  private readonly handlers = new Map<string, RegisteredJobHandler>();

  constructor() {
    this.register(THUNDER_JOB_TYPES.hello, 'ops', executeHelloJob);
  }

  register(
    jobType: string,
    queue: ThunderQueueFamily,
    handler: JobHandler,
  ): void {
    this.handlers.set(jobType, { queue, handler });
  }

  get(jobType: string): RegisteredJobHandler | undefined {
    return this.handlers.get(jobType);
  }

  getQueuesInUse(): ThunderQueueFamily[] {
    const queues = new Set<ThunderQueueFamily>();
    for (const entry of this.handlers.values()) {
      queues.add(entry.queue);
    }
    return THUNDER_QUEUE_FAMILIES.filter((queue) => queues.has(queue));
  }
}
