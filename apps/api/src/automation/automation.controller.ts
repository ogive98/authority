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
import type { IamUser } from '@prisma/client';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  CreateAtmProfileDto,
  ReviewAtmRunDto,
  RunAtmProfileDto,
  UpdateAtmProfileDto,
} from './automation.dto';
import { AutomationService } from './automation.service';

@Controller('api/v1/automation')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('catalog')
  @RequirePermission(PERMISSION_KEYS.automationRead)
  catalog() {
    return this.automation.catalog();
  }

  @Get('profiles')
  @RequirePermission(PERMISSION_KEYS.automationRead)
  listProfiles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('enabled') enabledRaw?: string,
  ) {
    const enabled =
      enabledRaw === '1' || enabledRaw === 'true'
        ? true
        : enabledRaw === '0' || enabledRaw === 'false'
          ? false
          : undefined;
    return this.automation.listProfiles(tenancy.companyId, { q, enabled });
  }

  @Get('profiles/:id')
  @RequirePermission(PERMISSION_KEYS.automationRead)
  getProfile(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automation.getProfile(tenancy.companyId, id);
  }

  @Post('profiles')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.automationWrite)
  createProfile(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateAtmProfileDto,
  ) {
    return this.automation.createProfile(tenancy.companyId, dto);
  }

  @Patch('profiles/:id')
  @RequirePermission(PERMISSION_KEYS.automationWrite)
  updateProfile(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAtmProfileDto,
  ) {
    return this.automation.updateProfile(tenancy.companyId, id, dto);
  }

  @Post('profiles/:id/run')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.automationWrite)
  runProfile(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunAtmProfileDto,
  ) {
    return this.automation.runProfile(tenancy.companyId, id, user.id, dto);
  }

  @Get('runs')
  @RequirePermission(PERMISSION_KEYS.automationRead)
  listRuns(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('profileId') profileId?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.automation.listRuns(tenancy.companyId, {
      profileId,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get('runs/:id')
  @RequirePermission(PERMISSION_KEYS.automationRead)
  getRun(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automation.getRun(tenancy.companyId, id);
  }

  @Post('runs/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.automationApprove)
  approveRun(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAtmRunDto,
  ) {
    return this.automation.approveRun(tenancy.companyId, id, user.id, dto);
  }

  @Post('runs/:id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.automationApprove)
  rejectRun(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAtmRunDto,
  ) {
    return this.automation.rejectRun(tenancy.companyId, id, user.id, dto);
  }
}
