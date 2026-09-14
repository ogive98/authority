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
  CreateWaInboxDraftDto,
  DismissWaInboxDto,
  MatchWaInboxDto,
} from './wa-inbox.dto';
import { WaInboxService } from './wa-inbox.service';

@Controller('api/v1/sales/wa-inbox')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('sales')
export class WaInboxController {
  constructor(private readonly waInbox: WaInboxService) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.salesRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.waInbox.list(tenancy.companyId, {
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get(':id/suggest-lines')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  suggestLines(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.waInbox.suggestLines(tenancy.companyId, id);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.salesRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.waInbox.get(tenancy.companyId, id);
  }

  @Patch(':id/match')
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  match(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MatchWaInboxDto,
  ) {
    return this.waInbox.match(tenancy.companyId, id, dto);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  dismiss(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissWaInboxDto,
  ) {
    return this.waInbox.dismiss(tenancy.companyId, id, dto);
  }

  @Post(':id/draft-order')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.salesWrite)
  createDraft(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWaInboxDraftDto,
  ) {
    return this.waInbox.createDraft(tenancy.companyId, id, dto);
  }
}
