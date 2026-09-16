import { Module } from '@nestjs/common';
import { PermissionsController } from '../permissions/permissions.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { AuthService } from './auth.service';
import { AvatarService } from './avatar.service';
import { DeviceService } from './device.service';
import { DevicesController } from './devices.controller';
import { IdentityController } from './identity.controller';
import { InvitesController } from './invites.controller';
import { InviteService } from './invite.service';
import { InviteSettingsResolver } from './invite-settings.resolver';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [PermissionsModule, AuditModule, MailModule],
  controllers: [
    IdentityController,
    DevicesController,
    InvitesController,
    PermissionsController,
  ],
  providers: [
    AuthService,
    AvatarService,
    PasswordService,
    SessionService,
    DeviceService,
    SessionGuard,
    InviteSettingsResolver,
    InviteService,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    DeviceService,
    SessionGuard,
    InviteService,
    InviteSettingsResolver,
  ],
})
export class IdentityModule {}
