import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { LabelsService } from './labels.service';
import { CreateTemplateDto, RenderLabelDto } from './labels.dto';

@Controller('api/v1/labels')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get('templates')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listTemplates(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.labelsService.listTemplates(tenancy.companyId);
  }

  @Post('templates')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.labelsService.createTemplate(tenancy.companyId, dto);
  }

  @Post('render')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async renderLabel(
    @Body() dto: RenderLabelDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.labelsService.renderLabel(tenancy.companyId, dto);
  }

  @Get('logs')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.qualityCheck)
  async listLogs(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.labelsService.listLogs(tenancy.companyId);
  }
}
