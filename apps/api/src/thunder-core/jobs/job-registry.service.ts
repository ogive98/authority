import { Injectable } from '@nestjs/common';
import {
  THUNDER_DEPENDENCY_KEYS,
  THUNDER_JOB_TYPES,
  THUNDER_QUEUE_FAMILIES,
  type ThunderQueueFamily,
} from '../thunder.constants';
import type { JobHandler, RegisteredJobHandler } from './job.types';
import {
  executeFailFatalJob,
  executeFailRetryableJob,
  executeFailTimeoutJob,
} from './processors/fail.processor';
import { executeBreakerGuardedJob } from './processors/breaker-guarded.processor';
import { executeHelloJob } from './processors/hello.processor';

@Injectable()
export class JobRegistryService {
  private readonly handlers = new Map<string, RegisteredJobHandler>();

  constructor() {
    this.register(THUNDER_JOB_TYPES.hello, 'ops', executeHelloJob);
    this.register(
      THUNDER_JOB_TYPES.failRetryable,
      'ops',
      executeFailRetryableJob,
    );
    this.register(THUNDER_JOB_TYPES.failFatal, 'ops', executeFailFatalJob);
    this.register(THUNDER_JOB_TYPES.failTimeout, 'ops', executeFailTimeoutJob);
    this.register(
      THUNDER_JOB_TYPES.breakerGuarded,
      'ops',
      executeBreakerGuardedJob,
      THUNDER_DEPENDENCY_KEYS.externalApiStub,
    );
  }

  register(
    jobType: string,
    queue: ThunderQueueFamily,
    handler: JobHandler,
    dependencyKey?: string,
  ): void {
    this.handlers.set(jobType, { queue, handler, dependencyKey });
  }

  get(jobType: string): RegisteredJobHandler | undefined {
    return this.handlers.get(jobType);
  }

  unregister(jobType: string): void {
    this.handlers.delete(jobType);
  }

  getQueuesInUse(): ThunderQueueFamily[] {
    const queues = new Set<ThunderQueueFamily>();
    for (const entry of this.handlers.values()) {
      queues.add(entry.queue);
    }
    return THUNDER_QUEUE_FAMILIES.filter((queue) => queues.has(queue));
  }
}
