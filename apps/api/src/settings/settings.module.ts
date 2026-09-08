import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ExpertiseResolverService } from './expertise-resolver.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, ExpertiseResolverService],
  exports: [SettingsService, ExpertiseResolverService],
})
export class SettingsModule {}
