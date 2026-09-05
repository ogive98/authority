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
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './sales.dto';
import { SalesService } from './sales.service';

@Controller('api/v1/sales')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('orders')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.salesService.list(tenancy.companyId, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('orders/:id')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.get(tenancy.companyId, id);
  }

  @Post('orders')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.salesService.create(tenancy.companyId, dto);
  }

  @Patch('orders/:id')
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.salesService.update(tenancy.companyId, id, dto);
  }

  @Post('orders/:id/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesConfirm)
  confirm(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.confirm(tenancy.companyId, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  cancel(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.cancel(tenancy.companyId, id);
  }
}
