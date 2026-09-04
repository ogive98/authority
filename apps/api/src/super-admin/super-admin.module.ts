import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { ThunderModule } from '../thunder-core/thunder.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminModulesController } from './super-admin-modules.controller';
import { SuperAdminThunderController } from './super-admin-thunder.controller';
import { SuperAdminIndustryPacksController } from './super-admin-industry-packs.controller';
import { TotpService } from './totp.service';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [
    IdentityModule,
    ThunderModule,
    ModulesRegistryModule,
    MasterDataModule,
  ],
  controllers: [
    SuperAdminController,
    SuperAdminThunderController,
    SuperAdminModulesController,
    SuperAdminIndustryPacksController,
  ],
  providers: [SuperAdminAuthService, SuperAdminSessionGuard, TotpService],
  exports: [SuperAdminAuthService, SuperAdminSessionGuard],
})
export class SuperAdminModule {}
