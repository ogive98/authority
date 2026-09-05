import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { LicenseModule } from '../license/license.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdmissionOrchestratorService } from './admission/admission-orchestrator.service';
import { ConsumerRegistryService } from './events/consumer-registry.service';
import { EventConsumerHost } from './events/event-consumer.host';
import { EventConsumerWorker } from './events/event-consumer.worker';
import { OutboxDlqService } from './events/outbox-dlq.service';
import { OutboxPublisherService } from './events/outbox-publisher.service';
import { OutboxPublisherWorker } from './events/outbox-publisher.worker';
import { ProcessedEventService } from './events/processed-event.service';
import { DlqService } from './jobs/dlq/dlq.service';
import { JobEnqueueService } from './jobs/job-enqueue.service';
import { JobProcessorHost } from './jobs/job-processor.host';
import { JobQueryService } from './jobs/job-query.service';
import { JobRegistryService } from './jobs/job-registry.service';
import { MonitorSnapshotService } from './observability/monitor-snapshot.service';
import { ThunderMetricsService } from './observability/thunder-metrics.service';
import { CircuitBreakerService } from './resilience/circuit-breaker.service';
import { PlanAbcPolicyService } from './resilience/plan-abc/plan-abc-policy.service';
import { PlanCRegistryService } from './resilience/plan-c-registry.service';
import { CapacityPlannerWorker } from './resources/capacity-planner.worker';
import { ResourceManagerService } from './resources/resource-manager.service';
import { WatchdogService } from './resources/watchdog.service';
import { WatchdogWorker } from './resources/watchdog.worker';
import { RuleDefService } from './rules/rule-def.service';
import { RuleEngineService } from './rules/rule-engine.service';
import { ThunderRulesRegistrar } from './rules/thunder-rules.registrar';
import { ThunderController } from './thunder.controller';
import { ThunderDevOnlyGuard } from './thunder-dev-only.guard';

@Module({
  imports: [
    PrismaModule,
    InfrastructureModule,
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    LicenseModule,
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
    OutboxDlqService,
    OutboxPublisherService,
    OutboxPublisherWorker,
    EventConsumerHost,
    EventConsumerWorker,
    CircuitBreakerService,
    PlanCRegistryService,
    PlanAbcPolicyService,
    ResourceManagerService,
    CapacityPlannerWorker,
    WatchdogService,
    WatchdogWorker,
    AdmissionOrchestratorService,
    ThunderMetricsService,
    MonitorSnapshotService,
    RuleDefService,
    RuleEngineService,
    ThunderRulesRegistrar,
  ],
  exports: [
    JobEnqueueService,
    JobProcessorHost,
    JobQueryService,
    DlqService,
    OutboxDlqService,
    OutboxPublisherService,
    EventConsumerHost,
    ProcessedEventService,
    CircuitBreakerService,
    PlanCRegistryService,
    PlanAbcPolicyService,
    ResourceManagerService,
    WatchdogService,
    JobRegistryService,
    AdmissionOrchestratorService,
    ThunderMetricsService,
    MonitorSnapshotService,
    RuleDefService,
    RuleEngineService,
  ],
})
export class ThunderModule {}
