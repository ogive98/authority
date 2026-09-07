export type EventContract = {
  eventType: string;
  publisherModuleId: string;
  version: number;
};

export type EventContractsMode = 'off' | 'warn' | 'strict';

export function resolveEventContractsMode(
  env: NodeJS.ProcessEnv = process.env,
): EventContractsMode {
  const raw = (env.THUNDER_EVENT_CONTRACTS_MODE ?? '').toLowerCase();
  if (raw === 'off' || raw === 'warn' || raw === 'strict') {
    return raw;
  }
  // Default strict: unknown publishes fail (terrain for Marketplace/Control).
  return 'strict';
}

/** Event type: dotted segments + .vN suffix (e.g. sales.order.confirmed.v1). */
export const EVENT_TYPE_PATTERN =
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v\d+$/;
