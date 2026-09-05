import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import type { Request, Response } from 'express';
import { LoginDto } from '../identity/login.dto';
import { SessionService } from '../identity/session.service';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalOrdersService } from './customer-portal-orders.service';
import {
  CustomerPortalSessionGuard,
  type CustomerPortalRequest,
} from './customer-portal-session.guard';
import { CUSTOMER_PORTAL_COOKIE_NAME } from './customer-portal.constants';

@Controller('api/v1/customer-portal')
export class CustomerPortalController {
  constructor(
    private readonly portalAuthService: CustomerPortalAuthService,
    private readonly portalOrdersService: CustomerPortalOrdersService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.portalAuthService.login({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setSessionCookie(res, result.token, result.session.expiresAt);
    return {
      user: result.user,
      membership: {
        customerId: result.membership.customerId,
        companyId: result.membership.companyId,
        role: result.membership.role,
      },
      realm: 'customer_portal',
    };
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[CUSTOMER_PORTAL_COOKIE_NAME] as
      | string
      | undefined;

    if (token) {
      const session = await this.sessionService.findActiveSession(
        token,
        IamSessionRealm.CUSTOMER_PORTAL,
      );
      if (session) {
        await this.sessionService.revokeSession(session.id, session.userId);
      }
    }

    res.clearCookie(CUSTOMER_PORTAL_COOKIE_NAME);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(CustomerPortalSessionGuard)
  async me(@Req() req: CustomerPortalRequest) {
    return this.portalAuthService.getMe(req.user!.id);
  }

  @Get('dashboard')
  @UseGuards(CustomerPortalSessionGuard)
  dashboard(@Req() req: CustomerPortalRequest) {
    // IDOR: customerId/companyId come only from session membership, never client input
    return this.portalOrdersService.getDashboardShell(
      req.companyId!,
      req.customerId!,
    );
  }

  @Get('orders')
  @UseGuards(CustomerPortalSessionGuard)
  listOrders(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalOrdersService.listOrders(
      req.companyId!,
      req.customerId!,
      {
        q,
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor,
      },
    );
  }

  @Get('orders/:id')
  @UseGuards(CustomerPortalSessionGuard)
  getOrder(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalOrdersService.getOrder(
      req.companyId!,
      req.customerId!,
      id,
    );
  }

  private setSessionCookie(res: Response, token: string, expires: Date): void {
    res.cookie(CUSTOMER_PORTAL_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires,
    });
  }
}
