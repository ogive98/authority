export const THUNDER_JOB_TYPES = {
  hello: 'thunder.hello.v1',
  failRetryable: 'thunder.fail.retryable.v1',
  failFatal: 'thunder.fail.fatal.v1',
  breakerGuarded: 'thunder.breaker-guarded.v1',
} as const;

export const THUNDER_DEPENDENCY_KEYS = {
  externalApiStub: 'external_api_stub',
} as const;

export type ThunderJobType =
  (typeof THUNDER_JOB_TYPES)[keyof typeof THUNDER_JOB_TYPES];

export const THUNDER_QUEUE_FAMILIES = [
  'critical',
  'ops',
  'notify',
  'print',
  'import',
  'analytics',
] as const;

export type ThunderQueueFamily = (typeof THUNDER_QUEUE_FAMILIES)[number];

export const THUNDER_ERROR_CODES = {
  REDIS_UNAVAILABLE: 'THUNDER.REDIS_UNAVAILABLE',
  JOB_NOT_FOUND: 'THUNDER.JOB_NOT_FOUND',
  IDEMPOTENCY_CONFLICT: 'THUNDER.IDEMPOTENCY_CONFLICT',
  UNKNOWN_JOB_TYPE: 'THUNDER.UNKNOWN_JOB_TYPE',
  PROCESSOR_UNAVAILABLE: 'THUNDER.PROCESSOR_UNAVAILABLE',
} as const;

export type ThunderErrorCode =
  (typeof THUNDER_ERROR_CODES)[keyof typeof THUNDER_ERROR_CODES];

export function thunderQueueName(family: ThunderQueueFamily): string {
  const env =
    process.env.AUTHORITY_ENV ?? process.env.NODE_ENV ?? 'development';
  return `authority.${env}.thunder.${family}`;
}

export function thunderWorkersEnabled(): boolean {
  if (process.env.THUNDER_WORKERS_ENABLED === 'false') {
    return false;
  }
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.THUNDER_WORKERS_ENABLED !== 'true'
  ) {
    return false;
  }
  return Boolean(process.env.REDIS_URL);
}

export function thunderEventStreamKey(): string {
  const env =
    process.env.AUTHORITY_ENV ?? process.env.NODE_ENV ?? 'development';
  return `authority.${env}.events.main`;
}

export function thunderEventPublisherEnabled(): boolean {
  if (process.env.THUNDER_EVENTS_ENABLED === 'false') {
    return false;
  }
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.THUNDER_EVENTS_ENABLED !== 'true'
  ) {
    return false;
  }
  return Boolean(process.env.REDIS_URL);
}

export function thunderConsumersEnabled(): boolean {
  return thunderEventPublisherEnabled();
}
