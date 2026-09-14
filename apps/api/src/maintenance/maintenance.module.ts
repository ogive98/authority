import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
