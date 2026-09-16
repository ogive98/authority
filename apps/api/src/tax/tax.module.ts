import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SettingsModule } from '../settings/settings.module';
import { RasEngineService } from './ras-engine.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { TejCenterService } from './tej-center.service';
import { TejLocalService } from './tej-local.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    SettingsModule,
  ],
  controllers: [TaxController],
  providers: [TaxService, TejLocalService, RasEngineService, TejCenterService],
  exports: [TaxService, TejLocalService, RasEngineService, TejCenterService],
})
export class TaxModule {}
