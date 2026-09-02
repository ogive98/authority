import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JobEnqueueService } from './jobs/job-enqueue.service';
import { JobProcessorHost } from './jobs/job-processor.host';
import { JobQueryService } from './jobs/job-query.service';
import { JobRegistryService } from './jobs/job-registry.service';
import { ThunderController } from './thunder.controller';

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
    JobRegistryService,
    JobEnqueueService,
    JobProcessorHost,
    JobQueryService,
  ],
  exports: [JobEnqueueService, JobProcessorHost, JobQueryService],
})
export class ThunderModule {}
