import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { HealthCheckersService } from './checkers/health-checkers.service';
import { MaintenanceEngine } from './engines/maintenance.engine';
import { RepairEngine } from './engines/repair.engine';
import { RepairRegistryService } from './engines/registry.service';
import { ReportingEngine } from './engines/reporting.engine';
import { ResetEngine } from './engines/reset.engine';
import { ScanEngine } from './engines/scan.engine';
import { SnapshotEngine } from './engines/snapshot.engine';
import { VerificationEngine } from './engines/verification.engine';
import { RepairErpController } from './repair-erp.controller';
import { RepairController } from './repair.controller';
import { RepairFacade } from './repair.facade';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    SuperAdminModule,
  ],
  controllers: [RepairErpController, RepairController],
  providers: [
    RepairRegistryService,
    HealthCheckersService,
    SnapshotEngine,
    VerificationEngine,
    ScanEngine,
    RepairEngine,
    ResetEngine,
    ReportingEngine,
    MaintenanceEngine,
    RepairFacade,
  ],
  exports: [RepairFacade],
})
export class RepairModule {}
