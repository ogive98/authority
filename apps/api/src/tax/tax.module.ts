import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
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
  providers: [TaxService, TejLocalService],
  exports: [TaxService, TejLocalService],
})
export class TaxModule {}
