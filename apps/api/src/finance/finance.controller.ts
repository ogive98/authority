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
import { AllocateOpenItemDto, CreateOpenItemDto } from './finance.dto';
import { FinanceService } from './finance.service';

@Controller('api/v1/finance')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('open-items')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.financeService.list(tenancy.companyId, {
      q,
      status,
      customerId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('open-items/:id')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeService.get(tenancy.companyId, id);
  }

  @Get('credit/:customerId')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  credit(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.financeService.creditSnapshot(tenancy.companyId, customerId);
  }

  @Post('open-items')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateOpenItemDto,
  ) {
    return this.financeService.create(tenancy.companyId, dto);
  }

  @Post('open-items/:id/allocate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  allocate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateOpenItemDto,
  ) {
    return this.financeService.allocate(tenancy.companyId, id, dto);
  }
}
