import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import { ExtensionRegistryService } from './extension-registry.service';
import { FeatureRequestService } from './feature-request.service';
import { MetadataRegistryService } from './metadata-registry.service';
import { ForgeController } from './forge.controller';

/**
 * FORGE — foundation + API + metadata bridge (D277–D279).
 * AUTHORITY UI. No AI / sandbox runtime.
 */
@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [ForgeController],
  providers: [
    ExtensionLifecycleService,
    ExtensionRegistryService,
    FeatureRequestService,
    MetadataRegistryService,
  ],
  exports: [
    ExtensionLifecycleService,
    ExtensionRegistryService,
    FeatureRequestService,
    MetadataRegistryService,
  ],
})
export class ForgeModule {}
