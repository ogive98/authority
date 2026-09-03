import type { ThunderQueueFamily } from '../thunder.constants';

export const SHEDDABLE_QUEUES: ThunderQueueFamily[] = ['import', 'analytics'];

export const QUEUE_DEFAULT_PRIORITY: Record<ThunderQueueFamily, number> = {
  critical: 0,
  ops: 2,
  notify: 3,
  print: 2,
  import: 4,
  analytics: 4,
};

export interface ResourcePressureSnapshot {
  shedP4: boolean;
  reason?: string;
}
