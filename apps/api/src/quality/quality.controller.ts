import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { QualityService } from './quality.service';
import { CloseNcrDto, CreateCheckDto, CreateNcrDto, HoldLotDto, ReleaseLotDto } from './quality.dto';

@Controller('api/v1/quality')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('checks')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listChecks(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.qualityService.listChecks(tenancy.companyId);
  }

  @Post('checks')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createCheck(
    @Body() dto: CreateCheckDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.qualityService.createCheck(tenancy.companyId, dto);
  }

  @Get('ncrs')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityNcrWrite)
  async listNcrs(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.qualityService.listNcrs(tenancy.companyId);
  }

  @Post('ncrs')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityNcrWrite)
  async createNcr(
    @Body() dto: CreateNcrDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.qualityService.createNcr(tenancy.companyId, dto);
  }

  @Post('ncrs/:id/close')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityNcrWrite)
  async closeNcr(
    @Param('id') id: string,
    @Body() dto: CloseNcrDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.qualityService.closeNcr(tenancy.companyId, id, dto.disposition, dto.closedBy);
  }

  @Post('lots/hold')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityRelease)
  async holdLot(
    @Body() dto: HoldLotDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.qualityService.holdLot(tenancy.companyId, dto.lotId, dto.reason, dto.heldBy);
  }

  @Post('lots/release')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityRelease)
  async releaseLot(
    @Body() dto: ReleaseLotDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.qualityService.releaseLot(tenancy.companyId, dto.lotId, dto.releasedBy);
  }
}
