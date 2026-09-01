import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentSession, CurrentUser } from './identity.decorators';
import { IDENTITY_COOKIE_NAME } from './identity.constants';
import { LoginDto } from './login.dto';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import type { SessionWithUser } from './session.service';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { UpdateMeDto } from './update-me.dto';
import {
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from '../organization/organization.constants';

@Controller('api/v1/identity')
export class IdentityController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(IDENTITY_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: result.session.expiresAt,
    });

    return {
      user: result.user,
      session: { id: result.session.id, expiresAt: result.session.expiresAt },
    };
  }

  @Get('me')
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  me(@CurrentUser() user: IamUser) {
    return this.authService.toMeResponse(user);
  }

  @Patch('me')
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async updateMe(
    @CurrentUser() user: IamUser,
    @Body() dto: UpdateMeDto,
    @Req() req: Request,
  ) {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const companyHeader = req.headers[TENANCY_HEADERS.companyId];
    const siteHeader = req.headers[TENANCY_HEADERS.siteId];
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];

    return this.authService.updateProfile({
      userId: user.id,
      displayName: dto.displayName,
      locale: dto.locale,
      companyId:
        (typeof companyHeader === 'string' ? companyHeader : undefined) ??
        cookies[TENANCY_COOKIES.companyId],
      siteId:
        (typeof siteHeader === 'string' ? siteHeader : undefined) ??
        cookies[TENANCY_COOKIES.siteId],
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySessionRevoke)
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentSession() session: SessionWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessionService.revokeSession(sessionId, session.userId);

    if (session.id === sessionId) {
      res.clearCookie(IDENTITY_COOKIE_NAME);
    }
  }
}
