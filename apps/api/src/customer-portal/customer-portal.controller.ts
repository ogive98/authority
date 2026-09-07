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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocLinkType, IamSessionRealm } from '@prisma/client';
import type { Request, Response } from 'express';
import { LoginDto } from '../identity/login.dto';
import { SessionService } from '../identity/session.service';
import { RequireModule } from '../modules-registry/modules.decorators';
import { DocumentsService } from '../documents/documents.service';
import { DEFAULT_MAX_UPLOAD_MB } from '../platform/platform.constants';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalClaimsService } from './customer-portal-claims.service';
import { CustomerPortalInsightsService } from './customer-portal-insights.service';
import { CustomerPortalModuleGuard } from './customer-portal-module.guard';
import { CustomerPortalOrdersService } from './customer-portal-orders.service';
import {
  CustomerPortalSessionGuard,
  type CustomerPortalRequest,
} from './customer-portal-session.guard';
import { CUSTOMER_PORTAL_COOKIE_NAME } from './customer-portal.constants';
import {
  PortalCreateClaimDto,
  PortalCreateOrderDto,
  PortalReorderDto,
} from './customer-portal.dto';

const maxUploadBytes =
  Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

@Controller('api/v1/customer-portal')
export class CustomerPortalController {
  constructor(
    private readonly portalAuthService: CustomerPortalAuthService,
    private readonly portalOrdersService: CustomerPortalOrdersService,
    private readonly portalClaimsService: CustomerPortalClaimsService,
    private readonly portalInsightsService: CustomerPortalInsightsService,
    private readonly documentsService: DocumentsService,
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

    res.clearCookie(CUSTOMER_PORTAL_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  async me(@Req() req: CustomerPortalRequest) {
    return this.portalAuthService.getMe(req.user!.id);
  }

  @Get('dashboard')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  dashboard(@Req() req: CustomerPortalRequest) {
    // IDOR: customerId/companyId come only from session membership, never client input
    return this.portalOrdersService.getDashboardShell(
      req.companyId!,
      req.customerId!,
    );
  }

  @Get('insights')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  insights(@Req() req: CustomerPortalRequest) {
    return this.portalInsightsService.listInsights(
      req.companyId!,
      req.customerId!,
    );
  }

  @Get('catalog')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  listCatalog(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalOrdersService.listCatalog(
      req.companyId!,
      req.customerId!,
      {
        q,
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor,
      },
    );
  }

  @Get('orders')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
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

  @Post('orders')
  @HttpCode(201)
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  createOrder(
    @Req() req: CustomerPortalRequest,
    @Body() dto: PortalCreateOrderDto,
  ) {
    return this.portalOrdersService.createOrder(
      req.companyId!,
      req.customerId!,
      dto,
    );
  }

  @Get('orders/:id')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
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

  @Post('orders/:id/reorder')
  @HttpCode(201)
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  reorderOrder(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PortalReorderDto,
  ) {
    return this.portalOrdersService.reorderOrder(
      req.companyId!,
      req.customerId!,
      id,
      dto,
    );
  }

  @Get('deliveries')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  listDeliveries(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalOrdersService.listDeliveries(
      req.companyId!,
      req.customerId!,
      {
        q,
        status,
        orderId,
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor,
      },
    );
  }

  @Get('deliveries/:id')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  getDelivery(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalOrdersService.getDelivery(
      req.companyId!,
      req.customerId!,
      id,
    );
  }

  @Get('finance/open-items')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('finance')
  listOpenItems(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalOrdersService.listOpenItems(
      req.companyId!,
      req.customerId!,
      {
        q,
        status,
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor,
      },
    );
  }

  @Get('finance/open-items/:id')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('finance')
  getOpenItem(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalOrdersService.getOpenItem(
      req.companyId!,
      req.customerId!,
      id,
    );
  }

  @Get('finance/credit')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('finance')
  getCredit(@Req() req: CustomerPortalRequest) {
    return this.portalOrdersService.getCredit(
      req.companyId!,
      req.customerId!,
    );
  }

  @Get('claims')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  listClaims(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalClaimsService.list(req.companyId!, req.customerId!, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('claims/:id')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  getClaim(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalClaimsService.get(
      req.companyId!,
      req.customerId!,
      id,
    );
  }

  @Post('claims')
  @HttpCode(201)
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  createClaim(
    @Req() req: CustomerPortalRequest,
    @Body() dto: PortalCreateClaimDto,
  ) {
    return this.portalClaimsService.create(
      req.companyId!,
      req.customerId!,
      req.user!.id,
      dto,
    );
  }

  @Get('documents')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('documents')
  listDocuments(
    @Req() req: CustomerPortalRequest,
    @Query('q') q?: string,
    @Query('linkType') linkType?: string,
    @Query('linkId') linkId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.documentsService.listForCustomer(
      req.companyId!,
      req.customerId!,
      {
        q,
        linkType,
        linkId,
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor,
      },
    );
  }

  @Post('documents')
  @HttpCode(201)
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }),
  )
  uploadDocument(
    @Req() req: CustomerPortalRequest,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    @Body() body: Record<string, string>,
  ) {
    return this.documentsService.createFromPortalUpload(
      req.companyId!,
      req.customerId!,
      req.user!.id,
      file,
      {
        title: body.title,
        linkType: (body.linkType as DocLinkType) || DocLinkType.CLAIM,
        linkId: body.linkId,
      },
    );
  }

  @Get('documents/:id/download')
  @UseGuards(CustomerPortalSessionGuard, CustomerPortalModuleGuard)
  @RequireModule('documents')
  downloadDocument(
    @Req() req: CustomerPortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.getDownloadForCustomer(
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
