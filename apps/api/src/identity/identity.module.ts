import { Module } from '@nestjs/common';
import { PermissionsController } from '../permissions/permissions.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [IdentityController, PermissionsController],
  providers: [AuthService, PasswordService, SessionService, SessionGuard],
  exports: [AuthService, PasswordService, SessionService, SessionGuard],
})
export class IdentityModule {}
