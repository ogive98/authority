import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { IamUser } from '@prisma/client';
import { IamSessionRealm } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AvatarService } from './avatar.service';
import { CurrentSession, CurrentUser } from './identity.decorators';
import { IDENTITY_COOKIE_NAME, IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { LoginDto } from './login.dto';
import { ReauthDto } from './reauth.dto';
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
    private readonly avatarService: AvatarService,
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
      path: '/',
      expires: result.session.expiresAt,
    });

    return {
      user: result.user,
      session: { id: result.session.id, expiresAt: result.session.expiresAt },
      realm: 'business' as const,
    };
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[IDENTITY_COOKIE_NAME] as string | undefined;

    if (token) {
      const session = await this.sessionService.findActiveSession(
        token,
        IamSessionRealm.BUSINESS,
      );
      if (session) {
        await this.sessionService.revokeSession(session.id, session.userId);
      }
    }

    res.clearCookie(IDENTITY_COOKIE_NAME, { path: '/' });
    res.clearCookie(TENANCY_COOKIES.companyId, { path: '/' });
    res.clearCookie(TENANCY_COOKIES.siteId, { path: '/' });
    return { ok: true };
  }

  @Post('auth/reauth')
  @HttpCode(200)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async reauth(
    @CurrentUser() user: IamUser,
    @Body() dto: ReauthDto,
    @Req() req: Request,
  ) {
    await this.authService.verifyCurrentPassword({
      userId: user.id,
      password: dto.password,
      ip: req.ip,
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async me(@CurrentUser() user: IamUser, @Req() req: Request) {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const companyHeader = req.headers[TENANCY_HEADERS.companyId];
    const companyId =
      (typeof companyHeader === 'string' ? companyHeader : undefined) ??
      cookies[TENANCY_COOKIES.companyId];
    return this.authService.buildMeResponse(user, companyId);
  }

  /** D157 — stream own profile photo (session cookie). */
  @Get('me/avatar')
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async getMyAvatar(
    @CurrentUser() user: IamUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.avatarService.read(user.id);
    if (!file) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.NOT_FOUND,
        'Aucune photo de profil.',
        HttpStatus.NOT_FOUND,
      );
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(file.buffer);
  }

  /** D157 — upload profile photo (JPEG/PNG/WebP, max 2 Mo). */
  @Post('me/avatar')
  @HttpCode(200)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadMyAvatar(
    @CurrentUser() user: IamUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Fichier image requis (champ « file »).',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { avatarUrl } = await this.avatarService.save({
      userId: user.id,
      buffer: file.buffer,
      mime: file.mimetype,
    });
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const companyHeader = req.headers[TENANCY_HEADERS.companyId];
    const companyId =
      (typeof companyHeader === 'string' ? companyHeader : undefined) ??
      cookies[TENANCY_COOKIES.companyId];
    const me = await this.authService.buildMeResponse(
      { ...user, avatarUrl },
      companyId,
    );
    return me;
  }

  @Delete('me/avatar')
  @HttpCode(200)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async clearMyAvatar(
    @CurrentUser() user: IamUser,
    @Req() req: Request,
  ) {
    await this.avatarService.clear(user.id);
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const companyHeader = req.headers[TENANCY_HEADERS.companyId];
    const companyId =
      (typeof companyHeader === 'string' ? companyHeader : undefined) ??
      cookies[TENANCY_COOKIES.companyId];
    return this.authService.buildMeResponse(
      { ...user, avatarUrl: null },
      companyId,
    );
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
      timezone: dto.timezone,
      avatarUrl: dto.avatarUrl,
      currentPassword: dto.currentPassword,
      password: dto.password,
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

  @Get('me/sessions')
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async listMySessions(@CurrentSession() session: SessionWithUser) {
    const rows = await this.sessionService.listActiveSessions(session.userId);
    return {
      currentSessionId: session.id,
      items: rows.map((r) => ({
        id: r.id,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        current: r.id === session.id,
      })),
    };
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
      res.clearCookie(IDENTITY_COOKIE_NAME, { path: '/' });
      res.clearCookie(TENANCY_COOKIES.companyId, { path: '/' });
      res.clearCookie(TENANCY_COOKIES.siteId, { path: '/' });
    }
  }
}
