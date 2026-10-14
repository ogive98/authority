import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { TraceabilityService } from './traceability.service';
import { CreateLotDto, CreateRecallDto, LinkLotsDto } from './traceability.dto';

@Controller('api/v1/traceability')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('traceability')
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  @Get('lots')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listLots(
    @Query('productId') productId: string | undefined,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.listLots(tenancy.companyId, productId);
  }

  @Post('lots')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createLot(
    @Body() dto: CreateLotDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.createLot(tenancy.companyId, dto);
  }

  @Get('lots/:id/tree')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async getLotTree(
    @Param('id') id: string,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.getLotTree(tenancy.companyId, id);
  }

  @Post('links')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async linkLots(
    @Body() dto: LinkLotsDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.linkLots(tenancy.companyId, dto);
  }

  @Get('recalls')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityRelease)
  async listRecalls(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.traceabilityService.listRecalls(tenancy.companyId);
  }

  @Post('recalls')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityRelease)
  async createRecall(
    @Body() dto: CreateRecallDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.createRecall(tenancy.companyId, dto);
  }

  @Post('recalls/:id/complete')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityRelease)
  async completeRecall(
    @Param('id') id: string,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.traceabilityService.completeRecall(tenancy.companyId, id);
  }
}
