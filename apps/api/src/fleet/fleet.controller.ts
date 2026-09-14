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
import { CreateAssignmentDto, CreateVehicleDto, CreateVehicleLogDto, UpdateVehicleDto } from './fleet.dto';
import { FleetService } from './fleet.service';

@Controller('api/v1/fleet')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('vehicles')
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  listVehicles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.fleetService.listVehicles(tenancy.companyId, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('vehicles/:id')
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  getVehicle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fleetService.getVehicle(tenancy.companyId, id);
  }

  @Get('vehicles/:id/logs')
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  listVehicleLogs(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.fleetService.listVehicleLogs(tenancy.companyId, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('vehicles/:id/logs')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  createVehicleLog(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleLogDto,
  ) {
    return this.fleetService.createVehicleLog(tenancy.companyId, id, dto);
  }

  @Post('vehicles')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  createVehicle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.fleetService.createVehicle(tenancy.companyId, dto);
  }

  @Patch('vehicles/:id')
  @RequirePermission(PERMISSION_KEYS.fleetManage)
  updateVehicle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.fleetService.updateVehicle(tenancy.companyId, id, dto);
  }

  @Get('assignments')
  @RequirePermission(PERMISSION_KEYS.fleetAssign)
  listAssignments(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('roundId') roundId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('includeCancelled') includeCancelledRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const includeCancelled =
      includeCancelledRaw === '1' ||
      includeCancelledRaw === 'true' ||
      includeCancelledRaw === 'yes';
    return this.fleetService.listAssignments(tenancy.companyId, {
      roundId,
      vehicleId,
      includeCancelled,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('rounds/:roundId/assign-hints')
  @RequirePermission(PERMISSION_KEYS.fleetAssign)
  assignHints(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('roundId', ParseUUIDPipe) roundId: string,
  ) {
    return this.fleetService.getAssignHints(tenancy.companyId, roundId);
  }

  @Post('assignments')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.fleetAssign)
  createAssignment(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.fleetService.createAssignment(tenancy.companyId, dto);
  }

  @Post('assignments/:id/cancel')
  @RequirePermission(PERMISSION_KEYS.fleetAssign)
  cancelAssignment(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fleetService.cancelAssignment(tenancy.companyId, id);
  }

  @Post('assignments/:id/copy-driver')
  @RequirePermission(PERMISSION_KEYS.fleetAssign)
  copyDriver(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fleetService.copyDriverToRound(tenancy.companyId, id);
  }
}
