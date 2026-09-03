import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ModuleCatalogService } from './catalog/module-catalog.service';
import { CapabilitiesController } from './capabilities.controller';
import { FeatureFlagService } from './feature-flag.service';
import { FlagGuard } from './flag.guard';
import { ModuleGuard } from './module.guard';
import { ModuleRegistryService } from './module-registry.service';
import { ModulesController } from './modules.controller';
import { SalesSurfaceController } from './sales-surface.controller';

@Module({
  imports: [IdentityModule],
  controllers: [
    ModulesController,
    CapabilitiesController,
    SalesSurfaceController,
  ],
  providers: [
    ModuleRegistryService,
    ModuleCatalogService,
    FeatureFlagService,
    ModuleGuard,
    FlagGuard,
  ],
  exports: [
    ModuleRegistryService,
    ModuleCatalogService,
    FeatureFlagService,
    ModuleGuard,
    FlagGuard,
  ],
})
export class ModulesRegistryModule {}
