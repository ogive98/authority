import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [IdentityController],
  providers: [AuthService, PasswordService, SessionService, SessionGuard],
  exports: [AuthService, PasswordService, SessionService, SessionGuard],
})
export class IdentityModule {}
