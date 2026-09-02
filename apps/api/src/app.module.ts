import './load-env';
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { ModulesRegistryModule } from './modules-registry/modules-registry.module';
import { AuditModule } from './audit/audit.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    IdentityModule,
    OrganizationModule,
    SuperAdminModule,
    ModulesRegistryModule,
    PlatformModule,
  ],
})
export class AppModule {}
