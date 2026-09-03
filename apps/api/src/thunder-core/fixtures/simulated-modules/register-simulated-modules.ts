import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConsumerRegistryService } from '../../events/consumer-registry.service';
import type { JobEnqueueService } from '../../jobs/job-enqueue.service';
import type { JobRegistryService } from '../../jobs/job-registry.service';
import { SIMULATED_MODULE_CONSUMERS, SIMULATED_MODULE_JOBS } from './constants';
import { createInventoryReserveFromOrderConsumer } from './inventory.reserve-from-order.consumer';
import { createInventoryReserveProcessor } from './inventory.reserve.processor';
import { notificationsStockReservedConsumer } from './notifications.stock-reserved.consumer';

export function registerSimulatedModules(deps: {
  prisma: PrismaService;
  jobRegistry: JobRegistryService;
  consumerRegistry: ConsumerRegistryService;
  jobEnqueue: JobEnqueueService;
}): void {
  deps.jobRegistry.register(
    SIMULATED_MODULE_JOBS.inventoryReserve,
    'ops',
    createInventoryReserveProcessor({ prisma: deps.prisma }),
    { moduleKey: 'inventory' },
  );
  deps.consumerRegistry.register(
    SIMULATED_MODULE_CONSUMERS.inventoryReserveFromOrder,
    createInventoryReserveFromOrderConsumer({ enqueue: deps.jobEnqueue }),
  );
  deps.consumerRegistry.register(
    SIMULATED_MODULE_CONSUMERS.notificationsStockReserved,
    notificationsStockReservedConsumer,
  );
}

export function unregisterSimulatedModules(deps: {
  jobRegistry: JobRegistryService;
  consumerRegistry: ConsumerRegistryService;
}): void {
  deps.jobRegistry.unregister(SIMULATED_MODULE_JOBS.inventoryReserve);
  deps.consumerRegistry.unregister(
    SIMULATED_MODULE_CONSUMERS.inventoryReserveFromOrder,
  );
  deps.consumerRegistry.unregister(
    SIMULATED_MODULE_CONSUMERS.notificationsStockReserved,
  );
}
