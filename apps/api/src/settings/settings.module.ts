import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ExpertiseResolverService } from './expertise-resolver.service';
import { OpsVisibilityResolver } from './ops-visibility.resolver';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    IdentityModule,
    MailModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    ExpertiseResolverService,
    OpsVisibilityResolver,
  ],
  exports: [
    SettingsService,
    ExpertiseResolverService,
    OpsVisibilityResolver,
  ],
})
export class SettingsModule {}
