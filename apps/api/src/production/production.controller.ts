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
  CreateWorkOrderDto,
  DeclareWorkOrderDto,
} from './production.dto';
import { ProductionService } from './production.service';

@Controller('api/v1/production')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('work-orders')
  @RequirePermission(PERMISSION_KEYS.productionRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.production.list(tenancy.companyId, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('work-orders/:id')
  @RequirePermission(PERMISSION_KEYS.productionRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.production.get(tenancy.companyId, id);
  }

  @Post('work-orders')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.productionWoWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.production.create(tenancy.companyId, dto);
  }

  @Post('work-orders/:id/release')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.productionWoWrite)
  release(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.production.release(tenancy.companyId, id);
  }

  @Post('work-orders/:id/declare')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.productionDeclare)
  declare(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclareWorkOrderDto,
  ) {
    return this.production.declare(tenancy.companyId, id, dto);
  }
}
