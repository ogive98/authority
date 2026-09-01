import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { IdentityException } from '../identity/identity.exception';
import { LoginDto } from '../identity/login.dto';
import { MfaVerifyDto } from './mfa-verify.dto';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';
import { SUPER_ADMIN_COOKIE_NAME } from './super-admin.constants';

@Controller('api/super-admin/v1')
export class SuperAdminController {
  constructor(private readonly superAdminAuthService: SuperAdminAuthService) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.superAdminAuthService.login({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.mfaRequired) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.MFA_REQUIRED,
        'Super Admin MFA verification required.',
        401,
        { mfaToken: result.mfaToken },
      );
    }

    this.setSessionCookie(res, result.token, result.session.expiresAt);
    return {
      user: result.user,
      session: { id: result.session.id, expiresAt: result.session.expiresAt },
      realm: 'super_admin',
    };
  }

  @Post('auth/mfa/verify')
  @HttpCode(200)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.superAdminAuthService.verifyMfa({
      mfaToken: dto.mfaToken,
      code: dto.code,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setSessionCookie(res, result.token, result.session.expiresAt);
    return {
      user: result.user,
      session: { id: result.session.id, expiresAt: result.session.expiresAt },
      realm: 'super_admin',
    };
  }

  @Get('health')
  @UseGuards(SuperAdminSessionGuard)
  health() {
    return {
      status: 'ok',
      realm: 'super_admin',
      timestamp: new Date().toISOString(),
    };
  }

  private setSessionCookie(res: Response, token: string, expires: Date): void {
    res.cookie(SUPER_ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires,
    });
  }
}
