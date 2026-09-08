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
import { CreateTaxRateDto, PatchTaxRateDto } from './tax.dto';
import { TaxService } from './tax.service';

@Controller('api/v1/tax')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('codes')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listCodes(@CurrentTenancy() tenancy: TenancyContext) {
    return this.taxService.listCodes(tenancy.companyId, { activeOnly: true });
  }

  @Get('rates')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listRates(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('asOf') asOf?: string,
    @Query('taxCodeId') taxCodeId?: string,
  ) {
    return this.taxService.listRates(tenancy.companyId, { asOf, taxCodeId });
  }

  @Post('rates')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  createRate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.taxService.createRate(tenancy.companyId, dto);
  }

  @Patch('rates/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  patchRate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchTaxRateDto,
  ) {
    return this.taxService.patchRate(tenancy.companyId, id, dto);
  }
}
