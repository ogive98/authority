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
  Put,
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
  CreateAddressDto,
  CreateContactDto,
  CreateCustomerDto,
  CreatePortalMembershipDto,
  CreateZoneDto,
  SetCreditDto,
  UnblockCustomerDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdateCustomerDto,
  UpdatePortalMembershipDto,
  UpsertCustomerFiscalOverrideDto,
  UpsertCustomerFiscalProfileDto,
  UpsertCustomerPriceDto,
} from './customers.dto';
import { Customer360Service } from './customer-360.service';
import { CustomerFiscalService } from './customer-fiscal.service';
import { CustomersService } from './customers.service';
import { PortalMembershipService } from './portal-membership.service';

@Controller('api/v1/customers')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customer360: Customer360Service,
    private readonly portalMemberships: PortalMembershipService,
    private readonly customerFiscal: CustomerFiscalService,
  ) {}

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

  @Get(':id/summary')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  summary(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customer360.summary(tenancy.companyId, id);
  }

  @Get(':id/timeline')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  timeline(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.customer360.timeline(tenancy.companyId, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get(':id/documents')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  documents(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.customer360.documents(tenancy.companyId, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get(':id/communications')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  communications(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.customer360.communications(tenancy.companyId, id, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get(':id/fiscal')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  getFiscal(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerFiscal.get(tenancy.companyId, id);
  }

  @Put(':id/fiscal')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  upsertFiscalProfile(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCustomerFiscalProfileDto,
  ) {
    return this.customerFiscal.upsertProfile(tenancy.companyId, id, dto);
  }

  @Put(':id/fiscal/overrides')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  upsertFiscalOverride(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCustomerFiscalOverrideDto,
  ) {
    return this.customerFiscal.upsertOverride(tenancy.companyId, id, dto);
  }

  @Delete(':id/fiscal/overrides/:taxCodeId')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  removeFiscalOverride(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taxCodeId', ParseUUIDPipe) taxCodeId: string,
  ) {
    return this.customerFiscal.removeOverride(
      tenancy.companyId,
      id,
      taxCodeId,
    );
  }

  @Get(':id/portal-memberships')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  listPortalMemberships(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalMemberships.list(tenancy.companyId, id);
  }

  @Get(':id/portal-linkable-users')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  listPortalLinkableUsers(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.portalMemberships.listLinkableUsers(tenancy.companyId, id, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post(':id/portal-memberships')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  createPortalMembership(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePortalMembershipDto,
  ) {
    return this.portalMemberships.create(tenancy.companyId, id, dto);
  }

  @Patch(':id/portal-memberships/:membershipId')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  updatePortalMembership(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdatePortalMembershipDto,
  ) {
    return this.portalMemberships.update(
      tenancy.companyId,
      id,
      membershipId,
      dto,
    );
  }

  @Get(':id/addresses')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  listAddresses(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.listAddresses(tenancy.companyId, id);
  }

  @Post(':id/addresses')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  addAddress(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.customersService.addAddress(tenancy.companyId, id, dto);
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  updateAddress(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customersService.updateAddress(
      tenancy.companyId,
      id,
      addressId,
      dto,
    );
  }

  @Delete(':id/addresses/:addressId')
  @HttpCode(204)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  async removeAddress(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    await this.customersService.removeAddress(
      tenancy.companyId,
      id,
      addressId,
    );
  }

  @Get(':id/prices')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  listPrices(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.listPrices(tenancy.companyId, id);
  }

  @Get(':id/suggest-price')
  @RequirePermission(PERMISSION_KEYS.customersRead)
  suggestPrice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.customersService.suggestUnitPrice(
      tenancy.companyId,
      id,
      productId,
    );
  }

  @Put(':id/prices')
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  upsertPrice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCustomerPriceDto,
  ) {
    return this.customersService.upsertPrice(tenancy.companyId, id, dto);
  }

  @Delete(':id/prices/:productId')
  @HttpCode(204)
  @RequirePermission(PERMISSION_KEYS.customersWrite)
  async removePrice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.customersService.removePrice(
      tenancy.companyId,
      id,
      productId,
    );
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
