import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsumerRegistryService } from './events/consumer-registry.service';
import { EventConsumerHost } from './events/event-consumer.host';
import { EventConsumerWorker } from './events/event-consumer.worker';
import { OutboxPublisherService } from './events/outbox-publisher.service';
import { OutboxPublisherWorker } from './events/outbox-publisher.worker';
import { ProcessedEventService } from './events/processed-event.service';
import { DlqService } from './jobs/dlq/dlq.service';
import { JobEnqueueService } from './jobs/job-enqueue.service';
import { JobProcessorHost } from './jobs/job-processor.host';
import { JobQueryService } from './jobs/job-query.service';
import { JobRegistryService } from './jobs/job-registry.service';
import { CircuitBreakerService } from './resilience/circuit-breaker.service';
import { PlanCRegistryService } from './resilience/plan-c-registry.service';
import { ThunderController } from './thunder.controller';
import { ThunderDevOnlyGuard } from './thunder-dev-only.guard';

@Module({
  imports: [
    PrismaModule,
    InfrastructureModule,
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
  ],
  controllers: [ThunderController],
  providers: [
    ThunderDevOnlyGuard,
    JobRegistryService,
    JobEnqueueService,
    JobProcessorHost,
    JobQueryService,
    DlqService,
    ConsumerRegistryService,
    ProcessedEventService,
    OutboxPublisherService,
    OutboxPublisherWorker,
    EventConsumerHost,
    EventConsumerWorker,
    CircuitBreakerService,
    PlanCRegistryService,
  ],
  exports: [
    JobEnqueueService,
    JobProcessorHost,
    JobQueryService,
    DlqService,
    OutboxPublisherService,
    EventConsumerHost,
    ProcessedEventService,
    CircuitBreakerService,
    PlanCRegistryService,
  ],
})
export class ThunderModule {}
