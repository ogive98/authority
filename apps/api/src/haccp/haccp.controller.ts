import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { HaccpService } from './haccp.service';
import { CreateAuditDto, CreateCcpDto, CreateRecordDto } from './haccp.dto';

@Controller('api/v1/haccp')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('haccp')
export class HaccpController {
  constructor(private readonly haccpService: HaccpService) {}

  @Get('ccps')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listCcps(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.haccpService.listCcps(tenancy.companyId);
  }

  @Post('ccps')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createCcp(
    @Body() dto: CreateCcpDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.haccpService.createCcp(tenancy.companyId, dto);
  }

  @Get('records')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listRecords(
    @Query('ccpId') ccpId: string | undefined,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.haccpService.listRecords(tenancy.companyId, ccpId);
  }

  @Post('records')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createRecord(
    @Body() dto: CreateRecordDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.haccpService.createRecord(tenancy.companyId, dto);
  }

  @Get('audits')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listAudits(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.haccpService.listAudits(tenancy.companyId);
  }

  @Post('audits')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createAudit(
    @Body() dto: CreateAuditDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.haccpService.createAudit(tenancy.companyId, dto);
  }
}
