import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';
import { SuperAdminController } from './super-admin.controller';
import { TotpService } from './totp.service';

@Module({
  imports: [IdentityModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminAuthService, SuperAdminSessionGuard, TotpService],
  exports: [SuperAdminAuthService, SuperAdminSessionGuard],
})
export class SuperAdminModule {}
