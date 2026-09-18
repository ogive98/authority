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
  UseGuards,
} from '@nestjs/common';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { CreateReturnsRmaDto, UpdateReturnsRmaDto } from './returns.dto';
import { ReturnsService } from './returns.service';

/** D317b — Returns is a Sales submodule (not a standalone module). */
@Controller('api/v1/sales/returns')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('sales')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get('rmas')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('shipmentId') shipmentId?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.returns.list(tenancy.companyId, {
      q,
      status,
      shipmentId,
      customerId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('rmas/:id')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.get(tenancy.companyId, id);
  }

  @Post('rmas')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateReturnsRmaDto,
  ) {
    return this.returns.create(tenancy.companyId, dto);
  }

  @Patch('rmas/:id')
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnsRmaDto,
  ) {
    return this.returns.update(tenancy.companyId, id, dto);
  }

  @Post('rmas/:id/post')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  post(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.post(tenancy.companyId, id);
  }

  @Post('rmas/:id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  cancel(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.cancel(tenancy.companyId, id);
  }

  @Post('rmas/:id/create-credit-note')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  createCreditNote(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.createCreditNote(tenancy.companyId, id);
  }
}
