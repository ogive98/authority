import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import {
  AssignDriverDto,
  CreateShipmentDto,
  FailShipmentDto,
} from './delivery.dto';
import { DeliveryService } from './delivery.service';

@Controller('api/v1/delivery')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('shipments')
  @RequirePermission(PERMISSION_KEYS.deliveryRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.deliveryService.list(tenancy.companyId, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('eligible-orders')
  @RequirePermission(PERMISSION_KEYS.deliveryRead)
  eligible(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.deliveryService.listEligibleOrders(tenancy.companyId, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get('shipments/:id')
  @RequirePermission(PERMISSION_KEYS.deliveryRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveryService.get(tenancy.companyId, id);
  }

  @Post('shipments')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.deliveryPrepare)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.deliveryService.create(tenancy.companyId, dto);
  }

  @Post('shipments/:id/assign')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.deliveryPrepare)
  assign(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.deliveryService.assign(tenancy.companyId, id, dto);
  }

  @Post('shipments/:id/dispatch')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.deliveryComplete)
  dispatch(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveryService.dispatch(tenancy.companyId, id);
  }

  @Post('shipments/:id/complete')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.deliveryComplete)
  complete(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveryService.complete(tenancy.companyId, id);
  }

  @Post('shipments/:id/fail')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.deliveryFail)
  fail(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailShipmentDto,
  ) {
    return this.deliveryService.fail(tenancy.companyId, id, dto);
  }
}
