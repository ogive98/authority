import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FeatureFlagService } from './feature-flag.service';
import { FlagGuard } from './flag.guard';
import { ModuleGuard } from './module.guard';
import { ModuleRegistryService } from './module-registry.service';
import { ModulesController } from './modules.controller';
import { SalesSurfaceController } from './sales-surface.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ModulesController, SalesSurfaceController],
  providers: [
    ModuleRegistryService,
    FeatureFlagService,
    ModuleGuard,
    FlagGuard,
  ],
  exports: [ModuleRegistryService, FeatureFlagService, ModuleGuard, FlagGuard],
})
export class ModulesRegistryModule {}
