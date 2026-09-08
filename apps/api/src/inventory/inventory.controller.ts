import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
  AdjustLotDto,
  AdjustStockDto,
  CreateLotDto,
  CreateWarehouseDto,
  PatchLotStatusDto,
  ReleaseStockDto,
  ReserveStockDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('api/v1/inventory')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listWarehouses(@CurrentTenancy() tenancy: TenancyContext) {
    return this.inventoryService.listWarehouses(tenancy.companyId);
  }

  @Post('warehouses')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  createWarehouse(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventoryService.createWarehouse(tenancy.companyId, dto);
  }

  @Get('balances')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listBalances(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listBalances(tenancy.companyId, {
      q,
      warehouseId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('lots')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listLots(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listLots(tenancy.companyId, {
      q,
      warehouseId,
      productId,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('lots')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  createLot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateLotDto,
  ) {
    return this.inventoryService.createLot(tenancy.companyId, dto);
  }

  @Post('lots/adjust')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  adjustLot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: AdjustLotDto,
  ) {
    return this.inventoryService.adjustLot(tenancy.companyId, dto);
  }

  @Post('lots/:lotId/status')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  patchLotStatus(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('lotId') lotId: string,
    @Body() dto: PatchLotStatusDto,
  ) {
    return this.inventoryService.patchLotStatus(
      tenancy.companyId,
      lotId,
      dto,
    );
  }

  @Get('movements')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listMovements(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('balanceId') balanceId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listMovements(tenancy.companyId, {
      balanceId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('adjust')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  adjust(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjust(tenancy.companyId, dto);
  }

  @Post('reserve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryReserve)
  reserve(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: ReserveStockDto,
  ) {
    return this.inventoryService.reserve(tenancy.companyId, dto);
  }

  @Post('release')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryReserve)
  release(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: ReleaseStockDto,
  ) {
    return this.inventoryService.release(tenancy.companyId, dto);
  }
}
