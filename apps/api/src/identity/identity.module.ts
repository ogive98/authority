import { Module } from '@nestjs/common';
import { PermissionsController } from '../permissions/permissions.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { InvitesController } from './invites.controller';
import { InviteService } from './invite.service';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [IdentityController, InvitesController, PermissionsController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionGuard,
    InviteService,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    SessionGuard,
    InviteService,
  ],
})
export class IdentityModule {}
