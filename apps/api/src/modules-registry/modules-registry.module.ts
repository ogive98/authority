import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CapabilityGuard } from './capability.guard';
import { CapabilityResolverService } from './catalog/capability-resolver.service';
import { ModuleCatalogService } from './catalog/module-catalog.service';
import { ModuleLifecycleService } from './catalog/module-lifecycle.service';
import { CapabilitiesController } from './capabilities.controller';
import { FeatureFlagService } from './feature-flag.service';
import { FlagGuard } from './flag.guard';
import { MeFieldAclService } from './me-field-acl.service';
import { MeRegistryController } from './me-registry.controller';
import { MeRegistryService } from './me-registry.service';
import { ModuleActivationService } from './module-activation.service';
import { ModuleGuard } from './module.guard';
import { ModuleRegistryService } from './module-registry.service';
import { ModulesController } from './modules.controller';
import { SalesSurfaceController } from './sales-surface.controller';

@Module({
  imports: [IdentityModule, PermissionsModule, PrismaModule, AuditModule],
  controllers: [
    ModulesController,
    CapabilitiesController,
    SalesSurfaceController,
    MeRegistryController,
  ],
  providers: [
    ModuleRegistryService,
    ModuleCatalogService,
    ModuleLifecycleService,
    ModuleActivationService,
    CapabilityResolverService,
    FeatureFlagService,
    MeFieldAclService,
    MeRegistryService,
    ModuleGuard,
    FlagGuard,
    CapabilityGuard,
  ],
  exports: [
    ModuleRegistryService,
    ModuleCatalogService,
    ModuleLifecycleService,
    ModuleActivationService,
    CapabilityResolverService,
    FeatureFlagService,
    MeFieldAclService,
    MeRegistryService,
    ModuleGuard,
    FlagGuard,
    CapabilityGuard,
  ],
})
export class ModulesRegistryModule {}
