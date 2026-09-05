import {
  Body,
  Controller,
  Delete,
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
  BlockCustomerDto,
  CreateContactDto,
  CreateCustomerDto,
  CreateZoneDto,
  SetCreditDto,
  UnblockCustomerDto,
  UpdateContactDto,
  UpdateCustomerDto,
} from './customers.dto';
import { CustomersService } from './customers.service';

@Controller('api/v1/customers')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.customersRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.customersService.list(tenancy.companyId, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('zones')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  listZones(@CurrentTenancy() tenancy: TenancyContext) {
    return this.customersService.listZones(tenancy.companyId);
  }

  @Post('zones')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  createZone(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateZoneDto,
  ) {
    return this.customersService.createZone(tenancy.companyId, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.get(tenancy.companyId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(tenancy.companyId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(tenancy.companyId, id, dto);
  }

  @Patch(':id/credit')
  @RequirePermission(PERMISSION_KEYS.customersCreditSet)
  setCredit(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCreditDto,
  ) {
    return this.customersService.setCredit(tenancy.companyId, id, dto);
  }

  @Post(':id/block')
  @RequirePermission(PERMISSION_KEYS.customersBlock)
  block(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockCustomerDto,
  ) {
    return this.customersService.block(tenancy.companyId, id, dto);
  }

  @Post(':id/unblock')
  @RequirePermission(PERMISSION_KEYS.customersBlock)
  unblock(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnblockCustomerDto,
  ) {
    return this.customersService.unblock(tenancy.companyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  async remove(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.customersService.softDelete(tenancy.companyId, id);
  }

  @Post(':id/contacts')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  addContact(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.customersService.addContact(tenancy.companyId, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  updateContact(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.customersService.updateContact(
      tenancy.companyId,
      id,
      contactId,
      dto,
    );
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  async removeContact(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    await this.customersService.removeContact(
      tenancy.companyId,
      id,
      contactId,
    );
  }
}
