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
import {
  CreateAssetDto,
  CreateWoDto,
  MarkAssetStatusDto,
  UpdateAssetDto,
} from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('api/v1/maintenance')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('assets')
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  listAssets(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('preventiveDue') preventiveDueRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const preventiveDue =
      preventiveDueRaw === '1' ||
      preventiveDueRaw === 'true' ||
      preventiveDueRaw === 'yes';
    return this.maintenanceService.listAssets(tenancy.companyId, {
      q,
      status,
      preventiveDue,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('assets/:id')
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  getAsset(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintenanceService.getAsset(tenancy.companyId, id);
  }

  @Post('assets')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  createAsset(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateAssetDto,
  ) {
    return this.maintenanceService.createAsset(tenancy.companyId, dto);
  }

  @Patch('assets/:id')
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  updateAsset(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.maintenanceService.updateAsset(tenancy.companyId, id, dto);
  }

  @Post('assets/:id/down')
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  markDown(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAssetStatusDto,
  ) {
    return this.maintenanceService.markDown(
      tenancy.companyId,
      id,
      dto.version,
    );
  }

  @Post('assets/:id/up')
  @RequirePermission(PERMISSION_KEYS.maintenanceAsset)
  markUp(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAssetStatusDto,
  ) {
    return this.maintenanceService.markUp(tenancy.companyId, id, dto.version);
  }

  @Get('maint-wo')
  @RequirePermission(PERMISSION_KEYS.maintenanceWo)
  listWorkOrders(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('assetId') assetId?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.maintenanceService.listWorkOrders(tenancy.companyId, {
      assetId,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('maint-wo')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.maintenanceWo)
  createWorkOrder(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateWoDto,
  ) {
    return this.maintenanceService.createWorkOrder(tenancy.companyId, dto);
  }

  @Post('maint-wo/:id/complete')
  @RequirePermission(PERMISSION_KEYS.maintenanceWo)
  completeWorkOrder(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintenanceService.completeWorkOrder(tenancy.companyId, id);
  }
}
