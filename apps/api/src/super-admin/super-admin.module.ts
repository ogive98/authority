import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { ThunderModule } from '../thunder-core/thunder.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminModulesController } from './super-admin-modules.controller';
import { SuperAdminThunderController } from './super-admin-thunder.controller';
import { TotpService } from './totp.service';

@Module({
  imports: [IdentityModule, ThunderModule, ModulesRegistryModule],
  controllers: [
    SuperAdminController,
    SuperAdminThunderController,
    SuperAdminModulesController,
  ],
  providers: [SuperAdminAuthService, SuperAdminSessionGuard, TotpService],
  exports: [SuperAdminAuthService, SuperAdminSessionGuard],
})
export class SuperAdminModule {}
