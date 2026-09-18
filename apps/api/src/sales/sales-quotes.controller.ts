import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { IamUser } from '@prisma/client';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { SessionGuard } from '../identity/session.guard';
import { CurrentUser } from '../identity/identity.decorators';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  CreateSalesQuoteDto,
  UpdateSalesQuoteDto,
} from './sales-quotes.dto';
import { SalesQuotesService } from './sales-quotes.service';
import { QuotePdfService } from './quote-pdf.service';

@Controller('api/v1/sales/quotes')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('sales')
export class SalesQuotesController {
  constructor(
    private readonly quotes: SalesQuotesService,
    private readonly quotePdf: QuotePdfService,
  ) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.salesRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.quotes.list(tenancy.companyId, {
      q,
      status,
      customerId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  /** D318 — HTML→PDF stream + persist Documents (link SAL_QUOTE). */
  @Get(':id/pdf')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  async getPdf(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.quotePdf.generateAndPersist(
      tenancy.companyId,
      user.id,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('X-Authority-Document-Id', result.documentId);
    return new StreamableFile(result.buffer);
  }

  /** D318b — publish quote PDF to customer portal documents. */
  @Post(':id/publish-portal')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  publishPortal(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotePdf.publishToPortal(tenancy.companyId, user.id, id);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotes.get(tenancy.companyId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateSalesQuoteDto,
  ) {
    return this.quotes.create(tenancy.companyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesQuoteDto,
  ) {
    return this.quotes.update(tenancy.companyId, id, dto);
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  send(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotes.send(tenancy.companyId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  cancel(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotes.cancel(tenancy.companyId, id);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  convert(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotes.convert(tenancy.companyId, id);
  }
}
