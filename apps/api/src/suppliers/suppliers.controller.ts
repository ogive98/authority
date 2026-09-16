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
  CreateSupplierContactDto,
  CreateSupplierDto,
  SetSupplierHoldDto,
  UpdateSupplierDto,
} from './suppliers.dto';
import { Supplier360Service } from './supplier-360.service';
import { SuppliersService } from './suppliers.service';

@Controller('api/v1/suppliers')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly supplier360: Supplier360Service,
  ) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.suppliersRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.suppliersService.list(tenancy.companyId, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get(':id/summary')
  @RequirePermission(PERMISSION_KEYS.suppliersRead)
  summary(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplier360.summary(tenancy.companyId, id);
  }

  @Get(':id/timeline')
  @RequirePermission(PERMISSION_KEYS.suppliersRead)
  timeline(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.supplier360.timeline(tenancy.companyId, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.suppliersRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.suppliersService.get(tenancy.companyId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.suppliersWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliersService.create(tenancy.companyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_KEYS.suppliersWrite)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(tenancy.companyId, id, dto);
  }

  @Post(':id/hold')
  @RequirePermission(PERMISSION_KEYS.suppliersHold)
  setHold(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSupplierHoldDto,
  ) {
    return this.suppliersService.setHold(tenancy.companyId, id, dto);
  }

  @Post(':id/contacts')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.suppliersWrite)
  addContact(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupplierContactDto,
  ) {
    return this.suppliersService.addContact(tenancy.companyId, id, dto);
  }
}
