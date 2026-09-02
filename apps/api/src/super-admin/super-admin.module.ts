import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ThunderModule } from '../thunder-core/thunder.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminThunderController } from './super-admin-thunder.controller';
import { TotpService } from './totp.service';

@Module({
  imports: [IdentityModule, ThunderModule],
  controllers: [SuperAdminController, SuperAdminThunderController],
  providers: [SuperAdminAuthService, SuperAdminSessionGuard, TotpService],
  exports: [SuperAdminAuthService, SuperAdminSessionGuard],
})
export class SuperAdminModule {}
